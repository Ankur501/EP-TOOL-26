const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 7;

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

async function createUser({ displayName, email, password }) {
  if (!pool) throw new Error("Database is not configured.");
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(displayName || "").trim();
  if (!cleanName) throw new Error("Name is required.");
  if (!cleanEmail) throw new Error("A valid email is required.");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");

  const { hash, salt } = await hashPassword(password);
  const userId = crypto.randomUUID();
  try {
    const { rows } = await pool.query(
      `INSERT INTO ep_users (id, display_name, email, password_hash, password_salt)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, display_name, email`,
      [userId, cleanName, cleanEmail, hash, salt]
    );
    return rows[0];
  } catch (error) {
    if (error.code === "23505") throw new Error("An account already exists for that email.");
    throw error;
  }
}

async function loginUser({ email, password }) {
  if (!pool) throw new Error("Database is not configured.");
  const cleanEmail = normalizeEmail(email);
  const { rows } = await pool.query(
    `SELECT id, display_name, email, password_hash, password_salt
     FROM ep_users
     WHERE email = $1`,
    [cleanEmail]
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(password || "", user.password_salt, user.password_hash))) {
    throw new Error("Email or password is incorrect.");
  }
  return toPublicUser(user);
}

async function createSession(userId) {
  if (!pool) throw new Error("Database is not configured.");
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO ep_auth_sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, userId, tokenHash, expiresAt]
  );
  return { token, expiresAt };
}

async function getSessionUser(token) {
  if (!pool || !token) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.display_name, u.email
     FROM ep_auth_sessions s
     JOIN ep_users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

async function deleteSession(token) {
  if (!pool || !token) return;
  await pool.query("DELETE FROM ep_auth_sessions WHERE token_hash = $1", [hashToken(token)]);
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
         duration_seconds,
         overall_score,
         summary
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        user.id,
        metadata.participantName || user.displayName,
        metadata.voiceProfile || "unspecified",
        metadata.sourceKind || "upload",
        metadata.fileName || null,
        metadata.fileType || null,
        Number.isFinite(metadata.fileSize) ? metadata.fileSize : null,
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

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  return { hash, salt };
}

async function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from((await scrypt(password, salt, 64)).toString("hex"), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : "";
}

function toPublicUser(user) {
  return {
    id: user.id,
    displayName: user.display_name,
    email: user.email
  };
}

module.exports = {
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
  healthCheck,
  initDb,
  listAssessments,
  loginUser,
  saveAssessment
};
