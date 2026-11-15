import { Bookmark, Check, Play } from "lucide-react";
import { formatDuration } from "../../utils/formatDuration.js";

export default function CourseContentsSidebar({
  chapters,
  activeVideoId,
  learningStates,
  progressPercent,
  isUpdating,
  onSelectLesson,
}) {
  const lessonCount = chapters.reduce(
    (total, chapter) => total + chapter.lessons.length,
    0,
  );

  return (
    <aside className="overflow-hidden rounded-3xl border-2 border-black bg-white  lg:sticky lg:top-6">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold">Course contents</h2>
        <p className="mt-1 text-xs text-slate-500">
          {lessonCount} lessons · {progressPercent}% complete
        </p>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-3">
        {chapters.map((chapter, chapterIndex) => (
          <section
            className="mb-3 last:mb-0"
            key={`${chapter.position}-${chapter.title}`}
          >
            <h3 className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {chapterIndex + 1}. {chapter.title}
            </h3>
            <ol className="space-y-1">
              {chapter.lessons.map((lesson) => {
                const isActive = lesson.videoId === activeVideoId;
                const lessonState = learningStates[lesson.videoId] ?? {};
                return (
                  <li key={lesson.videoId}>
                    <button
                      aria-current={isActive ? "true" : undefined}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? "bg-cyan-50 text-cyan-950"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                      disabled={isUpdating}
                      onClick={() => onSelectLesson(lesson.videoId)}
                      type="button"
                    >
                      <span
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                          lessonState.completed
                            ? "bg-emerald-100 text-emerald-800"
                            : isActive
                              ? "bg-white text-cyan-800"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {lessonState.completed ? (
                          <Check aria-hidden="true" size={13} />
                        ) : (
                          <Play aria-hidden="true" size={11} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold leading-5">
                          {lesson.title}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{formatDuration(lesson.durationSeconds)}</span>
                          {lessonState.bookmarked && (
                            <Bookmark
                              aria-label="Bookmarked"
                              className="fill-cyan-200 text-cyan-800"
                              size={11}
                            />
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </aside>
  );
}
