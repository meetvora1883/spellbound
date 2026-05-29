// commands/dm/send_member.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const DMManager = require('../../systems/dm/dmManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send_member')
    .setDescription('Send DM to all members with Member role')
    .addAttachmentOption(opt => opt
      .setName('attachment')
      .setDescription('Optional attachment (PNG/JPG/GIF/MP4)')
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const guildName = guild ? guild.name : 'Unknown Guild';

    // Permission check
    if (!db.hasDMPermission(userId, 'member') && interaction.user.id !== process.env.OWNER_ID) {
      // 🔹 NEW: Log denied attempt
      logger.warn(`❌ Missing DM permission "member": User ${interaction.user.tag} (${userId}) tried /send_member in guild ${guildName} (${guildId})`);
      return interaction.reply({
        content: '❌ You need "member" DM permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Check if role ID is configured
    const roleId = db.getDMRole(guildId, 'member');
    if (!roleId) {
      return interaction.reply({
        content: '❌ Member role has not been configured. Use `/dm_set_roles` first.',
        flags: MessageFlags.Ephemeral
      });
    }

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

    const operationId = DMManager.generateOperationId(userId);
    DMManager.storeOperation(operationId, {
      commandName: 'send_member',
      roleType: 'member',
      roleId,
      attachment,
      guildId
    });

    const modal = DMManager.createBulkDMModal(operationId, 'Member');
    await interaction.showModal(modal);
  }
};