import assert from "node:assert/strict";
import { after, test } from "node:test";
import mongoose from "mongoose";
import { AUTH_COOKIE_NAME, createAuthToken } from "../src/auth/security.js";
import { createApp } from "../src/app.js";
import { calculateStreak } from "../src/progress/router.js";
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
  title: "Progress course",
  videos: [{ videoId: "video_one" }, { videoId: "video_two" }],
  chapters: [
    { lessons: [{ videoId: "video_one" }, { videoId: "video_two" }] },
  ],
};
const states = [
  {
    userId,
    courseId,
    videoId: "video_one",
    completed: true,
    completedAt: new Date("2026-11-13T10:00:00Z"),
  },
  { userId, courseId, videoId: "video_two", completed: false },
];
const attempts = [
  {
    userId,
    courseId,
    scorePercent: 80,
    correctCount: 4,
    totalQuestions: 5,
    submittedAt: new Date("2026-11-12T10:00:00Z"),
  },
];
const activities = [
  {
    userId,
    courseId,
    durationMinutes: 45,
    occurredAt: new Date("2026-11-13T09:00:00Z"),
  },
  {
    userId,
    courseId,
    durationMinutes: 30,
    occurredAt: new Date("2026-11-12T09:00:00Z"),
  },
];
const createdActivities = [];

function query(rows) {
  const result = {
    sort() {
      return result;
    },
    limit() {
      return result;
    },
    select() {
      return result;
    },
    then(resolve, reject) {
      return Promise.resolve(rows).then(resolve, reject);
    },
  };
  return result;
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
    find() {
      return query([course]);
    },
    findOne(filter) {
      const found =
        String(filter._id) === String(courseId) &&
        String(filter.userId) === String(userId);
      const result = {
        select() {
          return Promise.resolve(found ? course : null);
        },
      };
      return result;
    },
  },
  LessonStateModel: { find: () => query(states) },
  QuizAttemptModel: { find: () => query(attempts) },
  LearningActivityModel: {
    find: () => query(activities),
    async create(fields) {
      const activity = { ...fields };
      createdActivities.push(activity);
      return activity;
    },
  },
  progressClock: () => new Date("2026-11-13T12:00:00Z"),
});
const server = app.listen(0);
const baseUrl = await new Promise((resolve) => {
  server.once("listening", () => {
    resolve(`http://127.0.0.1:${server.address().port}`);
  });
});

after(() =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }),
);

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

test("streak calculation includes today or yesterday and tolerates gaps", () => {
  assert.equal(
    calculateStreak(
      ["2026-11-13", "2026-11-12", "2026-11-11", "2026-11-09"],
      new Date("2026-11-13T12:00:00Z"),
    ),
    3,
  );
  assert.equal(
    calculateStreak(
      ["2026-11-12", "2026-11-11"],
      new Date("2026-11-13T12:00:00Z"),
    ),
    2,
  );
  assert.equal(
    calculateStreak(
      ["2026-11-10"],
      new Date("2026-11-13T12:00:00Z"),
    ),
    0,
  );
});

test("progress summary aggregates course completion, activity, streak, and scores", async () => {
  const response = await request("/api/progress");
  assert.equal(response.status, 200);
  const { summary, courses, weeklyStudy, recentActivity } =
    (await response.json()).data;
  assert.equal(summary.totalCourses, 1);
  assert.equal(summary.completedLessons, 1);
  assert.equal(summary.totalLessons, 2);
  assert.equal(summary.overallProgressPercent, 50);
  assert.equal(summary.currentStreakDays, 2);
  assert.equal(summary.studyMinutesThisWeek, 75);
  assert.equal(summary.averageQuizScore, 80);
  assert.equal(courses[0].progressPercent, 50);
  assert.equal(weeklyStudy.length, 7);
  assert.equal(recentActivity.length, 4);
});

test("study-time writes require ownership and validated duration", async () => {
  const missingAuth = await request("/api/progress/study-sessions", {
    method: "POST",
    body: { courseId, durationMinutes: 30 },
    auth: false,
  });
  assert.equal(missingAuth.status, 401);

  const invalidDuration = await request("/api/progress/study-sessions", {
    method: "POST",
    body: { courseId, durationMinutes: 0 },
  });
  assert.equal(invalidDuration.status, 400);

  const notOwner = await request("/api/progress/study-sessions", {
    method: "POST",
    body: { courseId, durationMinutes: 30 },
    forUserId: otherUserId,
  });
  assert.equal(notOwner.status, 404);

  const saved = await request("/api/progress/study-sessions", {
    method: "POST",
    body: { courseId, durationMinutes: 30 },
  });
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).data.activity.durationMinutes, 30);
  assert.equal(createdActivities.length, 1);
});
