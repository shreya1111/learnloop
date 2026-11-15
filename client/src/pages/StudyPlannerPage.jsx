import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Sparkles,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import StudyPlanForm from "../components/planner/StudyPlanForm.jsx";
import StudySessionCard from "../components/planner/StudySessionCard.jsx";
import BrandMark from "../components/BrandMark.jsx";
import { getApiErrorMessage, http } from "../api/http.js";
import { formatDuration } from "../utils/formatDuration.js";

function formatPlanDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function CourseChoice({ course }) {
  const isStructured = course.status === "structured";
  return (
    <article className="flex flex-col gap-4 rounded-2xl border-2 border-black bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">
          {course.playlist.channelTitle}
        </p>
        <h2 className="mt-1 truncate text-base font-semibold text-slate-900">
          {course.title}
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          {course.playlist.videoCount} videos ·{" "}
          {formatDuration(course.estimatedDurationSeconds)}
        </p>
      </div>
      <Link
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand hover:text-black"
        to={
          isStructured
            ? `/courses/${course._id}/planner`
            : `/courses/${course._id}`
        }
      >
        {isStructured ? "Plan this course" : "Prepare course"}
        <ArrowRight aria-hidden="true" size={15} />
      </Link>
    </article>
  );
}

export default function StudyPlannerPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingSessionId, setSavingSessionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPlanner = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      if (!courseId) {
        const response = await http.get("/api/courses");
        setCourses(response.data.data.courses);
        setCourse(null);
        setPlan(null);
        return;
      }

      const [courseResponse, planResponse] = await Promise.all([
        http.get(`/api/courses/${courseId}`),
        http.get(`/api/study-plans/courses/${courseId}`),
      ]);
      setCourse(courseResponse.data.data.course);
      setPlan(planResponse.data.data.plan);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadPlanner();
  }, [loadPlanner]);

  async function generatePlan(preferences) {
    setError("");
    setMessage("");
    setIsGenerating(true);
    try {
      const response = await http.post(
        `/api/study-plans/courses/${courseId}`,
        preferences,
        { timeout: 70000 },
      );
      setPlan(response.data.data.plan);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsGenerating(false);
    }
  }

  async function updateSession(sessionId, fields) {
    setError("");
    setMessage("");
    setSavingSessionId(sessionId);
    try {
      const response = await http.patch(
        `/api/study-plans/${plan._id}/sessions/${sessionId}`,
        fields,
      );
      setPlan(response.data.data.plan);
      setMessage("Study session updated.");
      return true;
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      return false;
    } finally {
      setSavingSessionId("");
    }
  }

  const sortedSessions = useMemo(
    () =>
      [...(plan?.sessions ?? [])].sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
    [plan],
  );
  const plannedMinutes = sortedSessions.reduce(
    (total, session) => total + session.durationMinutes,
    0,
  );

  return (
    <main className="min-h-screen bg-brand px-5 py-6 text-slate-900 sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <BrandMark />
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          to={course ? `/courses/${course._id}` : "/dashboard"}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          {course ? "Course details" : "Workspace"}
        </Link>
      </header>

      <section className="mx-auto max-w-5xl py-9 sm:py-12">
        {isLoading ? (
          <p
            aria-live="polite"
            className="py-16 text-center text-sm text-slate-500"
            role="status"
          >
            Loading study planner…
          </p>
        ) : error && !courseId ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-lg font-semibold text-rose-950">
              Your courses could not be loaded
            </h1>
            <p className="mt-2 text-sm text-rose-800">{error}</p>
            <button
              className="mt-4 text-sm font-semibold text-rose-900 underline underline-offset-2"
              onClick={() => loadPlanner()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : !courseId ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
              AI study planner
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Choose a course to plan
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Create a weekly schedule around your study goal and available
              time. Courses need an AI-generated outline before planning.
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
            {courses.length === 0 ? (
              <div className="mt-8 rounded-3xl border-2 border-black bg-white p-8 text-center">
                <h2 className="text-lg font-semibold">No courses yet</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Import a playlist to start building your learning plan.
                </p>
                <Link
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                  to="/dashboard#my-courses"
                >
                  Import a playlist <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            ) : (
              <div className="mt-7 space-y-3">
                {courses.map((item) => (
                  <CourseChoice course={item} key={item._id} />
                ))}
              </div>
            )}
          </>
        ) : error && !course ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-lg font-semibold text-rose-950">
              Study planner could not be loaded
            </h1>
            <p className="mt-2 text-sm text-rose-800">{error}</p>
            <button
              className="mt-4 text-sm font-semibold text-rose-900 underline underline-offset-2"
              onClick={() => loadPlanner()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : course ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
              AI study planner
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {plan ? plan.title : `Plan: ${course.title}`}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {plan
                ? plan.goal
                : "Set a learning goal and a schedule that fits your week. Your plan will cover the course lessons and include revision."}
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

            {course.status !== "structured" ? (
              <div className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="font-semibold text-amber-950">
                  Create the course outline first
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  The planner needs an AI-generated lesson structure and time
                  estimate to build a realistic schedule.
                </p>
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-950 underline underline-offset-2"
                  to={`/courses/${course._id}`}
                >
                  Open course details <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            ) : plan ? (
              <>
                <section className="mt-7 rounded-3xl border-2 border-black bg-white p-5  sm:p-7">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-800">
                      <Sparkles aria-hidden="true" size={18} />
                    </span>
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Your learning goal
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {plan.summary}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                      <CalendarDays aria-hidden="true" size={13} />
                      Starts {formatPlanDate(plan.startDate)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                      {plan.weeks} {plan.weeks === 1 ? "week" : "weeks"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                      <Clock3 aria-hidden="true" size={13} />
                      {formatDuration(plannedMinutes * 60)} planned
                    </span>
                  </div>
                </section>

                <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Your schedule</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Change dates, session time, and focus whenever your week
                      shifts.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {sortedSessions.length}{" "}
                    {sortedSessions.length === 1 ? "session" : "sessions"}
                  </span>
                </div>

                {message && (
                  <p
                    aria-live="polite"
                    className="mb-4 text-sm text-emerald-700"
                    role="status"
                  >
                    {message}
                  </p>
                )}
                <div className="space-y-4">
                  {sortedSessions.map((session) => (
                    <StudySessionCard
                      course={course}
                      courseId={course._id}
                      isSaving={savingSessionId === session._id}
                      key={session._id}
                      onUpdate={updateSession}
                      session={session}
                    />
                  ))}
                </div>
              </>
            ) : (
              <StudyPlanForm
                isGenerating={isGenerating}
                onGenerate={generatePlan}
              />
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
