import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CourseContentsSidebar from "../components/player/CourseContentsSidebar.jsx";
import LessonWorkspace from "../components/player/LessonWorkspace.jsx";
import StudyTimer from "../components/player/StudyTimer.jsx";
import BrandMark from "../components/BrandMark.jsx";
import { getApiErrorMessage, http } from "../api/http.js";

function getCourseChapters(course) {
  if (course.chapters?.length > 0) {
    return course.chapters;
  }
  return [
    {
      title: "Playlist videos",
      description: "Lessons in the original playlist order.",
      position: 0,
      lessons: course.videos.map((video) => ({
        videoId: video.videoId,
        title: video.title,
        videoUrl: video.videoUrl,
        position: video.position,
        durationSeconds: video.durationSeconds,
      })),
    },
  ];
}

function stateByVideoId(states) {
  return Object.fromEntries(states.map((state) => [state.videoId, state]));
}

export default function CoursePlayer() {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState(null);
  const [learningStates, setLearningStates] = useState({});
  const [activeVideoId, setActiveVideoId] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const loadPlayer = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [courseResponse, stateResponse] = await Promise.all([
        http.get(`/api/courses/${courseId}`),
        http.get(`/api/courses/${courseId}/learning-state`),
      ]);
      const nextCourse = courseResponse.data.data.course;
      const nextStates = stateByVideoId(stateResponse.data.data.states);
      const availableLessons = getCourseChapters(nextCourse).flatMap(
        (chapter) => chapter.lessons,
      );
      const requestedLesson = availableLessons.find(
        (lesson) => lesson.videoId === searchParams.get("lesson"),
      );
      const firstLesson = availableLessons.find(
        (lesson) => !nextStates[lesson.videoId]?.completed,
      );
      setCourse(nextCourse);
      setLearningStates(nextStates);
      setActiveVideoId(
        requestedLesson?.videoId ??
          firstLesson?.videoId ??
          nextCourse.chapters?.[0]?.lessons?.[0]?.videoId ??
          nextCourse.videos?.[0]?.videoId ??
          "",
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [courseId, searchParams]);

  useEffect(() => {
    void loadPlayer();
  }, [loadPlayer]);

  const chapters = useMemo(
    () => (course ? getCourseChapters(course) : []),
    [course],
  );
  const lessons = useMemo(
    () => chapters.flatMap((chapter) => chapter.lessons),
    [chapters],
  );
  const activeIndex = lessons.findIndex(
    (lesson) => lesson.videoId === activeVideoId,
  );
  const activeLesson = activeIndex >= 0 ? lessons[activeIndex] : null;
  const activeState = activeLesson
    ? learningStates[activeLesson.videoId] ?? {}
    : {};
  const activeChapter = chapters.find((chapter) =>
    chapter.lessons.some((lesson) => lesson.videoId === activeVideoId),
  );
  const completedCount = lessons.filter(
    (lesson) => learningStates[lesson.videoId]?.completed,
  ).length;
  const progressPercent =
    lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const videoDetails = course?.videos.find(
    (video) => video.videoId === activeLesson?.videoId,
  );

  useEffect(() => {
    setNoteDraft(activeLesson ? learningStates[activeLesson.videoId]?.note ?? "" : "");
    setActionMessage("");
  }, [activeLesson?.videoId, courseId]);

  async function updateActiveLesson(fields) {
    if (!activeLesson) {
      return null;
    }
    setIsUpdating(true);
    setError("");
    setActionMessage("");
    try {
      const response = await http.put(
        `/api/courses/${courseId}/videos/${activeLesson.videoId}/learning-state`,
        fields,
      );
      const state = response.data.data.state;
      setLearningStates((current) => ({
        ...current,
        [state.videoId]: state,
      }));
      setActionMessage("Lesson changes saved.");
      return state;
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      return null;
    } finally {
      setIsUpdating(false);
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    const state = await updateActiveLesson({ note: noteDraft });
    if (state) {
      setNoteDraft(state.note);
    }
  }

  return (
    <main className="min-h-screen bg-brand px-4 py-5 text-slate-900 sm:px-7 sm:py-7">
      <header className="mx-auto flex max-w-7xl items-center justify-between">
        <BrandMark />
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          to={course ? `/courses/${course._id}` : "/dashboard"}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Course details
        </Link>
      </header>

      <section className="mx-auto max-w-7xl py-7 sm:py-10">
        {isLoading ? (
          <p
            aria-live="polite"
            className="py-20 text-center text-sm text-slate-500"
            role="status"
          >
            Loading your course…
          </p>
        ) : error && !course ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-lg font-semibold text-rose-950">
              Course player could not be loaded
            </h1>
            <p className="mt-2 text-sm leading-6 text-rose-800">{error}</p>
            <button
              className="mt-4 text-sm font-semibold text-rose-900 underline underline-offset-2"
              onClick={() => loadPlayer()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : course ? (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
                  Course player
                </p>
                <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {course.title}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {activeLesson?.title ?? "Choose a lesson to begin"}
                </p>
              </div>
              <div className="w-full sm:w-56">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Course progress</span>
                  <span className="font-semibold text-slate-800">
                    {completedCount} / {lessons.length}
                  </span>
                </div>
                <div
                  aria-label={`${progressPercent}% of lessons completed`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={progressPercent}
                  className="h-2 overflow-hidden rounded-full bg-black/20"
                  role="progressbar"
                >
                  <div
                    className="h-full rounded-full bg-cyan-600 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <StudyTimer courseId={courseId} />
              </div>
            </div>

            {error && (
              <p
                aria-live="polite"
                className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                role="alert"
              >
                {error}
              </p>
            )}

            {lessons.length === 0 ? (
              <div className="rounded-3xl border-2 border-black bg-white p-8 text-center">
                <h2 className="text-lg font-semibold">No videos to play</h2>
                <p className="mt-2 text-sm text-slate-500">
                  This course does not contain any available lessons.
                </p>
              </div>
            ) : activeLesson ? (
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <LessonWorkspace
                  actionMessage={actionMessage}
                  activeChapter={activeChapter}
                  activeIndex={activeIndex}
                  activeLesson={activeLesson}
                  activeState={activeState}
                  isUpdating={isUpdating}
                  lessons={lessons}
                  noteDraft={noteDraft}
                  onClearActionMessage={() => setActionMessage("")}
                  onNoteDraftChange={setNoteDraft}
                  onSaveNote={saveNote}
                  onSelectLesson={setActiveVideoId}
                  onUpdateLesson={updateActiveLesson}
                  videoDetails={videoDetails}
                />
                <CourseContentsSidebar
                  activeVideoId={activeVideoId}
                  chapters={chapters}
                  isUpdating={isUpdating}
                  learningStates={learningStates}
                  onSelectLesson={setActiveVideoId}
                  progressPercent={progressPercent}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
