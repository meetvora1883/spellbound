// server/api.js
const express = require('express');
const db = require('../database');
const { logger } = require('../utils/logger');
const WarboardManager = require('../systems/warboard/warboardManager');
const { parseDate } = require('../utils/dateUtils');
const { getSession } = require('./sessionStore');
const { logActivity } = require('./middleware/activityLogger');
const GreetingsManager = require('../systems/greetings/greetingsManager');
const { notifyAdminsOfSubmission } = require('../systems/might/mightNotifier');
const { EmbedBuilder } = require('discord.js');
const QuestionManager = require('../systems/question/questionManager');
const { buildResultsEmbed } = require('../commands/question');
const { DateTime } = require('luxon');
const { i18n } = require('../utils/i18n');

// Public router (no authentication required)
const publicRouter = express.Router();

const path = require('path');
const fs = require('fs');


async function updateSubmissionDMs(submissionId, status, adminId, reason, bot) {
  const dms = db.getSubmissionDMs(submissionId);
  for (const dm of dms) {
    try {
      const channel = await bot.channels.fetch(dm.channel_id);
      const message = await channel.messages.fetch(dm.message_id);
      const originalEmbed = message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(status === 'approved' ? 0x00FF00 : 0xFF0000)
        .setFooter({ text: `Status: ${status} by ${adminId}` })
        .setTimestamp();
      await message.edit({ embeds: [updatedEmbed], components: [] });
    } catch (err) {
      logger.error(`Failed to update DM for submission ${submissionId}: ${err.message}`);
    }
  }
  // Clean up records (optional, you can keep for history)
  db.deleteSubmissionDMs(submissionId);
}


// ========== PUBLIC: BOT INFO ==========
publicRouter.get('/bot/info', (req, res) => {
  try {
    if (!req.bot || !req.bot.user) {
      return res.status(503).json({ error: 'Bot not ready' });
    }
    const botUser = req.bot.user;
    res.json({
      username: botUser.username,
      avatar: botUser.displayAvatarURL({ size: 64, format: 'png' })
    });
  } catch (err) {
    logger.error('Bot info error:', err);
    res.status(500).json({ error: 'Failed to get bot info' });
  }   
});

// Public endpoint to get bot owner ID from environment
publicRouter.get('/owner/id', (req, res) => {
  res.json({ ownerId: process.env.OWNER_ID || null });
});


// Protected router (requires JWT)
const protectedRouter = express.Router();

// ========== USER GUILDS DETAILS ==========
protectedRouter.get('/user/guilds-details', (req, res) => {
  const session = getSession(req.user.sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or not found' });
  }
  const { guilds, botGuilds } = session.data;
  const botSet = new Set(botGuilds);

  // Get accessible guild IDs from admins table
  const accessibleIds = db.getUserAccessibleGuilds(req.user.id);
  const accessibleSet = accessibleIds === null ? null : new Set(accessibleIds);

  const result = guilds.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    hasBot: botSet.has(g.id),
    hasAccess: accessibleIds === null ? botSet.has(g.id) : (botSet.has(g.id) && accessibleSet.has(g.id))
  }));

  res.json(result);
});

// ========== GUILDS (manageable only) ==========
protectedRouter.get('/guilds', (req, res) => {
  const session = getSession(req.user.sessionId);
  if (!session) return res.status(401).json({ error: 'Session expired' });
  const { guilds, botGuilds } = session.data;
  const botSet = new Set(botGuilds);
  const manageable = guilds.filter(g => (g.permissions & 0x8) === 0x8 && botSet.has(g.id));
  res.json(manageable);
});

// ========== GUILD STATS ==========
protectedRouter.get('/guilds/:id/stats', (req, res) => {
  const guildId = req.params.id;
  const players = db.getPlayerCount ? db.getPlayerCount(guildId) : 0;
  const warboards = db.getWarboardCount ? db.getWarboardCount(guildId) : 0;
  const assignments = db.getAssignmentCount ? db.getAssignmentCount(guildId) : 0;
  const latest = db.getLatestWarDate ? db.getLatestWarDate(guildId) : null;
  res.json({ players, warboards, assignments, latestWar: latest });
});

// ========== PLAYERS ==========
protectedRouter.get('/players', (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const players = db.getPlayers ? db.getPlayers(guildId) : [];
  res.json(players);
});

protectedRouter.post('/players', logActivity('player.add', 'Added player'), (req, res) => {
  const { guildId, userId, username, might } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  if (!db.addPlayer) return res.status(500).json({ error: 'Database method not implemented' });
  db.addPlayer(guildId, userId, username, might);
  logger.info(`Player added via web: ${username} in guild ${guildId}`);
  req.io.emit('playersUpdated');
  res.json({ success: true }); // was sendStatus(200)
});

protectedRouter.put('/players/:id', logActivity('player.update', 'Updated player'), (req, res) => {
  const { guildId, username, might } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  if (!db.updatePlayer) return res.status(500).json({ error: 'Database method not implemented' });
  db.updatePlayer(req.params.id, guildId, username, might);
  logger.info(`Player updated via web: ID ${req.params.id}`);
  req.io.emit('playersUpdated');
  res.json({ success: true }); // was sendStatus(200)
});

protectedRouter.delete('/players/:id', logActivity('player.delete', 'Deleted player'), (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  if (!db.deletePlayer) return res.status(500).json({ error: 'Database method not implemented' });
  db.deletePlayer(req.params.id, guildId);
  logger.info(`Player deleted via web: ID ${req.params.id}`);
  req.io.emit('playersUpdated');
  res.json({ success: true }); // was sendStatus(200)
});

// ========== WARBOARDS ==========
protectedRouter.get('/warboards', (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const dates = db.getWarboardDates ? db.getWarboardDates(guildId) : [];
  const warboards = dates.map(date => ({ war_date: date }));
  res.json(warboards);
});

protectedRouter.post('/warboards', logActivity('warboard.create', 'Created warboard'), (req, res) => {
  const { guildId, date } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const parsed = parseDate(date);
  if (!parsed) return res.status(400).json({ error: 'Invalid date' });
  db.createWarboard(guildId, parsed);
  logger.info(`Warboard created via web: ${parsed} in guild ${guildId}`);
  req.io.emit('warboardsUpdated');
  res.json({ date: parsed });
});

protectedRouter.post('/warboards/copy', logActivity('warboard.copy', 'Copied warboard'), (req, res) => {
  const { guildId, source, target } = req.body;
  if (!guildId || !source || !target) return res.status(400).json({ error: 'Missing fields' });
  const sourceDate = parseDate(source);
  const targetDate = parseDate(target);
  if (!sourceDate || !targetDate) return res.status(400).json({ error: 'Invalid date' });
  db.createWarboard(guildId, targetDate);
  const copiedCount = db.copyAssignments ? db.copyAssignments(guildId, sourceDate, targetDate) : 0;
  logger.info(`Copied ${copiedCount} assignments from ${sourceDate} to ${targetDate} via web`);
  req.io.emit('warboardsUpdated');
  res.json({ copied: copiedCount });
});

// ========== GET ASSIGNMENTS FOR A SPECIFIC DATE ==========
protectedRouter.get('/warboards/:date', (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const assignments = db.getAssignments(guildId, req.params.date);
  res.json(assignments);
});

// ========== DELETE WARBOARD (JSON response) ==========
protectedRouter.delete('/warboards/:date', logActivity('warboard.delete', 'Deleted warboard'), (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  if (db.deleteWarboard) {
    db.deleteWarboard(guildId, req.params.date);
  } else {
    return res.status(500).json({ error: 'Database method not implemented' });
  }
  logger.info(`Warboard deleted via web: ${req.params.date}`);
  req.io.emit('warboardsUpdated');
  res.json({ success: true }); // was sendStatus(200)
});

// ========== ASSIGNMENTS ==========
protectedRouter.post('/warboards/:date/assign', logActivity('assignment.add', 'Added assignment'), (req, res) => {
  const { guildId, userId, username, base, might, mention } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const parsed = req.params.date;
  db.createWarboard(guildId, parsed);
  db.saveAssignment(guildId, parsed, userId, username, base, might, mention ? 1 : 0);
  logger.info(`Assignment added via web: ${username} to ${base} on ${parsed}`);
  req.io.emit('assignmentUpdated', { date: parsed, base, guildId });
  res.json({ success: true }); // was sendStatus(200)
});

protectedRouter.delete('/warboards/:date/assign/:id', logActivity('assignment.remove', 'Removed assignment'), (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  if (db.deleteAssignmentById) {
    db.deleteAssignmentById(req.params.id, guildId, req.params.date);
  } else {
    return res.status(500).json({ error: 'Database method not implemented' });
  }
  logger.info(`Assignment deleted via web: ID ${req.params.id}`);
  req.io.emit('assignmentUpdated', { date: req.params.date, guildId });
  res.json({ success: true }); // was sendStatus(200)
});

// ========== ACTIONS ==========
protectedRouter.post('/warboards/:date/send', async (req, res) => {
  const { guildId, channelId } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const date = req.params.date;
  const channel = req.bot.channels.cache.get(channelId);
  if (!channel) return res.status(400).json({ error: 'Channel not found' });
  const assignments = db.getAssignments(guildId, date);
  if (!assignments.length) return res.status(400).json({ error: 'No assignments' });
  const chunks = WarboardManager.buildWarboardMessageChunks(guildId, date, assignments);
  for (const chunk of chunks) {
    await channel.send(chunk);
  }
  logger.info(`Warboard for ${date} sent to Discord via web in guild ${guildId}`);
  res.json({ success: true });
});

// ========== ACTIVITY LOGS ==========
protectedRouter.get('/guilds/:id/logs', (req, res) => {
  const guildId = req.params.id;
  const limit = parseInt(req.query.limit) || 50;
  const logs = db.getActivityLogs(guildId, limit);
  res.json(logs);
});

// ========== ADMIN: WEB USERS MANAGEMENT ==========
protectedRouter.use('/admin/web-users', (req, res, next) => {
  if (req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Owner only' });
  }
  next();
});

protectedRouter.get('/admin/web-users', (req, res) => {
  const users = db.getAllWebUsers();
  res.json(users);
});

protectedRouter.post('/admin/web-users', logActivity('web-user.create', 'Created web user'), (req, res) => {
  const { username, password, discordId } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const result = db.createWebUser(username, password, req.user.id, discordId);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    throw err;
  }
});

protectedRouter.delete('/admin/web-users/:id', logActivity('web-user.delete', 'Deleted web user'), (req, res) => {
  db.deleteWebUser(req.params.id);
  res.json({ success: true }); // was sendStatus(200)
});

protectedRouter.put('/admin/web-users/:id', logActivity('web-user.update', 'Updated web user'), (req, res) => {
  const { password, discordId } = req.body;
  db.updateWebUser(req.params.id, { password, discordId });
  res.json({ success: true }); // was sendStatus(200)
});

// ========== BOT NICKNAME MANAGEMENT ==========
protectedRouter.get('/guilds/:id/bot-nickname', (req, res) => {
  const guildId = req.params.id;
  const guild = req.bot.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const member = guild.members.cache.get(req.bot.user.id);
  if (!member) return res.status(404).json({ error: 'Bot not in guild' });
  res.json({ nickname: member.nickname });
});

protectedRouter.post('/guilds/:id/bot-nickname', logActivity('bot.nickname', 'Changed bot nickname'), (req, res) => {
  const guildId = req.params.id;
  const { nickname } = req.body;
  if (nickname && nickname.length > 32) return res.status(400).json({ error: 'Nickname too long' });
  const guild = req.bot.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const member = guild.members.cache.get(req.bot.user.id);
  if (!member) return res.status(404).json({ error: 'Bot not in guild' });
  member.setNickname(nickname || null)
    .then(() => res.json({ success: true }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// ========== GUILD MEMBERS (paginated) ==========
protectedRouter.get('/guilds/:id/members', async (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Owner only' });
  }
  const guildId = req.params.id;
  const limit = parseInt(req.query.limit) || 100;
  const after = req.query.after || undefined;
  const guild = req.bot.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  try {
    const collection = await guild.members.fetch({ limit, after });
    const members = Array.from(collection.values()).map(m => ({
      id: m.id,
      username: m.user.username,
      nickname: m.nickname,
      avatar: m.user.avatar,
      isAdmin: db.isAdmin(guildId, m.id)
    }));
    const lastId = members.length > 0 ? members[members.length - 1].id : null;
    res.json({
      members,
      next: lastId,
      hasMore: members.length === limit
    });
  } catch (error) {
    if (error.retryAfter || (error.code && error.code === 50008)) {
      const retryAfter = error.retryAfter || 30;
      logger.warn(`Rate limited fetching members for guild ${guildId}. Retry after ${retryAfter}s`);
      return res.status(429).json({ 
        error: 'Rate limited by Discord',
        retryAfter 
      });
    }
    logger.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ========== GRANT ADMIN ACCESS ==========
protectedRouter.post('/guilds/:id/admin', logActivity('admin.grant', 'Granted admin'), (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  db.addAdmin(req.params.id, userId);
  res.json({ success: true });
});

// ========== REVOKE ADMIN ACCESS ==========
protectedRouter.delete('/guilds/:id/admin/:userId', logActivity('admin.revoke', 'Revoked admin'), (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  db.removeAdmin(req.params.id, req.params.userId);
  res.json({ success: true });
});

// ========== BOT GUILDS (owner only) ==========
protectedRouter.get('/bot/guilds', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Owner only' });
  }
  const guilds = req.bot.guilds.cache.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    memberCount: g.memberCount,
    joinedAt: g.joinedTimestamp
  }));
  res.json(guilds);
});

// ========== OWNER: WEB ACTIVITY (sessions) ==========  
protectedRouter.get('/owner/web-activity', (req, res) => {  
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });  
  const stmt = db.db.prepare(`  
    SELECT user_id, username, login_time, last_active, ip  
    FROM web_sessions  
    ORDER BY login_time DESC  
    LIMIT 100  
  `);  
  const sessions = stmt.all();  
  res.json(sessions);  
});  
  
// ========== OWNER: DISCORD SERVER ACTIVITY (presence) ==========  
protectedRouter.get('/owner/discord-activity', (req, res) => {  
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });  
  const guilds = req.bot.guilds.cache;  
  const activities = [];  
  guilds.forEach(guild => {  
    guild.members.cache.forEach(member => {  
      if (member.presence) {  
        const status = member.presence.status; // 'online', 'idle', 'dnd'  
        const activity = member.presence.activities[0]; // first activity  
        activities.push({  
          guild_id: guild.id,  
          guild_name: guild.name,  
          user_id: member.id,  
          username: member.user.username,  
          avatar: member.user.avatar,  
          status,  
          activity_name: activity?.name || null,  
          activity_type: activity?.type || null, // 0: Playing, 1: Streaming, 2: Listening, 3: Watching, 5: Competing  
          roles: member.roles.cache.map(r => ({ id: r.id, name: r.name })),  
        });  
      }  
    });  
  });  
  res.json(activities);  
});

// ========== GREETINGS ENDPOINTS ==========

// Get all text channels in the guild (for dropdowns)
protectedRouter.get('/guilds/:id/channels', (req, res) => {
  const guild = req.bot.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const channels = guild.channels.cache
    .filter(c => c.type === 0) // text channels only
    .map(c => ({ id: c.id, name: c.name, type: c.type }));
  res.json(channels);
});

// Get greetings settings (channels + enabled flags)
protectedRouter.get('/guilds/:id/greetings/settings', (req, res) => {
  const guildId = req.params.id;
  const settings = db.getGreetingsSettings(guildId);
  res.json(settings);
});

// Save greetings settings (channels, toggles)
protectedRouter.post('/guilds/:id/greetings/settings', logActivity('greetings.settings', 'Updated greetings settings'), (req, res) => {
  const guildId = req.params.id;
  const {
    welcome_channel_id, farewell_channel_id,
    ban_channel_id, kick_channel_id,
    welcome_enabled, farewell_enabled, ban_enabled, kick_enabled,
    welcome_dm_enabled, farewell_dm_enabled,
    invite_tracking_enabled
  } = req.body;

  // Channel settings
  if (welcome_channel_id !== undefined) db.setGreetingsChannel(guildId, 'welcome', welcome_channel_id, req.user.id);
  if (farewell_channel_id !== undefined) db.setGreetingsChannel(guildId, 'farewell', farewell_channel_id, req.user.id);
  if (ban_channel_id !== undefined) db.setGreetingsChannel(guildId, 'ban', ban_channel_id, req.user.id);
  if (kick_channel_id !== undefined) db.setGreetingsChannel(guildId, 'kick', kick_channel_id, req.user.id);

  // Channel toggles
  if (welcome_enabled !== undefined) db.enableGreeting(guildId, 'welcome', welcome_enabled, req.user.id);
  if (farewell_enabled !== undefined) db.enableGreeting(guildId, 'farewell', farewell_enabled, req.user.id);
  if (ban_enabled !== undefined) db.enableGreeting(guildId, 'ban', ban_enabled, req.user.id);
  if (kick_enabled !== undefined) db.enableGreeting(guildId, 'kick', kick_enabled, req.user.id);

  // DM toggles
  if (welcome_dm_enabled !== undefined) db.setDMGreetingEnabled(guildId, 'welcome_dm', welcome_dm_enabled, req.user.id);
  if (farewell_dm_enabled !== undefined) db.setDMGreetingEnabled(guildId, 'farewell_dm', farewell_dm_enabled, req.user.id);

  // Invite tracking
  if (invite_tracking_enabled !== undefined) db.setInviteTrackingEnabled(guildId, invite_tracking_enabled);

  res.json({ success: true });
});

// Get a specific greeting message (channel or DM)
protectedRouter.get('/guilds/:id/greetings/messages/:type', (req, res) => {
  const guildId = req.params.id;
  const type = req.params.type;
  let message;
  if (type.endsWith('_dm')) {
    message = db.getDMGreetingMessage(guildId, type);
  } else {
    message = db.getGreetingMessage(guildId, type);
  }
  res.json(message || {});
});

// Save a channel greeting message (welcome, farewell, ban, kick)
protectedRouter.post('/guilds/:id/greetings/messages/:type', logActivity('greetings.message', 'Saved greeting message'), (req, res) => {
  const guildId = req.params.id;
  const type = req.params.type;
  const data = req.body;
  db.saveGreetingMessage(guildId, type, data, req.user.id);
  res.json({ success: true });
});

// Save a DM greeting message (welcome_dm, farewell_dm)
protectedRouter.post('/guilds/:id/greetings/dm-messages/:type', logActivity('greetings.dm', 'Saved DM greeting'), (req, res) => {
  const guildId = req.params.id;
  const type = req.params.type;
  const data = req.body;
  db.saveDMGreetingMessage(guildId, type, data, req.user.id);
  res.json({ success: true });
});

// Get a specific DM greeting message
protectedRouter.get('/guilds/:id/greetings/dm-messages/:type', (req, res) => {
  const guildId = req.params.id;
  const type = req.params.type;
  const message = db.getDMGreetingMessage(guildId, type);
  res.json(message || {});
});

// Toggle DM greeting enabled/disabled
protectedRouter.post('/guilds/:id/greetings/dm-toggle/:type', logActivity('greetings.dm-toggle', 'Toggled DM greeting'), (req, res) => {
  const guildId = req.params.id;
  const type = req.params.type;
  const { enabled } = req.body;
  db.setDMGreetingEnabled(guildId, type, enabled, req.user.id);
  res.json({ success: true });
});

// Test a greeting (sends a test message to the current user or a specified channel)
protectedRouter.post('/guilds/:id/greetings/test', async (req, res) => {
  const guildId = req.params.id;
  const { type, isDM, channelId } = req.body;
  const guild = req.bot.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const member = guild.members.cache.get(req.user.id);
  if (!member) return res.status(400).json({ error: 'You are not in this guild' });

  const testOptions = {
    interaction: { member, guild },
    type: isDM ? (type === 'welcome' ? 'welcome' : 'farewell') : type,
    targetChannel: channelId ? guild.channels.cache.get(channelId) : null,
    isDM
  };

  try {
    const result = await GreetingsManager.testGreeting(testOptions, req.bot);
    res.json(result);
  } catch (err) {
    logger.error('Test greeting error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get full greetings status (including DM toggles and invite tracking)
protectedRouter.get('/guilds/:id/greetings/status', (req, res) => {
  const guildId = req.params.id;
  const settings = db.getGreetingsSettings(guildId);
  const dmWelcome = db.isDMGreetingEnabled(guildId, 'welcome_dm');
  const dmFarewell = db.isDMGreetingEnabled(guildId, 'farewell_dm');
  const inviteTracking = db.isInviteTrackingEnabled(guildId);
  res.json({
    ...settings,
    welcome_dm_enabled: dmWelcome,
    farewell_dm_enabled: dmFarewell,
    invite_tracking_enabled: inviteTracking
  });
});


// ========== MIGHT HISTORY ==========
// Get current might for all users in a guild (for dropdown)
protectedRouter.get('/guilds/:id/might/current', (req, res) => {
  const guildId = req.params.id;
  const users = db.getAllCurrentMight(guildId);
  res.json(users);
});

// Get might history for a specific user
protectedRouter.get('/guilds/:id/might/history/:userId', (req, res) => {
  const guildId = req.params.id;
  const userId = req.params.userId;
  const limit = parseInt(req.query.limit) || 50;
  const history = db.getMightHistoryForUser(guildId, userId, limit);
  res.json(history);
});

// Optional: get might history for all users (could be heavy)
protectedRouter.get('/guilds/:id/might/history', (req, res) => {
  const guildId = req.params.id;
  // For simplicity, we'll return history grouped by user.
  // A more efficient approach would be to return a combined dataset.
  const users = db.getAllCurrentMight(guildId);
  const result = [];
  for (const u of users) {
    const hist = db.getMightHistoryForUser(guildId, u.user_id, 20);
    result.push({
      userId: u.user_id,
      username: u.username,
      current: u.might,
      history: hist
    });
  }
  res.json(result);
});


// ========== GET LAST MIGHT FOR A USER ==========
protectedRouter.get('/players/:userId/last-might', (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const lastMight = db.getLatestMight(guildId, req.params.userId);
  res.json({ might: lastMight });
});

// ========== MIGHT SUBMISSIONS ==========
// Submit a new might (any authenticated user)
// ========== MIGHT SUBMISSIONS ==========
protectedRouter.post('/might/submit', (req, res) => {
  const { guildId, inGameName, might } = req.body;
  if (!guildId || !inGameName || !might) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const userId = req.user.id;
  const username = req.user.username;

  // Check for might decrease
  const lastMight = db.getLatestMight(guildId, userId);
  if (lastMight !== null && parseFloat(might) < parseFloat(lastMight)) {
    return res.status(400).json({ error: 'Might cannot decrease. Last recorded: ' + lastMight });
  }

  // Insert submission and get ID (assuming db.submitMight returns lastInsertRowid)
  const result = db.submitMight(guildId, userId, username, inGameName, might);
  const submissionId = result.lastInsertRowid;

  // Notify admins (async, don't wait)
  const submission = {
    id: submissionId,
    guildId,
    userId,
    username,
    in_game_name: inGameName,
    submitted_might: might,
    submitted_at: Date.now()
  };
  notifyAdminsOfSubmission(req.bot, guildId, submission).catch(err => {
    logger.error('Failed to notify admins:', err);
  });

  res.json({ success: true });
});

// Get pending submissions (admin only)
protectedRouter.get('/might/pending', (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  if (!db.isAdmin(guildId, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const pending = db.getPendingSubmissions(guildId);
  res.json(pending);
});

// Approve submission (admin only)
protectedRouter.post('/might/approve/:id', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const submission = db.getSubmissionById(id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (!db.isAdmin(submission.guild_id, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }
  db.approveSubmission(id, req.user.id, notes);
  
  // Emit Socket.IO event
  req.io.emit('submissionUpdated', {
    submissionId: id,
    guildId: submission.guild_id,
    status: 'approved',
    admin: req.user.id,
    reason: notes
  });
    // Update DMs asynchronously
  updateSubmissionDMs(id, 'approved', req.user.id, notes, req.bot).catch(err => {
    logger.error('Failed to update submission DMs:', err);
  });

  res.json({ success: true });
});

// Reject submission (admin only)
protectedRouter.post('/might/reject/:id', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const submission = db.getSubmissionById(id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (!db.isAdmin(submission.guild_id, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }
  db.rejectSubmission(id, req.user.id, notes);
  
  // Emit Socket.IO event
  req.io.emit('submissionUpdated', {
    submissionId: id,
    guildId: submission.guild_id,
    status: 'rejected',
    admin: req.user.id,
    reason: notes
  });
    // Update DMs asynchronously
  updateSubmissionDMs(id, 'rejected', req.user.id, notes, req.bot).catch(err => {
    logger.error('Failed to update submission DMs:', err);
  });

  res.json({ success: true });
});

// Delete a might history point (admin only)
protectedRouter.delete('/might/history/:id', (req, res) => {
  const { id } = req.params;
  const history = db.getHistoryById(id);
  if (!history) return res.status(404).json({ error: 'History not found' });
  if (!db.isAdmin(history.guild_id, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }
  db.deleteMightHistory(id);
  res.json({ success: true });
});

// ========== COMPARISON ==========
// Get might history for multiple users (admin only)
protectedRouter.post('/might/compare', (req, res) => {
  const { guildId, userIds } = req.body; // array of Discord IDs
  if (!guildId || !userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!db.isAdmin(guildId, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const result = {};
  for (const uid of userIds) {
    const history = db.getMightHistoryForUser(guildId, uid, 100); // get up to 100 points
    result[uid] = history;
  }
  res.json(result);
});

// Get current user's pending submissions (member view)
// Get current user's pending submissions (member view)
protectedRouter.get('/might/my-pending', (req, res) => {
  const { guildId } = req.query;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const userId = req.user.id;
  const pending = db.getUserPendingSubmissions(guildId, userId);
  res.json(pending);
});


protectedRouter.get('/guilds/:id/is-admin', (req, res) => {
  const guildId = req.params.id;
  const isAdmin = db.isAdmin(guildId, req.user.id) || req.user.id === process.env.OWNER_ID;
  res.json({ isAdmin });
});

// Get pending submissions for a specific user (admin only)
protectedRouter.get('/might/user-pending', (req, res) => {
  const { guildId, userId } = req.query;
  if (!guildId || !userId) return res.status(400).json({ error: 'guildId and userId required' });
  if (!db.isAdmin(guildId, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Admin only' });
  }
  const pending = db.getUserPendingSubmissions(guildId, userId);
  res.json(pending);
});

// Paginated might history (member view)
protectedRouter.get('/guilds/:guildId/might/history-full/:userId', (req, res) => {
  const { guildId, userId } = req.params;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  // Optional: ensure user has access (self or admin)
  if (userId !== req.user.id && !db.isAdmin(guildId, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const result = db.getMightHistoryPaginated(guildId, userId, limit, offset);
  res.json(result);
});

// Paginated submission history (member view)
protectedRouter.get('/might/user-submissions', (req, res) => {
  const { guildId, userId } = req.query;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  if (!guildId || !userId) return res.status(400).json({ error: 'Missing parameters' });
  if (userId !== req.user.id && !db.isAdmin(guildId, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const result = db.getUserSubmissionsPaginated(guildId, userId, limit, offset);
  res.json(result);
});


// Get might history within a date range
protectedRouter.get('/guilds/:guildId/might/history-range/:userId', (req, res) => {
  const { guildId, userId } = req.params;
  const start = req.query.start ? parseInt(req.query.start) : null;
  const end = req.query.end ? parseInt(req.query.end) : null;

  // Optional permission check: user must be self or admin
  if (userId !== req.user.id && !db.isAdmin(guildId, req.user.id) && req.user.id !== process.env.OWNER_ID) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const history = db.getMightHistoryInRange(guildId, userId, start, end);
  res.json(history);
});







// ========== QUESTIONS ==========
// Get all questions for a guild (with optional status filter)
protectedRouter.get('/guilds/:guildId/questions', (req, res) => {
  const { guildId } = req.params;
  const { status } = req.query; // optional
  const questions = db.getQuestions(guildId, status);
  // Enrich each question with option count and response count
  const enriched = questions.map(q => {
    const options = db.getQuestionOptions(q.id);
    const responses = db.getQuestionResponses(q.id);
    return {
      ...q,
      optionCount: options.length,
      responseCount: responses.length,
      options: options // include full options for convenience
    };
  });
  res.json(enriched);
});

// Get a single question by ID
protectedRouter.get('/guilds/:guildId/questions/:id', (req, res) => {
  const { id } = req.params;
  const question = db.getQuestion(id);
  if (!question || question.guild_id !== req.params.guildId) {
    return res.status(404).json({ error: 'Question not found' });
  }
  const options = db.getQuestionOptions(id);
  const responses = db.getQuestionResponses(id);
  res.json({ ...question, options, responses });
});

// Create a new question (draft)
protectedRouter.post('/guilds/:guildId/questions', logActivity('question.create', 'Created question'), (req, res) => {
  const { guildId } = req.params;
  const { title, description, footer, suffix, maxInteractions } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const result = db.createQuestion(
    guildId,
    title,
    description || null,
    footer || null,
    suffix || '',
    maxInteractions || 1,
    req.user.id
  );
  const questionId = result.lastInsertRowid;
  logger.info(`Question created via web: ID ${questionId} in guild ${guildId}`);
  req.io.emit('questionsUpdated', { guildId, questionId });
  res.json({ id: questionId });
});

// Add an option to a question (only in draft)
protectedRouter.post('/guilds/:guildId/questions/:id/options', logActivity('question.option', 'Added option'), (req, res) => {
  const { guildId, id } = req.params;
  const { label, emoji, answerText, answerNumber, style } = req.body;
  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) {
    return res.status(404).json({ error: 'Question not found' });
  }
  if (question.status !== 'draft') {
    return res.status(400).json({ error: 'Can only add options to draft questions' });
  }
  const existing = db.getQuestionOptions(id);
  const position = existing.length;
  db.addQuestionOption(id, label, answerText, answerNumber, emoji, style, position);
  logger.info(`Option added to question ${id} via web`);
  req.io.emit('questionsUpdated', { guildId, questionId: id });
  res.json({ success: true });
});

// Start a question (change status to active)
protectedRouter.post('/guilds/:guildId/questions/:id/start', logActivity('question.start', 'Started question'), (req, res) => {
  const { guildId, id } = req.params;
  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) {
    return res.status(404).json({ error: 'Question not found' });
  }
  if (!['sent', 'closed'].includes(question.status)) {
    return res.status(400).json({ error: `Cannot start question with status ${question.status}` });
  }
  db.setQuestionStatus(id, 'active');
  // Attempt to update the Discord message if it exists
  if (question.channel_id && question.message_id && req.bot) {
    QuestionManager.updateQuestionMessage(req.bot, { ...question, status: 'active' }).catch(err => {
      logger.error(`Failed to update question message after start: ${err.message}`);
    });
  }
  logger.info(`Question ${id} started via web`);
  req.io.emit('questionsUpdated', { guildId, questionId: id });
  res.json({ success: true });
});

// Stop a question (change status to closed)
protectedRouter.post('/guilds/:guildId/questions/:id/stop', logActivity('question.stop', 'Stopped question'), (req, res) => {
  const { guildId, id } = req.params;
  const { removeButtons, showResults } = req.body;
  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) {
    return res.status(404).json({ error: 'Question not found' });
  }
  if (!['active', 'sent'].includes(question.status)) {
    return res.status(400).json({ error: `Cannot stop question with status ${question.status}` });
  }
  db.setQuestionStatus(id, 'closed');
  // Attempt to update Discord message
  if (question.channel_id && question.message_id && req.bot) {
    const options = db.getQuestionOptions(id);
    const embed = QuestionManager.buildEmbed({ ...question, status: 'closed' }, options);
    const rows = removeButtons ? [] : QuestionManager.buildActionRows(id, options, true);
    req.bot.channels.fetch(question.channel_id)
      .then(channel => channel.messages.fetch(question.message_id))
      .then(msg => msg.edit({ embeds: [embed], components: rows }))
      .catch(err => logger.error(`Failed to update question message after stop: ${err.message}`));
  }
  // If showResults, send results to channel
  if (showResults && question.channel_id && req.bot) {
    const { buildResultsEmbed } = require('../commands/question'); // careful with circular
    buildResultsEmbed(id, null).then(embed => {
      req.bot.channels.fetch(question.channel_id)
        .then(channel => channel.send({ embeds: [embed] }))
        .catch(err => logger.error(`Failed to send results: ${err.message}`));
    });
  }
  logger.info(`Question ${id} stopped via web`);
  req.io.emit('questionsUpdated', { guildId, questionId: id });
  res.json({ success: true });
});

// Delete a question
protectedRouter.delete('/guilds/:guildId/questions/:id', logActivity('question.delete', 'Deleted question'), (req, res) => {
  const { guildId, id } = req.params;
  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) {
    return res.status(404).json({ error: 'Question not found' });
  }
  // Optionally delete the Discord message
  if (question.channel_id && question.message_id && req.bot) {
    req.bot.channels.fetch(question.channel_id)
      .then(channel => channel.messages.fetch(question.message_id))
      .then(msg => msg.delete())
      .catch(() => {});
  }
  db.deleteQuestion(id);
  logger.info(`Question ${id} deleted via web`);
  req.io.emit('questionsUpdated', { guildId, questionId: id });
  res.json({ success: true });
});

// Get results for a question
protectedRouter.get('/guilds/:guildId/questions/:id/results', (req, res) => {
  const { id } = req.params;
  const question = db.getQuestion(id);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  const options = db.getQuestionOptions(id);
  const responses = db.getQuestionResponses(id);
  // Build counts
  const counts = {};
  const sums = {};
  options.forEach(o => {
    counts[o.id] = 0;
    if (o.answer_number !== null) sums[o.id] = 0;
  });
  let totalSum = 0;
  responses.forEach(r => {
    counts[r.option_id] = (counts[r.option_id] || 0) + 1;
    const opt = options.find(o => o.id === r.option_id);
    if (opt && opt.answer_number !== null) {
      sums[r.option_id] = (sums[r.option_id] || 0) + opt.answer_number;
      totalSum += opt.answer_number;
    }
  });
  // Group users by option
  const usersByOption = {};
  options.forEach(o => usersByOption[o.id] = []);
  responses.forEach(r => {
    if (usersByOption[r.option_id]) usersByOption[r.option_id].push(r.user_id);
  });
  res.json({
    question,
    options,
    counts,
    sums,
    totalSum,
    usersByOption
  });
});


// Update a draft question (title, description, footer, suffix, maxInteractions)
protectedRouter.patch('/guilds/:guildId/questions/:id', logActivity('question.update', 'Updated question'), (req, res) => {
  const { guildId, id } = req.params;
  const { title, description, footer, suffix, maxInteractions } = req.body;
  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) return res.status(404).json({ error: 'Not found' });
  if (question.status !== 'draft') return res.status(400).json({ error: 'Can only edit draft questions' });
  // We need database functions to update these fields – add them if not present
  
  if (db.updateQuestion) {
    db.updateQuestion(id, { title, description, footer, suffix, maxInteractions });
  } else {
    // Fallback: direct SQL (you'll need to add this to your db module)
    const stmt = db.db.prepare(`UPDATE questions SET title = ?, description = ?, footer = ?, suffix = ?, max_interactions = ? WHERE id = ?`);
    stmt.run(title, description, footer, suffix, maxInteractions, id);
  }
  res.json({ success: true });
});

// Delete an option from a draft question
protectedRouter.delete('/guilds/:guildId/questions/:questionId/options/:optionId', logActivity('question.deleteOption', 'Deleted option'), (req, res) => {
  const { guildId, questionId, optionId } = req.params;
  const question = db.getQuestion(questionId);
  if (!question || question.guild_id !== guildId) return res.status(404).json({ error: 'Not found' });
  if (question.status !== 'draft') return res.status(400).json({ error: 'Can only delete options from draft' });
  // Need a db.deleteQuestionOption function – implement if missing
  const stmt = db.db.prepare(`DELETE FROM question_options WHERE id = ? AND question_id = ?`);
  stmt.run(optionId, questionId);
  // Reorder remaining options? (optional)
  res.json({ success: true });
});

// Send question immediately (like /question send without schedule)
protectedRouter.post('/guilds/:guildId/questions/:id/send', logActivity('question.send', 'Sent question'), async (req, res) => {
  const { guildId, id } = req.params;
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });

  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) return res.status(404).json({ error: 'Not found' });
  if (question.status !== 'draft') return res.status(400).json({ error: 'Only draft questions can be sent' });

  const channel = req.bot.channels.cache.get(channelId);
  if (!channel) return res.status(400).json({ error: 'Channel not found' });

  const options = db.getQuestionOptions(id);
  if (options.length === 0) return res.status(400).json({ error: 'No options added' });

  try {
    const message = await QuestionManager.sendQuestion(channel, question, options, true); // true = buttons disabled initially
    db.setQuestionMessage(id, channel.id, message.id);
    db.setQuestionStatus(id, 'sent');
    res.json({ success: true, messageId: message.id });
  } catch (err) {
    logger.error('Failed to send question:', err);
    res.status(500).json({ error: err.message });
  }
});

// Schedule question for later
// Schedule question for later
protectedRouter.post('/guilds/:guildId/questions/:id/schedule', logActivity('question.schedule', 'Scheduled question'), (req, res) => {
  const { guildId, id } = req.params;
  const { channelId, scheduledAt, timezone } = req.body;
  if (!channelId || !scheduledAt || !timezone) {
    return res.status(400).json({ error: 'channelId, scheduledAt, timezone required' });
  }

  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) return res.status(404).json({ error: 'Not found' });
  if (question.status !== 'draft') return res.status(400).json({ error: 'Only draft questions can be scheduled' });

  // Parse the date string with the given timezone using Luxon
  const dt = DateTime.fromISO(scheduledAt, { zone: timezone });
  if (!dt.isValid) {
    return res.status(400).json({ error: 'Invalid date/time or timezone' });
  }
  const scheduledTimestamp = dt.toMillis();

  // Validate it's in the future
  const now = Date.now();
  if (scheduledTimestamp <= now) {
    return res.status(400).json({ error: 'Scheduled time must be in the future' });
  }

  // Store channel and scheduled time
  db.setQuestionChannel(id, channelId);
  db.setQuestionScheduled(id, scheduledTimestamp);

  res.json({ success: true });
});

// Get available timezones (list from command choices)
protectedRouter.get('/timezones', (req, res) => {
  const timezones = [
    { name: 'UTC', value: 'UTC' },
    { name: 'India (IST) – Asia/Kolkata', value: 'Asia/Kolkata' },
    { name: 'UK (GMT/BST) – Europe/London', value: 'Europe/London' },
    { name: 'US Eastern (EST/EDT) – America/New_York', value: 'America/New_York' },
    { name: 'US Central (CST/CDT) – America/Chicago', value: 'America/Chicago' },
    { name: 'US Mountain (MST/MDT) – America/Denver', value: 'America/Denver' },
    { name: 'US Pacific (PST/PDT) – America/Los_Angeles', value: 'America/Los_Angeles' },
    { name: 'Europe Central (CET/CEST) – Europe/Berlin', value: 'Europe/Berlin' },
    { name: 'Japan (JST) – Asia/Tokyo', value: 'Asia/Tokyo' },
    { name: 'Australia Eastern (AEST/AEDT) – Australia/Sydney', value: 'Australia/Sydney' }
  ];
  res.json(timezones);
});

// Helper to fetch multiple users with their best available name (guild nickname > global username > ID)
async function fetchUsers(client, guild, userIds) {
  const uniqueIds = [...new Set(userIds)];
  const users = [];
  for (const id of uniqueIds) {
    try {
      // Try to get from guild first (for nickname)
      if (guild) {
        const member = await guild.members.fetch(id).catch(() => null);
        if (member) {
          users.push({ id: member.id, tag: member.nickname || member.user.username });
          continue;
        }
      }
      // Fallback to global user fetch
      const user = await client.users.fetch(id);
      users.push({ id: user.id, tag: user.username });
    } catch (err) {
      logger.warn(`Failed to fetch user ${id}: ${err.message}`);
      users.push({ id, tag: 'Unknown User' });
    }
  }
  return users;
}

// Enhanced results endpoint
protectedRouter.get('/guilds/:guildId/questions/:id/results', async (req, res) => {
  const { guildId, id } = req.params;
  const question = db.getQuestion(id);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  const options = db.getQuestionOptions(id);
  const responses = db.getQuestionResponses(id);

  // Build counts and sums
  const counts = {};
  const sums = {};
  options.forEach(o => {
    counts[o.id] = 0;
    if (o.answer_number !== null) sums[o.id] = 0;
  });
  let totalSum = 0;
  responses.forEach(r => {
    counts[r.option_id] = (counts[r.option_id] || 0) + 1;
    const opt = options.find(o => o.id === r.option_id);
    if (opt && opt.answer_number !== null) {
      sums[r.option_id] = (sums[r.option_id] || 0) + opt.answer_number;
      totalSum += opt.answer_number;
    }
  });

  // Group user IDs by option
  const usersByOption = {};
  options.forEach(o => usersByOption[o.id] = []);
  responses.forEach(r => {
    if (usersByOption[r.option_id]) usersByOption[r.option_id].push(r.user_id);
  });

  // Fetch all unique user IDs to get tags/nicknames
  const allUserIds = [...new Set(responses.map(r => r.user_id))];
  let userMap = {};
  if (req.bot && allUserIds.length) {
    const guild = req.bot.guilds.cache.get(guildId);
    if (!guild) {
      logger.warn(`Guild ${guildId} not found in bot cache when fetching results`);
    }
    try {
      const users = await fetchUsers(req.bot, guild, allUserIds);
      userMap = Object.fromEntries(users.map(u => [u.id, u.tag]));
    } catch (err) {
      logger.error('Failed to fetch users for results:', err);
    }
  }

  res.json({
    question,
    options,
    counts,
    sums,
    totalSum,
    usersByOption,
    userMap
  });
});


// ========== QUESTION EDIT & COPY ==========
// Update a draft question's main fields
protectedRouter.patch('/guilds/:guildId/questions/:id', logActivity('question.update', 'Updated question'), (req, res) => {
  const { guildId, id } = req.params;
  const { title, description, footer, suffix, maxInteractions } = req.body;
  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) return res.status(404).json({ error: 'Not found' });
  if (question.status !== 'draft') return res.status(400).json({ error: 'Only draft questions can be edited' });
  
  // Update the question (using direct SQL or db.updateQuestion if available)
  const stmt = db.db.prepare(`
    UPDATE questions 
    SET title = ?, description = ?, footer = ?, suffix = ?, max_interactions = ?
    WHERE id = ?
  `);
  stmt.run(title, description, footer, suffix, maxInteractions, id);
  
  res.json({ success: true });
});

// Copy a question (creates a new draft with same options)
protectedRouter.post('/guilds/:guildId/questions/:id/copy', logActivity('question.copy', 'Copied question'), (req, res) => {
  const { guildId, id } = req.params;
  const question = db.getQuestion(id);
  if (!question || question.guild_id !== guildId) return res.status(404).json({ error: 'Not found' });
  
  // Create new question with same fields, status draft
  const result = db.createQuestion(
    guildId,
    question.title,
    question.description,
    question.footer,
    question.suffix || '',
    question.max_interactions,
    req.user.id // copying user as creator
  );
  const newId = result.lastInsertRowid;
  
  // Copy all options
  const options = db.getQuestionOptions(id);
  options.forEach(opt => {
    db.addQuestionOption(
      newId,
      opt.label,
      opt.answer_text,
      opt.answer_number,
      opt.emoji,
      opt.style,
      opt.position
    );
  });
  
  res.json({ id: newId });
});



// ========== PIN MESSAGE CHANNELS ==========
// ========== PIN CHANNELS ==========

// Get all pin channels for guild
protectedRouter.get('/guilds/:id/pin-channels', (req, res) => {
  const guildId = req.params.id;
  const channels = db.getPinChannelsByGuild(guildId);
  res.json(channels);
});

// Get single pin channel details
protectedRouter.get('/guilds/:id/pin-channels/:channelId', (req, res) => {
  const channel = db.getPinChannel(req.params.channelId);
  if (!channel || channel.guild_id !== req.params.id) return res.status(404).json({ error: 'Not found' });
  res.json(channel);
});

// Add a pin channel
protectedRouter.post('/guilds/:id/pin-channels', logActivity('pin.add', 'Added pin channel'), (req, res) => {
  const guildId = req.params.id;
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });

  const guild = req.bot.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== 0) return res.status(400).json({ error: 'Invalid text channel' });

  db.addPinChannel(guildId, channelId, req.user.id);
  req.io.emit('pinChannelsUpdated', { guildId });
  res.json({ success: true });
});

// Remove pin channel
protectedRouter.delete('/guilds/:id/pin-channels/:channelId', logActivity('pin.remove', 'Removed pin channel'), (req, res) => {
  db.removePinChannel(req.params.channelId);
  req.io.emit('pinChannelsUpdated', { guildId: req.params.id });
  res.json({ success: true });
});

// Update pin message (content + embed)
protectedRouter.put('/guilds/:id/pin-channels/:channelId/message', logActivity('pin.message', 'Updated pin message'), (req, res) => {
  const { channelId } = req.params;
  const data = req.body;
  db.updatePinMessage(channelId, data);
  req.io.emit('pinChannelsUpdated', { guildId: req.params.id });
  res.json({ success: true });
});

// Get current user's language
protectedRouter.get('/user/language', (req, res) => {
  const lang = db.getUserLanguage(req.user.id) || 'en';
  res.json({ language: lang });
});

// Update current user's language
protectedRouter.put('/user/language', (req, res) => {
  const { language } = req.body;
  if (!language) return res.status(400).json({ error: 'language required' });
  db.setUserLanguage(req.user.id, language);
  res.json({ success: true });
});




protectedRouter.put('/admin/web-users/:id/lock', (req, res) => {
  db.setWebUserStatus(req.params.id, 'locked');
  res.json({ success: true });
});

protectedRouter.put('/admin/web-users/:id/unlock', (req, res) => {
  db.setWebUserStatus(req.params.id, 'active');
  res.json({ success: true });
});
protectedRouter.post('/admin/ban-discord/:discordId', (req, res) => {
  const { reason } = req.body;
  db.banDiscordId(req.params.discordId, reason || 'Manual ban', req.user.id);
  res.json({ success: true });
});

protectedRouter.delete('/admin/ban-discord/:discordId', (req, res) => {
  db.unbanDiscordId(req.params.discordId);
  res.json({ success: true });
});

protectedRouter.get('/admin/banned-discords', (req, res) => {
  const list = db.getBannedDiscordIds();
  res.json(list);
});



// ========== SESSIONS (owner only) ==========
protectedRouter.get('/admin/sessions', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  const sessionStore = require('../server/sessionStore');
  const sessions = sessionStore.getAllSessions();
  res.json(sessions);
});

protectedRouter.delete('/admin/sessions/:sessionId', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });

  const sessionStore = require('../server/sessionStore');
  const session = sessionStore.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // 1️⃣ Delete the session from memory
  sessionStore.deleteSession(req.params.sessionId);

  // 2️⃣ Mark the Discord user as kicked so their JWT becomes invalid
  const kickedUsers = req.app.get('kickedUsers');
  if (kickedUsers) kickedUsers.add(session.userId);

  // 3️⃣ Update DB (optional)
  db.prepare('UPDATE web_sessions SET last_active = NULL WHERE session_id = ?').run(req.params.sessionId);

  res.json({ success: true });
});

// ========== IP RULES (owner only) ==========
protectedRouter.get('/admin/ip-rules', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  const rules = db.getIpRules();
  res.json(rules);
});
protectedRouter.post('/admin/ip-rules', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID)
    return res.status(403).json({ error: 'Owner only' });

  const { ip, type } = req.body;
  if (!ip || !type) return res.status(400).json({ error: 'ip and type required' });

  db.addIpRule(ip, type, req.user.id);

  // --- If blacklisting, kick all sessions from this IP ---
  if (type === 'blacklist') {
    const sessionStore = require('../server/sessionStore');
    const allSessions = sessionStore.getAllSessions();

    for (const s of allSessions) {
      const sessionIp = (s.data.ip || '').replace(/^::ffff:/, '');
      if (sessionIp === ip) {
        sessionStore.deleteSession(s.sessionId);
        req.io.emit('webUserOffline', { sessionId: s.sessionId, userId: s.userId });
      }
    }
  }

  res.json({ success: true });
});
protectedRouter.delete('/admin/ip-rules/:id', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  db.deleteIpRule(req.params.id);
  res.json({ success: true });
});

// ========== ERROR LOGS (owner only) ==========
protectedRouter.get('/admin/error-logs', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  const limit = parseInt(req.query.limit) || 50;
  const logs = db.getErrorLogs(limit);
  res.json(logs);
});

// ========== USER THEME / DASHBOARD SETTINGS ==========
protectedRouter.get('/user/settings', (req, res) => {
  const settings = db.getUserSettings(req.user.id);
  res.json(settings || { theme: 'dark', custom_css: '', dashboard_layout: '[]' });
});

protectedRouter.put('/user/settings', (req, res) => {
  const { theme, custom_css, dashboard_layout } = req.body;
  db.setUserSettings(req.user.id, { theme, custom_css, dashboard_layout });
  res.json({ success: true });
});

// ========== TRANSLATION MANAGEMENT (owner only) ==========
protectedRouter.get('/admin/translations/languages', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  const localesDir = path.join(__dirname, '../locales');
  if (!fs.existsSync(localesDir)) {
    return res.json(['en']); // fallback
  }
  const languages = fs.readdirSync(localesDir).filter(f =>
    fs.statSync(path.join(localesDir, f)).isDirectory()
  );
  res.json(languages);
});

protectedRouter.get('/admin/translations/:lng', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  const lng = req.params.lng;
  const filePath = path.join(__dirname, '../locales', lng, 'translation.json');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Language not found' });
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  res.json(data);
});

protectedRouter.put('/admin/translations/:lng', (req, res) => {
  if (req.user.id !== process.env.OWNER_ID) return res.status(403).json({ error: 'Owner only' });
  const lng = req.params.lng;
  const newData = req.body;
  const dirPath = path.join(__dirname, '../locales', lng);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  const filePath = path.join(dirPath, 'translation.json');
  fs.writeFileSync(filePath, JSON.stringify(newData, null, 2), 'utf8');
  i18n.reloadResources(lng, 'translation');
  res.json({ success: true });
});

protectedRouter.get('/bot/health', (req, res) => {
  const os = require('os');
  const v8 = require('v8');
  const usage = process.cpuUsage();
  const totalCpu = usage.user + usage.system;
  const uptime = process.uptime();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const heapStats = v8.getHeapStatistics();
  const eventLoopLag = 0; // accurate measurement requires a library, but you can add later

  res.json({
    cpu: Math.round((totalCpu / 1000) * 100) / 100,  // in ms (cumulative)
    memory: {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100)
    },
    uptime: uptime,
    heapUsed: heapStats.used_heap_size,
    eventLoopLag: eventLoopLag,
    discordPing: req.bot.ws.ping
  });
});

module.exports = { publicRouter, protectedRouter };