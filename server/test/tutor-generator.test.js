import assert from "node:assert/strict";
import { test } from "node:test";
import { createGeminiTutor } from "../src/ai/tutor.js";

test("AI tutor request keeps the provider key server-side and returns structured citations", async () => {
  let request;
  const tutor = createGeminiTutor({
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
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        answer: "Complementary hues sit opposite on the color wheel.",
                        citationVideoIds: ["video_color"],
                      }),
                    },
                  ],
                },
              },
            ],
          };
        },
      };
    },
  });

  const answer = await tutor({
    course: {
      title: "Design foundations",
      description: "Color and typography.",
      learningObjectives: ["Understand color"],
      chapters: [
        {
          title: "Color theory",
          description: "Color relationships",
          lessons: [{ videoId: "video_color", title: "Color basics" }],
        },
      ],
    },
    transcripts: [{ videoId: "video_color", text: "Complementary hues..." }],
    notes: [{ videoId: "video_color", text: "My note" }],
    history: [{ role: "user", text: "What is color?" }],
    message: "Explain complementary colors.",
  });

  assert.equal(request.headers["x-goog-api-key"], "server-only-key");
  assert.equal(answer.citationVideoIds[0], "video_color");
  const payload = JSON.parse(request.body);
  assert.match(
    payload.systemInstruction.parts[0].text,
    /untrusted reference data/i,
  );
  const input = JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(input.learnerQuestion, "Explain complementary colors.");
  assert.equal(input.availableUserProvidedTranscripts[0].videoId, "video_color");
  assert.equal(JSON.stringify(payload).includes("server-only-key"), false);
});
