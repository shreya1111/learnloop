import { useState } from "react";
import { CalendarDays, Sparkles } from "lucide-react";

const studyDayOptions = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];

function localDateValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StudyPlanForm({ isGenerating, onGenerate }) {
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(localDateValue);
  const [weeks, setWeeks] = useState("4");
  const [minutesPerSession, setMinutesPerSession] = useState("45");
  const [studyDays, setStudyDays] = useState([
    "monday",
    "wednesday",
    "friday",
  ]);

  function toggleStudyDay(day) {
    setStudyDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day],
    );
  }

  function submit(event) {
    event.preventDefault();
    void onGenerate({
      goal,
      startDate,
      weeks: Number(weeks),
      minutesPerSession: Number(minutesPerSession),
      studyDays,
    });
  }

  return (
    <form
      className="mt-6 grid gap-5 rounded-3xl border-2 border-black bg-white p-5  sm:p-7"
      onSubmit={submit}
    >
      <div>
        <h2 className="text-lg font-semibold">Build your study plan</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Share your goal and weekly availability. The plan will schedule every
          course lesson and add a revision session.
        </p>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        What do you want to achieve?
        <textarea
          className="mt-2 min-h-24 w-full rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
          maxLength={500}
          minLength={3}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="For example: understand the core concepts well enough to build a small project."
          required
          value={goal}
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">
          Choose your study days
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {studyDayOptions.map(([day, label]) => {
            const selected = studyDays.includes(day);
            return (
              <label
                className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                  selected
                    ? "border-cyan-300 bg-cyan-50 text-cyan-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                key={day}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  name="studyDays"
                  onChange={() => toggleStudyDay(day)}
                  type="checkbox"
                  value={day}
                />
                {label}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Select at least one day. The AI schedules no more than one session
          per selected day.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700">
          Start date
          <span className="relative mt-2 block">
            <CalendarDays
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              className="w-full rounded-xl border-2 border-black bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Plan length (weeks)
          <input
            className="mt-2 w-full rounded-xl border-2 border-black px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
            max={16}
            min={1}
            onChange={(event) => setWeeks(event.target.value)}
            required
            type="number"
            value={weeks}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Minutes per session
          <input
            className="mt-2 w-full rounded-xl border-2 border-black px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
            max={480}
            min={15}
            onChange={(event) => setMinutesPerSession(event.target.value)}
            required
            type="number"
            value={minutesPerSession}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">
          Plans are based on this course outline and your available study time.
        </p>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGenerating || !goal.trim() || studyDays.length === 0}
          type="submit"
        >
          <Sparkles aria-hidden="true" size={16} />
          {isGenerating ? "Creating your plan…" : "Generate study plan"}
        </button>
      </div>
    </form>
  );
}
