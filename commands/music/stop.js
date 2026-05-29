const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const emojis = require('../../constants/emojis');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop music and clear queue'),
  async execute(interaction, client) {
    const queue = client.music.getQueue(interaction.guild.id);
    if (!queue || !queue.current) return interaction.reply({ content: `${emojis.ERROR} Nothing is playing.`, flags: MessageFlags.Ephemeral });
    await client.music.stop(interaction.guild.id);
    interaction.reply(`${emojis.STOP} Stopped music and left the voice channel.`);
  }
};