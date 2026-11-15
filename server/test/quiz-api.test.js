import assert from "node:assert/strict";
import { after, test } from "node:test";
import mongoose from "mongoose";
import { AUTH_COOKIE_NAME, createAuthToken } from "../src/auth/security.js";
import { createApp } from "../src/app.js";
import {
  gradeQuiz,
  normalizeGeneratedQuiz,
  validateGeneratedQuiz,
} from "../src/quizzes/router.js";
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
  status: "structured",
  description: "Core design concepts.",
  learningObjectives: ["Understand design principles"],
  difficulty: "beginner",
  chapters: [
    {
      title: "Color theory",
      description: "Color relationships and contrast.",
      position: 0,
      lessons: [{ videoId: "video_color", title: "Color basics" }],
    },
    {
      title: "Typography",
      description: "Type selection and hierarchy.",
      position: 1,
      lessons: [{ videoId: "video_type", title: "Type basics" }],
    },
  ],
};

const generatedQuiz = {
  title: "Design foundations check",
  description: "Check your understanding of color and typography.",
  questions: [
    {
      topic: "Color theory",
      lessonVideoIds: ["video_color"],
      type: "multiple-choice",
      prompt: "Which pair are complementary colors?",
      options: ["Red and green", "Red and orange", "Blue and green", "Yellow and orange"],
      correctAnswer: "Red and green",
      acceptedAnswers: [],
      explanation: "Complementary hues sit opposite each other on the color wheel.",
      difficulty: "beginner",
    },
    {
      topic: "Color theory",
      lessonVideoIds: ["video_color"],
      type: "true-false",
      prompt: "Contrast can help make text easier to read.",
      options: ["True", "False"],
      correctAnswer: "True",
      acceptedAnswers: [],
      explanation: "Sufficient contrast improves text legibility.",
      difficulty: "beginner",
    },
    {
      topic: "Color theory",
      lessonVideoIds: ["video_color"],
      type: "short-answer",
      prompt: "What do we call colors opposite one another on the color wheel?",
      options: [],
      correctAnswer: "Complementary colors",
      acceptedAnswers: ["complementary hues"],
      explanation: "Complementary colors form opposing pairs on the color wheel.",
      difficulty: "intermediate",
    },
    {
      topic: "Typography",
      lessonVideoIds: ["video_type"],
      type: "multiple-choice",
      prompt: "What does typographic hierarchy primarily guide?",
      options: ["Reading order", "Image resolution", "File size", "Color temperature"],
      correctAnswer: "Reading order",
      acceptedAnswers: [],
      explanation: "Hierarchy signals the relative importance and sequence of text.",
      difficulty: "beginner",
    },
    {
      topic: "Typography",
      lessonVideoIds: ["video_type"],
      type: "short-answer",
      prompt: "Name the visual ranking of text elements.",
      options: [],
      correctAnswer: "Typographic hierarchy",
      acceptedAnswers: ["type hierarchy"],
      explanation: "Typographic hierarchy organizes text by visual importance.",
      difficulty: "intermediate",
    },
  ],
};

function createMemoryModels() {
  const quizzes = [];
  const attempts = [];
  return {
    quizzes,
    attempts,
    QuizModel: {
      async findOne(query) {
        return (
          quizzes.find(
            (quiz) =>
              String(quiz._id) === String(query._id) &&
              String(quiz.userId) === String(query.userId),
          ) ?? null
        );
      },
      find(query) {
        return {
          sort: async () =>
            quizzes.filter(
              (quiz) =>
                String(quiz.userId) === String(query.userId) &&
                String(quiz.courseId) === String(query.courseId),
            ),
        };
      },
      async create(fields) {
        const quiz = {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          ...fields,
          questions: fields.questions.map((question) => ({
            _id: new mongoose.Types.ObjectId(),
            ...question,
          })),
        };
        quizzes.push(quiz);
        return quiz;
      },
    },
    QuizAttemptModel: {
      find(query) {
        return {
          sort() {
            return {
              limit: async () =>
                attempts.filter(
                  (attempt) =>
                    String(attempt.userId) === String(query.userId) &&
                    String(attempt.courseId) === String(query.courseId),
                ),
            };
          },
        };
      },
      async create(fields) {
        const attempt = {
          _id: new mongoose.Types.ObjectId(),
          submittedAt: new Date(),
          ...fields,
        };
        attempts.push(attempt);
        return attempt;
      },
    },
  };
}

const memory = createMemoryModels();
const generated = structuredClone(generatedQuiz);
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
  TranscriptModel: {
    find() {
      return {
        select() {
          return {
            limit: async () => [
              { videoId: "video_color", text: "User transcript" },
            ],
          };
        },
      };
    },
  },
  QuizModel: memory.QuizModel,
  QuizAttemptModel: memory.QuizAttemptModel,
  quizGenerator: async (input) => {
    assert.equal(input.transcripts.length, 1);
    if (input.mode === "placement") {
      assert.equal(input.chapterPosition, undefined);
    } else {
      assert.equal(input.mode, "quiz");
    }
    return generated;
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

test("quiz generation validates topic coverage and hides answers before submission", async () => {
  const unauthenticated = await request(`/api/quizzes/courses/${courseId}`, {
    method: "POST",
    body: { mode: "quiz", questionCount: 5 },
    auth: false,
  });
  assert.equal(unauthenticated.status, 401);

  const otherOwner = await request(`/api/quizzes/courses/${courseId}`, {
    forUserId: otherUserId,
  });
  assert.equal(otherOwner.status, 404);

  const response = await request(`/api/quizzes/courses/${courseId}`, {
    method: "POST",
    body: { mode: "quiz", questionCount: 5 },
  });
  assert.equal(response.status, 201);
  const quiz = (await response.json()).data.quiz;
  assert.equal(quiz.questions.length, 5);
  assert.equal("correctAnswer" in quiz.questions[0], false);
  assert.equal("acceptedAnswers" in quiz.questions[0], false);

  const fetched = await request(`/api/quizzes/${quiz._id}`);
  assert.equal(fetched.status, 200);
  assert.equal("correctAnswer" in (await fetched.json()).data.quiz.questions[0], false);
  return quiz;
});

test("placement test generation includes every course topic", async () => {
  const response = await request(`/api/quizzes/courses/${courseId}`, {
    method: "POST",
    body: { mode: "placement", questionCount: 5 },
  });
  assert.equal(response.status, 201);
  const quiz = (await response.json()).data.quiz;
  assert.equal(quiz.mode, "placement");
  assert.deepEqual(
    new Set(quiz.questions.map((question) => question.topic)),
    new Set(["Color theory", "Typography"]),
  );
});

test("attempt submission checks completeness, grades answers, and stores topic recommendations", async () => {
  const quiz = memory.quizzes[0];
  const ownerOnly = await request(`/api/quizzes/${quiz._id}`, {
    forUserId: otherUserId,
  });
  assert.equal(ownerOnly.status, 404);

  const incomplete = await request(`/api/quizzes/${quiz._id}/attempts`, {
    method: "POST",
    body: { answers: [] },
  });
  assert.equal(incomplete.status, 400);

  const answers = quiz.questions.map((question, index) => ({
    questionId: String(question._id),
    answer: [
      question.correctAnswer,
      question.correctAnswer,
      "not sure",
      question.correctAnswer,
      "Typographic hierarchy",
    ][index],
  }));
  const response = await request(`/api/quizzes/${quiz._id}/attempts`, {
    method: "POST",
    body: { answers },
  });
  assert.equal(response.status, 201);
  const { attempt, results } = (await response.json()).data;
  assert.equal(attempt.scorePercent, 80);
  assert.equal(attempt.topicResults[0].recommendation, "revise");
  assert.equal(attempt.topicResults[1].recommendation, "skip");
  assert.equal(results[2].isCorrect, false);
  assert.equal(results[2].correctAnswer, "Complementary colors");
  assert.equal(memory.attempts.length, 1);
});

test("quiz output rejects missing placement topics and invalid answer options", () => {
  const missingTopic = validateGeneratedQuiz(
    { ...generatedQuiz, questions: generatedQuiz.questions.slice(0, 3) },
    course,
    { mode: "placement", questionCount: 3 },
  );
  assert.equal(missingTopic.success, false);

  const malformedChoice = structuredClone(generatedQuiz);
  malformedChoice.questions[0].correctAnswer = "Not an option";
  const invalidAnswer = validateGeneratedQuiz(malformedChoice, course, {
    mode: "quiz",
    questionCount: 5,
  });
  assert.equal(invalidAnswer.success, false);
});

test("quiz normalization clears provider-echoed answers on choice questions", () => {
  const echoed = structuredClone(generatedQuiz);
  echoed.questions[0].acceptedAnswers = ["Red and green"];
  echoed.questions[1].acceptedAnswers = ["True"];
  const scope = { mode: "quiz", questionCount: 5 };
  assert.equal(validateGeneratedQuiz(echoed, course, scope).success, false);

  const normalized = normalizeGeneratedQuiz(echoed);
  assert.deepEqual(normalized.questions[0].acceptedAnswers, []);
  assert.deepEqual(normalized.questions[2].acceptedAnswers, ["complementary hues"]);
  assert.equal(validateGeneratedQuiz(normalized, course, scope).success, true);
});

test("quiz grading normalizes case, punctuation, and accepted short answers", () => {
  const result = gradeQuiz(
    {
      questions: [
        {
          _id: "question_one",
          topic: "Color theory",
          correctAnswer: "Complementary colors",
          acceptedAnswers: ["complementary hues"],
        },
      ],
    },
    [{ questionId: "question_one", answer: "COMPLEMENTARY HUES!" }],
  );
  assert.equal(result.scorePercent, 100);
  assert.equal(result.topicResults[0].recommendation, "skip");
});
