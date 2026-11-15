import { useEffect, useState } from "react";
import { Brain, Sparkles } from "lucide-react";

export default function QuizBuilder({
  chapters,
  initialMode = "quiz",
  isGenerating,
  onGenerate,
}) {
  const [mode, setMode] = useState(initialMode);
  const [questionCount, setQuestionCount] = useState("10");
  const [chapterPosition, setChapterPosition] = useState("");
  const placementNeedsMoreQuestions =
    mode === "placement" && chapters.length > Number(questionCount);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  function submit(event) {
    event.preventDefault();
    onGenerate({
      mode,
      questionCount: Number(questionCount),
      ...(mode === "quiz" && chapterPosition !== ""
        ? { chapterPosition: Number(chapterPosition) }
        : {}),
    });
  }

  return (
    <form
      className="mt-7 grid gap-5 rounded-3xl border-2 border-black bg-white p-5  sm:p-7"
      onSubmit={submit}
    >
      <div>
        <h2 className="text-lg font-semibold">Create a knowledge check</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Questions use the course outline and any transcripts you have added.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">
          Choose a test type
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ["quiz", "Topic quiz", "Practice the full course or one chapter."],
            [
              "placement",
              "Placement test",
              "Sample every chapter and identify what to focus on.",
            ],
          ].map(([value, title, description]) => (
            <label
              className={`cursor-pointer rounded-2xl border p-4 transition ${
                mode === value
                  ? "border-cyan-300 bg-cyan-50/70"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
              key={value}
            >
              <span className="flex items-start gap-3">
                <input
                  checked={mode === value}
                  className="mt-1 accent-cyan-700"
                  name="testMode"
                  onChange={() => setMode(value)}
                  type="radio"
                  value={value}
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {description}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Number of questions
          <input
            className="mt-2 w-full rounded-xl border-2 border-black px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
            max={20}
            min={5}
            onChange={(event) => setQuestionCount(event.target.value)}
            required
            type="number"
            value={questionCount}
          />
        </label>
        {mode === "quiz" && (
          <label className="block text-sm font-medium text-slate-700">
            Topic
            <select
              className="mt-2 w-full rounded-xl border-2 border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
              onChange={(event) => setChapterPosition(event.target.value)}
              value={chapterPosition}
            >
              <option value="">Entire course</option>
              {chapters.map((chapter) => (
                <option key={chapter.position} value={chapter.position}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {placementNeedsMoreQuestions && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Choose at least {chapters.length} questions to include every chapter.
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5 text-slate-500">
          Short answers are checked against the generated answer and accepted
          alternatives. Results are saved to this course.
        </p>
        <button
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating || placementNeedsMoreQuestions}
          type="submit"
        >
          {mode === "placement" ? (
            <Brain aria-hidden="true" size={16} />
          ) : (
            <Sparkles aria-hidden="true" size={16} />
          )}
          {isGenerating ? "Preparing questions…" : "Create test"}
        </button>
      </div>
    </form>
  );
}
