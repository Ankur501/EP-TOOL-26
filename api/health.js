const { handleError, healthCheck, sendJson } = require("./_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }
  try {
    sendJson(response, 200, { ok: true, database: await healthCheck() });
  } catch (error) {
    handleError(response, error);
  }
};
