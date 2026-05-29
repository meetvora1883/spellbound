// server/middleware/botClient.js
function injectBot(client) {
  return (req, res, next) => {
    req.bot = client;
    next();
  };
}

module.exports = { injectBot };