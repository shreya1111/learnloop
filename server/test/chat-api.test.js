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
  title: "Foundations of design",
  description: "Design basics.",
  learningObjectives: ["Understand color"],
  videos: [{ videoId: "video_color", title: "Color basics" }],
  chapters: [
    {
      title: "Color theory",
      description: "Color relationships",
      lessons: [{ videoId: "video_color", title: "Color basics" }],
    },
  ],
};
const conversations = [];
let tutorInput;

function chain(rows) {
  const query = {
    sort() {
      return query;
    },
    limit() {
      return query;
    },
    select() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(rows).then(resolve, reject);
    },
  };
  return query;
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
    findOne(filter) {
      const found =
        String(filter._id) === String(courseId) &&
        String(filter.userId) === String(userId);
      return {
        select() {
          return Promise.resolve(found ? course : null);
        },
        then(resolve, reject) {
          return Promise.resolve(found ? course : null).then(resolve, reject);
        },
      };
    },
  },
  TranscriptModel: {
    find() {
      return {
        select() {
          return {
            limit: async () => [
              {
                videoId: "video_color",
                text: "Complementary hues appear opposite each other on the wheel.",
              },
            ],
          };
        },
      };
    },
  },
  LessonStateModel: {
    find() {
      return chain([
        { videoId: "video_color", note: "Remember contrast and harmony." },
      ]);
    },
  },
  ChatConversationModel: {
    async findOne(filter) {
      return (
        conversations.find(
          (item) =>
            String(item._id) === String(filter._id) &&
            String(item.userId) === String(filter.userId) &&
            String(item.courseId) === String(filter.courseId),
        ) ?? null
      );
    },
    find(filter) {
      return chain(
        conversations.filter(
          (item) =>
            String(item.courseId) === String(filter.courseId) &&
            String(item.userId) === String(filter.userId),
        ),
      );
    },
    async create(fields) {
      const conversation = {
        _id: new mongoose.Types.ObjectId(),
        ...fields,
        messages: fields.messages.map((message) => ({
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          ...message,
        })),
        async save() {},
      };
      conversations.push(conversation);
      return conversation;
    },
  },
  tutor: async (input) => {
    tutorInput = input;
    return {
      answer: "Complementary colors are opposite on the color wheel.",
      citationVideoIds: ["video_color"],
    };
  },
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

test("tutor conversations are authenticated, owned, and use only bounded course context", async () => {
  const unauthenticated = await request(`/api/chat/courses/${courseId}`, {
    auth: false,
  });
  assert.equal(unauthenticated.status, 401);

  const otherOwner = await request(`/api/chat/courses/${courseId}`);
  assert.equal(otherOwner.status, 200);
  assert.deepEqual((await otherOwner.json()).data.conversations, []);

  const missingCourse = await request(
    `/api/chat/courses/${courseId}/messages`,
    {
      method: "POST",
      forUserId: otherUserId,
      body: { message: "Explain color theory" },
    },
  );
  assert.equal(missingCourse.status, 404);

  const sent = await request(`/api/chat/courses/${courseId}/messages`, {
    method: "POST",
    body: { message: "Explain complementary colors." },
  });
  assert.equal(sent.status, 200);
  const { conversation, answer } = (await sent.json()).data;
  assert.equal(conversation.messages.length, 2);
  assert.equal(answer.citations[0].title, "Color basics");
  assert.equal(tutorInput.transcripts.length, 1);
  assert.equal(tutorInput.notes[0].text, "Remember contrast and harmony.");

  const anotherOwnerConversation = await request(
    `/api/chat/courses/${courseId}/messages`,
    {
      method: "POST",
      forUserId: otherUserId,
      body: {
        message: "Continue",
        conversationId: conversation._id,
      },
    },
  );
  assert.equal(anotherOwnerConversation.status, 404);
});

test("tutor continues saved context across messages", async () => {
  const first = conversations[0];
  const response = await request(`/api/chat/courses/${courseId}/messages`, {
    method: "POST",
    body: {
      message: "How do they relate to contrast?",
      conversationId: String(first._id),
    },
  });
  assert.equal(response.status, 200);
  assert.equal(tutorInput.history.length, 2);
  assert.equal(tutorInput.history[0].role, "user");
  assert.equal(
    tutorInput.message,
    "How do they relate to contrast?",
  );
  assert.equal((await response.json()).data.conversation.messages.length, 4);
});
