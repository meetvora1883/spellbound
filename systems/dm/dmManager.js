// systems/dm/dmManager.js
const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { logger } = require('../../utils/logger');

// Store active operations (modal sessions)
const activeOperations = new Map();

class DMManager {
  /**
   * Generate a unique operation ID for modal flow
   */
  static generateOperationId(userId) {
    return `${Date.now()}_${userId}`;
  }

  /**
   * Store operation data with auto-cleanup (5 minutes)
   */
  static storeOperation(operationId, data) {
    activeOperations.set(operationId, data);
    setTimeout(() => {
      if (activeOperations.has(operationId)) {
        activeOperations.delete(operationId);
        logger.debug(`Cleaned up expired DM operation: ${operationId}`);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Retrieve and delete operation data
   */
  static retrieveOperation(operationId) {
    const data = activeOperations.get(operationId);
    activeOperations.delete(operationId);
    return data;
  }

  /**
   * Create modal for individual DM
   */
  static createIndividualDMModal(operationId) {
    const modal = new ModalBuilder()
      .setCustomId(`dm_modal_${operationId}`)
      .setTitle('Send Individual DM');

    const messageInput = new TextInputBuilder()
      .setCustomId('message')
      .setLabel('Message Content')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Enter your message here...\nUse shift+enter for new lines');

    const thumbnailInput = new TextInputBuilder()
      .setCustomId('thumbnail')
      .setLabel('Thumbnail URL (Optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('https://example.com/image.png');

    const colorInput = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Embed Color (Optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('#1E90FF (default: #5865F2)');

    modal.addComponents(
      new ActionRowBuilder().addComponents(messageInput),
      new ActionRowBuilder().addComponents(thumbnailInput),
      new ActionRowBuilder().addComponents(colorInput)
    );
    return modal;
  }

  /**
   * Create modal for bulk DM (role-based)
   */
  static createBulkDMModal(operationId, roleName) {
    const modal = new ModalBuilder()
      .setCustomId(`bulk_dm_modal_${operationId}`)
      .setTitle(`Send DM to ${roleName}`);

    const messageInput = new TextInputBuilder()
      .setCustomId('message')
      .setLabel('Message Content')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Enter your message here...\nUse shift+enter for new lines');

    const thumbnailInput = new TextInputBuilder()
      .setCustomId('thumbnail')
      .setLabel('Thumbnail URL (Optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('https://example.com/image.png');

    const colorInput = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Embed Color (Optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('#1E90FF (default: #5865F2)');

    modal.addComponents(
      new ActionRowBuilder().addComponents(messageInput),
      new ActionRowBuilder().addComponents(thumbnailInput),
      new ActionRowBuilder().addComponents(colorInput)
    );
    return modal;
  }

  /**
   * Parse Discord content (emoji shortcodes → actual emoji)
   */
  static parseDiscordContent(content) {
    const emojiMap = {
      ':snowflake:': '❄️',
      ':warning:': '⚠️',
      ':gift:': '🎁',
      ':mobile_phone:': '📱',
      ':ice_cube:': '🧊',
      ':small_blue_diamond:': '🔹',
      ':trophy:': '🏆',
      ':crossed_swords:': '⚔️',
      ':hourglass_flowing_sand:': '⏳',
      ':white_check_mark:': '✅',
      ':x:': '❌'
    };
    let parsed = content;
    Object.entries(emojiMap).forEach(([code, emoji]) => {
      parsed = parsed.replace(new RegExp(code, 'g'), emoji);
    });
    return parsed;
  }

  /**
   * Validate hex color → integer for EmbedBuilder
   */
  static validateColor(color) {
    if (!color) return 0x5865F2;
    const hex = color.replace('#', '');
    if (/^[0-9A-F]{6}$/i.test(hex)) {
      return parseInt(hex, 16);
    }
    return 0x5865F2;
  }

  /**
   * Send a single DM with embed + optional attachment
   */
  static async sendDM(user, content, attachment, guild, thumbnail, color) {
    try {
      const parsedContent = this.parseDiscordContent(content);
      const embed = new EmbedBuilder()
        .setColor(this.validateColor(color))
        .setDescription(parsedContent)
        .setTimestamp()
        .setFooter({ text: guild.name });

      if (thumbnail && thumbnail.startsWith('http')) {
        embed.setThumbnail(thumbnail);
      }

      const options = { embeds: [embed] };
      if (attachment && attachment.url && attachment.url.startsWith('http')) {
        options.files = [{
          attachment: attachment.url,
          name: attachment.name || 'attachment'
        }];
      }

      await user.send(options);
      logger.success(`DM sent to ${user.tag} (${user.id})`);
      return { success: true, user: user.tag, userId: user.id };
    } catch (error) {
      const reason = error.code === 50007 ? 'DM closed/blocked' : error.message;
      logger.error(`DM failed for ${user.tag}: ${reason}`);
      return { success: false, user: user.tag, userId: user.id, reason };
    }
  }

  /**
   * Send DMs in batches of 5 with delay
   */
  static async sendDMsInBatches(members, content, attachment, guild, thumbnail, color) {
    const results = [];
    const BATCH_SIZE = 5;
    const DELAY_MS = 2000;

    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const batch = members.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(member => {
        if (member.user.bot) {
          return Promise.resolve({ success: false, user: member.user.tag, reason: 'Bot user' });
        }
        return this.sendDM(member.user, content, attachment, guild, thumbnail, color);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.value || r.reason));
      
      logger.info(`DM batch progress: ${i + batch.length}/${members.length}`);
      if (i + BATCH_SIZE < members.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    return results;
  }

    /**
   * Generate beautiful boxed console log – PLAIN WHITE, perfect borders, exact fit.
   */
  static generateBoxedLog(serverName, targetName, results) {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    // Prepare all lines to be displayed
    const lines = [
      `Server: ${serverName}`,
      `Target: ${targetName}`,
      `Total: ${results.length}  ✅ ${successful}  ❌ ${failed}`,
      ...results.slice(0, 10).map(r => `${r.user} - ${r.success ? '✅ Sent' : '❌ Failed'}`)
    ];

    if (results.length > 10) {
      lines.push(`... and ${results.length - 10} more users`);
    }

    // Calculate the maximum line length (plain text, no colour codes)
    const maxLineLength = Math.max(...lines.map(l => l.length));
    // Box width = longest line + 4 (for borders and padding) – no forced minimum
    const boxWidth = Math.min(maxLineLength + 4, 70); // cap at 70 to avoid ultra-wide

    // Box drawing characters
    const top = `┌${'─'.repeat(boxWidth - 2)}┐`;
    const mid = `├${'─'.repeat(boxWidth - 2)}┤`;
    const bottom = `└${'─'.repeat(boxWidth - 2)}┘`;

    // Pad a single line to fit exactly inside the box (no trailing spaces)
    const pad = (text) => {
      // Truncate if too long (should not happen because boxWidth is based on max length)
      const cleanText = text.length > boxWidth - 4 ? text.slice(0, boxWidth - 7) + '...' : text;
      const padding = boxWidth - 2 - cleanText.length;
      return `│ ${cleanText}${' '.repeat(padding)}│`;
    };

    // Build the box – plain text, no ANSI codes
    let log = '';
    log += top + '\n';
    log += pad(lines[0]) + '\n';
    log += pad(lines[1]) + '\n';
    log += pad(lines[2]) + '\n';
    log += mid + '\n';

    // User results (first 10)
    results.slice(0, 10).forEach(r => {
      const status = r.success ? '✅ Sent' : '❌ Failed';
      const line = `${r.user} - ${status}`;
      log += pad(line) + '\n';
    });

    if (results.length > 10) {
      log += mid + '\n';
      log += pad(lines[lines.length - 1]) + '\n';
    }

    log += bottom;
    return log;
  }
}

module.exports = DMManager;