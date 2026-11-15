import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenCheck } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getApiErrorMessage, http } from "../api/http.js";
import BrandMark from "../components/BrandMark.jsx";
import QuizBuilder from "../components/quizzes/QuizBuilder.jsx";
import QuizQuestionForm from "../components/quizzes/QuizQuestionForm.jsx";
import QuizResults from "../components/quizzes/QuizResults.jsx";

export default function QuizzesPage() {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [courseResponse, quizzesResponse] = await Promise.all([
        http.get(`/api/courses/${courseId}`),
        http.get(`/api/quizzes/courses/${courseId}`),
      ]);
      setCourse(courseResponse.data.data.course);
      setQuizzes(quizzesResponse.data.data.quizzes);
      setAttempts(quizzesResponse.data.data.attempts);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function generateTest(preferences) {
    setError("");
    setIsGenerating(true);
    try {
      const response = await http.post(
        `/api/quizzes/courses/${courseId}`,
        preferences,
        { timeout: 70000 },
      );
      const quiz = response.data.data.quiz;
      setQuizzes((current) => [quiz, ...current]);
      setActiveQuiz(quiz);
      setReport(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsGenerating(false);
    }
  }

  async function selectQuiz(quizId) {
    setError("");
    setIsLoading(true);
    try {
      const response = await http.get(`/api/quizzes/${quizId}`);
      setActiveQuiz(response.data.data.quiz);
      setReport(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswers(answers) {
    setError("");
    setIsSubmitting(true);
    try {
      const response = await http.post(
        `/api/quizzes/${activeQuiz._id}/attempts`,
        { answers },
      );
      setReport(response.data.data);
      const history = await http.get(`/api/quizzes/courses/${courseId}`);
      setAttempts(history.data.data.attempts);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function returnToTests() {
    setActiveQuiz(null);
    setReport(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-brand px-5 py-6 text-slate-900 sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <BrandMark />
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          to={course ? `/courses/${course._id}` : "/dashboard"}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Course details
        </Link>
      </header>

      <section className="mx-auto max-w-5xl py-9 sm:py-12">
        {isLoading && !activeQuiz ? (
          <p
            aria-live="polite"
            className="py-16 text-center text-sm text-slate-500"
            role="status"
          >
            Loading course tests…
          </p>
        ) : error && !course ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-lg font-semibold text-rose-950">
              Tests could not be loaded
            </h1>
            <p className="mt-2 text-sm text-rose-800">{error}</p>
            <button
              className="mt-4 text-sm font-semibold text-rose-900 underline underline-offset-2"
              onClick={() => loadPage()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : course ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
              Quizzes & placement
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {course.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Test your understanding with topic quizzes, or take a placement
              test to see which chapters may need more attention.
            </p>
            {error && (
              <p
                aria-live="polite"
                className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                role="alert"
              >
                {error}
              </p>
            )}

            {activeQuiz ? (
              report ? (
                <QuizResults
                  onBack={returnToTests}
                  quiz={activeQuiz}
                  report={report}
                />
              ) : (
                <QuizQuestionForm
                  isSubmitting={isSubmitting}
                  onBack={returnToTests}
                  onSubmit={submitAnswers}
                  quiz={activeQuiz}
                />
              )
            ) : course.status !== "structured" ? (
              <div className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="font-semibold text-amber-950">
                  Create the course outline first
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  Quiz and placement questions need course chapters and lessons.
                  Add transcripts to support questions with more context.
                </p>
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-950 underline underline-offset-2"
                  to={`/courses/${course._id}`}
                >
                  Open course details <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            ) : (
              <>
                <QuizBuilder
                  chapters={course.chapters}
                  initialMode={
                    searchParams.get("mode") === "placement"
                      ? "placement"
                      : "quiz"
                  }
                  isGenerating={isGenerating}
                  onGenerate={generateTest}
                />

                {quizzes.length > 0 && (
                  <section className="mt-9">
                    <h2 className="text-lg font-semibold">Your tests</h2>
                    <div className="mt-3 space-y-3">
                      {quizzes.map((quiz) => (
                        <article
                          className="flex flex-col gap-3 rounded-2xl border-2 border-black bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                          key={quiz._id}
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-800">
                              <BookOpenCheck aria-hidden="true" size={18} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {quiz.mode === "placement"
                                  ? "Placement test"
                                  : "Topic quiz"}
                              </p>
                              <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">
                                {quiz.title}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                {quiz.questions.length} questions
                              </p>
                            </div>
                          </div>
                          <button
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand hover:text-black"
                            onClick={() => selectQuiz(quiz._id)}
                            type="button"
                          >
                            Take test <ArrowRight aria-hidden="true" size={14} />
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {attempts.length > 0 && (
                  <section className="mt-9">
                    <h2 className="text-lg font-semibold">Recent results</h2>
                    <div className="mt-3 divide-y divide-slate-100 rounded-2xl border-2 border-black bg-white px-4">
                      {attempts.map((attempt) => {
                        const quiz = quizzes.find(
                          (item) => item._id === attempt.quizId,
                        );
                        return (
                          <article
                            className="flex flex-wrap items-center justify-between gap-3 py-4"
                            key={attempt._id}
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {quiz?.title ?? "Course test"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {attempt.correctCount} of {attempt.totalQuestions}{" "}
                                correct
                              </p>
                            </div>
                            <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-900">
                              {attempt.scorePercent}%
                            </span>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
