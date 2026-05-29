const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { formatMight } = require('../../utils/dateUtils');
const { logger } = require('../../utils/logger');

const REPORT_PASSWORD = process.env.MIGHT_REPORT_PASSWORD || 'M@nsi.16'; // fallback for dev

module.exports = {
  data: new SlashCommandBuilder()
    .setName('might_report')
    .setDescription('Send the might difference report to the configured channel and reset baseline')
    .addStringOption(opt =>
      opt.setName('password')
        .setDescription('Password to execute this command')
        .setRequired(true)
    ),

  async execute(interaction) {
    const password = interaction.options.getString('password');
    if (password !== REPORT_PASSWORD) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Incorrect password.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const channelId = db.getMightReportChannel(guildId);
    if (!channelId) {
      return interaction.reply({ content: 'No report channel configured. Use `/might_setchannel` first.', flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      return interaction.reply({ content: 'Configured channel not found. Please set a new one.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const differences = db.getMightDifferences(guildId);
    if (differences.length === 0) {
      return interaction.editReply('No might data to report.');
    }

    // Build report with mentions
    let report = '**<a:Chart_2:1479423284104790067> Might Change Report**\n\n';
    for (const d of differences) {
      const prev = formatMight(d.previous_might);
      const curr = formatMight(d.current_might);
      const change = (d.change > 0 ? '+' : '') + formatMight(d.change);
      // If user_id is not null, mention; otherwise use username
      const userDisplay = d.user_id ? `<@${d.user_id}>` : d.username;
      report += `**${userDisplay}**\n`;
      report += `Previous: ${prev} | Current: ${curr} | Change: ${change}\n\n`;
    }

    // Split and send
    const chunks = [];
    let current = '';
    const lines = report.split('\n');
    for (const line of lines) {
      if (current.length + line.length + 1 > 1900) {
        chunks.push(current);
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }
    if (current) chunks.push(current);

    for (const chunk of chunks) {
      await channel.send(chunk);
    }

    // Reset baseline
    db.resetMightBaseline(guildId);
    logger.info(`Might report sent and baseline reset for guild ${guildId} by ${interaction.user.tag}`);

    await interaction.editReply(`<a:Green_tick:1479397724603416606> Report sent to ${channel} and baseline reset.`);
  }
};