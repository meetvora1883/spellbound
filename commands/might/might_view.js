// commands/might/might_view.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { formatMight } = require('../../utils/dateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('might_view')
    .setDescription('View the current might differences for all players'),

  async execute(interaction) {
    const guildId = interaction.guildId;

    const differences = db.getMightDifferences(guildId);
    if (differences.length === 0) {
      return interaction.reply({ content: 'No might data available yet.', flags: MessageFlags.Ephemeral });
    }

    // Build a formatted list
    let description = '';
    for (const d of differences) {
      const prev = formatMight(d.previous_might);
      const curr = formatMight(d.current_might);
      const change = (d.change > 0 ? '+' : '') + formatMight(d.change);
      description += `**${d.username}** \`${d.user_id}\`\n`;
      description += `Previous: ${prev} | Current: ${curr} | Change: ${change}\n\n`;
      if (description.length > 4000) break; // embed limit
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('<a:Chart_2:1479423284104790067> Might Differences')
      .setDescription(description || 'No data')
      .setFooter({ text: `Total players: ${differences.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};