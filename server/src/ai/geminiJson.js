export class GeminiProviderError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "GeminiProviderError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function generateGeminiJson({
  apiKey,
  model,
  systemInstruction,
  input,
  responseSchema,
  fetchImpl = fetch,
  timeoutMs = 60000,
  maxOutputTokens = 8192,
}) {
  if (!apiKey) {
    throw new GeminiProviderError(
      503,
      "AI_NOT_CONFIGURED",
      "AI generation is not configured on this server",
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          responseFormat: {
            text: { mimeType: "APPLICATION_JSON", schema: responseSchema },
          },
          temperature: 0.2,
          maxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new GeminiProviderError(
        504,
        "AI_TIMEOUT",
        "The AI provider took too long to respond; try again",
      );
    }
    throw new GeminiProviderError(
      503,
      "AI_PROVIDER_UNAVAILABLE",
      "The AI provider could not be reached; try again later",
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) {
      throw new GeminiProviderError(
        502,
        "AI_INVALID_RESPONSE",
        "The AI provider returned an unreadable response",
      );
    }
    payload = {};
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new GeminiProviderError(
        429,
        "AI_RATE_LIMITED",
        "The AI provider is rate-limiting requests; try again later",
      );
    }
    if (response.status === 503 || response.status === 504) {
      throw new GeminiProviderError(
        503,
        "AI_PROVIDER_UNAVAILABLE",
        "The AI provider is temporarily unavailable; try again later",
      );
    }
    throw new GeminiProviderError(
      502,
      "AI_PROVIDER_ERROR",
      "The AI provider could not generate a response",
    );
  }

  const candidate = payload.candidates?.[0];
  if (!candidate || candidate.finishReason !== "STOP") {
    throw new GeminiProviderError(
      502,
      "AI_INVALID_RESPONSE",
      "The AI provider did not return a complete response",
    );
  }

  const text = candidate.content?.parts
    ?.map((part) => part.text)
    .filter((part) => typeof part === "string")
    .join("");
  if (!text) {
    throw new GeminiProviderError(
      502,
      "AI_INVALID_RESPONSE",
      "The AI provider returned an empty response",
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiProviderError(
      502,
      "AI_INVALID_RESPONSE",
      "The AI provider returned invalid JSON",
    );
  }
}
