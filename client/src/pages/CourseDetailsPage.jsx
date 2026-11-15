import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  ListChecks,
  NotebookPen,
  Play,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BrandMark from "../components/BrandMark.jsx";
import { getApiErrorMessage, http } from "../api/http.js";
import { useAuthStore } from "../store/authStore.js";
import { formatDuration } from "../utils/formatDuration.js";

const linkStyle =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-brand hover:text-black";

function getLessons(course) {
  const videosById = new Map(
    course.videos.map((video) => [video.videoId, video]),
  );
  const structured = (course.chapters ?? []).flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({
      ...lesson,
      chapterTitle: chapter.title,
      chapterDescription: chapter.description,
      video: videosById.get(lesson.videoId),
    })),
  );
  if (structured.length) return structured;
  return course.videos.map((video) => ({
    ...video,
    chapterTitle: "Playlist lessons",
    chapterDescription: "",
    video,
  }));
}

function createPacingDays(lessons, studyPlan) {
  if (studyPlan?.sessions?.length) {
    const sessionsByDate = new Map();
    for (const session of [...studyPlan.sessions].sort((a, b) =>
      a.date.localeCompare(b.date),
    )) {
      if (session.kind !== "learning" || !session.lessonVideoIds.length) continue;
      const day = sessionsByDate.get(session.date) ?? {
        id: session.date,
        date: session.date,
        durationMinutes: 0,
        videoIds: [],
        isScheduled: true,
      };
      day.durationMinutes += session.durationMinutes;
      day.videoIds.push(...session.lessonVideoIds);
      sessionsByDate.set(session.date, day);
    }

    const byId = new Map(lessons.map((lesson) => [lesson.videoId, lesson]));
    const days = [...sessionsByDate.values()].map((day, index) => ({
      ...day,
      label: `Day ${index + 1}`,
      lessons: day.videoIds.map((id) => byId.get(id)).filter(Boolean),
    }));
    const scheduled = new Set(
      days.flatMap((day) => day.lessons.map((lesson) => lesson.videoId)),
    );
    const unplanned = lessons.filter((lesson) => !scheduled.has(lesson.videoId));
    if (unplanned.length) {
      days.push({
        id: "unplanned",
        label: `Day ${days.length + 1}`,
        durationMinutes: null,
        lessons: unplanned,
        isScheduled: false,
      });
    }
    if (days.length) return days;
  }

  const days = [];
  let day = null;
  let seconds = 0;
  for (const lesson of lessons) {
    const duration = lesson.durationSeconds;
    if (
      day &&
      Number.isFinite(duration) &&
      seconds + duration > 3600
    ) {
      days.push(day);
      day = null;
      seconds = 0;
    }
    if (!day) {
      day = {
        id: `suggested-${days.length + 1}`,
        label: `Day ${days.length + 1}`,
        durationSeconds: 0,
        hasUnknownDuration: false,
        lessons: [],
        isScheduled: false,
      };
    }
    day.lessons.push(lesson);
    if (Number.isFinite(duration)) {
      day.durationSeconds += duration;
      seconds += duration;
    } else {
      day.hasUnknownDuration = true;
      days.push(day);
      day = null;
      seconds = 0;
    }
    if (Number.isFinite(duration) && duration > 3600) {
      days.push(day);
      day = null;
      seconds = 0;
    }
  }
  if (day?.lessons.length) days.push(day);
  return days;
}

function CourseSidebar({ course }) {
  const user = useAuthStore((state) => state.user);
  const initials =
    user?.name
      ?.split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "LL";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-black bg-white px-4 py-6 lg:flex">
      <BrandMark />
      <Link
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black"
        to="/dashboard#my-courses"
      >
        <Sparkles aria-hidden="true" size={16} />
        New course
      </Link>
      <nav aria-label="Course workspace" className="mt-7 space-y-1">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Workspace
        </p>
        <Link className={linkStyle} to="/dashboard">
          <CalendarDays aria-hidden="true" size={17} />
          Today
        </Link>
        <Link className={linkStyle} to="/dashboard#my-courses">
          <BookOpen aria-hidden="true" size={17} />
          My courses
        </Link>
        <Link className={linkStyle} to="/study-planner">
          <ListChecks aria-hidden="true" size={17} />
          Roadmaps
        </Link>
        <Link className={linkStyle} to={`/courses/${course._id}/learn`}>
          <NotebookPen aria-hidden="true" size={17} />
          Notes
        </Link>
      </nav>
      <div className="mt-8 border-t border-slate-100 pt-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Recent course
        </p>
        <Link
          aria-current="page"
          className="flex items-start gap-3 rounded-xl bg-[#FFF3EE] px-3 py-3 text-sm font-semibold text-black"
          to={`/courses/${course._id}`}
        >
          <span className="mt-1 size-2 shrink-0 rounded-full bg-black" />
          <span className="line-clamp-2">{course.title}</span>
        </Link>
      </div>
      <Link
        className="mt-auto flex items-center gap-3 rounded-xl border-2 border-black p-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        to="/dashboard#account"
      >
        <span className="grid size-9 place-items-center rounded-full bg-[#FFF3EE] text-xs font-bold text-black">
          {initials}
        </span>
        {user?.name ?? "Learner profile"}
      </Link>
    </aside>
  );
}

function LessonCard({
  courseId,
  lesson,
  index,
  state,
  onOpenLesson,
}) {
  const description =
    lesson.chapterDescription || lesson.video?.description || "";
  const playerUrl = `/courses/${courseId}/learn?lesson=${encodeURIComponent(lesson.videoId)}`;

  return (
    <article
      className="group rounded-2xl border-2 border-black bg-white p-4 transition hover:border-brand sm:p-5"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ${
            state?.completed
              ? "bg-brand text-black"
              : "bg-[#FFF3EE] text-slate-500"
          }`}
        >
          {state?.completed ? (
            <Check aria-hidden="true" size={16} />
          ) : (
            String(index + 1).padStart(2, "0")
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/60">
            {lesson.chapterTitle}
          </p>
          <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-900 sm:text-base">
            {lesson.title}
          </h3>
          {description && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">
              {description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 aria-hidden="true" size={13} />
              {formatDuration(lesson.durationSeconds)}
            </span>
            {state?.completed && (
              <span className="inline-flex items-center gap-1 text-black">
                <CheckCircle2 aria-hidden="true" size={13} />
                Completed
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-black px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:bg-brand hover:text-black"
              to={playerUrl}
            >
              <NotebookPen aria-hidden="true" size={13} />
              Notes
            </Link>
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-black px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:bg-brand hover:text-black"
              to={`/courses/${courseId}/quizzes`}
            >
              <Target aria-hidden="true" size={13} />
              Quiz
            </Link>
          </div>
        </div>
        <button
          aria-label={`${state?.completed ? "Review" : "Play"} ${lesson.title}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-black px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-brand hover:text-black sm:px-4"
          onClick={() => onOpenLesson(playerUrl)}
          type="button"
        >
          <Play aria-hidden="true" size={14} fill="currentColor" />
          <span className="hidden sm:inline">
            {state?.completed ? "Review" : "Play"}
          </span>
        </button>
      </div>
    </article>
  );
}

function dayDuration(day) {
  if (day.isScheduled) {
    return day.durationMinutes === null
      ? "Pacing not set"
      : `${formatDuration(day.durationMinutes * 60)} planned`;
  }
  if (day.hasUnknownDuration) return "Some durations unavailable";
  return formatDuration(day.durationSeconds);
}

export default function CourseDetailsPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [learningStates, setLearningStates] = useState({});
  const [studyPlan, setStudyPlan] = useState(null);
  const [selectedDayId, setSelectedDayId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();

  const loadCourse = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [courseResponse, stateResponse, planResponse] = await Promise.all([
        http.get(`/api/courses/${courseId}`),
        http.get(`/api/courses/${courseId}/learning-state`),
        http.get(`/api/study-plans/courses/${courseId}`),
      ]);
      setCourse(courseResponse.data.data.course);
      setLearningStates(
        Object.fromEntries(
          stateResponse.data.data.states.map((state) => [state.videoId, state]),
        ),
      );
      setStudyPlan(planResponse.data.data.plan);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const lessons = useMemo(() => (course ? getLessons(course) : []), [course]);
  const days = useMemo(
    () => createPacingDays(lessons, studyPlan),
    [lessons, studyPlan],
  );
  const selectedDay =
    days.find((day) => day.id === selectedDayId) ??
    days.find((day) =>
      day.lessons.some((lesson) => !learningStates[lesson.videoId]?.completed),
    ) ??
    days[0] ??
    null;
  const completedLessons = lessons.filter(
    (lesson) => learningStates[lesson.videoId]?.completed,
  ).length;
  const courseProgress =
    lessons.length > 0
      ? Math.round((completedLessons / lessons.length) * 100)
      : 0;

  async function generateCourseStructure() {
    setGenerationError("");
    setNotice("");
    setIsGenerating(true);
    try {
      const response = await http.post(
        `/api/ai/courses/${courseId}/structure`,
        undefined,
        { timeout: 70000 },
      );
      setCourse(response.data.data.course);
      setNotice("Your AI chapter outline is ready.");
    } catch (requestError) {
      setGenerationError(getApiErrorMessage(requestError));
    } finally {
      setIsGenerating(false);
    }
  }

  function openLesson(url) {
    navigate(url);
  }

  return (
    <div className="min-h-screen bg-brand text-slate-900">
      {course && <CourseSidebar course={course} />}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black bg-brand/95 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <BrandMark />
            <Link
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-2 text-xs font-semibold text-white"
              to="/dashboard#my-courses"
            >
              <Sparkles aria-hidden="true" size={13} />
              New course
            </Link>
          </div>
          <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 lg:flex">
            <Link className="hover:text-black" to="/dashboard">
              My courses
            </Link>
            <span aria-hidden="true">/</span>
            <span className="max-w-64 truncate text-slate-800">
              {course?.title ?? "Course"}
            </span>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-black"
            to="/dashboard"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            Workspace
          </Link>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-9">
          {isLoading ? (
            <p
              aria-live="polite"
              className="rounded-3xl border-2 border-black bg-white px-5 py-16 text-center text-sm text-slate-500"
              role="status"
            >
              Loading your course…
            </p>
          ) : error ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
              <h1 className="text-lg font-semibold text-rose-950">
                Course could not be loaded
              </h1>
              <p className="mt-2 text-sm text-rose-800">{error}</p>
              <button
                className="mt-4 text-sm font-semibold text-rose-900 underline underline-offset-2"
                onClick={() => void loadCourse()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : course ? (
            <>
              {course.playlist.unavailableVideoCount > 0 && (
                <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {course.playlist.unavailableVideoCount} playlist item
                  {course.playlist.unavailableVideoCount === 1 ? " was" : "s were"}{" "}
                  unavailable from YouTube and were not imported.
                </p>
              )}

              <section className="overflow-hidden  border-2 border-black bg-white ">
                <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
                  <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-10">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-black/60">
                      {course.status === "structured"
                        ? "Your learning path"
                        : "Imported course"}
                    </p>
                    <h1 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                      {course.title}
                    </h1>
                    {course.description && (
                      <p className="mt-3 line-clamp-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-slate-600">
                        {course.description}
                      </p>
                    )}
                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {course.playlist.channelTitle || "YouTube course"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Play aria-hidden="true" size={12} />
                        {lessons.length}{" "}
                        {lessons.length === 1 ? "lesson" : "lessons"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 aria-hidden="true" size={13} />
                        {formatDuration(course.estimatedDurationSeconds)}
                      </span>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2.5">
                      {lessons.length > 0 && (
                        <Link
                          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black"
                          to={`/courses/${course._id}/learn?lesson=${encodeURIComponent(lessons.find((lesson) => !learningStates[lesson.videoId]?.completed)?.videoId ?? lessons[0].videoId)}`}
                        >
                          <Play aria-hidden="true" size={15} fill="currentColor" />
                          {completedLessons ? "Continue learning" : "Start learning"}
                        </Link>
                      )}
                      <Link
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand hover:bg-brand"
                        to={`/courses/${course._id}/planner`}
                      >
                        <CalendarDays aria-hidden="true" size={15} />
                        Study plan
                      </Link>
                      <a
                        className="inline-flex items-center gap-1.5 self-center px-2 py-2 text-xs font-semibold text-slate-500 transition hover:text-black"
                        href={course.playlist.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Source playlist <ExternalLink aria-hidden="true" size={12} />
                      </a>
                    </div>
                  </div>
                  <div className="relative min-h-52 bg-[#FFF3EE] md:min-h-full">
                    <div className="absolute inset-0 grid place-items-center text-black/60">
                      <BookOpen aria-hidden="true" size={42} strokeWidth={1.2} />
                    </div>
                    {course.playlist.thumbnailUrl ? (
                      <img
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                        onLoad={(event) => {
                          if (event.currentTarget.naturalWidth < 320) {
                            event.currentTarget.hidden = true;
                          }
                        }}
                        referrerPolicy="no-referrer"
                        src={course.playlist.thumbnailUrl}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
                    <div className="absolute inset-x-4 bottom-4 text-white sm:inset-x-6 sm:bottom-6">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium text-white/80">
                            Course progress
                          </p>
                          <p className="mt-1 text-2xl font-semibold">
                            {courseProgress}%
                          </p>
                        </div>
                        <span className="text-right text-xs text-white/90">
                          {completedLessons} of {lessons.length} lessons
                        </span>
                      </div>
                      <div
                        aria-label={`${courseProgress}% of course completed`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={courseProgress}
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/35"
                        role="progressbar"
                      >
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{ width: `${courseProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-5 flex flex-col gap-5 rounded-3xl border-2 border-black bg-[#FFF3EE] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-black ">
                    <Target aria-hidden="true" size={20} />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-black">
                      Already know some of this?
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-black/70">
                      Take an AI-generated placement test to identify topics you
                      can skip and lessons worth revisiting.
                    </p>
                  </div>
                </div>
                {course.status === "structured" ? (
                  <Link
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black"
                    to={`/courses/${course._id}/quizzes?mode=placement`}
                  >
                    Take the placement test
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                ) : (
                  <button
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-wait disabled:opacity-70"
                    disabled={isGenerating}
                    onClick={() => void generateCourseStructure()}
                    type="button"
                  >
                    <Sparkles aria-hidden="true" size={15} />
                    {isGenerating ? "Building course outline…" : "Build course outline"}
                  </button>
                )}
              </section>

              <section className="mt-8" aria-labelledby="learning-plan-heading">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/60">
                      {studyPlan ? "Personalized schedule" : "Suggested pacing"}
                    </p>
                    <h2
                      className="mt-1.5 text-xl font-semibold tracking-tight"
                      id="learning-plan-heading"
                    >
                      Your learning plan
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {studyPlan
                        ? "Lessons from your saved study plan, grouped by date."
                        : "A gentle one-hour daily guide based on available video durations."}
                    </p>
                  </div>
                  <Link
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-black hover:text-black"
                    to={`/courses/${course._id}/planner`}
                  >
                    {studyPlan ? "Edit study plan" : "Personalize this plan"}
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>

                {days.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-black bg-white px-5 py-10 text-center">
                    <BookOpen
                      aria-hidden="true"
                      className="mx-auto text-black/40"
                      size={24}
                    />
                    <h3 className="mt-3 text-sm font-semibold">
                      Your lessons will appear here
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      This course does not have any available videos yet.
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      aria-label="Learning days"
                      className="mt-5 flex gap-2 overflow-x-auto pb-2"
                      role="tablist"
                    >
                      {days.map((day) => {
                        const done = day.lessons.filter(
                          (lesson) => learningStates[lesson.videoId]?.completed,
                        ).length;
                        const active = selectedDay?.id === day.id;
                        return (
                          <button
                            aria-selected={active}
                            className={`min-w-28 shrink-0 rounded-xl border px-3.5 py-3 text-left transition ${
                              active
                                ? "border-black bg-black text-white "
                                : "border-black bg-white text-slate-600 hover:border-brand"
                            }`}
                            id={`tab-${day.id}`}
                            key={day.id}
                            onClick={() => setSelectedDayId(day.id)}
                            role="tab"
                            type="button"
                          >
                            <span className="block text-xs font-semibold">
                              {day.label}
                            </span>
                            <span
                              className={`mt-1 block text-[10px] ${
                                active ? "text-white/75" : "text-slate-400"
                              }`}
                            >
                              {done}/{day.lessons.length} complete
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedDay && (
                      <section
                        aria-labelledby={`tab-${selectedDay.id}`}
                        className="mt-2 rounded-3xl border-2 border-black bg-[#FFF3EE] p-4 sm:p-5"
                        role="tabpanel"
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-800">
                              {selectedDay.label}
                              {selectedDay.date
                                ? ` · ${new Intl.DateTimeFormat(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  }).format(new Date(`${selectedDay.date}T00:00:00`))}`
                                : ""}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {selectedDay.lessons.length}{" "}
                              {selectedDay.lessons.length === 1 ? "lesson" : "lessons"}{" "}
                              · {dayDuration(selectedDay)}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black">
                            {selectedDay.lessons.length > 0 &&
                            selectedDay.lessons.every(
                              (lesson) => learningStates[lesson.videoId]?.completed,
                            ) ? (
                              <>
                                <CheckCircle2 aria-hidden="true" size={13} />
                                Day complete
                              </>
                            ) : selectedDay.lessons.some(
                                (lesson) => learningStates[lesson.videoId]?.completed,
                              ) ? (
                              <>
                                <Circle aria-hidden="true" size={12} />
                                In progress
                              </>
                            ) : (
                              <>
                                <Clock3 aria-hidden="true" size={12} />
                                Up next
                              </>
                            )}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {selectedDay.lessons.map((lesson) => (
                            <LessonCard
                              courseId={course._id}
                              index={lessons.findIndex(
                                (item) => item.videoId === lesson.videoId,
                              )}
                              key={lesson.videoId}
                              lesson={lesson}
                              onOpenLesson={openLesson}
                              state={learningStates[lesson.videoId]}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </section>

              <section className="mt-8 rounded-3xl border-2 border-black bg-white p-5 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FFF3EE] text-black">
                      <Sparkles aria-hidden="true" size={18} />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">
                        {course.status === "structured"
                          ? "AI course outline"
                          : "Shape this playlist into a course"}
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                        The current outline groups playlist videos using their
                        titles and metadata. Add transcripts in course setup for
                        lesson context; transcript-timestamp segmentation is a
                        later stage.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <button
                      className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-wait disabled:opacity-70"
                      disabled={isGenerating || course.videos.length === 0}
                      onClick={() => void generateCourseStructure()}
                      type="button"
                    >
                      <Sparkles aria-hidden="true" size={14} />
                      {isGenerating
                        ? "Generating…"
                        : course.status === "structured"
                          ? "Regenerate outline"
                          : "Generate outline"}
                    </button>
                    <Link
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-black px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-brand"
                      to={`/courses/${course._id}/setup`}
                    >
                      <Settings2 aria-hidden="true" size={14} />
                      Transcripts & setup
                    </Link>
                  </div>
                </div>

                {(generationError || notice) && (
                  <p
                    aria-live="polite"
                    className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                      generationError
                        ? "border border-rose-200 bg-rose-50 text-rose-800"
                        : "border-2 border-black bg-[#FFF3EE] text-black"
                    }`}
                    role={generationError ? "alert" : "status"}
                  >
                    {generationError || notice}
                  </p>
                )}

                {course.status === "structured" && (
                  <>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {course.difficulty && (
                        <span className="rounded-full bg-[#FFF3EE] px-3 py-1.5 text-[11px] font-semibold capitalize text-black">
                          {course.difficulty}
                        </span>
                      )}
                      {course.estimatedDurationMinutes && (
                        <span className="rounded-full bg-[#FFF3EE] px-3 py-1.5 text-[11px] font-medium text-slate-600">
                          About {formatDuration(course.estimatedDurationMinutes * 60)}
                        </span>
                      )}
                      <span className="rounded-full bg-[#FFF3EE] px-3 py-1.5 text-[11px] font-medium text-slate-600">
                        {course.chapters.length}{" "}
                        {course.chapters.length === 1 ? "chapter" : "chapters"}
                      </span>
                    </div>
                    {course.learningObjectives?.length > 0 && (
                      <div className="mt-5 border-t border-slate-100 pt-5">
                        <h3 className="text-xs font-semibold text-slate-800">
                          Learning objectives
                        </h3>
                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                          {course.learningObjectives.map((objective) => (
                            <li
                              className="flex items-start gap-2 text-xs leading-5 text-slate-600"
                              key={objective}
                            >
                              <Check
                                aria-hidden="true"
                                className="mt-0.5 shrink-0 text-black"
                                size={14}
                              />
                              {objective}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          ) : (
            <div className="rounded-3xl border-2 border-black bg-white p-8 text-center">
              <h1 className="text-lg font-semibold">Course not found</h1>
              <p className="mt-2 text-sm text-slate-500">
                It may have been removed or belong to another account.
              </p>
              <Link
                className="mt-4 inline-flex text-sm font-semibold text-black"
                to="/dashboard"
              >
                Back to workspace
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
