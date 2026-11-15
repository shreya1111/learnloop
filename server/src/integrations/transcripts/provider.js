export function createTranscriptProvider({ automaticProvider } = {}) {
  return async function acquireTranscript({ videoId, userProvidedText }) {
    const text = userProvidedText?.trim();
    if (text) {
      return { available: true, source: "user", text };
    }

    if (automaticProvider) {
      return automaticProvider(videoId);
    }

    return {
      available: false,
      source: null,
      message:
        "YouTube playlist metadata does not include transcripts. Paste a transcript to add lesson context.",
    };
  };
}
