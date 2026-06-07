const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
    })
  : null;

async function initDb() {
  if (!pool) return { configured: false, connected: false };
  const schema = await fs.readFile(path.join(__dirname, "database", "schema.sql"), "utf8");
  await pool.query(schema);
  return { configured: true, connected: true };
}

async function healthCheck() {
  if (!pool) return { configured: false, connected: false };
  try {
    await pool.query("SELECT 1");
    return { configured: true, connected: true };
  } catch (error) {
    return { configured: true, connected: false, error: error.message };
  }
}

async function listAssessments(userId, limit = 10) {
  if (!pool) throw new Error("Database is not configured.");
  const { rows } = await pool.query(
    `SELECT
       id,
       created_at,
       participant_name,
       voice_profile,
       source_kind,
       file_name,
       file_type,
       file_size_bytes,
       video_bucket,
       video_path,
       video_uploaded_at,
       duration_seconds,
       overall_score,
       summary
     FROM ep_assessments
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.min(Number(limit) || 10, 50)]
  );
  return rows;
}

async function saveAssessment(payload, user) {
  if (!pool) throw new Error("Database is not configured.");
  const client = await pool.connect();
  const id = crypto.randomUUID();
  const metadata = payload.metadata || {};
  const result = payload.result || {};
  const buckets = Array.isArray(result.buckets) ? result.buckets : [];
  const params = Array.isArray(result.params) ? result.params : [];

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO ep_assessments (
         id,
         user_id,
         participant_name,
         voice_profile,
         source_kind,
         file_name,
         file_type,
         file_size_bytes,
         video_bucket,
         video_path,
         video_uploaded_at,
         duration_seconds,
         overall_score,
         summary
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        user.id,
        metadata.participantName || user.displayName || user.email,
        metadata.voiceProfile || "unspecified",
        metadata.sourceKind || "upload",
        metadata.fileName || null,
        metadata.fileType || null,
        Number.isFinite(metadata.fileSize) ? metadata.fileSize : null,
        metadata.videoBucket || null,
        metadata.videoPath || null,
        metadata.videoPath ? new Date() : null,
        Number.isFinite(metadata.duration) ? metadata.duration : null,
        toScore(result.overall),
        String(result.summary || "")
      ]
    );

    for (const bucket of buckets) {
      await client.query(
        `INSERT INTO ep_bucket_scores (assessment_id, bucket_name, score, description)
         VALUES ($1, $2, $3, $4)`,
        [id, String(bucket[0]), toScore(bucket[1]), String(bucket[2] || "")]
      );
    }

    for (const param of params) {
      await client.query(
        `INSERT INTO ep_parameter_scores (
           assessment_id,
           parameter_id,
           bucket_name,
           parameter_name,
           score,
           metric,
           reference_text,
           coaching_text
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          String(param.id),
          String(param.bucket),
          String(param.name),
          toScore(param.score),
          String(param.metric || ""),
          String(param.reference || ""),
          String(param.coaching || "")
        ]
      );
    }

    await client.query("COMMIT");
    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function toScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("Scores must be numbers from 0 to 100.");
  }
  return Math.round(score);
}

module.exports = {
  healthCheck,
  initDb,
  listAssessments,
  saveAssessment
};
