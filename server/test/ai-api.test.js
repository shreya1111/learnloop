import assert from "node:assert/strict";
import { after, test } from "node:test";
import mongoose from "mongoose";
import { AUTH_COOKIE_NAME, createAuthToken } from "../src/auth/security.js";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

const config = loadConfig({
  NODE_ENV: "test",
  JWT_SECRET: "test-secret-with-more-than-thirty-two-characters",
  CLIENT_ORIGIN: "http://localhost:5173",
});
const userId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();
const courseId = new mongoose.Types.ObjectId();
const otherCourseId = new mongoose.Types.ObjectId();
const course = {
  _id: courseId,
  userId,
  title: "Playlist course",
  description: "Original playlist description",
  status: "imported",
  playlist: { title: "Playlist title", description: "Playlist description" },
  videos: [
    {
      videoId: "video_first",
      title: "Introduction",
      videoUrl: "https://www.youtube.com/watch?v=video_first",
      position: 0,
      durationSeconds: 120,
    },
    {
      videoId: "video_second",
      title: "Core ideas",
      videoUrl: "https://www.youtube.com/watch?v=video_second",
      position: 1,
      durationSeconds: null,
    },
  ],
  async save() {
    this.saveCount = (this.saveCount ?? 0) + 1;
  },
};

const otherCourse = {
  _id: otherCourseId,
  userId: otherUserId,
  videos: course.videos,
};
let generatedOutput = {
  title: "A structured learning course",
  description: "A clear introduction to the playlist topics.",
  learningObjectives: ["Explain the core ideas", "Apply the foundational concepts"],
  difficulty: "beginner",
  prerequisites: [],
  estimatedDurationMinutes: 45,
  chapters: [
    {
      title: "Getting started",
      description: "Build context and learn the basic concepts.",
      videoIds: ["video_first", "video_second"],
    },
  ],
};
let generationCallCount = 0;

const app = createApp({
  config,
  UserModel: {
    async findById(id) {
      if (String(id) === String(userId)) return { _id: userId };
      if (String(id) === String(otherUserId)) return { _id: otherUserId };
      return null;
    },
  },
  CourseModel: {
    async findOne(query) {
      if (String(query._id) === String(course._id) && String(query.userId) === String(userId)) {
        return course;
      }
      if (
        String(query._id) === String(otherCourse._id) &&
        String(query.userId) === String(otherUserId)
      ) {
        return otherCourse;
      }
      return null;
    },
  },
  courseStructureGenerator: async (input) => {
    generationCallCount += 1;
    assert.equal(input.playlist.title, "Playlist title");
    assert.equal(input.videos.length, 2);
    return generatedOutput;
  },
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

function request(path, { auth = true, forUserId = userId } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      origin: config.clientOrigin,
      ...(auth ? { cookie: sessionCookie(forUserId) } : {}),
    },
  });
}

test("AI course generation requires an authenticated owner", async () => {
  const unauthenticated = await request(`/api/ai/courses/${courseId}/structure`, {
    auth: false,
  });
  assert.equal(unauthenticated.status, 401);

  const otherOwner = await request(
    `/api/ai/courses/${otherCourseId}/structure`,
    { forUserId: userId },
  );
  assert.equal(otherOwner.status, 404);
  assert.equal((await otherOwner.json()).error.code, "COURSE_NOT_FOUND");
  assert.equal(generationCallCount, 0);
});

test("rejects incomplete AI video grouping without changing the course", async () => {
  generatedOutput = {
    ...generatedOutput,
    chapters: [
      { ...generatedOutput.chapters[0], videoIds: ["video_first"] },
    ],
  };

  const response = await request(`/api/ai/courses/${courseId}/structure`);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "AI_INVALID_OUTPUT");
  assert.equal(course.status, "imported");
  assert.equal(course.title, "Playlist course");
  assert.equal(course.saveCount ?? 0, 0);
});

test("validates and saves the full AI-generated course outline", async () => {
  generatedOutput = {
    title: "A structured learning course",
    description: "A clear introduction to the playlist topics.",
    learningObjectives: ["Explain the core ideas", "Apply the foundational concepts"],
    difficulty: "beginner",
    prerequisites: [],
    estimatedDurationMinutes: 45,
    chapters: [
      {
        title: "Getting started",
        description: "Build context and learn the basic concepts.",
        videoIds: ["video_first", "video_second"],
      },
    ],
  };

  const response = await request(`/api/ai/courses/${courseId}/structure`);
  assert.equal(response.status, 200);
  const result = (await response.json()).data.course;
  assert.equal(result.status, "structured");
  assert.equal(result.difficulty, "beginner");
  assert.equal(result.chapters[0].lessons.length, 2);
  assert.equal(result.chapters[0].lessons[1].title, "Core ideas");
  assert.equal(result.chapters[0].lessons[1].videoId, "video_second");
  assert.equal(course.saveCount, 1);
  assert.equal(generationCallCount, 2);
});
