import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createYouTubeDataClient,
  MAX_PLAYLIST_VIDEOS,
  parseYouTubeDuration,
  YouTubeApiError,
} from "../src/integrations/youtube/client.js";
import {
  canonicalPlaylistUrl,
  extractPlaylistId,
  PlaylistUrlError,
} from "../src/integrations/youtube/playlistUrl.js";

test("accepts supported YouTube playlist links and canonicalizes them", () => {
  assert.equal(
    extractPlaylistId("https://www.youtube.com/playlist?list=PLabc_123"),
    "PLabc_123",
  );
  assert.equal(
    extractPlaylistId(
      "https://youtube.com/watch?v=video123&list=PLabc_123&t=10",
    ),
    "PLabc_123",
  );
  assert.equal(
    extractPlaylistId("https://youtu.be/video123?list=PLabc_123"),
    "PLabc_123",
  );
  assert.equal(
    canonicalPlaylistUrl("PLabc_123"),
    "https://www.youtube.com/playlist?list=PLabc_123",
  );
});

test("rejects non-YouTube links and URLs without a playlist ID", () => {
  assert.throws(
    () => extractPlaylistId("https://youtube.com.attacker.example/playlist?list=PLabc_123"),
    PlaylistUrlError,
  );
  assert.throws(
    () => extractPlaylistId("https://www.youtube.com/watch?v=video123"),
    PlaylistUrlError,
  );
});

test("parses YouTube ISO 8601 durations", () => {
  assert.equal(parseYouTubeDuration("PT1H2M3S"), 3723);
  assert.equal(parseYouTubeDuration("P1DT2H"), 93600);
  assert.equal(parseYouTubeDuration("PT0S"), 0);
  assert.equal(parseYouTubeDuration("P"), null);
  assert.equal(parseYouTubeDuration("not-a-duration"), null);
});

test("fetches metadata and paginated videos without exposing secrets in output", async () => {
  const requests = [];
  const fetchImpl = async (input) => {
    const url = new URL(input);
    requests.push(url);
    if (url.pathname.endsWith("/playlists")) {
      return Response.json({
        items: [
          {
            snippet: {
              title: "Foundations",
              description: "An introduction",
              channelTitle: "Learning channel",
              thumbnails: { medium: { url: "https://img.example/playlist.jpg" } },
            },
            contentDetails: { itemCount: 2 },
          },
        ],
      });
    }
    if (url.pathname.endsWith("/playlistItems")) {
      if (url.searchParams.get("pageToken")) {
        return Response.json({
          items: [
            {
              snippet: {
                position: 1,
                title: "Second lesson",
                resourceId: { videoId: "video_second" },
              },
            },
          ],
        });
      }
      return Response.json({
        nextPageToken: "page-two",
        items: [
          {
            snippet: {
              position: 0,
              title: "First lesson",
              resourceId: { videoId: "video_first" },
            },
          },
        ],
      });
    }
    return Response.json({
      items: [
        {
          id: "video_first",
          contentDetails: { duration: "PT2M" },
        },
        {
          id: "video_second",
          contentDetails: { duration: "PT1H" },
        },
      ],
    });
  };

  const client = createYouTubeDataClient({
    apiKey: "server-only-test-key",
    fetchImpl,
  });
  const result = await client.fetchPlaylist("PLabc_123");

  assert.equal(requests.length, 4);
  assert.ok(requests.every((url) => url.searchParams.get("key") === "server-only-test-key"));
  assert.equal(result.playlist.title, "Foundations");
  assert.equal(result.playlist.videoCount, 2);
  assert.deepEqual(
    result.videos.map(({ videoId, durationSeconds }) => ({
      videoId,
      durationSeconds,
    })),
    [
      { videoId: "video_first", durationSeconds: 120 },
      { videoId: "video_second", durationSeconds: 3600 },
    ],
  );
  assert.equal("key" in result, false);
});

test("excludes playlist entries missing from YouTube video details", async () => {
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/playlists")) {
      return Response.json({
        items: [
          {
            snippet: { title: "Mixed availability" },
            contentDetails: { itemCount: 3 },
          },
        ],
      });
    }
    if (url.pathname.endsWith("/playlistItems")) {
      return Response.json({
        items: [
          {
            snippet: {
              position: 0,
              title: "Available lesson",
              resourceId: { videoId: "video_available" },
            },
          },
          {
            snippet: {
              position: 1,
              title: "Deleted video",
              resourceId: { videoId: "video_unavailable" },
            },
          },
          { snippet: { position: 2, title: "Private video" } },
        ],
      });
    }
    return Response.json({
      items: [
        {
          id: "video_available",
          contentDetails: { duration: "PT2M" },
        },
      ],
    });
  };

  const client = createYouTubeDataClient({
    apiKey: "server-only-test-key",
    fetchImpl,
  });
  const result = await client.fetchPlaylist("PLabc_123");

  assert.deepEqual(
    result.videos.map((video) => video.videoId),
    ["video_available"],
  );
  assert.equal(result.playlist.videoCount, 1);
  assert.equal(result.playlist.unavailableVideoCount, 2);
});

test("rejects playlists when none of the listed videos are accessible", async () => {
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/playlists")) {
      return Response.json({
        items: [
          {
            snippet: { title: "Unavailable lessons" },
            contentDetails: { itemCount: 1 },
          },
        ],
      });
    }
    if (url.pathname.endsWith("/playlistItems")) {
      return Response.json({
        items: [
          {
            snippet: {
              position: 0,
              title: "Private video",
              resourceId: { videoId: "video_private" },
            },
          },
        ],
      });
    }
    return Response.json({ items: [] });
  };
  const client = createYouTubeDataClient({
    apiKey: "server-only-test-key",
    fetchImpl,
  });

  await assert.rejects(
    client.fetchPlaylist("PLabc_123"),
    (error) =>
      error instanceof YouTubeApiError &&
      error.statusCode === 422 &&
      error.code === "PLAYLIST_EMPTY",
  );
});

test("maps YouTube quota failures to a clear retryable error", async () => {
  const client = createYouTubeDataClient({
    apiKey: "server-only-test-key",
    fetchImpl: async () =>
      Response.json(
        { error: { errors: [{ reason: "quotaExceeded" }] } },
        { status: 403 },
      ),
  });

  await assert.rejects(
    client.fetchPlaylist("PLabc_123"),
    (error) =>
      error instanceof YouTubeApiError &&
      error.statusCode === 503 &&
      error.code === "YOUTUBE_QUOTA_EXCEEDED",
  );
});

test("does not make a network request without a configured API key", async () => {
  let fetchCalled = false;
  const client = createYouTubeDataClient({
    fetchImpl: async () => {
      fetchCalled = true;
      return Response.json({});
    },
  });

  await assert.rejects(
    client.fetchPlaylist("PLabc_123"),
    (error) =>
      error instanceof YouTubeApiError &&
      error.code === "YOUTUBE_NOT_CONFIGURED",
  );
  assert.equal(fetchCalled, false);
});

test("rejects playlists above the import limit before listing videos", async () => {
  let requestCount = 0;
  const client = createYouTubeDataClient({
    apiKey: "server-only-test-key",
    fetchImpl: async () => {
      requestCount += 1;
      return Response.json({
        items: [
          {
            snippet: { title: "Too many videos" },
            contentDetails: { itemCount: MAX_PLAYLIST_VIDEOS + 1 },
          },
        ],
      });
    },
  });

  await assert.rejects(
    client.fetchPlaylist("PLabc_123"),
    (error) =>
      error instanceof YouTubeApiError &&
      error.code === "PLAYLIST_TOO_LARGE",
  );
  assert.equal(requestCount, 1);
});
