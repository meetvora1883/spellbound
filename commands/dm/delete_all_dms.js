const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { logger } = require('../../utils/logger');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_all_dms')
    .setDescription('Delete all bot messages in a user\'s DMs (owner only)')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user whose DMs will be cleaned')
        .setRequired(true)
    )
    .addBooleanOption(opt =>
      opt.setName('confirm')
        .setDescription('Confirm deletion (required)')
        .setRequired(true)
    ),

  // This command is adminOnly and also owner-only by permission middleware
  // We'll also check if user has dm:delete permission or is owner
  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const confirm = interaction.options.getBoolean('confirm');
    const userId = interaction.user.id;

    // Permission check: must be bot owner OR have dm:delete permission
    const isOwner = (userId === client.ownerId);
    const hasDMPerm = db?.hasDMPermission ? db.hasDMPermission(userId, 'dm:delete') : false; // if db exists

    if (!isOwner && !hasDMPerm) {
      return interaction.reply({
        content: '❌ You do not have permission to delete DMs. This command requires the `dm:delete` permission or bot owner.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!confirm) {
      return interaction.reply({
        content: '❌ Deletion not confirmed. Please set `confirm: true` to proceed.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Fetch DM channel
      const dmChannel = await targetUser.createDM().catch(() => null);
      if (!dmChannel) {
        return interaction.editReply('❌ Could not open DM with that user (they may have DMs disabled).');
      }

      let deletedCount = 0;
      let lastId = null;
      let batchCount = 0;

      await interaction.editReply(`🗑️ Scanning DMs with **${targetUser.tag}**...`);

      // Loop until no more messages
      while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await dmChannel.messages.fetch(options);
        if (messages.size === 0) break;

        // Filter messages sent by the bot
        const botMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (botMessages.size > 0) {
          // Delete in batches (Discord allows bulk delete only in guilds, not DMs – so we delete one by one)
          for (const msg of botMessages.values()) {
            await msg.delete().catch(err => logger.warn(`Could not delete message ${msg.id}: ${err}`));
            deletedCount++;
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // If we fetched fewer than 100, we've reached the end
        if (messages.size < 100) break;

        // Set lastId to the oldest message in this batch for next iteration
        lastId = messages.last().id;
        batchCount++;

        // Update status every few batches
        if (batchCount % 5 === 0) {
          await interaction.editReply(`🗑️ Deleted **${deletedCount}** messages so far...`);
        }
      }

      logger.info(`Deleted ${deletedCount} bot messages in DMs with ${targetUser.tag} (${targetUser.id}) by ${interaction.user.tag}`);
      await interaction.editReply(`✅ Successfully deleted **${deletedCount}** bot messages in DMs with **${targetUser.tag}**.`);
    } catch (error) {
      logger.error('Error deleting DMs:', error);
      await interaction.editReply(`❌ An error occurred: ${error.message}`);
    }
  }
};