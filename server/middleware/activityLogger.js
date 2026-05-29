// server/middleware/activityLogger.js
const db = require('../../database');

function logActivity(action, details = null) {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function(body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id || 'system';
        const username = req.user?.username || 'System';
        const guildId = req.body?.guildId || req.query?.guildId || req.params?.guildId || req.params?.id;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (guildId) {
          db.addActivityLog(guildId, userId, username, action, details, ip);
        }
      }
      originalSend.call(this, body);
    };
    next();
  };
}

module.exports = { logActivity };