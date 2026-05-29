const axios = require('axios');
const SpotifyUri = require('spotify-uri');

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post('https://accounts.spotify.com/api/token', 
    'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  accessToken = response.data.access_token;
  tokenExpiry = Date.now() + (response.data.expires_in * 1000);
  return accessToken;
}

async function fetchPlaylist(uri) {
  const token = await getAccessToken();
  const response = await axios.get(`https://api.spotify.com/v1/playlists/${uri.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const tracks = response.data.tracks.items.map(item => ({
    title: item.track.name,
    artist: item.track.artists.map(a => a.name).join(', '),
    url: null, // will be resolved later
    duration: item.track.duration_ms
  }));
  return { name: response.data.name, tracks };
}

async function fetchTrack(uri) {
  const token = await getAccessToken();
  const response = await axios.get(`https://api.spotify.com/v1/tracks/${uri.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return {
    title: response.data.name,
    artist: response.data.artists.map(a => a.name).join(', '),
    url: null,
    duration: response.data.duration_ms
  };
}

function parseSpotifyUrl(url) {
  try {
    const uri = SpotifyUri.parse(url);
    if (uri.type === 'playlist') return { type: 'playlist', uri };
    if (uri.type === 'track') return { type: 'track', uri };
    if (uri.type === 'album') return { type: 'album', uri };
    return null;
  } catch {
    return null;
  }
}

module.exports = { parseSpotifyUrl, fetchPlaylist, fetchTrack };