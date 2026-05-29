// commands/might/might_setchannel.js
const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('might_setchannel')
    .setDescription('Set the channel for automatic might reports')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to send reports to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;

    db.setMightReportChannel(guildId, channel.id);
    logger.info(`Might report channel set to #${channel.name} in guild ${guildId} by ${interaction.user.tag}`);

    await interaction.reply({
      content: `<a:Green_tick_mark:1479393702031134730> Might reports will be sent to ${channel}.`,
      flags: MessageFlags.Ephemeral
    });
  }
};