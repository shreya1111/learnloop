import { useEffect, useState } from "react";
import { Clock3, Play, Square } from "lucide-react";
import { getApiErrorMessage, http } from "../../api/http.js";

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function StudyTimer({ courseId }) {
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!startedAt) return undefined;
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [startedAt]);

  async function stopTimer() {
    if (!startedAt) return;
    const startedAtSnapshot = startedAt;
    const elapsedMilliseconds = Math.max(0, Date.now() - startedAtSnapshot);
    const durationMinutes = Math.floor(elapsedMilliseconds / 60000);
    setError("");
    setMessage("");
    if (durationMinutes < 1) {
      setStartedAt(null);
      setNow(Date.now());
      setMessage("Timer stopped. At least one minute is needed to log a session.");
      return;
    }

    setIsSaving(true);
    try {
      await http.post("/api/progress/study-sessions", {
        courseId,
        durationMinutes,
      });
      setStartedAt(null);
      setNow(Date.now());
      setMessage(
        `${durationMinutes} ${durationMinutes === 1 ? "minute" : "minutes"} added to your study time.`,
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setStartedAt(Date.now() - elapsedMilliseconds);
      setNow(Date.now());
    } finally {
      setIsSaving(false);
    }
  }

  const elapsedSeconds = startedAt
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0;

  return (
    <div className="mt-4 rounded-2xl border-2 border-black bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Clock3 aria-hidden="true" size={16} />
          Study timer
          <span aria-live="off" className="font-mono text-slate-500">
            {formatTime(elapsedSeconds)}
          </span>
        </div>
        {startedAt ? (
          <button
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
            disabled={isSaving}
            onClick={stopTimer}
            type="button"
          >
            <Square aria-hidden="true" size={13} />
            {isSaving ? "Saving…" : "Stop & save"}
          </button>
        ) : (
          <button
            className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3.5 py-2 text-xs font-semibold text-cyan-950 hover:bg-cyan-200"
            onClick={() => {
              setError("");
              setMessage("");
              setNow(Date.now());
              setStartedAt(Date.now());
            }}
            type="button"
          >
            <Play aria-hidden="true" size={13} />
            Start timer
          </button>
        )}
      </div>
      {(message || error) && (
        <p
          aria-live="polite"
          className={`mt-2 text-xs ${error ? "text-rose-700" : "text-emerald-700"}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
      {startedAt && (
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          This timer runs while the course player is open. Stop and save before
          leaving the page.
        </p>
      )}
    </div>
  );
}
