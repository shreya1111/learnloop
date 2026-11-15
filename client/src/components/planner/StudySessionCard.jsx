import { useEffect, useState } from "react";
import { Check, Clock3, Save } from "lucide-react";
import { Link } from "react-router-dom";

export default function StudySessionCard({
  course,
  courseId,
  session,
  isSaving,
  onUpdate,
}) {
  const [date, setDate] = useState(session.date);
  const [title, setTitle] = useState(session.title);
  const [focus, setFocus] = useState(session.focus);
  const [durationMinutes, setDurationMinutes] = useState(
    String(session.durationMinutes),
  );
  const lessons = session.lessonVideoIds
    .map((videoId) => course.videos.find((video) => video.videoId === videoId))
    .filter(Boolean);

  useEffect(() => {
    setDate(session.date);
    setTitle(session.title);
    setFocus(session.focus);
    setDurationMinutes(String(session.durationMinutes));
  }, [session]);

  const hasChanges =
    date !== session.date ||
    title !== session.title ||
    focus !== session.focus ||
    Number(durationMinutes) !== session.durationMinutes;

  async function saveSession(event) {
    event.preventDefault();
    await onUpdate(session._id, {
      date,
      title,
      focus,
      durationMinutes: Number(durationMinutes),
    });
  }

  return (
    <article className="rounded-3xl border-2 border-black bg-white p-5  sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              session.kind === "revision"
                ? "bg-violet-50 text-violet-800"
                : "bg-cyan-50 text-cyan-900"
            }`}
          >
            {session.kind === "revision" ? "Revision" : "Learning"}
          </span>
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            {session.title}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Clock3 aria-hidden="true" size={13} />
            {session.durationMinutes} min planned
          </p>
        </div>
        <button
          aria-pressed={session.completed}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition disabled:opacity-60 ${
            session.completed
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          disabled={isSaving}
          onClick={() =>
            onUpdate(session._id, { completed: !session.completed })
          }
          type="button"
        >
          <Check aria-hidden="true" size={14} />
          {session.completed ? "Completed" : "Mark complete"}
        </button>
      </div>

      <form className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2" onSubmit={saveSession}>
        <label className="block text-xs font-medium text-slate-700">
          Session date
          <input
            className="mt-2 w-full rounded-xl border-2 border-black px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Duration (minutes)
          <input
            className="mt-2 w-full rounded-xl border-2 border-black px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
            max={480}
            min={1}
            onChange={(event) => setDurationMinutes(event.target.value)}
            required
            type="number"
            value={durationMinutes}
          />
        </label>
        <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
          Session title
          <input
            className="mt-2 w-full rounded-xl border-2 border-black px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>
        <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
          Focus for this session
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border-2 border-black px-3 py-2.5 text-sm leading-5 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
            maxLength={1500}
            onChange={(event) => setFocus(event.target.value)}
            required
            value={focus}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {lessons.map((lesson) => (
              <Link
                className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-brand hover:text-black hover:text-cyan-900"
                key={lesson.videoId}
                to={`/courses/${courseId}/learn?lesson=${encodeURIComponent(lesson.videoId)}`}
              >
                {lesson.title}
              </Link>
            ))}
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || !hasChanges}
            type="submit"
          >
            <Save aria-hidden="true" size={14} />
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </article>
  );
}
