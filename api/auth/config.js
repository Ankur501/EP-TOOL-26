const { sendJson, supabaseAnonKey, supabaseUrl } = require("../_shared");

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }
  sendJson(response, 200, {
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl,
    supabaseAnonKey
  });
};
