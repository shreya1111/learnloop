const allowedHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

export class PlaylistUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlaylistUrlError";
  }
}

export function extractPlaylistId(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new PlaylistUrlError("Enter a valid YouTube playlist URL");
  }

  if (
    !["https:", "http:"].includes(url.protocol) ||
    !allowedHosts.has(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new PlaylistUrlError("Use a YouTube playlist URL");
  }

  const playlistId = url.searchParams.get("list");
  if (!playlistId || !/^[A-Za-z0-9_-]{1,128}$/.test(playlistId)) {
    throw new PlaylistUrlError("The URL does not contain a valid playlist ID");
  }

  return playlistId;
}

export function canonicalPlaylistUrl(playlistId) {
  const url = new URL("https://www.youtube.com/playlist");
  url.searchParams.set("list", playlistId);
  return url.toString();
}
