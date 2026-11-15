import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGeminiCourseStructureGenerator,
  GeminiProviderError,
} from "../src/ai/courseStructure.js";

const playlist = { title: "A playlist", description: "Playlist description" };
const videos = [
  { videoId: "video_one", title: "Lesson one", durationSeconds: 60 },
];
const generatedStructure = {
  title: "A course",
  description: "A course description",
  learningObjectives: ["Learn the basics", "Apply the ideas"],
  difficulty: "beginner",
  prerequisites: [],
  estimatedDurationMinutes: 10,
  chapters: [
    {
      title: "Foundations",
      description: "An introduction to the subject.",
      videoIds: ["video_one"],
    },
  ],
};

test("Gemini provider sends a server-keyed structured-output request", async () => {
  let requestUrl;
  let requestOptions;
  const generate = createGeminiCourseStructureGenerator({
    apiKey: "server-only-key",
    model: "configured-model",
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: JSON.stringify(generatedStructure) }] },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const result = await generate({ playlist, videos });
  const requestBody = JSON.parse(requestOptions.body);
  assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/configured-model:generateContent");
  assert.equal(requestOptions.headers["x-goog-api-key"], "server-only-key");
  assert.equal(
    requestBody.generationConfig.responseFormat.text.mimeType,
    "APPLICATION_JSON",
  );
  assert.ok(requestBody.generationConfig.responseFormat.text.schema);
  assert.equal(requestBody.contents[0].parts[0].text.includes("video_one"), true);
  assert.deepEqual(result, generatedStructure);
});

test("Gemini provider reports missing configuration and quota errors explicitly", async () => {
  const unconfigured = createGeminiCourseStructureGenerator({
    apiKey: undefined,
    model: "configured-model",
  });
  await assert.rejects(
    unconfigured({ playlist, videos }),
    (error) => error instanceof GeminiProviderError && error.code === "AI_NOT_CONFIGURED",
  );

  const rateLimited = createGeminiCourseStructureGenerator({
    apiKey: "server-only-key",
    model: "configured-model",
    fetchImpl: async () => new Response("{}", { status: 429 }),
  });
  await assert.rejects(
    rateLimited({ playlist, videos }),
    (error) =>
      error instanceof GeminiProviderError &&
      error.statusCode === 429 &&
      error.code === "AI_RATE_LIMITED",
  );
});

test("Gemini provider rejects truncated or malformed model output", async () => {
  for (const payload of [
    { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] },
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not json" }] } }] },
  ]) {
    const generate = createGeminiCourseStructureGenerator({
      apiKey: "server-only-key",
      model: "configured-model",
      fetchImpl: async () =>
        new Response(JSON.stringify(payload), { status: 200 }),
    });
    await assert.rejects(
      generate({ playlist, videos }),
      (error) =>
        error instanceof GeminiProviderError && error.code === "AI_INVALID_RESPONSE",
    );
  }
});
