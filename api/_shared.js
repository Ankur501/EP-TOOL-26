const { healthCheck, initDb, listAssessments, saveAssessment } = require("../db");

const supabaseUrl = process.env.SUPABASE_URL || "https://xfrurdrgvkeopemzevtk.supabase.co";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcnVyZHJndmtlb3BlbXpldnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjU4MzgsImV4cCI6MjA5NjQwMTgzOH0.k7-Je57rFD5FnuNh9qNS4OxeSYuuodv-TNocYhUuvTs";

let initPromise;

function ensureDb() {
  initPromise ||= initDb();
  return initPromise;
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function bearerToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

async function getSupabaseUser(token) {
  if (!supabaseUrl || !supabaseAnonKey || !token) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return {
    id: user.id,
    email: user.email,
    displayName:
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Signed in user"
  };
}

async function requireUser(request, response) {
  const user = await getSupabaseUser(bearerToken(request));
  if (!user) {
    sendJson(response, 401, { error: "Please sign in to continue." });
    return null;
  }
  return user;
}

function handleError(response, error) {
  const status = error.message.includes("not configured") ? 503 : 500;
  sendJson(response, status, { error: error.message });
}

module.exports = {
  ensureDb,
  handleError,
  healthCheck,
  listAssessments,
  requireUser,
  saveAssessment,
  sendJson,
  supabaseAnonKey,
  supabaseUrl
};
