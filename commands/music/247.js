const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const emojis = require('../../constants/emojis');

module.exports = {
  data: new SlashCommandBuilder().setName('247').setDescription('Toggle 24/7 mode'),
  async execute(interaction, client) {
    const current = client.music.is24h(interaction.guild.id);
    client.music.set24h(interaction.guild.id, !current);
    interaction.reply({ content: `${emojis.REPEAT} 24/7 mode is now **${!current ? 'enabled' : 'disabled'}**.`, flags: MessageFlags.Ephemeral });
  }
};