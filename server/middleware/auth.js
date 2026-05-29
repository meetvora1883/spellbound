// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../../database');

function authenticateJWT(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if the user was kicked (owner action)
    const kickedUsers = req.app.get('kickedUsers');
    if (kickedUsers && kickedUsers.has(user.id)) {
      res.clearCookie('token', { path: '/' });
      return res.status(401).json({ error: 'Session terminated by admin' });
    }

    // Check if the Discord ID is banned
    if (db.isDiscordBanned(user.id)) {
      res.clearCookie('token', { path: '/' });
      return res.status(401).json({ error: 'Account banned' });
    }

    req.user = user;
    next();
  });
}

module.exports = { authenticateJWT };