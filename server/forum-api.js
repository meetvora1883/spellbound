const express = require('express');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');
const guides = require('../systems/Guides/star-perks');
const { isGuideOwner } = require('../utils/owner');

const router = express.Router();

function requireGuideOwner(req, res, next) {
  if (!req.user || !isGuideOwner(req.user.id)) {
    return res.status(403).json({ error: 'You are not authorized to create guides.' });
  }
  next();
}

// Helper to replace placeholders (same as in star-perks.js)
function replaceEmojis(text) {
  if (!text) return text;
  const emojis = require('../constants/emojis');
  return text
    .replace(/\{GREEN_TICK\}/g, emojis.GREEN_TICK || '✅')
    .replace(/\{RED_CROSS\}/g, emojis.RED_CROSS || '❌')
    .replace(/\{BAR_CHART\}/g, emojis.BAR_CHART || '📊')
    .replace(/\{LOCK\}/g, emojis.LOCK || '🔒')
    .replace(/\{UNLOCK\}/g, emojis.UNLOCK || '🔓')
    .replace(/\{TICKET\}/g, emojis.TICKET || '🎫')
    .replace(/\{CLOSE\}/g, emojis.CLOSE || '❌')
    .replace(/\{DELETE\}/g, emojis.DELETE || '🗑️')
    .replace(/\{CLAIM\}/g, emojis.CLAIM || '🙋')
    .replace(/\{UNCLAIM\}/g, emojis.UNCLAIM || '🙅')
    .replace(/\{ADD\}/g, emojis.ADD || '➕')
    .replace(/\{REMOVE\}/g, emojis.REMOVE || '➖')
    .replace(/\{TRANSCRIPT\}/g, emojis.TRANSCRIPT || '📄')
    .replace(/\{RENAME\}/g, emojis.RENAME || '✏️')
    .replace(/\{WARN\}/g, emojis.WARN || '⚠️')
    .replace(/\{INFO\}/g, emojis.INFO || 'ℹ️')
    .replace(/\{SUCCESS\}/g, emojis.SUCCESS || '✅')
    .replace(/\{ERROR\}/g, emojis.ERROR || '❌')
    .replace(/\{LOADING\}/g, emojis.LOADING || '⏳');
}

// Endpoint to get forum channels in a guild
router.get('/forum-channels', requireGuideOwner, (req, res) => {
  const guildId = req.query.guildId;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });
  const guild = req.bot.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const forumChannels = guild.channels.cache.filter(c => c.type === 15); // GuildForum = 15
  const channels = forumChannels.map(c => ({ id: c.id, name: c.name }));
  res.json(channels);
});

// Endpoint to create the forum guide
router.post('/create-forum-guide', requireGuideOwner, async (req, res) => {
  const { guildId, channelId, guideType = 'replica' } = req.body;
  if (!guildId || !channelId) return res.status(400).json({ error: 'Missing fields' });

  const guide = guides[guideType];
  if (!guide) return res.status(400).json({ error: `Guide type '${guideType}' not found` });

  const guild = req.bot.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== 15) return res.status(400).json({ error: 'Invalid forum channel' });

  try {
    // Build initial message with thumbnail
    let initialContent = replaceEmojis(`{LOADING} Creating **${guide.name}**... Please wait.`);
    let initialFiles = [];

    const thumbnailPath = path.join(process.cwd(), guide.thumbnailPath);
    if (guide.thumbnailPath && fs.existsSync(thumbnailPath)) {
      initialFiles.push({ attachment: thumbnailPath, name: path.basename(guide.thumbnailPath) });
    } else if (guide.thumbnailPath) {
      logger.warn(`Thumbnail not found: ${thumbnailPath}`);
      initialContent += `\n*[Thumbnail missing: ${path.basename(guide.thumbnailPath)}]*`;
    }

    // Fallback loading image if no thumbnail and loading.png exists
    const loadingImagePath = path.join(process.cwd(), 'public/images/loading.png');
    if (!initialFiles.length && fs.existsSync(loadingImagePath)) {
      initialFiles.push({ attachment: loadingImagePath, name: 'loading.png' });
    }

    const thread = await channel.threads.create({
      name: guide.threadName,
      message: { content: initialContent, files: initialFiles },
      autoArchiveDuration: 60,
    });

    const sendMessage = async (content, imagePath) => {
      let options = {};
      if (imagePath) {
        const absolutePath = path.join(process.cwd(), imagePath);
        if (fs.existsSync(absolutePath)) {
          options.files = [{ attachment: absolutePath, name: path.basename(absolutePath) }];
        } else {
          logger.warn(`Image file not found: ${absolutePath}`);
          content = (content || '') + `\n*[Image missing: ${path.basename(imagePath)}]*`;
        }
      }

      if (content) {
        content = replaceEmojis(content);
        
        // Discord message limit is 2000 characters
        const MAX_LEN = 2000;
        if (content.length <= MAX_LEN) {
          await thread.send({ content, ...options });
        } else {
          // Split into chunks
          let chunks = [];
          let currentChunk = '';
          const lines = content.split('\n');
          for (const line of lines) {
            if ((currentChunk + line + '\n').length <= MAX_LEN) {
              currentChunk += line + '\n';
            } else {
              if (currentChunk) chunks.push(currentChunk.trimEnd());
              currentChunk = line + '\n';
            }
          }
          if (currentChunk) chunks.push(currentChunk.trimEnd());

          // Send first chunk with files (if any), subsequent chunks without files
          for (let i = 0; i < chunks.length; i++) {
            const chunkOptions = (i === 0 && options.files) ? { files: options.files } : {};
            await thread.send({ content: chunks[i], ...chunkOptions });
          }
        }
      } else if (options.files) {
        await thread.send(options);
      }
    };

    // Send all messages
    for (const msg of guide.messages) {
      await sendMessage(msg.content, msg.imagePath);
    }

    await thread.send(replaceEmojis('{SUCCESS} Forum guide created successfully!'));
    res.json({ success: true, threadUrl: thread.url });
  } catch (err) {
    logger.error(`Failed to create ${guideType} guide:`, err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;