const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { formatDateDisplay } = require('../../utils/dateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warboard_listdates')
    .setDescription('List all war dates with assignments'),
  
  async execute(interaction) {
    const guildId = interaction.guildId;
    const dates = db.getWarboardDates(guildId);
    
    if (dates.length === 0) {
      return interaction.reply({ content: '📭 No warboards found.', flags: MessageFlags.Ephemeral });
    }
    
    const displayDates = dates.map(d => `• ${formatDateDisplay(d)}`);
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('<a:calendar:1479397729875660872> Warboard Dates')
      .setDescription(displayDates.join('\n'))
      .setFooter({ text: `Total: ${dates.length}` });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};