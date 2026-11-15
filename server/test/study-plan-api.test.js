import assert from "node:assert/strict";
import { after, test } from "node:test";
import mongoose from "mongoose";
import { AUTH_COOKIE_NAME, createAuthToken } from "../src/auth/security.js";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { validateGeneratedPlan } from "../src/studyPlans/router.js";

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
  title: "Structured course",
  description: "An introduction to the subject.",
  status: "structured",
  learningObjectives: ["Understand the foundations"],
  estimatedDurationMinutes: 45,
  estimatedDurationSeconds: 1800,
  chapters: [{ title: "Foundations" }],
  videos: [
    { videoId: "video_one", title: "Introduction", position: 0 },
    { videoId: "video_two", title: "Core ideas", position: 1 },
  ],
};

function createMemoryStudyPlanModel() {
  const plans = [];
  const matches = (plan, query) =>
    (!query._id || String(plan._id) === String(query._id)) &&
    (!query.userId || String(plan.userId) === String(query.userId)) &&
    (!query.courseId || String(plan.courseId) === String(query.courseId));

  function createPlan(fields) {
    const sessions = fields.sessions.map((session) => ({
      _id: new mongoose.Types.ObjectId(),
      completed: false,
      completedAt: null,
      ...session,
    }));
    sessions.id = (id) =>
      sessions.find((session) => String(session._id) === String(id));
    return {
      _id: new mongoose.Types.ObjectId(),
      ...fields,
      sessions,
      createdAt: new Date(),
      updatedAt: new Date(),
      async save() {
        this.updatedAt = new Date();
      },
    };
  }

  return {
    plans,
    async findOne(query) {
      return plans.find((plan) => matches(plan, query)) ?? null;
    },
    async create(fields) {
      const plan = createPlan(fields);
      plans.push(plan);
      return plan;
    },
  };
}

let generatedPlan = {
  title: "A steady path through the course",
  summary: "Build understanding in short sessions and review the main ideas.",
  sessions: [
    {
      dayOffset: 0,
      title: "Start with the foundations",
      focus: "Understand the introductory concepts.",
      kind: "learning",
      durationMinutes: 25,
      lessonVideoIds: ["video_one"],
    },
    {
      dayOffset: 2,
      title: "Connect the core ideas",
      focus: "Learn and apply the next set of concepts.",
      kind: "learning",
      durationMinutes: 20,
      lessonVideoIds: ["video_two"],
    },
    {
      dayOffset: 4,
      title: "Review and recall",
      focus: "Revisit the ideas and check your understanding.",
      kind: "revision",
      durationMinutes: 15,
      lessonVideoIds: ["video_one", "video_two"],
    },
  ],
};
let generatorCallCount = 0;
const studyPlanModel = createMemoryStudyPlanModel();
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
        String(query.userId) === String(userId)
        ? course
        : null;
    },
  },
  StudyPlanModel: studyPlanModel,
  studyPlanGenerator: async () => {
    generatorCallCount += 1;
    return generatedPlan;
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

const preferences = {
  goal: "Understand and apply the course foundations",
  startDate: "2026-04-06",
  weeks: 1,
  minutesPerSession: 45,
  studyDays: ["monday", "wednesday", "friday"],
};

test("validates learning order by scheduled date, not model response order", () => {
  const result = validateGeneratedPlan(
    {
      title: "A steady path through the course",
      summary: "Build understanding and revisit the main ideas.",
      sessions: [
        {
          dayOffset: 2,
          title: "Start with the foundations",
          focus: "Understand the introductory concepts.",
          kind: "learning",
          durationMinutes: 25,
          lessonVideoIds: ["video_one"],
        },
        {
          dayOffset: 0,
          title: "Connect the core ideas",
          focus: "Learn and apply the next set of concepts.",
          kind: "learning",
          durationMinutes: 20,
          lessonVideoIds: ["video_two"],
        },
        {
          dayOffset: 4,
          title: "Review and recall",
          focus: "Revisit the ideas and check your understanding.",
          kind: "revision",
          durationMinutes: 15,
          lessonVideoIds: ["video_one", "video_two"],
        },
      ],
    },
    course,
    preferences,
  );

  assert.equal(result.success, false);
  assert.equal(
    result.message,
    "The plan must schedule every course lesson once and in order",
  );
});

test("study plans are authenticated and scoped to the course owner", async () => {
  const path = `/api/study-plans/courses/${courseId}`;
  const unauthenticated = await request(path, { auth: false });
  assert.equal(unauthenticated.status, 401);

  const otherOwner = await request(path, { forUserId: otherUserId });
  assert.equal(otherOwner.status, 404);
  assert.equal((await otherOwner.json()).error.code, "COURSE_NOT_FOUND");
});

test("rejects a generated plan that omits course lessons", async () => {
  generatedPlan = {
    ...generatedPlan,
    sessions: generatedPlan.sessions.map((session) =>
      session.kind === "learning"
        ? { ...session, lessonVideoIds: ["video_one"] }
        : session,
    ),
  };

  const response = await request(`/api/study-plans/courses/${courseId}`, {
    method: "POST",
    body: preferences,
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "AI_INVALID_OUTPUT");
  assert.equal(studyPlanModel.plans.length, 0);
});

test("creates a date-validated plan and lets the owner edit a session", async () => {
  generatedPlan = {
    title: "A steady path through the course",
    summary: "Build understanding in short sessions and review the main ideas.",
    sessions: [
      {
        dayOffset: 0,
        title: "Start with the foundations",
        focus: "Understand the introductory concepts.",
        kind: "learning",
        durationMinutes: 25,
        lessonVideoIds: ["video_one"],
      },
      {
        dayOffset: 2,
        title: "Connect the core ideas",
        focus: "Learn and apply the next set of concepts.",
        kind: "learning",
        durationMinutes: 20,
        lessonVideoIds: ["video_two"],
      },
      {
        dayOffset: 4,
        title: "Review and recall",
        focus: "Revisit the ideas and check your understanding.",
        kind: "revision",
        durationMinutes: 15,
        lessonVideoIds: ["video_one", "video_two"],
      },
    ],
  };

  const response = await request(`/api/study-plans/courses/${courseId}`, {
    method: "POST",
    body: preferences,
  });
  assert.equal(response.status, 201);
  const plan = (await response.json()).data.plan;
  assert.equal(plan.sessions[0].date, "2026-04-06");
  assert.equal(plan.sessions[1].date, "2026-04-08");
  assert.equal(plan.sessions[2].date, "2026-04-10");

  const updated = await request(
    `/api/study-plans/${plan._id}/sessions/${plan.sessions[0]._id}`,
    {
      method: "PATCH",
      body: {
        date: "2026-04-07",
        durationMinutes: 30,
        completed: true,
      },
    },
  );
  assert.equal(updated.status, 200);
  const updatedPlan = (await updated.json()).data.plan;
  assert.equal(updatedPlan.sessions[0].date, "2026-04-07");
  assert.equal(updatedPlan.sessions[0].durationMinutes, 30);
  assert.equal(updatedPlan.sessions[0].completed, true);

  const duplicate = await request(`/api/study-plans/courses/${courseId}`, {
    method: "POST",
    body: preferences,
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, "STUDY_PLAN_ALREADY_EXISTS");
  assert.equal(generatorCallCount, 2);
});
