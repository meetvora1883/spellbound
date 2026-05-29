// systems/backup.js
const { AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Sends the SQLite database file to a configured Discord backup channel.
 * @param {object} client - The Discord client instance
 */
async function uploadBackup(client) {
  const dbPath = path.join(__dirname, '../database/database.sqlite');

  if (!process.env.BACKUP_CHANNEL_ID || !client) {
    logger.warn('Backup skipped – BACKUP_CHANNEL_ID not set or client missing');
    return;
  }

  try {
    const channel = await client.channels.fetch(process.env.BACKUP_CHANNEL_ID);
    if (!channel) {
      logger.warn('Backup channel not found');
      return;
    }

    const attachment = new AttachmentBuilder(dbPath, {
      name: `warboard-backup-${new Date().toISOString().slice(0, 10)}.sqlite`
    });

    await channel.send({
      content: `📦 **Daily Database Backup** – ${new Date().toLocaleString()}`,
      files: [attachment]
    });

    logger.success('Backup sent to Discord channel');
  } catch (err) {
    logger.error('Discord backup failed:', err);
  }
}

// 🟢 THIS EXPORT IS REQUIRED
module.exports = { uploadBackup };