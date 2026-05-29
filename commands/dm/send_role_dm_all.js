const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const DMManager = require('../../systems/dm/dmManager');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send_role_dm_all')
    .setDescription('Send a DM to all members of a specified role')
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('The role whose members will receive the DM')
        .setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName('attachment')
        .setDescription('Optional attachment (PNG/JPG/GIF/MP4)')
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const guildName = guild?.name || 'Unknown Guild';
    const userTag = interaction.user.tag;

    // 1. Permission check – user must have "dm_all" permission or be owner
    if (!db.hasDMPermission(userId, 'dm_all') && userId !== process.env.OWNER_ID) {
      logger.warn(`<a:Red_cross_mark:1479397724603416606> Missing DM permission "dm_all": User ${userTag} (${userId}) tried /send_role_dm_all in guild ${guildName} (${guildId})`);
      return interaction.reply({
        content: '<a:Red_cross_mark:1479397724603416606> You need **dm_all** permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    // 2. Get the role
    const role = interaction.options.getRole('role');
    if (!role) {
      return interaction.reply({
        content: '<a:Red_cross_mark:1479397724603416606> Role not found.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Prevent accidentally pinging @everyone
    if (role.id === guildId) {
      return interaction.reply({
        content: '<a:Red_cross_mark:1479397724603416606> Cannot send DMs to the @everyone role.',
        flags: MessageFlags.Ephemeral
      });
    }

    // 3. Validate attachment (if any)
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

    // 4. Generate operation and show modal
    const operationId = DMManager.generateOperationId(userId);
    DMManager.storeOperation(operationId, {
      commandName: 'send_role_dm_all',
      roleId: role.id,
      attachment: attachment,
      guildId: guildId
    });

    const modal = DMManager.createBulkDMModal(operationId, role.name);
    await interaction.showModal(modal);
  }
};