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
const course = {
  _id: courseId,
  userId,
  videos: [
    { videoId: "video_one", title: "First lesson" },
    { videoId: "video_two", title: "Second lesson" },
  ],
};

function createMemoryLessonStateModel() {
  const states = new Map();
  const keyFor = ({ userId: ownerId, courseId: ownerCourseId, videoId }) =>
    `${ownerId}:${ownerCourseId}:${videoId}`;

  return {
    async find(query) {
      return [...states.values()].filter(
        (state) =>
          String(state.userId) === String(query.userId) &&
          String(state.courseId) === String(query.courseId),
      );
    },
    async findOneAndUpdate(filter, update) {
      const key = keyFor(filter);
      const state = {
        userId: filter.userId,
        courseId: filter.courseId,
        videoId: filter.videoId,
        completed: false,
        completedAt: null,
        note: "",
        bookmarked: false,
        ...states.get(key),
        ...update.$set,
        updatedAt: new Date(),
      };
      states.set(key, state);
      return state;
    },
  };
}

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
      return String(query._id) === String(course._id) &&
        String(query.userId) === String(course.userId)
        ? course
        : null;
    },
  },
  LessonStateModel: createMemoryLessonStateModel(),
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

function request(path, { method = "GET", body, forUserId = userId, auth = true } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(method !== "GET" ? { origin: config.clientOrigin } : {}),
      ...(auth ? { cookie: sessionCookie(forUserId) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("lesson state is private to the course owner", async () => {
  const path = `/api/courses/${courseId}/learning-state`;
  const unauthenticated = await request(path, { auth: false });
  assert.equal(unauthenticated.status, 401);

  const otherOwner = await request(path, { forUserId: otherUserId });
  assert.equal(otherOwner.status, 404);
  assert.equal((await otherOwner.json()).error.code, "COURSE_NOT_FOUND");
});

test("saves lesson completion, notes, and bookmarks independently", async () => {
  const courseStatePath = `/api/courses/${courseId}/learning-state`;
  const initial = await request(courseStatePath);
  assert.deepEqual((await initial.json()).data.states, []);

  const saved = await request(
    `/api/courses/${courseId}/videos/video_one/learning-state`,
    {
      method: "PUT",
      body: {
        completed: true,
        note: "  Remember to revisit this idea.  ",
        bookmarked: true,
      },
    },
  );
  assert.equal(saved.status, 200);
  const savedState = (await saved.json()).data.state;
  assert.equal(savedState.completed, true);
  assert.ok(savedState.completedAt);
  assert.equal(savedState.note, "Remember to revisit this idea.");
  assert.equal(savedState.bookmarked, true);

  const changedNote = await request(
    `/api/courses/${courseId}/videos/video_one/learning-state`,
    { method: "PUT", body: { note: "" } },
  );
  const changedState = (await changedNote.json()).data.state;
  assert.equal(changedState.note, "");
  assert.equal(changedState.completed, true);
  assert.equal(changedState.bookmarked, true);

  const overview = await request(courseStatePath);
  const states = (await overview.json()).data.states;
  assert.equal(states.length, 1);
  assert.equal(states[0].videoId, "video_one");
  assert.equal(states[0].note, "");
});

test("rejects empty updates and video IDs outside the owned course", async () => {
  const path = `/api/courses/${courseId}/videos/video_two/learning-state`;
  const empty = await request(path, { method: "PUT", body: {} });
  assert.equal(empty.status, 400);
  assert.equal((await empty.json()).error.code, "VALIDATION_ERROR");

  const unknownVideo = await request(
    `/api/courses/${courseId}/videos/not_in_course/learning-state`,
    { method: "PUT", body: { completed: true } },
  );
  assert.equal(unknownVideo.status, 404);
  assert.equal((await unknownVideo.json()).error.code, "VIDEO_NOT_FOUND");
});
