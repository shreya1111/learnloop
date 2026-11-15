import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Library,
  ListChecks,
  NotebookPen,
  Plus,
  Play,
  Save,
  MessageCircle,
  Sparkles,
  Target,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage, http } from "../api/http.js";
import BrandMark from "../components/BrandMark.jsx";
import { formatDuration } from "../utils/formatDuration.js";

const curriculumLinkClass =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-brand hover:text-black";

function getCourseLessons(course) {
  const videosById = new Map(
    course.videos.map((video) => [video.videoId, video]),
  );
  const structuredLessons = (course.chapters ?? []).flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({
      ...lesson,
      chapterTitle: chapter.title,
      chapterDescription: chapter.description,
      video: videosById.get(lesson.videoId),
    })),
  );
  if (structuredLessons.length > 0) {
    return structuredLessons;
  }
  return course.videos.map((video) => ({
    ...video,
    chapterTitle: "Playlist lessons",
    chapterDescription: "",
    video,
  }));
}

function buildSuggestedDays(lessons, studyPlan) {
  if (studyPlan?.sessions?.length) {
    const scheduledDays = new Map();
    for (const session of [...studyPlan.sessions].sort((left, right) =>
      left.date.localeCompare(right.date),
    )) {
      if (session.kind !== "learning" || !session.lessonVideoIds.length) {
        continue;
      }
      const day = scheduledDays.get(session.date) ?? {
        id: session.date,
        label: `Day ${scheduledDays.size + 1}`,
        date: session.date,
        durationMinutes: 0,
        lessons: [],
        isScheduled: true,
      };
      day.durationMinutes += session.durationMinutes;
      day.lessons.push(...session.lessonVideoIds);
      scheduledDays.set(session.date, day);
    }

    const lessonsById = new Map(lessons.map((lesson) => [lesson.videoId, lesson]));
    const days = [...scheduledDays.values()].map((day) => ({
      ...day,
      lessons: day.lessons
        .map((videoId) => lessonsById.get(videoId))
        .filter(Boolean),
    }));
    const scheduledIds = new Set(
      days.flatMap((day) => day.lessons.map((lesson) => lesson.videoId)),
    );
    const remaining = lessons.filter(
      (lesson) => !scheduledIds.has(lesson.videoId),
    );
    if (remaining.length > 0) {
      days.push({
        id: "not-scheduled",
        label: `Day ${days.length + 1}`,
        durationMinutes: null,
        lessons: remaining,
        isScheduled: false,
      });
    }
    if (days.length > 0) {
      return days;
    }
  }

  const days = [];
  let day = null;
  let daySeconds = 0;
  for (const lesson of lessons) {
    const duration = lesson.durationSeconds;
    if (
      day &&
      duration !== null &&
      duration !== undefined &&
      daySeconds + duration > 3600
    ) {
      days.push(day);
      day = null;
      daySeconds = 0;
    }
    if (!day) {
      day = {
        id: `suggested-${days.length + 1}`,
        label: `Day ${days.length + 1}`,
        durationSeconds: 0,
        durationKnown: true,
        lessons: [],
        isScheduled: false,
      };
    }
    day.lessons.push(lesson);
    if (duration === null || duration === undefined) {
      day.durationKnown = false;
    } else {
      day.durationSeconds += duration;
      daySeconds += duration;
    }
    if (duration === null || duration === undefined || duration > 3600) {
      days.push(day);
      day = null;
      daySeconds = 0;
    }
  }
  if (day?.lessons.length) {
    days.push(day);
  }
  return days;
}

function CourseNavigation({ course }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-black bg-white px-4 py-6 lg:flex">
      <BrandMark />
      <Link
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black"
        to="/dashboard#my-courses"
      >
        <Plus aria-hidden="true" size={17} />
        New course
      </Link>
      <nav aria-label="Course workspace" className="mt-7 space-y-1">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Workspace
        </p>
        <Link className={curriculumLinkClass} to="/dashboard">
          <LayoutDashboard aria-hidden="true" size={17} />
          Today
        </Link>
        <Link className={curriculumLinkClass} to="/dashboard#my-courses">
          <Library aria-hidden="true" size={17} />
          My courses
        </Link>
        <Link className={curriculumLinkClass} to="/study-planner">
          <CalendarDays aria-hidden="true" size={17} />
          Roadmaps
        </Link>
        <Link
          className={curriculumLinkClass}
          to={`/courses/${course._id}/learn`}
        >
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
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-black" />
          <span className="line-clamp-2">{course.title}</span>
        </Link>
      </div>
      <Link
        className="mt-auto flex items-center gap-3 rounded-xl border-2 border-black p-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        to="/dashboard#account"
      >
        <span className="grid size-9 place-items-center rounded-full bg-[#FFF3EE] text-xs font-bold text-black">
          LL
        </span>
        Learner profile
      </Link>
    </aside>
  );
}

function VideoTranscript({ courseId, video }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [text, setText] = useState(video.transcript?.text ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function toggleTranscript() {
    const shouldOpen = !isOpen;
    setIsOpen(shouldOpen);
    if (!shouldOpen || isLoaded) {
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const response = await http.get(
        `/api/courses/${courseId}/videos/${video.videoId}/transcript`,
      );
      const transcript = response.data.data;
      if (transcript.available) {
        setText(transcript.text);
        setSaved(transcript.source === "user");
      } else {
        setNotice(transcript.message);
      }
      setIsLoaded(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function saveTranscript(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSaving(true);
    try {
      const response = await http.put(
        `/api/courses/${courseId}/videos/${video.videoId}/transcript`,
        { text },
      );
      setText(response.data.data.text);
      setSaved(true);
      setNotice("Transcript saved to this course.");
      setIsLoaded(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="border-t border-slate-100">
      <button
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 py-3 text-xs font-semibold text-cyan-800 hover:text-black"
        onClick={toggleTranscript}
        type="button"
      >
        <FileText aria-hidden="true" size={15} />
        {saved ? "Edit transcript" : "Transcript & captions"}
      </button>
      {isOpen && (
        <div className="pb-4">
          {isLoading ? (
            <p aria-live="polite" className="text-xs text-slate-500" role="status">
              Checking transcript availability…
            </p>
          ) : (
            <form onSubmit={saveTranscript}>
              {notice && (
                <p aria-live="polite" className="mb-3 text-xs leading-5 text-slate-500">
                  {notice}
                </p>
              )}
              <label className="block text-xs font-medium text-slate-700">
                Transcript text
                <textarea
                  className="mt-2 min-h-32 w-full resize-y rounded-xl border-2 border-black bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
                  maxLength={250000}
                  onChange={(event) => {
                    setText(event.target.value);
                    setSaved(false);
                    setNotice("");
                  }}
                  placeholder="Paste a transcript you have permission to use…"
                  required
                  value={text}
                />
              </label>
              {error && (
                <p aria-live="polite" className="mt-2 text-xs text-rose-700" role="alert">
                  {error}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">
                  {text.length.toLocaleString()} / 250,000 characters
                </p>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand hover:text-black disabled:opacity-60"
                  disabled={isSaving || !text.trim()}
                  type="submit"
                >
                  {saved ? (
                    <Check aria-hidden="true" size={14} />
                  ) : (
                    <Save aria-hidden="true" size={14} />
                  )}
                  {isSaving ? "Saving…" : saved ? "Saved" : "Save transcript"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function VideoRow({ courseId, video }) {
  return (
    <article className="rounded-2xl border-2 border-black bg-white px-4 sm:px-5">
      <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-500">
          {String(video.position + 1).padStart(2, "0")}
        </span>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {video.thumbnailUrl ? (
            <img
              alt=""
              className="aspect-video w-24 shrink-0 rounded-lg bg-slate-100 object-cover sm:w-32"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
              referrerPolicy="no-referrer"
              src={video.thumbnailUrl}
            />
          ) : (
            <span className="grid aspect-video w-24 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400 sm:w-32">
              <Play aria-hidden="true" size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
              {video.title}
            </h3>
            {video.channelTitle && (
              <p className="mt-1 truncate text-xs text-slate-500">
                {video.channelTitle}
              </p>
            )}
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Clock3 aria-hidden="true" size={12} />
              {formatDuration(video.durationSeconds)}
            </p>
          </div>
        </div>
        <a
          aria-label={`Open ${video.title} on YouTube`}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-cyan-800 sm:ml-auto"
          href={video.videoUrl}
          rel="noreferrer"
          target="_blank"
        >
          Watch video <ExternalLink aria-hidden="true" size={13} />
        </a>
      </div>
      <VideoTranscript courseId={courseId} video={video} />
    </article>
  );
}

export default function CourseSetupPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [error, setError] = useState("");

  const loadCourse = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await http.get(`/api/courses/${courseId}`);
      setCourse(response.data.data.course);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  async function generateCourseStructure() {
    setGenerationError("");
    setIsGenerating(true);
    try {
      const response = await http.post(
        `/api/ai/courses/${courseId}/structure`,
        undefined,
        { timeout: 70000 },
      );
      setCourse(response.data.data.course);
    } catch (requestError) {
      setGenerationError(getApiErrorMessage(requestError));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand px-5 py-6 text-slate-900 sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <BrandMark />
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          to={`/courses/${courseId}`}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Course curriculum
        </Link>
      </header>

      <section className="mx-auto max-w-5xl py-10 sm:py-14">
        {isLoading ? (
          <p aria-live="polite" className="py-16 text-center text-sm text-slate-500" role="status">
            Loading course…
          </p>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-lg font-semibold text-rose-950">
              Course could not be loaded
            </h1>
            <p className="mt-2 text-sm text-rose-800">{error}</p>
            <button
              className="mt-4 text-sm font-semibold text-rose-900 underline underline-offset-2"
              onClick={() => loadCourse()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : course ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-cyan-800">
              {course.status === "structured" ? "AI-structured course" : "Imported playlist"}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {course.title}
            </h1>
            {course.description && (
              <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate-600">
                {course.description}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span>{course.playlist.channelTitle}</span>
              <span>
                {course.playlist.videoCount}{" "}
                {course.playlist.videoCount === 1 ? "video" : "videos"}
              </span>
              <span>{formatDuration(course.estimatedDurationSeconds)}</span>
              <a
                className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-cyan-800"
                href={course.playlist.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Source playlist <ExternalLink aria-hidden="true" size={12} />
              </a>
            </div>
            {course.videos.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                  to={`/courses/${course._id}/learn`}
                >
                  Start learning <ArrowRight aria-hidden="true" size={16} />
                </Link>
                {course.status === "structured" && (
                  <>
                    <Link
                      className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-cyan-900"
                      to={`/courses/${course._id}/planner`}
                    >
                      Study planner <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                    <Link
                      className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-cyan-900"
                      to={`/courses/${course._id}/quizzes`}
                    >
                      <Brain aria-hidden="true" size={16} />
                      Quizzes & placement
                    </Link>
                    <Link
                      className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-cyan-900"
                      to={`/ai-tutor?courseId=${course._id}`}
                    >
                      <MessageCircle aria-hidden="true" size={16} />
                      Ask the tutor
                    </Link>
                  </>
                )}
              </div>
            )}

            {course.playlist.unavailableVideoCount > 0 && (
              <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {course.playlist.unavailableVideoCount} playlist item
                {course.playlist.unavailableVideoCount === 1 ? " was" : "s were"}{" "}
                unavailable from YouTube and were not imported.
              </p>
            )}

            <section
              aria-labelledby="course-outline-heading"
              className="mt-8 rounded-3xl border-2 border-black bg-white p-5  sm:p-7"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2
                    className="text-lg font-semibold"
                    id="course-outline-heading"
                  >
                    Course outline
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Organize every playlist video into chapters and lessons with
                    learning objectives and a difficulty estimate.
                  </p>
                </div>
                <button
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isGenerating || course.videos.length === 0}
                  onClick={generateCourseStructure}
                  type="button"
                >
                  <Sparkles aria-hidden="true" size={16} />
                  {isGenerating
                    ? "Generating outline…"
                    : course.status === "structured"
                      ? "Regenerate outline"
                      : "Generate outline"}
                </button>
              </div>

              {generationError && (
                <p
                  aria-live="polite"
                  className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                  role="alert"
                >
                  {generationError}
                </p>
              )}

              {course.status === "structured" ? (
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-cyan-50 px-3 py-1.5 font-semibold capitalize text-cyan-900">
                      {course.difficulty}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                      About {course.estimatedDurationMinutes} minutes
                    </span>
                  </div>
                  <h3 className="mt-5 text-sm font-semibold text-slate-900">
                    Learning objectives
                  </h3>
                  <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-600 sm:grid-cols-2">
                    {course.learningObjectives.map((objective) => (
                      <li className="flex gap-2" key={objective}>
                        <Check
                          aria-hidden="true"
                          className="mt-1 shrink-0 text-cyan-700"
                          size={15}
                        />
                        {objective}
                      </li>
                    ))}
                  </ul>
                  {course.prerequisites.length > 0 && (
                    <p className="mt-4 text-xs leading-5 text-slate-500">
                      <span className="font-semibold text-slate-700">
                        Suggested prerequisites:{" "}
                      </span>
                      {course.prerequisites.join(", ")}
                    </p>
                  )}
                  <div className="mt-6 space-y-3">
                    {course.chapters.map((chapter, index) => (
                      <details
                        className="rounded-2xl border-2 border-black bg-slate-50"
                        key={`${chapter.position}-${chapter.title}`}
                        open={index === 0}
                      >
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4">
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">
                              {index + 1}. {chapter.title}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              {chapter.description}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {chapter.lessons.length}{" "}
                            {chapter.lessons.length === 1 ? "lesson" : "lessons"}
                          </span>
                        </summary>
                        <ol className="space-y-1 px-4 pb-3">
                          {chapter.lessons.map((lesson) => (
                            <li key={lesson.videoId}>
                              <a
                                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-700 hover:bg-white hover:text-cyan-900"
                                href={lesson.videoUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <Play
                                  aria-hidden="true"
                                  className="shrink-0 text-cyan-700"
                                  size={13}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {lesson.title}
                                </span>
                                {lesson.durationSeconds !== null && (
                                  <span className="shrink-0 text-slate-400">
                                    {formatDuration(lesson.durationSeconds)}
                                  </span>
                                )}
                              </a>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  {isGenerating
                    ? "The outline will appear here when the AI response has been validated."
                    : "Generation uses the video titles and durations in this playlist. You can regenerate the outline later."}
                </p>
              )}
            </section>

            <div className="mt-9">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Videos in this course</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Add transcripts you have permission to use for future course
                    context.
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {course.videos.length}{" "}
                  {course.videos.length === 1 ? "lesson" : "lessons"}
                </span>
              </div>
              <div className="space-y-3">
                {course.videos.map((video) => (
                  <VideoRow
                    courseId={course._id}
                    key={`${video.videoId}-${video.position}`}
                    video={video}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border-2 border-black bg-white p-8 text-center">
            <h1 className="text-lg font-semibold">Course not found</h1>
            <p className="mt-2 text-sm text-slate-500">
              It may have been removed or belong to another account.
            </p>
            <Link
              className="mt-4 inline-flex text-sm font-semibold text-cyan-800"
              to="/dashboard"
            >
              Back to workspace
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
