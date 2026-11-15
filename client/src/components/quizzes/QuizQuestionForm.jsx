import { useState } from "react";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";

const questionTypeLabels = {
  "multiple-choice": "Multiple choice",
  "true-false": "True or false",
  "short-answer": "Short answer",
};

export default function QuizQuestionForm({ quiz, isSubmitting, onBack, onSubmit }) {
  const [answers, setAnswers] = useState({});

  function submit(event) {
    event.preventDefault();
    onSubmit(
      quiz.questions.map((question) => ({
        questionId: question._id,
        answer: answers[question._id] ?? "",
      })),
    );
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={submit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={15} />
          All tests
        </button>
        <span className="text-xs font-medium text-slate-500">
          {quiz.questions.length} questions · answer what you can
        </span>
      </div>
      {quiz.questions.map((question, index) => (
        <fieldset
          className="rounded-3xl border-2 border-black bg-white p-5  sm:p-6"
          key={question._id}
        >
          <legend className="sr-only">
            Question {index + 1}: {question.prompt}
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-900">
              {question.topic}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
              {questionTypeLabels[question.type]}
            </span>
            <span className="ml-auto text-xs text-slate-400">
              {index + 1} / {quiz.questions.length}
            </span>
          </div>
          <h2 className="mt-4 text-base font-semibold leading-6 text-slate-900">
            {question.prompt}
          </h2>
          {question.options.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              {question.options.map((option) => (
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${
                    answers[question._id] === option
                      ? "border-cyan-300 bg-cyan-50 text-cyan-950"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  key={option}
                >
                  <input
                    checked={answers[question._id] === option}
                    className="mt-0.5 accent-cyan-700"
                    name={question._id}
                    onChange={() =>
                      setAnswers((current) => ({
                        ...current,
                        [question._id]: option,
                      }))
                    }
                    type="radio"
                    value={option}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          ) : (
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Your answer
              <input
                autoComplete="off"
                className="mt-2 w-full rounded-xl border-2 border-black px-3.5 py-3 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
                maxLength={1000}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question._id]: event.target.value,
                  }))
                }
                value={answers[question._id] ?? ""}
              />
            </label>
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100 p-4">
        <p className="text-xs text-slate-600">
          Unanswered questions are marked incorrect.
        </p>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Scoring…" : "Submit answers"}
          {isSubmitting ? (
            <Send aria-hidden="true" size={15} />
          ) : (
            <ArrowRight aria-hidden="true" size={15} />
          )}
        </button>
      </div>
    </form>
  );
}
