require("dotenv").config();

const express = require("express");
const path = require("node:path");
const { healthCheck, initDb, listAssessments, saveAssessment } = require("./db");

const app = express();
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "127.0.0.1";
const supabaseUrl = process.env.SUPABASE_URL || "https://xfrurdrgvkeopemzevtk.supabase.co";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_request, response) => {
  response.json({ ok: true, database: await healthCheck() });
});

app.get("/api/auth/config", (_request, response) => {
  response.json({
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl,
    supabaseAnonKey
  });
});

app.get("/api/auth/session", async (request, response, next) => {
  try {
    const user = await getSupabaseUser(bearerToken(request));
    response.json({ authenticated: Boolean(user), user });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assessments", requireAuth, async (request, response, next) => {
  try {
    const rows = await listAssessments(request.user.id, request.query.limit);
    response.json({ assessments: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/assessments", requireAuth, async (request, response, next) => {
  try {
    const saved = await saveAssessment(request.body, request.user);
    response.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

app.get(["/auth/callback", "/callback"], (_request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.use(express.static(__dirname));

app.use((error, _request, response, _next) => {
  const status = error.message.includes("not configured")
    ? 503
    : error.message.includes("required") ||
        error.message.includes("valid") ||
        error.message.includes("Password") ||
        error.message.includes("incorrect") ||
        error.message.includes("exists")
      ? 400
      : 500;
  response.status(status).json({ error: error.message });
});

async function requireAuth(request, response, next) {
  try {
    const user = await getSupabaseUser(bearerToken(request));
    if (!user) {
      response.status(401).json({ error: "Please sign in to continue." });
      return;
    }
    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
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

initDb()
  .then((database) => {
    app.listen(port, host, () => {
      const status = database.connected ? "with Supabase persistence" : "without database persistence";
      console.log(`Executive Presence app running at http://${host}:${port} ${status}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  });
