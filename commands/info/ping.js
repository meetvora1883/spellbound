const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),

  async execute(interaction, client) {

    await interaction.reply({
      content: 'Pinging...',
      flags: MessageFlags.Ephemeral
    });

    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    await interaction.editReply({
      content: `<a:pong:1479422328088690830> Pong!\n**Bot Latency:** ${latency}ms\n**API Latency:** ${apiLatency}ms`
    });

  }
};
