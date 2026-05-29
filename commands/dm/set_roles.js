// commands/dm/set_roles.js
const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

const ROLE_TYPES = [
  { name: 'Member', value: 'member' },
  { name: 'Inder Jaal 1', value: 'inder_jaal_1' },
  { name: 'Inder Jaal 2', value: 'inder_jaal_2' },
  { name: 'Inder Jaal 3', value: 'inder_jaal_3' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm_set_roles')
    .setDescription('Configure role IDs for DM sending (Admin only)')
    .addStringOption(opt =>
      opt.setName('role_type')
        .setDescription('Select the role to configure')
        .setRequired(true)
        .addChoices(...ROLE_TYPES)
    )
    .addStringOption(opt =>
      opt.setName('role_id')
        .setDescription('Role ID (right-click role → Copy ID)')
        .setRequired(true)
    ),

  adminOnly: true, // requires guild admin

  async execute(interaction) {
    const guildId = interaction.guildId;
    const roleType = interaction.options.getString('role_type');
    const newRoleId = interaction.options.getString('role_id');
    const currentRoleId = db.getDMRole(guildId, roleType);

    // If already set, ask for confirmation via modal
    if (currentRoleId) {
      // Get role names for display
      let roleName = 'Unknown';
      try {
        const role = await interaction.guild.roles.fetch(currentRoleId);
        roleName = role ? role.name : 'Unknown';
      } catch {}

      const modal = new ModalBuilder()
        .setCustomId(`confirm_role_change_${roleType}_${newRoleId}_${Date.now()}`)
        .setTitle(`Change ${roleType} role?`);

      const textInput = new TextInputBuilder()
        .setCustomId('confirmation')
        .setLabel(`Current: ${roleName} (${currentRoleId})`)
        .setStyle(TextInputStyle.Short)
        .setValue('YES')
        .setRequired(true)
        .setPlaceholder('Type YES to confirm');

      const row = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } else {
      // No existing role – set directly
      db.setDMRole(guildId, roleType, newRoleId, interaction.user.id);
      logger.info(`DM role ${roleType} set to ${newRoleId} in guild ${guildId} by ${interaction.user.tag}`);
      await interaction.reply({
        content: `✅ **${roleType}** role ID has been set to \`${newRoleId}\`.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};