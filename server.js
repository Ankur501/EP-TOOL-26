require("dotenv").config();

const express = require("express");
const path = require("node:path");
const {
  createSession,
  createUser,
  deleteSession,
  getSessionUser,
  healthCheck,
  initDb,
  listAssessments,
  loginUser,
  saveAssessment
} = require("./db");

const app = express();
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "127.0.0.1";
const cookieName = "ep_session";
const isProduction = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_request, response) => {
  response.json({ ok: true, database: await healthCheck() });
});

app.get("/api/auth/session", async (request, response) => {
  const user = await getSessionUser(readCookie(request, cookieName));
  response.json({ authenticated: Boolean(user), user });
});

app.post("/api/auth/signup", async (request, response, next) => {
  try {
    const user = await createUser(request.body);
    const session = await createSession(user.id);
    setSessionCookie(response, session);
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const user = await loginUser(request.body);
    const session = await createSession(user.id);
    setSessionCookie(response, session);
    response.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (request, response, next) => {
  try {
    await deleteSession(readCookie(request, cookieName));
    response.setHeader("Set-Cookie", clearSessionCookie());
    response.json({ ok: true });
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
    const user = await getSessionUser(readCookie(request, cookieName));
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

function readCookie(request, name) {
  const header = request.headers.cookie || "";
  const cookies = Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
  return cookies[name] || "";
}

function setSessionCookie(response, session) {
  const maxAge = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
  response.setHeader(
    "Set-Cookie",
    [
      `${cookieName}=${encodeURIComponent(session.token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
      isProduction ? "Secure" : ""
    ]
      .filter(Boolean)
      .join("; ")
  );
}

function clearSessionCookie() {
  return [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    isProduction ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
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
