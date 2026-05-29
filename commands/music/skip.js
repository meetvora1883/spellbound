const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const emojis = require('../../constants/emojis');

module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  async execute(interaction, client) {
    const queue = client.music.getQueue(interaction.guild.id);
    if (!queue || !queue.current) return interaction.reply({ content: `${emojis.ERROR} Nothing is playing.`, flags: MessageFlags.Ephemeral });
    await client.music.skip(interaction.guild.id);
    interaction.reply(`${emojis.SKIP} Skipped the current song.`);
  }
};