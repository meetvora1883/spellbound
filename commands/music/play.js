const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const emojis = require('../../constants/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song, playlist, or saved playlist')
    .addStringOption(opt => opt.setName('query').setDescription('Song name, URL, or saved playlist name').setRequired(true)),
  async execute(interaction, client) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) return interaction.reply({ content: `${emojis.ERROR} You need to be in a voice channel.`, flags: MessageFlags.Ephemeral });

    const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return interaction.reply({ content: `${emojis.ERROR} I need permission to connect and speak in that voice channel.`, flags: MessageFlags.Ephemeral });
    }

    const query = interaction.options.getString('query');
    await interaction.deferReply();

    try {
      await client.music.joinVoice(interaction.guild.id, voiceChannel.id, interaction.channel.id);
    } catch (err) {
      return interaction.editReply(`${emojis.ERROR} Could not join the voice channel.`);
    }

    // Check saved playlist
    const playlist = db.getPlaylist(interaction.guild.id, interaction.user.id, query);
    if (playlist) {
      const tracks = JSON.parse(playlist.tracks);
      const loadedTracks = [];
      for (const trackData of tracks) {
        const res = await client.music.search(trackData.url, interaction.user);
        if (res && res.loadType !== 'NO_MATCHES') loadedTracks.push(...res.tracks);
      }
      if (loadedTracks.length) {
        client.music.addToQueue(interaction.guild.id, loadedTracks);
        return interaction.editReply(`${emojis.PLAYLIST} Loaded playlist **${playlist.name}** (${loadedTracks.length} songs).`);
      }
      return interaction.editReply(`${emojis.ERROR} No playable tracks found.`);
    }

    // Search (YouTube, SoundCloud, Spotify)
    const result = await client.music.search(query, interaction.user);
    if (!result || result.loadType === 'NO_MATCHES') {
      return interaction.editReply(`${emojis.ERROR} No results found.`);
    }

    if (result.loadType === 'PLAYLIST_LOADED') {
      client.music.addToQueue(interaction.guild.id, result.tracks);
      interaction.editReply(`${emojis.PLAYLIST} Added playlist **${result.playlist.name}** (${result.tracks.length} songs).`);
    } else {
      client.music.addToQueue(interaction.guild.id, result.tracks[0]);
      interaction.editReply(`${emojis.MUSIC} Added to queue: **${result.tracks[0].info.title}**`);
    }
  }
};