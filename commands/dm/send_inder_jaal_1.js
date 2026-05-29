const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const DMManager = require('../../systems/dm/dmManager');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send_inder_jaal_1')
    .setDescription('Send DM to Inder Jaal 1 members')
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

    // 🔹 Permission check with denial log
    if (!db.hasDMPermission(userId, 'inder_jaal_1') && interaction.user.id !== process.env.OWNER_ID) {
      logger.warn(`❌ Missing DM permission "inder_jaal_1": User ${userTag} (${userId}) tried /send_inder_jaal_1 in guild ${guildName} (${guildId})`);
      return interaction.reply({
        content: '❌ You need **inder_jaal_1** DM permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    // 🔹 Check if role ID is configured
    const roleId = db.getDMRole(guildId, 'inder_jaal_1');
    if (!roleId) {
      return interaction.reply({
        content: '❌ Inder Jaal 1 role has not been configured. Use `/dm_set_roles` first.',
        flags: MessageFlags.Ephemeral
      });
    }

    // 🔹 Attachment validation
    const attachment = interaction.options.getAttachment('attachment');
    if (attachment) {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'video/mp4'];
      if (!allowed.includes(attachment.contentType)) {
        return interaction.reply({
          content: '❌ Invalid attachment type. Only PNG, JPG, GIF, or MP4 allowed.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // 🔹 Generate operation and show modal
    const operationId = DMManager.generateOperationId(userId);
    DMManager.storeOperation(operationId, {
      commandName: 'send_inder_jaal_1',
      roleType: 'inder_jaal_1',
      roleId,
      attachment,
      guildId
    });

    const modal = DMManager.createBulkDMModal(operationId, 'Inder Jaal 1');
    await interaction.showModal(modal);
  }
};