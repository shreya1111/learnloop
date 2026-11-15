import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  Save,
} from "lucide-react";
import { formatDuration } from "../../utils/formatDuration.js";

export default function LessonWorkspace({
  activeLesson,
  activeChapter,
  videoDetails,
  activeState,
  isUpdating,
  actionMessage,
  noteDraft,
  lessons,
  activeIndex,
  onUpdateLesson,
  onSaveNote,
  onNoteDraftChange,
  onSelectLesson,
  onClearActionMessage,
}) {
  return (
    <div className="min-w-0 space-y-5">
      <div className="overflow-hidden rounded-3xl border-2 border-black bg-black ">
        <div className="aspect-video">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
            referrerPolicy="strict-origin-when-cross-origin"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(activeLesson.videoId)}`}
            title={`Lesson: ${activeLesson.title}`}
          />
        </div>
      </div>

      <section className="rounded-3xl border-2 border-black bg-white p-5  sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
              {activeChapter?.title}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {activeLesson.title}
            </h2>
            {activeChapter?.description && (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {activeChapter.description}
              </p>
            )}
            {videoDetails?.description && (
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-500">
                {videoDetails.description}
              </p>
            )}
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Clock3 aria-hidden="true" size={14} />
              {formatDuration(activeLesson.durationSeconds)}
            </p>
          </div>
          <a
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-cyan-800"
            href={activeLesson.videoUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open on YouTube <ExternalLink aria-hidden="true" size={13} />
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            aria-pressed={Boolean(activeState.completed)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
              activeState.completed
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            disabled={isUpdating}
            onClick={() =>
              onUpdateLesson({ completed: !activeState.completed })
            }
            type="button"
          >
            <Check aria-hidden="true" size={16} />
            {activeState.completed ? "Completed" : "Mark complete"}
          </button>
          <button
            aria-pressed={Boolean(activeState.bookmarked)}
            className="inline-flex items-center gap-2 rounded-full border-2 border-black px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            disabled={isUpdating}
            onClick={() =>
              onUpdateLesson({ bookmarked: !activeState.bookmarked })
            }
            type="button"
          >
            <Bookmark
              aria-hidden="true"
              className={
                activeState.bookmarked ? "fill-cyan-200 text-cyan-800" : ""
              }
              size={16}
            />
            {activeState.bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
        </div>
        {actionMessage && (
          <p
            aria-live="polite"
            className="mt-3 text-xs text-emerald-700"
            role="status"
          >
            {actionMessage}
          </p>
        )}
      </section>

      <section className="rounded-3xl border-2 border-black bg-white p-5  sm:p-7">
        <div className="flex items-center gap-2">
          <FileText aria-hidden="true" className="text-cyan-800" size={18} />
          <h2 className="text-base font-semibold">Personal notes</h2>
        </div>
        <form className="mt-4" onSubmit={onSaveNote}>
          <label className="block">
            <span className="sr-only">Notes for {activeLesson.title}</span>
            <textarea
              className="min-h-36 w-full resize-y rounded-2xl border-2 border-black bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
              disabled={isUpdating}
              maxLength={20000}
              onChange={(event) => {
                onNoteDraftChange(event.target.value);
                onClearActionMessage();
              }}
              placeholder="Capture key ideas or questions for this lesson…"
              value={noteDraft}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              {noteDraft.length.toLocaleString()} / 20,000 characters
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUpdating}
              type="submit"
            >
              <Save aria-hidden="true" size={15} />
              {isUpdating ? "Saving…" : "Save notes"}
            </button>
          </div>
        </form>
      </section>

      <div className="flex items-center justify-between gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isUpdating || activeIndex <= 0}
          onClick={() => onSelectLesson(lessons[activeIndex - 1].videoId)}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={15} />
          Previous lesson
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isUpdating || activeIndex < 0 || activeIndex >= lessons.length - 1}
          onClick={() => onSelectLesson(lessons[activeIndex + 1].videoId)}
          type="button"
        >
          Next lesson <ArrowRight aria-hidden="true" size={15} />
        </button>
      </div>
    </div>
  );
}
