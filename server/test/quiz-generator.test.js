import assert from "node:assert/strict";
import { test } from "node:test";
import { createGeminiQuizGenerator } from "../src/ai/quiz.js";

test("quiz generator sends bounded course context and only the selected chapter", async () => {
  let request;
  const generator = createGeminiQuizGenerator({
    apiKey: "server-only-key",
    model: "gemini-test",
    fetchImpl: async (url, options) => {
      request = { url, ...options };
      return {
        ok: true,
        async json() {
          return {
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: '{"title":"Quiz","description":"Practice","questions":[]}' }] },
              },
            ],
          };
        },
      };
    },
  });

  const course = {
    title: "Course title",
    description: "Course description",
    learningObjectives: ["Understand the foundations"],
    difficulty: "beginner",
    chapters: [
      {
        title: "Color theory",
        description: "Color relationships",
        position: 0,
        lessons: [
          { videoId: "video_color", title: "Color basics", durationSeconds: 100 },
        ],
      },
      {
        title: "Typography",
        description: "Type systems",
        position: 1,
        lessons: [
          { videoId: "video_type", title: "Type basics", durationSeconds: 200 },
        ],
      },
    ],
  };
  await generator({
    course,
    transcripts: [
      { videoId: "video_color", text: "A".repeat(30000) },
      { videoId: "video_type", text: "B".repeat(30000) },
    ],
    mode: "quiz",
    questionCount: 5,
    chapterPosition: 0,
  });

  assert.equal(request.headers["x-goog-api-key"], "server-only-key");
  assert.match(request.url, /gemini-test:generateContent$/);
  const payload = JSON.parse(request.body);
  const input = JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(input.mode, "quiz");
  assert.equal(input.course.chapters.length, 1);
  assert.equal(input.course.chapters[0].title, "Color theory");
  assert.equal(
    input.availableUserProvidedTranscripts.reduce(
      (total, transcript) => total + transcript.text.length,
      0,
    ),
    40000,
  );
  assert.equal(JSON.stringify(payload).includes("server-only-key"), false);
});
