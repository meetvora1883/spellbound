// systems/might/mightNotifier.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

async function notifyAdminsOfSubmission(client, guildId, submission) {
  logger.debug(`[MightNotifier] Starting notification for submission ${submission.id} in guild ${guildId}`);
  const admins = db.getGuildAdmins(guildId);
  if (!admins.length) {
    logger.debug(`[MightNotifier] No admins found for guild ${guildId}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('New Might Submission')
    .setDescription(
      `**User:** ${submission.username} (${submission.user_id})\n` +
      `**In‑game name:** ${submission.in_game_name}\n` +
      `**Might:** ${submission.submitted_might}\n` +
      `**Submitted:** <t:${Math.floor(submission.submitted_at / 1000)}:R>`
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_${submission.id}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject_${submission.id}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)
  );

  for (const adminId of admins) {
    try {
      const admin = await client.users.fetch(adminId);
      const sentMessage = await admin.send({ embeds: [embed], components: [row] });
      // Store the DM for later updates
      db.storeSubmissionDM(submission.id, adminId, sentMessage.channel.id, sentMessage.id);
      logger.success(`[MightNotifier] DM sent to ${admin.tag} (${adminId})`);
    } catch (err) {
      logger.error(`[MightNotifier] Failed to DM admin ${adminId}: ${err.message}`);
    }
  }
}

module.exports = { notifyAdminsOfSubmission };