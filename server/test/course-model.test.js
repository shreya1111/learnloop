import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { Course } from "../src/models/Course.js";
import { ChatConversation } from "../src/models/ChatConversation.js";
import { LearningActivity } from "../src/models/LearningActivity.js";
import { LessonState } from "../src/models/LessonState.js";
import { Quiz } from "../src/models/Quiz.js";
import { QuizAttempt } from "../src/models/QuizAttempt.js";
import { StudyPlan } from "../src/models/StudyPlan.js";

test("course schema validates the generated chapter and lesson structure", async () => {
  const course = new Course({
    userId: new mongoose.Types.ObjectId(),
    title: "Structured course",
    status: "structured",
    playlist: {
      youtubePlaylistId: "PLcourse",
      sourceUrl: "https://www.youtube.com/playlist?list=PLcourse",
      title: "Playlist",
      videoCount: 1,
      importedAt: new Date(),
    },
    videos: [
      {
        videoId: "video_one",
        title: "Lesson one",
        position: 0,
        videoUrl: "https://www.youtube.com/watch?v=video_one",
      },
    ],
    learningObjectives: ["Understand the subject", "Apply the concepts"],
    difficulty: "beginner",
    prerequisites: [],
    estimatedDurationMinutes: 30,
    chapters: [
      {
        title: "Foundations",
        description: "An introduction to the subject.",
        position: 0,
        lessons: [
          {
            videoId: "video_one",
            title: "Lesson one",
            videoUrl: "https://www.youtube.com/watch?v=video_one",
            position: 0,
            durationSeconds: 120,
          },
        ],
      },
    ],
  });

  await course.validate();
  assert.equal(course.chapters[0].lessons[0].videoId, "video_one");
  assert.deepEqual(course.learningObjectives, [
    "Understand the subject",
    "Apply the concepts",
  ]);
});

test("lesson state validates user-scoped completion and note fields", async () => {
  const state = new LessonState({
    userId: new mongoose.Types.ObjectId(),
    courseId: new mongoose.Types.ObjectId(),
    videoId: "video_one",
    completed: true,
    completedAt: new Date(),
    note: "A useful reminder.",
    bookmarked: true,
  });

  await state.validate();
  assert.equal(state.completed, true);
  assert.equal(state.bookmarked, true);
  assert.equal(state.note, "A useful reminder.");
});

test("study plan schema validates editable scheduled sessions", async () => {
  const plan = new StudyPlan({
    userId: new mongoose.Types.ObjectId(),
    courseId: new mongoose.Types.ObjectId(),
    title: "A weekly learning path",
    goal: "Understand and apply the foundations",
    summary: "Study concepts and revisit them for retention.",
    startDate: "2026-04-06",
    weeks: 1,
    minutesPerSession: 45,
    studyDays: ["monday", "wednesday"],
    sessions: [
      {
        date: "2026-04-06",
        dayOffset: 0,
        title: "Learn the foundations",
        focus: "Understand the introductory concepts.",
        kind: "learning",
        durationMinutes: 30,
        lessonVideoIds: ["video_one"],
      },
    ],
  });

  await plan.validate();
  assert.equal(plan.sessions[0].kind, "learning");
  assert.equal(plan.sessions[0].lessonVideoIds[0], "video_one");
});

test("quiz and attempt schemas validate answer keys and diagnostic results", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const quiz = new Quiz({
    userId,
    courseId,
    title: "Foundations check",
    mode: "placement",
    description: "Check foundational understanding.",
    questions: [
      {
        topic: "Color theory",
        lessonVideoIds: ["video_color"],
        type: "short-answer",
        prompt: "Name the colors opposite on the color wheel.",
        options: [],
        correctAnswer: "Complementary colors",
        acceptedAnswers: ["complementary hues"],
        explanation: "Complementary colors are opposite on the wheel.",
        difficulty: "beginner",
      },
    ],
  });
  await quiz.validate();

  const attempt = new QuizAttempt({
    userId,
    courseId,
    quizId: quiz._id,
    scorePercent: 100,
    correctCount: 1,
    totalQuestions: 1,
    questionResults: [
      { questionId: quiz.questions[0]._id, answer: "Complementary hues", isCorrect: true },
    ],
    topicResults: [
      {
        topic: "Color theory",
        correct: 1,
        total: 1,
        masteryPercent: 100,
        recommendation: "skip",
      },
    ],
  });
  await attempt.validate();
  assert.equal(quiz.questions[0].correctAnswer, "Complementary colors");
  assert.equal(attempt.topicResults[0].recommendation, "skip");
});

test("study activity and tutor conversation schemas validate owner-scoped records", async () => {
  const userId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const activity = new LearningActivity({
    userId,
    courseId,
    durationMinutes: 45,
  });
  await activity.validate();
  assert.equal(activity.durationMinutes, 45);

  const conversation = new ChatConversation({
    userId,
    courseId,
    title: "Explain color theory",
    messages: [
      { role: "user", text: "What are complementary colors?" },
      {
        role: "assistant",
        text: "They are opposite on the color wheel.",
        citations: [{ videoId: "video_color", title: "Color basics" }],
      },
    ],
  });
  await conversation.validate();
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[1].citations[0].videoId, "video_color");
});
