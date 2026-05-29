// server/middleware/localAuth.js
const jwt = require('jsonwebtoken');

function requireLocalAuth(req, res, next) {
  const localToken = req.cookies.local_auth;
  if (!localToken) {
    return res.status(401).json({ error: 'Local authentication required' });
  }
  jwt.verify(localToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err || decoded.step !== 'local') {
      return res.status(403).json({ error: 'Invalid local auth' });
    }
    req.localUser = decoded;
    next();
  });
}

module.exports = { requireLocalAuth };