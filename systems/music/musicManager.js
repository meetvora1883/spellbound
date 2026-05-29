const { Shoukaku } = require("shoukaku");
const { Connectors } = require("shoukaku");
const nodes = require("./nodes");
const spotify = require("./spotify");

class MusicManager {
  constructor(client) {
    this.client = client;
    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(client),
      nodes,
      {
        moveOnDisconnect: false,
        reconnectTries: 3,
        reconnectInterval: 5000,
        restTimeout: 10000
      }
    );
    this.queues = new Map();
    this.guild24h = new Map();
  }

  initialize() {
    this.shoukaku.on("ready", (name) => {
      console.log(`✅ Lavalink node ready: ${name}`);
    });
    this.shoukaku.on("error", (name, error) => {
      console.error(`❌ Lavalink error (${name}):`, error);
    });
    this.shoukaku.on("close", (name, code, reason) => {
      console.warn(`⚠️ Lavalink node ${name} closed: ${code} - ${reason}`);
    });
  }

  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        queue: [],
        current: null,
        textChannel: null,
        voiceChannel: null,
        player: null,
        isPlaying: false,
      });
    }
    return this.queues.get(guildId);
  }

  setChannels(guildId, textChannelId, voiceChannelId) {
    const queue = this.getQueue(guildId);
    queue.textChannel = textChannelId;
    queue.voiceChannel = voiceChannelId;
  }

  async joinVoice(guildId, voiceChannelId, textChannelId) {
    const queue = this.getQueue(guildId);
    this.setChannels(guildId, textChannelId, voiceChannelId);
    if (queue.player && queue.player.channelId === voiceChannelId) return queue.player;
    if (queue.player) await this.shoukaku.leaveVoiceChannel(guildId);
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const player = await this.shoukaku.joinVoiceChannel({
        guildId,
        channelId: voiceChannelId,
        shardId: 0,
        deaf: true
      });
      queue.player = player;
      this._setupPlayerEvents(player, guildId);
      return player;
    } catch (error) {
      console.error(`Failed to join voice in guild ${guildId}:`, error);
      throw error;
    }
  }

  _setupPlayerEvents(player, guildId) {
    player.on("end", (data) => {
      const queue = this.getQueue(guildId);
      if (data.reason === "REPLACED") return;
      queue.isPlaying = false;
      this._playNext(guildId);
    });
    player.on("error", (error) => {
      console.error(`Player error in guild ${guildId}:`, error);
      const queue = this.getQueue(guildId);
      if (queue.current) {
        const textChannel = this.client.channels.cache.get(queue.textChannel);
        if (textChannel) textChannel.send(`❌ Error playing: ${error.message}`);
        queue.current = null;
      }
      this._playNext(guildId);
    });
  }

  async _playNext(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.queue.length === 0) {
      queue.current = null;
      queue.isPlaying = false;
      const is24h = this.guild24h.get(guildId) || false;
      if (!is24h) {
        setTimeout(() => {
          if (!queue.isPlaying && queue.queue.length === 0 && queue.player) {
            this.leaveVoice(guildId);
          }
        }, 5000);
      } else {
        const textChannel = this.client.channels.cache.get(queue.textChannel);
        if (textChannel) textChannel.send(`🔁 Queue finished. Staying in voice channel (24/7 mode).`);
      }
      return;
    }
    const track = queue.queue.shift();
    queue.current = track;
    queue.isPlaying = true;
    try {
      await queue.player.playTrack({ track: track.encoded });
      const textChannel = this.client.channels.cache.get(queue.textChannel);
      if (textChannel) textChannel.send(`🎵 Now playing: **${track.info.title}**`);
    } catch (err) {
      console.error(`Failed to play track in guild ${guildId}:`, err);
      queue.current = null;
      queue.isPlaying = false;
      this._playNext(guildId);
    }
  }

  addToQueue(guildId, tracks) {
    const queue = this.getQueue(guildId);
    if (!Array.isArray(tracks)) tracks = [tracks];
    queue.queue.push(...tracks);
    if (!queue.isPlaying && queue.player) this._playNext(guildId);
  }

  async search(query, requester) {
    // Check if it's a Spotify URL
    const spotifyData = spotify.parseSpotifyUrl(query);
    if (spotifyData) {
      if (spotifyData.type === 'playlist') {
        const playlist = await spotify.fetchPlaylist(spotifyData.uri);
        const tracks = [];
        for (const item of playlist.tracks) {
          const searchQuery = `${item.artist} - ${item.title}`;
          const result = await this._searchLavalink(searchQuery);
          if (result && result.loadType !== 'NO_MATCHES') {
            tracks.push(...result.tracks.slice(0, 1)); // take the first result
          }
        }
        return { loadType: 'PLAYLIST_LOADED', tracks, playlist: { name: playlist.name } };
      } else if (spotifyData.type === 'track') {
        const track = await spotify.fetchTrack(spotifyData.uri);
        const searchQuery = `${track.artist} - ${track.title}`;
        const result = await this._searchLavalink(searchQuery);
        if (result && result.loadType !== 'NO_MATCHES') {
          return { loadType: 'TRACK_LOADED', tracks: result.tracks.slice(0, 1) };
        }
        return { loadType: 'NO_MATCHES' };
      }
    }
    // Otherwise, treat as YouTube/SoundCloud link or search query
    return await this._searchLavalink(query);
  }

  async _searchLavalink(query) {
    const nodes = [...this.shoukaku.nodes.values()];
    if (nodes.length === 0) throw new Error('No Lavalink nodes available');
    const node = nodes[0];
    try {
      const result = await node.rest.resolve(query);
      if (!result) return { loadType: 'NO_MATCHES' };
      if (result.type === 'track') return { loadType: 'TRACK_LOADED', tracks: [result.data] };
      if (result.type === 'playlist') return { loadType: 'PLAYLIST_LOADED', tracks: result.data.tracks, playlist: { name: result.data.info.name } };
      if (result.type === 'search') return { loadType: 'SEARCH_RESULT', tracks: result.data };
      return { loadType: 'NO_MATCHES' };
    } catch (err) {
      console.error('Lavalink search error:', err);
      return { loadType: 'NO_MATCHES' };
    }
  }

  async skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) await queue.player.stopTrack();
  }

  async stop(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      await queue.player.stopTrack();
      queue.queue = [];
      queue.current = null;
      queue.isPlaying = false;
      await this.leaveVoice(guildId);
    }
  }

  async leaveVoice(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      await this.shoukaku.leaveVoiceChannel(guildId);
      queue.player = null;
      queue.current = null;
      queue.isPlaying = false;
    }
    this.queues.delete(guildId);
  }

  set24h(guildId, enabled) { this.guild24h.set(guildId, enabled); }
  is24h(guildId) { return this.guild24h.get(guildId) || false; }
}

module.exports = MusicManager;