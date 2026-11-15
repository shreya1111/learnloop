import assert from "node:assert/strict";
import { after, test } from "node:test";
import mongoose from "mongoose";
import { AUTH_COOKIE_NAME, createAuthToken } from "../src/auth/security.js";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createTranscriptProvider } from "../src/integrations/transcripts/provider.js";

const config = loadConfig({
  NODE_ENV: "test",
  JWT_SECRET: "test-secret-with-more-than-thirty-two-characters",
  CLIENT_ORIGIN: "http://localhost:5173",
});
const userId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();
const user = {
  _id: userId,
  name: "Playlist Learner",
  email: "playlist@example.test",
};
const otherUser = {
  _id: otherUserId,
  name: "Other Learner",
  email: "other@example.test",
};
const importedPlaylist = {
  playlist: {
    youtubePlaylistId: "PLabc_123",
    title: "Learning the foundations",
    description: "An introductory series",
    channelTitle: "Learning channel",
    thumbnailUrl: "https://img.example/playlist.jpg",
    declaredVideoCount: 2,
    videoCount: 2,
    unavailableVideoCount: 0,
  },
  videos: [
    {
      videoId: "video_first",
      title: "Introduction",
      description: "",
      thumbnailUrl: "",
      channelTitle: "Learning channel",
      position: 0,
      durationSeconds: 120,
      videoUrl: "https://www.youtube.com/watch?v=video_first",
    },
    {
      videoId: "video_second",
      title: "Core ideas",
      description: "",
      thumbnailUrl: "",
      channelTitle: "Learning channel",
      position: 1,
      durationSeconds: null,
      videoUrl: "https://www.youtube.com/watch?v=video_second",
    },
  ],
};

function createMemoryCourseModel() {
  const courses = [];
  const matches = (course, query) => {
    if (query.userId && String(course.userId) !== String(query.userId)) {
      return false;
    }
    if (query._id && String(course._id) !== String(query._id)) {
      return false;
    }
    if (
      query["playlist.youtubePlaylistId"] &&
      course.playlist.youtubePlaylistId !== query["playlist.youtubePlaylistId"]
    ) {
      return false;
    }
    return true;
  };

  return {
    courses,
    async create(fields) {
      const course = {
        _id: new mongoose.Types.ObjectId(),
        ...fields,
        createdAt: new Date(),
        updatedAt: new Date(),
        videos: fields.videos.map((video) => ({ ...video })),
        async save() {
          this.updatedAt = new Date();
        },
      };
      courses.push(course);
      return course;
    },
    async findOne(query) {
      return courses.find((course) => matches(course, query)) ?? null;
    },
    find(query) {
      const result = {
        sort() {
          return result;
        },
        async select() {
          return courses
            .filter((course) => matches(course, query))
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .map(({ videos, ...course }) => course);
        },
      };
      return result;
    },
  };
}

function createMemoryTranscriptModel() {
  const transcripts = new Map();
  const keyFor = (courseId, videoId) => `${courseId}:${videoId}`;

  return {
    async findOne({ courseId, videoId }) {
      return transcripts.get(keyFor(courseId, videoId)) ?? null;
    },
    async findOneAndUpdate(filter, update) {
      const transcript = {
        courseId: filter.courseId,
        userId: filter.userId,
        videoId: filter.videoId,
        ...update.$set,
      };
      transcripts.set(keyFor(filter.courseId, filter.videoId), transcript);
      return transcript;
    },
  };
}

const courseModel = createMemoryCourseModel();
const transcriptModel = createMemoryTranscriptModel();
let youtubeCallCount = 0;
const app = createApp({
  config,
  UserModel: {
    async findById(id) {
      if (String(id) === String(userId)) return user;
      if (String(id) === String(otherUserId)) return otherUser;
      return null;
    },
  },
  CourseModel: courseModel,
  TranscriptModel: transcriptModel,
  youtubeClient: {
    async fetchPlaylist(playlistId) {
      youtubeCallCount += 1;
      assert.equal(playlistId, importedPlaylist.playlist.youtubePlaylistId);
      return importedPlaylist;
    },
  },
  transcriptProvider: createTranscriptProvider(),
});
const server = app.listen(0);
const baseUrl = await new Promise((resolve) => {
  server.once("listening", () => {
    resolve(`http://127.0.0.1:${server.address().port}`);
  });
});

after(() => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
}));

function sessionCookie(forUserId = userId) {
  return `${AUTH_COOKIE_NAME}=${createAuthToken(forUserId, config)}`;
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(method !== "GET" ? { origin: config.clientOrigin } : {}),
      ...(auth ? { cookie: sessionCookie() } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return response;
}

test("playlist import requires authentication and validates the URL", async () => {
  const unauthenticated = await request("/api/playlists/import", {
    method: "POST",
    body: { playlistUrl: "https://www.youtube.com/playlist?list=PLabc_123" },
    auth: false,
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(youtubeCallCount, 0);

  const invalid = await request("/api/playlists/import", {
    method: "POST",
    body: { playlistUrl: "https://example.com/playlist?list=PLabc_123" },
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "INVALID_PLAYLIST_URL");
  assert.equal(youtubeCallCount, 0);
});

test("imports an owner-scoped course and rejects duplicate imports", async () => {
  const response = await request("/api/playlists/import", {
    method: "POST",
    body: {
      playlistUrl: "https://www.youtube.com/playlist?list=PLabc_123",
    },
  });
  assert.equal(response.status, 201);

  const body = await response.json();
  assert.equal(body.data.course.title, "Learning the foundations");
  assert.equal(body.data.course.status, "imported");
  assert.equal(body.data.course.videos.length, 2);
  assert.equal(body.data.course.estimatedDurationSeconds, null);
  assert.equal(body.data.course.playlist.unavailableVideoCount, 0);
  assert.equal("transcript" in body.data.course.videos[0], false);

  const duplicate = await request("/api/playlists/import", {
    method: "POST",
    body: {
      playlistUrl: "https://youtube.com/watch?v=video_first&list=PLabc_123",
    },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(youtubeCallCount, 1);

  const courses = await request("/api/courses");
  assert.equal(courses.status, 200);
  const courseList = (await courses.json()).data.courses;
  assert.equal(courseList.length, 1);
  assert.equal("videos" in courseList[0], false);
});

test("reports transcript availability and saves user-provided transcript text", async () => {
  const courseId = courseModel.courses[0]._id.toString();
  const transcriptPath = `/api/courses/${courseId}/videos/video_first/transcript`;

  const unavailable = await request(transcriptPath);
  const unavailableBody = await unavailable.json();
  assert.equal(unavailable.status, 200);
  assert.equal(unavailableBody.data.available, false);
  assert.match(unavailableBody.data.message, /does not include transcripts/);

  const saved = await request(transcriptPath, {
    method: "PUT",
    body: { text: "  User provided lesson transcript.  " },
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).data.text, "User provided lesson transcript.");

  const available = await request(transcriptPath);
  const availableBody = await available.json();
  assert.equal(availableBody.data.available, true);
  assert.equal(availableBody.data.source, "user");
  assert.equal(availableBody.data.text, "User provided lesson transcript.");
});

test("prevents other users from reading an imported course", async () => {
  const courseId = courseModel.courses[0]._id.toString();
  const response = await fetch(`${baseUrl}/api/courses/${courseId}`, {
    headers: { cookie: sessionCookie(otherUserId) },
  });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "COURSE_NOT_FOUND");
});
