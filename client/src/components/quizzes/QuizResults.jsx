import { ArrowLeft, Check, X } from "lucide-react";

const recommendationLabels = {
  skip: "Consider skipping the introductory lessons",
  revise: "Review this topic",
  "deeper-learning": "Spend more time learning this topic",
};

export default function QuizResults({ quiz, report, onBack }) {
  return (
    <section className="mt-7">
      <button
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        onClick={onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={15} />
        All tests
      </button>
      <div className="mt-5 rounded-3xl border-2 border-black bg-white p-6  sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
          {quiz.mode === "placement" ? "Placement results" : "Quiz results"}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {report.attempt.scorePercent}% — {report.attempt.correctCount} of{" "}
          {report.attempt.totalQuestions} correct
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {quiz.mode === "placement"
            ? "Use these topic estimates to decide what to review. Each topic is sampled by a limited number of questions."
            : "Review the explanations below to reinforce the ideas."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {report.attempt.topicResults.map((topic) => (
          <article
            className="rounded-2xl border-2 border-black bg-white p-4"
            key={topic.topic}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {topic.topic}
              </h3>
              <span className="text-sm font-semibold text-slate-700">
                {topic.masteryPercent}%
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {recommendationLabels[topic.recommendation]}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {topic.correct} of {topic.total} correct
            </p>
          </article>
        ))}
      </div>

      <div className="mt-7 space-y-3">
        <h2 className="text-lg font-semibold">Answer review</h2>
        {report.results.map((result, index) => (
          <article
            className="rounded-2xl border-2 border-black bg-white p-5"
            key={result.questionId}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                  result.isCorrect
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {result.isCorrect ? (
                  <Check aria-hidden="true" size={14} />
                ) : (
                  <X aria-hidden="true" size={14} />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  {index + 1}. {result.topic}
                </p>
                <h3 className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                  {result.prompt}
                </h3>
                <p className="mt-2 text-xs text-slate-600">
                  Your answer: {result.answer || "Not answered"}
                </p>
                {!result.isCorrect && (
                  <p className="mt-1 text-xs font-medium text-emerald-800">
                    Expected answer: {result.correctAnswer}
                  </p>
                )}
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {result.explanation}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
