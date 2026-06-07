const { handleError, requireUser, sendJson } = require("../_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }
  try {
    const user = await requireUser(request, response);
    if (!user) return;
    sendJson(response, 200, { authenticated: true, user });
  } catch (error) {
    handleError(response, error);
  }
};
