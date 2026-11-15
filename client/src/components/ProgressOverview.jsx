import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Brain,
  BookOpenCheck,
  ChartNoAxesCombined,
  Clock3,
  Flame,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getApiErrorMessage, http } from "../api/http.js";
import { formatDuration } from "../utils/formatDuration.js";

function formatActivity(activity) {
  if (activity.type === "lesson-completed") return "Completed a lesson";
  if (activity.type === "quiz-attempt") {
    return `Finished a quiz · ${activity.scorePercent}%`;
  }
  return `Studied for ${formatDuration(activity.durationMinutes * 60)}`;
}

export default function ProgressOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadProgress = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const response = await http.get("/api/progress");
      setData(response.data.data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  if (isLoading) {
    return (
      <p className="mt-7 rounded-2xl bg-slate-50 px-5 py-8 text-center text-sm text-slate-500" role="status">
        Loading your learning progress…
      </p>
    );
  }

  if (error) {
    return (
      <div className="mt-7 rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="text-sm text-rose-800">{error}</p>
        <button
          className="mt-3 text-sm font-semibold text-rose-900 underline"
          onClick={() => loadProgress()}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  const { summary, courses, weeklyStudy, recentActivity } = data;
  const hasProgress =
    summary.completedLessons > 0 ||
    summary.studyMinutesThisWeek > 0 ||
    recentActivity.length > 0;
  const maxMinutes = Math.max(30, ...weeklyStudy.map((day) => day.minutes));

  return (
    <div className="mt-6 space-y-5">
      {!hasProgress ? (
        <div className="rounded-2xl bg-slate-50 px-5 py-7 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-white text-slate-500 ">
            <ChartNoAxesCombined aria-hidden="true" size={20} />
          </span>
          <h3 className="mt-3 text-sm font-semibold">
            Your learning progress starts here
          </h3>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-500">
            Complete lessons, take a quiz, or use the study timer to see your
            weekly learning activity.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={BookOpenCheck}
              label="Lessons"
              value={`${summary.completedLessons}/${summary.totalLessons}`}
            />
            <MetricCard
              icon={Flame}
              label="Day streak"
              value={summary.currentStreakDays}
            />
            <MetricCard
              icon={Clock3}
              label="Study this week"
              value={formatDuration(summary.studyMinutesThisWeek * 60)}
            />
            <MetricCard
              icon={Brain}
              label="Quiz average"
              value={
                summary.averageQuizScore === null
                  ? "—"
                  : `${summary.averageQuizScore}%`
              }
            />
          </div>

          <section aria-label="Weekly study time" className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Study time this week</h3>
              <span className="text-xs text-slate-500">
                {formatDuration(summary.studyMinutesThisWeek * 60)}
              </span>
            </div>
            <div className="mt-4 flex h-24 items-end justify-between gap-2">
              {weeklyStudy.map((day) => (
                <div
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  key={day.date}
                  title={`${day.day}: ${day.minutes} minutes`}
                >
                  <div
                    className="w-full max-w-7 rounded-t-md bg-cyan-500 transition-all"
                    style={{
                      height: `${Math.max(4, (day.minutes / maxMinutes) * 100)}%`,
                    }}
                  />
                  <span className="text-[10px] text-slate-500">{day.day}</span>
                </div>
              ))}
            </div>
          </section>

          {courses.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Course progress</h3>
                <span className="text-right text-[11px] text-slate-500">
                  {summary.totalCourses} total · {summary.activeCourses} active
                  · {summary.completedCourses} complete
                </span>
              </div>
              <div className="space-y-3">
                {courses.slice(0, 4).map((course) => (
                  <Link
                    className="block rounded-xl border-2 border-black p-3 transition hover:border-cyan-200"
                    key={course.courseId}
                    to={`/courses/${course.courseId}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="line-clamp-1 text-xs font-semibold text-slate-800">
                        {course.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {course.progressPercent}%
                      </span>
                    </div>
                    <div
                      aria-label={`${course.progressPercent}% complete`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={course.progressPercent}
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                    >
                      <div
                        className="h-full rounded-full bg-cyan-600"
                        style={{ width: `${course.progressPercent}%` }}
                      />
                    </div>
                    <span className="sr-only">
                      {course.completedLessons} of {course.lessonCount} lessons
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {recentActivity.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Recent activity</h3>
              <div className="divide-y divide-slate-100 rounded-2xl border-2 border-black px-3">
                {recentActivity.slice(0, 5).map((activity, index) => (
                  <Link
                    className="flex items-start justify-between gap-2 py-3"
                    key={`${activity.type}-${activity.courseId}-${activity.occurredAt}-${index}`}
                    to={
                      activity.type === "quiz-attempt"
                        ? `/courses/${activity.courseId}/quizzes`
                        : activity.type === "lesson-completed" && activity.videoId
                          ? `/courses/${activity.courseId}/learn?lesson=${encodeURIComponent(activity.videoId)}`
                          : `/courses/${activity.courseId}`
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-slate-800">
                        {formatActivity(activity)}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-slate-500">
                        {activity.courseTitle}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-slate-400"
                      size={13}
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl bg-slate-50 p-3">
      <span className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
        <Icon aria-hidden="true" size={14} />
        {label}
      </span>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </article>
  );
}
