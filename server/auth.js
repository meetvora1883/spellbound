// server/auth.js
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const db = require('../database');
const { createSession } = require('./sessionStore');
const { requireLocalAuth } = require('./middleware/localAuth');
const { recordWebSession } = require('../database');
const { notifyOwnerOfBan } = require('../systems/banNotifier');

const router = express.Router();

// Helper to verify JWT (used in /me)
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    logger.warn('No token in cookies');
    return res.status(401).json({ error: 'No token' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn('Invalid token:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// ==================== LOCAL ADMIN LOGIN (Step 1) ====================
router.post('/local-login', (req, res) => {
  const { username, password } = req.body;
  console.log(`Local login attempt - username: ${username}, password length: ${password ? password.length : 0}`);
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = db.validateWebUser(username, password);
  if (!user) {
    console.log('Local login failed: invalid credentials');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Check if account is locked
  if (user.status === 'locked') {
    console.log('Local login failed: account locked');
    return res.status(403).json({ error: 'Account locked. Contact the bot owner.' });
  }
  console.log('Local login successful for user:', user.username);
  // Create temporary token for local auth step (5 min expiry)
  const localToken = jwt.sign(
    { username: user.username, id: user.id, step: 'local' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  res.cookie('local_auth', localToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000,
    path: '/'
  });
  res.json({ success: true });
});

// ==================== DISCORD OAUTH START ====================
// Admin route (requires local auth)
router.get('/discord', requireLocalAuth, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.HTTP_EXTERNAL + '/auth/callback')}&response_type=code&scope=identify%20guilds&state=${state}`;
  res.redirect(url);
});

// Member route (no local auth)
router.get('/discord/member', (req, res) => {
  const state = 'member';
  const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.HTTP_EXTERNAL + '/auth/callback')}&response_type=code&scope=identify%20guilds&state=${state}`;
  res.redirect(url);
});

// ==================== DISCORD CALLBACK ====================
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('No code');

  try {
    // Exchange code for token
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.DISCORD_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.HTTP_EXTERNAL + '/auth/callback',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token } = tokenRes.data;

    // Get Discord user
    const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    const discordUser = userRes.data;

    // Collect IP and user agent for session
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // ========== BANNED DISCORD CHECK ==========
    if (db.isDiscordBanned(discordUser.id)) {
      res.clearCookie('local_auth', { path: '/' });
      return res.redirect(`/blocked?discord_id=${discordUser.id}`);
    }

    // Get user's guilds
    const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${access_token}` } });
    const userGuilds = guildsRes.data;

    // Bot's guilds from DB
    const botGuilds = db.getAllGuilds().map(g => g.guild_id);
    const botGuildsSet = new Set(botGuilds);

    // Create session with IP and browser info, pass io for auto-cleanup
    const sessionId = createSession(discordUser.id, {
      guilds: userGuilds,
      botGuilds: botGuilds,
      ip: ip,
      userAgent: userAgent,
      avatar: discordUser.avatar,
      username: discordUser.username  // for the live user list
    }, req.io);   // pass Socket.IO instance

    // Record web session for activity tracking
    recordWebSession(discordUser.id, discordUser.username, discordUser.avatar, ip, sessionId, userAgent);

    // ========== EMIT ONLINE EVENT ==========
    req.io.emit('webUserOnline', {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,   // hash, not URL – you can construct it later
      ip: ip,
      userAgent: userAgent,
      sessionId: sessionId,
      loginTime: Date.now()
    });

    // ========== ADMIN FLOW (password‑sharing detection) ==========
    let webUserId = null;
    if (state !== 'member') {
      const localToken = req.cookies.local_auth;
      if (localToken) {
        try {
          const decoded = jwt.verify(localToken, process.env.JWT_SECRET);
          if (decoded.step === 'local') {
            webUserId = decoded.id;
            const webUser = db.getWebUserById(webUserId);

            if (webUser) {
              if (webUser.discord_id && webUser.discord_id !== discordUser.id) {
                // ----- PASSWORD SHARING DETECTED -----
                const reason = `Password sharing: ${discordUser.username} (${discordUser.id}) used password of ${webUser.username}`;

                // Fetch original owner's Discord username
                let originalDiscordUsername = null;
                try {
                  const originalUser = await req.bot.users.fetch(webUser.discord_id);
                  originalDiscordUsername = originalUser.username;
                } catch (e) {
                  logger.warn('Could not fetch original Discord username:', e.message);
                }

                // Ban both Discord IDs
                db.banDiscordId(webUser.discord_id, originalDiscordUsername, reason, webUserId);
                db.banDiscordId(discordUser.id, discordUser.username, reason, webUserId);

                // Lock the web user account
                const newPass = crypto.randomBytes(16).toString('hex');
                db.updateWebUser(webUserId, { password: newPass });
                db.setWebUserStatus(webUserId, 'locked');

                // ---- KICK ACTIVE SESSIONS ----
                const sessionStore = require('./sessionStore');
                // For the original account, we need to find its sessions
                const origSessions = sessionStore.getSessionsForDiscordId(webUser.discord_id);
                origSessions.forEach(s => {
                  sessionStore.deleteSession(s.sessionId);
                  req.io.emit('webUserOffline', { sessionId: s.sessionId, userId: webUser.discord_id });
                });
                // For the new account
                const newSessions = sessionStore.getSessionsForDiscordId(discordUser.id);
                newSessions.forEach(s => {
                  sessionStore.deleteSession(s.sessionId);
                  req.io.emit('webUserOffline', { sessionId: s.sessionId, userId: discordUser.id });
                });

                // ---- NOTIFY OWNER ----
                notifyOwnerOfBan(req.bot, {
                  adminName: webUser.username,
                  reason,
                  discordId: discordUser.id,
                  discordUsername: discordUser.username,
                  webUserId,
                  webUsername: webUser.username,
                  originalDiscordId: webUser.discord_id,
                  originalDiscordUsername
                });

                // Clear cookies and redirect to blocked page for current Discord
                res.clearCookie('local_auth', { path: '/' });
                return res.redirect(`/blocked?discord_id=${discordUser.id}`);
              } else if (!webUser.discord_id) {
                // First time binding
                db.updateWebUser(webUserId, { discordId: discordUser.id });
              }
              // If discord_id already matches, do nothing (re‑login)
            }
          }
        } catch (e) {
          logger.warn('Local auth token invalid:', e.message);
        }
      }
      // Clear local auth cookie in any case
      res.clearCookie('local_auth', { path: '/' });
    }

    // Create main JWT payload
    const payload = {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      sessionId: sessionId,
      webUserId: webUserId
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    logger.info(`JWT set for user ${discordUser.id} (${discordUser.username}) with session ${sessionId}`);

    // Redirect based on flow
    if (state === 'member') {
      res.redirect(process.env.HTTP_EXTERNAL + '/member-dashboard.html');
    } else {
      res.redirect(process.env.HTTP_EXTERNAL + '/dashboard.html');
    }
  } catch (err) {
    logger.error('OAuth error:', err.response?.data || err.message);
    res.status(500).send('Authentication failed');
  }
});

// ==================== LOGOUT ====================
router.get('/logout', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.sessionId) {
        const sessionStore = require('./sessionStore');
        sessionStore.deleteSession(decoded.sessionId);
        req.io.emit('webUserOffline', { sessionId: decoded.sessionId, userId: decoded.id });
      }
    } catch (e) {
      // token invalid or expired – no session to delete
    }
  }
  res.clearCookie('token', { path: '/' });
  res.clearCookie('local_auth', { path: '/' });
  res.sendStatus(200);
});

// ==================== GET CURRENT USER ====================
router.get('/me', verifyToken, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    avatar: req.user.avatar,
    sessionId: req.user.sessionId,
    webUserId: req.user.webUserId
  });
});

// ==================== TEST COOKIE ====================
router.get('/test-cookie', (req, res) => {
  res.json({
    cookie: req.cookies.token ? req.cookies.token.substring(0, 50) + '...' : 'none',
    allCookies: req.cookies
  });
});

// ==================== DEBUG USERS ====================
router.get('/debug-users', (req, res) => {
  const users = db.getAllWebUsers();
  res.json(users);
});

module.exports = router;