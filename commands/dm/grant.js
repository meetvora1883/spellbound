const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

const PERMISSION_CHOICES = [
  { name: 'DM All', value: 'dm_all' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm_grant')
    .setDescription('Grant DM sending permission to a user (Owner only)')
    .addUserOption(opt => opt.setName('user').setDescription('User to grant').setRequired(true))
    .addStringOption(opt => opt
      .setName('permission')
      .setDescription('Permission type')
      .setRequired(true)
      .addChoices(...PERMISSION_CHOICES)
    ),

  async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ 
        content: '<a:Red_cross_mark:1479397724603416606> Only the bot owner can grant DM permissions.',
        flags: MessageFlags.Ephemeral 
      });
    }

    const targetUser = interaction.options.getUser('user');
    const permission = interaction.options.getString('permission');

    let context = '';
    if (interaction.guild) {
      context = ` in guild ${interaction.guild.name} (${interaction.guildId})`;
    }

    db.grantDMPermission(targetUser.id, permission, interaction.user.id);
    logger.success(`DM permission "${permission}" granted to ${targetUser.tag}${context} by owner ${interaction.user.tag}`);

    await interaction.reply({
      content: `<a:Green_tick:1479397724603416606> Granted **${permission}** DM permission to ${targetUser.tag}.`,
      flags: MessageFlags.Ephemeral
    });
  }
};