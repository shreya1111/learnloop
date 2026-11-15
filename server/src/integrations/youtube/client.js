const API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const REQUEST_TIMEOUT_MS = 10000;
export const MAX_PLAYLIST_VIDEOS = 500;

export class YouTubeApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "YouTubeApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function upstreamError(response, payload) {
  const reason = payload?.error?.errors?.[0]?.reason;
  if (
    ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(reason)
  ) {
    return new YouTubeApiError(
      503,
      "YOUTUBE_QUOTA_EXCEEDED",
      "YouTube API quota is temporarily unavailable; try again later",
    );
  }
  if (["playlistNotFound", "playlistItemsNotAccessible"].includes(reason)) {
    return new YouTubeApiError(
      404,
      "PLAYLIST_NOT_FOUND",
      "The playlist was not found or is not publicly accessible",
    );
  }
  if (reason === "keyInvalid" || reason === "accessNotConfigured") {
    return new YouTubeApiError(
      503,
      "YOUTUBE_NOT_CONFIGURED",
      "The YouTube API key is invalid or the Data API is not enabled",
    );
  }
  if (response.status === 403) {
    return new YouTubeApiError(
      403,
      "YOUTUBE_ACCESS_DENIED",
      "YouTube denied access to this playlist",
    );
  }
  if (response.status === 404) {
    return new YouTubeApiError(
      404,
      "PLAYLIST_NOT_FOUND",
      "The playlist was not found",
    );
  }
  return new YouTubeApiError(
    502,
    "YOUTUBE_REQUEST_FAILED",
    "YouTube could not complete the playlist request",
  );
}

function thumbnailUrl(thumbnails = {}) {
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    ""
  );
}

export function parseYouTubeDuration(value) {
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!match || match.slice(1).every((part) => part === undefined)) {
    return null;
  }

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return (
    Number(days) * 86400 +
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds)
  );
}

export function createYouTubeDataClient({ apiKey, fetchImpl = fetch } = {}) {
  async function request(resource, parameters) {
    if (!apiKey) {
      throw new YouTubeApiError(
        503,
        "YOUTUBE_NOT_CONFIGURED",
        "Playlist import is not configured yet; set YOUTUBE_API_KEY on the server",
      );
    }

    const url = new URL(`${API_BASE_URL}/${resource}`);
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    url.searchParams.set("key", apiKey);

    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new YouTubeApiError(
          504,
          "YOUTUBE_TIMEOUT",
          "YouTube did not respond in time; try again",
        );
      }
      throw new YouTubeApiError(
        503,
        "YOUTUBE_UNAVAILABLE",
        "YouTube could not be reached; try again later",
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new YouTubeApiError(
        502,
        "YOUTUBE_INVALID_RESPONSE",
        "YouTube returned an unreadable response",
      );
    }

    if (!response.ok) {
      throw upstreamError(response, payload);
    }

    return payload;
  }

  async function fetchPlaylist(playlistId) {
    const playlistResponse = await request("playlists", {
      part: "snippet,contentDetails",
      id: playlistId,
    });
    const playlistItem = playlistResponse.items?.[0];
    if (!playlistItem) {
      throw new YouTubeApiError(
        404,
        "PLAYLIST_NOT_FOUND",
        "The playlist was not found or is not publicly accessible",
      );
    }

    const declaredItemCount = Number(
      playlistItem.contentDetails?.itemCount ?? 0,
    );
    if (declaredItemCount > MAX_PLAYLIST_VIDEOS) {
      throw new YouTubeApiError(
        413,
        "PLAYLIST_TOO_LARGE",
        `Playlists can contain up to ${MAX_PLAYLIST_VIDEOS} videos`,
      );
    }

    const playlistItems = [];
    const seenPageTokens = new Set();
    let pageToken;
    do {
      if (pageToken && seenPageTokens.has(pageToken)) {
        throw new YouTubeApiError(
          502,
          "YOUTUBE_PAGINATION_ERROR",
          "YouTube returned an invalid playlist page sequence",
        );
      }
      if (pageToken) {
        seenPageTokens.add(pageToken);
      }

      const page = await request("playlistItems", {
        part: "snippet,contentDetails",
        playlistId,
        maxResults: 50,
        pageToken,
      });
      if (!Array.isArray(page.items)) {
        throw new YouTubeApiError(
          502,
          "YOUTUBE_INVALID_RESPONSE",
          "YouTube returned an invalid playlist response",
        );
      }
      if (playlistItems.length + page.items.length > MAX_PLAYLIST_VIDEOS) {
        throw new YouTubeApiError(
          413,
          "PLAYLIST_TOO_LARGE",
          `Playlists can contain up to ${MAX_PLAYLIST_VIDEOS} videos`,
        );
      }
      playlistItems.push(...page.items);
      pageToken = page.nextPageToken;
    } while (pageToken);

    const playableItems = playlistItems
      .map((item) => ({
        item,
        videoId:
          item.snippet?.resourceId?.videoId ?? item.contentDetails?.videoId,
      }))
      .filter(({ videoId }) => typeof videoId === "string" && videoId.length);
    if (playableItems.length === 0) {
      throw new YouTubeApiError(
        422,
        "PLAYLIST_EMPTY",
        "No accessible videos were found in this playlist",
      );
    }

    const videoDurations = new Map();
    for (let start = 0; start < playableItems.length; start += 50) {
      const batch = playableItems.slice(start, start + 50);
      const videoResponse = await request("videos", {
        part: "contentDetails",
        id: batch.map(({ videoId }) => videoId).join(","),
      });
      for (const video of videoResponse.items ?? []) {
        videoDurations.set(
          video.id,
          parseYouTubeDuration(video.contentDetails?.duration ?? ""),
        );
      }
    }

    const accessibleItems = playableItems.filter(({ videoId }) =>
      videoDurations.has(videoId),
    );
    if (accessibleItems.length === 0) {
      throw new YouTubeApiError(
        422,
        "PLAYLIST_EMPTY",
        "No accessible videos were found in this playlist",
      );
    }

    const videos = accessibleItems.map(({ item, videoId }, index) => {
      const snippet = item.snippet ?? {};
      return {
        videoId,
        title: snippet.title?.trim() || "Untitled video",
        description: snippet.description ?? "",
        thumbnailUrl: thumbnailUrl(snippet.thumbnails),
        channelTitle: snippet.videoOwnerChannelTitle ?? snippet.channelTitle ?? "",
        position: Number.isInteger(snippet.position)
          ? snippet.position
          : index,
        durationSeconds: videoDurations.get(videoId) ?? null,
        videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      };
    });

    const snippet = playlistItem.snippet ?? {};
    return {
      playlist: {
        youtubePlaylistId: playlistId,
        title: snippet.title?.trim() || "Untitled playlist",
        description: snippet.description ?? "",
        channelTitle: snippet.channelTitle ?? "",
        thumbnailUrl: thumbnailUrl(snippet.thumbnails),
        declaredVideoCount: declaredItemCount,
        videoCount: videos.length,
        unavailableVideoCount: playlistItems.length - videos.length,
      },
      videos,
    };
  }

  return { fetchPlaylist };
}
