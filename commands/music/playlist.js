const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const emojis = require('../../constants/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your saved playlists')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create playlist from URL')
        .addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true))
        .addStringOption(opt => opt.setName('link').setDescription('YouTube/SoundCloud/Spotify playlist URL').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add tracks to existing playlist')
        .addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true))
        .addStringOption(opt => opt.setName('link').setDescription('YouTube/SoundCloud/Spotify playlist URL').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('load')
        .setDescription('Load a saved playlist into the queue')
        .addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List your saved playlists')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a saved playlist')
        .addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true))
    ),
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === 'create') {
      const name = interaction.options.getString('name');
      const link = interaction.options.getString('link');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Search using musicManager (handles all sources)
      const result = await client.music.search(link, interaction.user);
      if (!result || result.loadType !== 'PLAYLIST_LOADED') {
        return interaction.editReply(`${emojis.ERROR} Not a valid playlist. Make sure the URL is correct and the playlist is public.`);
      }

      const tracks = result.tracks.map(t => ({
        title: t.info.title,
        url: t.info.uri,
        duration: t.info.length
      }));

      try {
        db.createPlaylist(guildId, userId, name, tracks);
        interaction.editReply(`${emojis.GREEN_TICK} Playlist **${name}** created with ${tracks.length} songs.`);
      } catch (err) {
        if (err.message.includes('UNIQUE')) {
          interaction.editReply(`${emojis.ERROR} A playlist named **${name}** already exists.`);
        } else {
          throw err;
        }
      }
    }

    else if (sub === 'add') {
      const name = interaction.options.getString('name');
      const link = interaction.options.getString('link');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Check if playlist exists
      const playlist = db.getPlaylist(guildId, userId, name);
      if (!playlist) {
        return interaction.editReply(`${emojis.ERROR} Playlist **${name}** not found. Use \`/playlist create\` first.`);
      }

      const result = await client.music.search(link, interaction.user);
      if (!result || result.loadType !== 'PLAYLIST_LOADED') {
        return interaction.editReply(`${emojis.ERROR} Not a valid playlist. Make sure the URL is correct.`);
      }

      const existing = JSON.parse(playlist.tracks);
      const newTracks = result.tracks.map(t => ({
        title: t.info.title,
        url: t.info.uri,
        duration: t.info.length
      }));

      db.updatePlaylistTracks(guildId, userId, name, [...existing, ...newTracks]);
      interaction.editReply(`${emojis.GREEN_TICK} Added ${newTracks.length} songs to **${name}**.`);
    }

    else if (sub === 'load') {
      const name = interaction.options.getString('name');
      const playlist = db.getPlaylist(guildId, userId, name);
      if (!playlist) {
        return interaction.reply({ content: `${emojis.ERROR} Playlist **${name}** not found.`, flags: MessageFlags.Ephemeral });
      }
      interaction.reply({ content: `${emojis.INFO} Use \`/play ${name}\` to load this playlist.`, flags: MessageFlags.Ephemeral });
    }

    else if (sub === 'list') {
      const playlists = db.getUserPlaylists(guildId, userId);
      if (!playlists.length) {
        return interaction.reply({ content: `${emojis.INFO} You have no saved playlists.`, flags: MessageFlags.Ephemeral });
      }
      const list = playlists.map(p => `**${p.name}** (${JSON.parse(p.tracks).length} songs)`).join('\n');
      interaction.reply({ content: `${emojis.PLAYLIST} Your playlists:\n${list}`, flags: MessageFlags.Ephemeral });
    }

    else if (sub === 'delete') {
      const name = interaction.options.getString('name');
      const playlist = db.getPlaylist(guildId, userId, name);
      if (!playlist) {
        return interaction.reply({ content: `${emojis.ERROR} Playlist **${name}** not found.`, flags: MessageFlags.Ephemeral });
      }
      db.deletePlaylist(guildId, userId, name);
      interaction.reply({ content: `${emojis.GREEN_TICK} Deleted playlist **${name}**.`, flags: MessageFlags.Ephemeral });
    }
  }
};