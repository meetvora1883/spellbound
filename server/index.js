// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');
const fs = require('fs');
const i18nextMiddleware = require('i18next-http-middleware');
const { logger } = require('../utils/logger');
const { i18n } = require('../utils/i18n');
const db = require('../database');
const authRoutes = require('./auth');
const { publicRouter, protectedRouter } = require('./api');
const { authenticateJWT } = require('./middleware/auth');
const { injectBot } = require('./middleware/botClient');
const forumApi = require('./forum-api');

function startServer(client) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: process.env.HTTP_EXTERNAL,
      credentials: true
    }
  });
  client.io = io;

  // Store for kicked users (Discord ID) so they cannot use old JWTs
  const kickedUsers = new Set();
  app.set('kickedUsers', kickedUsers);

  // ========== DYNAMIC FAVICON ENDPOINT ==========
  app.get('/favicon.ico', async (req, res) => {
    try {
      if (!client.user) return res.status(503).end();
      const avatarUrl = client.user.displayAvatarURL({ format: 'png', size: 64 });
      const response = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      res.set('Cache-Control', 'public, max-age=3600');
      res.set('Content-Type', 'image/png');
      res.send(buffer);
    } catch (err) {
      logger.error('Favicon fetch error:', err.message);
      res.status(500).end();
    }
  });

  // ========== COLORED REQUEST LOGGING MIDDLEWARE ==========
  app.use((req, res, next) => {
    const start = Date.now();
    const reqId = `req-${Math.random().toString(36).substring(2, 5)}`;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.on('finish', () => {
      const duration = Date.now() - start;
      let timeColor = chalk.green;
      if (duration >= 200 && duration < 500) timeColor = chalk.yellow;
      else if (duration >= 500) timeColor = chalk.red;
      console.log(
        chalk.gray(`[${new Date().toLocaleString()}] `) +
        chalk.magenta('(HTTP) ') +
        chalk.cyan(reqId) + ' ' +
        chalk.white(ip) + ' ' +
        chalk.yellow(req.method) + ' ' +
        chalk.white(req.originalUrl) + ' -+> ' +
        (res.statusCode >= 400 ? chalk.red(res.statusCode) : chalk.green(res.statusCode)) + ' in ' +
        timeColor(duration + 'ms')
      );
    });
    next();
  });

  // ========== MIDDLEWARE ==========
  app.use(cors({ origin: process.env.HTTP_EXTERNAL, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // i18n middleware
  app.use(i18nextMiddleware.handle(i18n));

  // ========== IP WHITELIST / BLACKLIST MIDDLEWARE ==========
  app.use((req, res, next) => {
    // 1. ALWAYS ALLOW these paths (even if IP is blacklisted)
    const allowedPaths = [
      '/ip-blocked',
      '/blocked',
      '/login.html',
      '/favicon.ico',
      '/api/translations',
      '/auth',
      '/api/log-error'
    ];

    if (allowedPaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    // 2. Get the real client IP
    let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.socket.remoteAddress || '127.0.0.1';
    ip = ip.replace(/^::ffff:/, '');

    // Always allow localhost
    const localhosts = ['127.0.0.1', '::1', '0.0.0.0'];
    if (localhosts.includes(ip)) return next();

    const db = require('../database');

    // 3️⃣ Blacklist check
    const blacklisted = db.db.prepare('SELECT * FROM ip_rules WHERE ip = ? AND type = ?').get(ip, 'blacklist');
    if (blacklisted) {
      return res.redirect(`/ip-blocked?ip=${encodeURIComponent(ip)}`);
    }

    // 4️⃣ Whitelist check (only if whitelist rules exist)
    const whitelistCount = db.db.prepare('SELECT COUNT(*) as cnt FROM ip_rules WHERE type = ?').get('whitelist');
    if (whitelistCount.cnt > 0) {
      const allowed = db.db.prepare('SELECT 1 FROM ip_rules WHERE ip = ? AND type = ?').get(ip, 'whitelist');
      if (!allowed) {
        return res.redirect(`/ip-blocked?ip=${encodeURIComponent(ip)}&reason=not_whitelisted`);
      }
    }

    next();
  });

  // Inject bot client
  app.use(injectBot(client));

  // Make io accessible in routes
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // ========== ROUTES ==========

  // Translation endpoint
  app.get('/api/translations', (req, res) => {
    const lng = req.query.lng || req.language || 'en';
    const hasResources = i18n.hasResourceBundle(lng, 'translation');
    if (!hasResources) {
      console.warn(`No translations found for language: ${lng}, falling back to English`);
      const resources = i18n.getResourceBundle('en', 'translation') || {};
      return res.json(resources);
    }
    const resources = i18n.getResourceBundle(lng, 'translation') || {};
    res.json(resources);
  });

  // Frontend error logging
  app.post('/api/log-error', (req, res) => {
    const { message, stack, url } = req.body;
    db.logError(message, stack, url, req.user?.id);
    res.json({ success: true });
  });

  // IP blocked page
  app.get('/ip-blocked', (req, res) => {
    const ip = req.query.ip || 'Unknown';
    const reasonQuery = req.query.reason || '';

    let blockedBy = 'System';
    let banDate = new Date().toLocaleDateString('en-GB');
    let banReason = reasonQuery === 'not_whitelisted'
      ? 'Your IP is not on the whitelist.'
      : 'Your IP has been blacklisted by an administrator.';

    if (!reasonQuery) {
      const rule = db.db.prepare('SELECT * FROM ip_rules WHERE ip = ? AND type = ?').get(ip, 'blacklist');
      if (rule) {
        blockedBy = rule.created_by || 'System';
        banDate = new Date(rule.created_at).toLocaleDateString('en-GB');
        banReason = rule.reason || banReason;
      }
    }

    let html = fs.readFileSync(path.join(__dirname, '../public/ip-blocked.html'), 'utf8');
    html = html.replace('{{ip}}', ip);
    html = html.replace('{{adminName}}', blockedBy);
    html = html.replace('{{reason}}', banReason);
    html = html.replace('{{banDate}}', banDate);
    res.send(html);
  });

  // Blocked user page (Discord ID ban)
  app.get('/blocked', (req, res) => {
    const discordId = req.query.discord_id;
    if (!discordId) return res.status(400).send('Missing Discord ID');

    const ban = db.db.prepare('SELECT * FROM banned_discord WHERE discord_id = ?').get(discordId);
    if (!ban) return res.status(404).send('No ban record found');

    let adminName = 'System';
    if (ban.banned_by) {
      const adminUser = db.db.prepare('SELECT username FROM web_users WHERE id = ?').get(ban.banned_by);
      if (adminUser) adminName = adminUser.username;
    }

    let html = fs.readFileSync(path.join(__dirname, '../public/blocked.html'), 'utf8');
    html = html.replace('{{adminName}}', adminName);
    html = html.replace('{{reason}}', ban.reason || 'Multi login with different IDs');
    html = html.replace('{{banDate}}', new Date(ban.banned_at).toLocaleDateString('en-GB'));
    html = html.replace('{{discordId}}', ban.discord_id);
    html = html.replace('{{username}}', ban.username || 'Unknown');
    res.send(html);
  });

  // Public status page
  app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/status.html'));
  });

  // Public routes (no authentication required)
  app.use('/auth', authRoutes);

  // Public API routes (no auth)
  app.use('/api', publicRouter);

  // Protected API routes (require JWT)
  app.use('/api', authenticateJWT, protectedRouter);

  // Forum API (protected)
  app.use('/api/forum', authenticateJWT, forumApi);

  // Serve static files from public folder
  const publicPath = path.join(__dirname, '../public');
  logger.info(`Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));

  // Root route
  app.get('/', (req, res) => {
    const token = req.cookies.token;
    if (token) {
      res.redirect('/dashboard.html');
    } else {
      res.sendFile(path.join(publicPath, 'login.html'));
    }
  });

  // ========== GLOBAL ERROR HANDLER ==========
  app.use((err, req, res, next) => {
    db.logError(err.message, err.stack, req.originalUrl, req.user?.id);
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  const PORT = process.env.HTTP_PORT || 3001;
  const HOST = process.env.HTTP_HOST || '0.0.0.0';
  server.listen(PORT, HOST, () => {
    logger.success(`Web panel running on http://${HOST}:${PORT}`);
  });

  return { app, server, io };
}

module.exports = { startServer };