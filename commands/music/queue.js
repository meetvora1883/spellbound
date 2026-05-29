const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const emojis = require('../../constants/emojis');

module.exports = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Show the current music queue'),
  async execute(interaction, client) {
    const queue = client.music.getQueue(interaction.guild.id);
    if (!queue || !queue.current) {
      return interaction.reply({ content: `${emojis.ERROR} Nothing is playing.`, flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${emojis.MUSIC} Music Queue`)
      .setDescription(`**Now Playing:** ${queue.current.info.title}`)
      .setFooter({ text: `Queue length: ${queue.queue.length} songs` });

    if (queue.queue.length) {
      const tracks = queue.queue.slice(0, 10).map((track, i) => `${i+1}. ${track.info.title}`).join('\n');
      embed.addFields({ name: 'Up next', value: tracks || 'None' });
      if (queue.queue.length > 10) embed.addFields({ name: '...', value: `and ${queue.queue.length - 10} more` });
    }

    await interaction.reply({ embeds: [embed] });
  }
};