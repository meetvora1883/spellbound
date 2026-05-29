// systems/banNotifier.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { logger } = require('../utils/logger');
const db = require('../database');

/**
 * Notify the bot owner of a ban with action buttons.
 * @param {object} client - Discord client
 * @param {object} opts
 * @param {string} opts.adminName         - Web panel username who triggered the ban
 * @param {string} opts.reason            - Ban reason
 * @param {string} opts.discordId         - Banned Discord ID (the incoming user)
 * @param {string} opts.discordUsername   - Discord username of the banned user
 * @param {number} opts.webUserId         - Web user ID (if linked)
 * @param {string} opts.webUsername       - Web panel username (for button label)
 * @param {string} [opts.originalDiscordId]       - Previously linked Discord ID
 * @param {string} [opts.originalDiscordUsername] - Username of original Discord ID
 */
async function notifyOwnerOfBan(client, opts) {
  const {
    adminName,
    reason,
    discordId,
    discordUsername,
    webUserId,
    webUsername,
    originalDiscordId,
    originalDiscordUsername
  } = opts;

  try {
    const owner = await client.users.fetch(process.env.OWNER_ID);
    if (!owner) return logger.error('Owner not found for ban notification');

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔨 Account Banned')
      .setDescription('A user has been banned from the panel.')
      .addFields(
        { name: 'Admin', value: adminName, inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Banned Discord', value: `${discordUsername} (${discordId})`, inline: true }
      );

    if (originalDiscordId) {
      embed.addFields({
        name: 'Original Discord',
        value: `${originalDiscordUsername || 'Unknown'} (${originalDiscordId})`,
        inline: true
      });
    }

    if (webUserId) {
      embed.addFields({ name: 'Web User', value: `${webUsername || 'Unknown'} (ID: ${webUserId})`, inline: true });
    }

    embed.addFields({ name: 'Date', value: new Date().toLocaleString(), inline: true });
    embed.setTimestamp();

    const components = [];

    // Button 1 – Unlock web user (shows web panel username)
    if (webUserId && webUsername) {
      components.push(
        new ButtonBuilder()
          .setCustomId(`unban_pass_${webUserId}`)
          .setLabel(`🔓 Unban Password (${webUsername})`)
          .setStyle(ButtonStyle.Primary)
      );
    } else if (webUserId) {
      components.push(
        new ButtonBuilder()
          .setCustomId(`unban_pass_${webUserId}`)
          .setLabel(`🔓 Unban Password (ID ${webUserId})`)
          .setStyle(ButtonStyle.Primary)
      );
    }

    // Button 2 – Unban the new Discord user (shows Discord username)
    components.push(
      new ButtonBuilder()
        .setCustomId(`unban_discord_${discordId}`)
        .setLabel(`🔨 Unban Discord (${discordUsername})`)
        .setStyle(ButtonStyle.Danger)
    );

    // Button 3 – Unban both (web + new Discord)
    if (webUserId) {
      components.push(
        new ButtonBuilder()
          .setCustomId(`unban_both_${webUserId}_${discordId}`)
          .setLabel(`✅ Unban Both (${webUsername || webUserId} & ${discordUsername})`)
          .setStyle(ButtonStyle.Success)
      );
    }

    // Button 4 – Unban original Discord ID (if different)
    if (originalDiscordId && originalDiscordId !== discordId) {
      components.push(
        new ButtonBuilder()
          .setCustomId(`unban_discord_${originalDiscordId}`)
          .setLabel(`🔓 Unban Original (${originalDiscordUsername || originalDiscordId})`)
          .setStyle(ButtonStyle.Secondary)
      );
    }

    const rows = [];
    for (let i = 0; i < components.length; i += 3) {
      rows.push(new ActionRowBuilder().addComponents(components.slice(i, i + 3)));
    }

    await owner.send({ embeds: [embed], components: rows });
    logger.success(`Ban notification sent to owner for Discord ID ${discordId}`);
  } catch (err) {
    logger.error('Failed to send ban notification to owner:', err);
  }
}

/**
 * Handle unban button clicks (owner only)
 */
// systems/banNotifier.js
async function handleBanButton(interaction) {
  if (interaction.user.id !== process.env.OWNER_ID) {
    return interaction.reply({ content: 'Only the bot owner can use these buttons.', ephemeral: true });
  }

  const customId = interaction.customId;

  try {
    // ========== UNLOCK WEB USER (Unban Password) ==========
    if (customId.startsWith('unban_pass_')) {
      const webUserId = customId.split('_')[2];
      const status = db.getWebUserStatus(webUserId);
      if (status !== 'locked') {
        return interaction.reply({ content: 'That web user is not locked.', ephemeral: true });
      }

      // Generate new password
      const crypto = require('crypto');
      const newPassword = crypto.randomBytes(8).toString('hex');           // 16-char hex
      const bcrypt = require('bcrypt');
      const hash = bcrypt.hashSync(newPassword, 10);
      db.db.prepare('UPDATE web_users SET password_hash = ?, status = ? WHERE id = ?')
        .run(hash, 'active', webUserId);

      // Fetch username
      const user = db.db.prepare('SELECT username FROM web_users WHERE id = ?').get(webUserId);

      return interaction.reply({
        content: `✅ Web user **${user?.username || webUserId}** unlocked.\n🔑 **New password:** \`${newPassword}\``,
        ephemeral: true
      });
    }

    // ========== UNBAN DISCORD ID ==========
    if (customId.startsWith('unban_discord_')) {
      const discordId = customId.split('_')[2];
      if (!db.isDiscordBanned(discordId)) {
        return interaction.reply({ content: 'That Discord ID is not banned.', ephemeral: true });
      }
      db.unbanDiscordId(discordId);
      return interaction.reply({ content: `✅ Discord ID **${discordId}** has been unbanned.`, ephemeral: true });
    }

    // ========== UNBAN BOTH (web user + Discord) ==========
    if (customId.startsWith('unban_both_')) {
      const parts = customId.split('_');
      const webUserId = parts[2];
      const discordId = parts[3];

      const wasLocked = db.getWebUserStatus(webUserId) === 'locked';
      const wasBanned = db.isDiscordBanned(discordId);

      if (!wasLocked && !wasBanned) {
        return interaction.reply({ content: 'Neither the web user is locked nor the Discord ID is banned.', ephemeral: true });
      }

      // Unlock & generate password if locked
      let newPassword = null;
      if (wasLocked) {
        const crypto = require('crypto');
        newPassword = crypto.randomBytes(8).toString('hex');
        const bcrypt = require('bcrypt');
        const hash = bcrypt.hashSync(newPassword, 10);
        db.db.prepare('UPDATE web_users SET password_hash = ?, status = ? WHERE id = ?')
          .run(hash, 'active', webUserId);
      }
      if (wasBanned) db.unbanDiscordId(discordId);

      const user = db.db.prepare('SELECT username FROM web_users WHERE id = ?').get(webUserId);
      let msg = `✅ Web user **${user?.username || webUserId}** unlocked and Discord ID **${discordId}** unbanned.`;
      if (newPassword) msg += `\n🔑 **New password:** \`${newPassword}\``;

      return interaction.reply({ content: msg, ephemeral: true });
    }

    return interaction.reply({ content: 'Unknown action.', ephemeral: true });
  } catch (err) {
    logger.error(`Unban button error: ${err.message}`);
    return interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
  }
}

module.exports = { notifyOwnerOfBan, handleBanButton };