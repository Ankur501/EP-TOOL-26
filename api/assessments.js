const { ensureDb, handleError, listAssessments, requireUser, saveAssessment, sendJson } = require("./_shared");

module.exports = async function handler(request, response) {
  try {
    await ensureDb();
    const user = await requireUser(request, response);
    if (!user) return;

    if (request.method === "GET") {
      const limit = new URL(request.url, "http://localhost").searchParams.get("limit");
      sendJson(response, 200, { assessments: await listAssessments(user.id, limit) });
      return;
    }

    if (request.method === "POST") {
      sendJson(response, 201, await saveAssessment(request.body, user));
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    handleError(response, error);
  }
};
