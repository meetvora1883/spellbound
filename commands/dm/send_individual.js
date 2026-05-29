const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const DMManager = require('../../systems/dm/dmManager');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send_individual')
    .setDescription('Send DM to a specific user')
    .addUserOption(opt => opt.setName('user').setDescription('User to DM').setRequired(true))
    .addAttachmentOption(opt =>
      opt.setName('attachment')
        .setDescription('Optional attachment (PNG/JPG/GIF/MP4)')
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const guildName = guild ? guild.name : 'Unknown Guild';
    const userTag = interaction.user.tag;

    // 🔹 Permission check: ANY DM permission is sufficient for individual DM
    if (!db.hasDMPermission(userId) && interaction.user.id !== process.env.OWNER_ID) {
      logger.warn(`<a:Red_cross_mark:1479397724603416606> Missing any DM permission: User ${userTag} (${userId}) tried /send_individual in guild ${guildName} (${guildId})`);
      return interaction.reply({
        content: '<a:Red_cross_mark:1479397724603416606> You need at least one DM permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    // 🔹 Attachment validation
    const attachment = interaction.options.getAttachment('attachment');
    if (attachment) {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'video/mp4'];
      if (!allowed.includes(attachment.contentType)) {
        return interaction.reply({
          content: '<a:Red_cross_mark:1479397724603416606> Invalid attachment type. Only PNG, JPG, GIF, or MP4 allowed.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // 🔹 Target user
    const targetUser = interaction.options.getUser('user');

    const operationId = DMManager.generateOperationId(userId);
    DMManager.storeOperation(operationId, {
      commandName: 'send_individual',
      attachment,
      guildId,
      targetUserId: targetUser.id
    });

    const modal = DMManager.createIndividualDMModal(operationId);
    await interaction.showModal(modal);
  }
};