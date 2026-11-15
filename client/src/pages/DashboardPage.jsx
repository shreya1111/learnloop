import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  CircleHelp,
  ExternalLink,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Play,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark.jsx";
import ProgressOverview from "../components/ProgressOverview.jsx";
import { getApiErrorMessage, http } from "../api/http.js";
import { useAuthStore } from "../store/authStore.js";
import { formatDuration } from "../utils/formatDuration.js";

const navigationLinks = [
  { icon: Library, label: "My courses", to: "/dashboard#my-courses" },
  { icon: CalendarDays, label: "Study planner", to: "/study-planner" },
  { icon: Sparkles, label: "AI tutor", to: "/ai-tutor" },
];

function SidebarNavigation() {
  return (
    <nav aria-label="Workspace navigation" className="space-y-1">
      <Link
        aria-current="page"
        className="flex items-center gap-3 rounded-xl bg-cyan-50 px-3 py-2.5 text-sm font-semibold text-cyan-900"
        to="/dashboard"
      >
        <LayoutDashboard aria-hidden="true" size={18} />
        Overview
      </Link>
      {navigationLinks.map(({ icon: Icon, label, to }) => (
        <Link
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          key={label}
          to={to}
        >
          <Icon aria-hidden="true" size={18} />
          <span className="flex-1">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function Sidebar({ user }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
      <div className="px-2">
        <BrandMark />
      </div>
      <div className="mt-10">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Workspace
        </p>
        <SidebarNavigation />
      </div>
      <div className="mt-auto rounded-2xl bg-slate-50 p-4">
        <span className="grid size-9 place-items-center rounded-xl bg-white text-slate-700 ">
          <CircleHelp aria-hidden="true" size={18} />
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          Just getting started?
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Build a course outline, plan your study week, and track lesson completion.
        </p>
        <a
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 hover:text-black"
          href="/#how-it-works"
        >
          Explore LearnLoop <ArrowRight aria-hidden="true" size={13} />
        </a>
        <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white"
          >
            {user.name
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-slate-800">
              {user.name}
            </span>
            <span className="block truncate text-[11px] text-slate-500">
              {user.email}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}

function MobileMenu({ isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 top-full z-40 border-b-2 border-black bg-white px-5 py-4  lg:hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Workspace
        </span>
        <button
          aria-label="Close menu"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="mt-3" onClick={onClose}>
        <SidebarNavigation />
      </div>
      <a
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-800"
        href="/#how-it-works"
        onClick={onClose}
      >
        Explore LearnLoop <ArrowRight aria-hidden="true" size={15} />
      </a>
    </div>
  );
}

function CourseCard({ course }) {
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-black bg-white">
      <div className="flex flex-col sm:flex-row">
        <div className="relative grid aspect-video w-full shrink-0 place-items-center overflow-hidden bg-[#FFF3EE] text-black/40 sm:aspect-auto sm:w-44">
          <Play aria-hidden="true" size={24} />
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
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-800">
              {course.status === "structured" ? "AI structured" : "Playlist imported"}
            </span>
            <span className="text-xs text-slate-500">
              {course.playlist.channelTitle}
            </span>
          </div>
          <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-slate-900">
            {course.title}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Play aria-hidden="true" size={13} />
              {course.playlist.videoCount}{" "}
              {course.playlist.videoCount === 1 ? "video" : "videos"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 aria-hidden="true" size={13} />
              {formatDuration(course.estimatedDurationSeconds)}
            </span>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-4 pt-5">
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-cyan-800"
              to={`/courses/${course._id}`}
            >
              Open course <ArrowRight aria-hidden="true" size={15} />
            </Link>
            <a
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
              href={course.playlist.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Source playlist <ExternalLink aria-hidden="true" size={14} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [coursesError, setCoursesError] = useState("");
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [importError, setImportError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const loadCourses = useCallback(async () => {
    setIsCoursesLoading(true);
    setCoursesError("");
    try {
      const response = await http.get("/api/courses");
      setCourses(response.data.data.courses);
    } catch (requestError) {
      setCoursesError(getApiErrorMessage(requestError));
    } finally {
      setIsCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  async function importPlaylist(event) {
    event.preventDefault();
    setImportError("");
    setImportMessage("");
    setIsImporting(true);
    try {
      const response = await http.post("/api/playlists/import", { playlistUrl });
      const course = response.data.data.course;
      setCourses((currentCourses) => [course, ...currentCourses]);
      setCoursesError("");
      setPlaylistUrl("");
      setImportMessage(`“${course.title}” is now in your learning library.`);
    } catch (requestError) {
      setImportError(getApiErrorMessage(requestError));
    } finally {
      setIsImporting(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);
    try {
      await updateProfile({ name });
      setMessage("Profile updated.");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function signOut() {
    setError("");
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand text-slate-900">
      <Sidebar user={user} />

      <div className="lg:pl-64">
        <header className="relative z-20 flex h-[68px] items-center justify-between border-b-2 border-black bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "Close workspace menu" : "Open workspace menu"}
              className="grid size-10 place-items-center rounded-xl border-2 border-black text-slate-600"
              onClick={() => setIsMenuOpen((open) => !open)}
              type="button"
            >
              {isMenuOpen ? (
                <X aria-hidden="true" size={19} />
              ) : (
                <Menu aria-hidden="true" size={19} />
              )}
            </button>
            <BrandMark />
          </div>
          <p className="hidden text-sm font-medium text-slate-500 lg:block">
            Your learning workspace
          </p>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">Learner account</p>
            </div>
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white"
            >
              {user.name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-full border-2 border-black px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-60 sm:px-4 sm:text-sm"
              disabled={isLoggingOut}
              onClick={signOut}
              type="button"
            >
              <LogOut aria-hidden="true" size={15} />
              <span className="hidden sm:inline">
                {isLoggingOut ? "Signing out…" : "Sign out"}
              </span>
            </button>
          </div>
          <MobileMenu
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
          />
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          <div className="mb-6 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Workspace</span>
            <span aria-hidden="true" className="text-slate-300">
              /
            </span>
            <span className="text-slate-800">Overview</span>
          </div>

          <section className="relative overflow-hidden  bg-slate-950 px-6 py-7 text-white sm:px-9 sm:py-9">
            <div
              aria-hidden="true"
              className="absolute -right-10 -top-32 size-80 rounded-full bg-cyan-400/20 blur-3xl"
            />
            <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-cyan-100">
                  <Sparkles aria-hidden="true" size={14} />
                  Your workspace is ready
                </span>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Welcome back, {user.name}.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  Shape your playlist into a course, then plan focused study
                  sessions around your week.
                </p>
              </div>
              <a
                className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                href="#my-courses"
              >
                See your workspace <ArrowDownRight aria-hidden="true" size={16} />
              </a>
            </div>
          </section>

          {error && (
            <p
              aria-live="polite"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              role="alert"
            >
              {error}
            </p>
          )}

          <section
            className="mt-9 grid scroll-mt-6 gap-5 xl:grid-cols-[1.35fr_0.85fr]"
            id="my-courses"
          >
            <article className="rounded-3xl border-2 border-black bg-white p-6   sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Learning library
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    My courses
                  </h2>
                </div>
                <span className="grid size-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-800">
                  <BookOpen aria-hidden="true" size={19} />
                </span>
              </div>

              <form className="mt-6" onSubmit={importPlaylist}>
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="playlist-url"
                >
                  YouTube playlist URL
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    autoComplete="url"
                    className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
                    id="playlist-url"
                    onChange={(event) => {
                      setPlaylistUrl(event.target.value);
                      setImportError("");
                      setImportMessage("");
                    }}
                    placeholder="https://www.youtube.com/playlist?list=..."
                    required
                    type="url"
                    value={playlistUrl}
                  />
                  <button
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isImporting || isCoursesLoading}
                    type="submit"
                  >
                    {isImporting
                      ? "Importing…"
                      : isCoursesLoading
                        ? "Loading library…"
                        : "Import playlist"}
                    {!isImporting && !isCoursesLoading && (
                      <ArrowRight aria-hidden="true" size={15} />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Public playlists with up to 500 videos are supported.
                  Transcripts are not included by YouTube Data API.
                </p>
                {importError && (
                  <p
                    aria-live="polite"
                    className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                    role="alert"
                  >
                    {importError}
                  </p>
                )}
                {importMessage && (
                  <p
                    aria-live="polite"
                    className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                    role="status"
                  >
                    {importMessage}
                  </p>
                )}
              </form>

              {coursesError ? (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <p className="text-sm font-medium text-rose-900">
                    Courses could not be loaded
                  </p>
                  <p className="mt-1 text-sm text-rose-800">{coursesError}</p>
                  <button
                    className="mt-3 text-sm font-semibold text-rose-900 underline underline-offset-2"
                    onClick={() => loadCourses()}
                    type="button"
                  >
                    Try again
                  </button>
                </div>
              ) : isCoursesLoading ? (
                <p
                  aria-live="polite"
                  className="mt-6 rounded-2xl bg-slate-50 px-5 py-8 text-center text-sm text-slate-500"
                  role="status"
                >
                  Loading your courses…
                </p>
              ) : courses.length > 0 ? (
                <div className="mt-6 space-y-3">
                  {courses.map((course) => (
                    <CourseCard course={course} key={course._id} />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center sm:px-8">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-slate-500 ">
                    <Library aria-hidden="true" size={22} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">
                    Your learning library starts here
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Paste a public playlist link above to organize its videos
                    into a course.
                  </p>
                </div>
              )}
            </article>

            <article className="rounded-3xl border-2 border-black bg-white p-6   sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Your activity
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    Learning progress
                  </h2>
                </div>
                <span className="grid size-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                  <ChartNoAxesCombined aria-hidden="true" size={19} />
                </span>
              </div>
              <ProgressOverview />
            </article>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border-2 border-black bg-white p-6   sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                  <CalendarDays aria-hidden="true" size={19} />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Study planner</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Build a personalized weekly schedule with time for lessons
                    and revision.
                  </p>
                  <Link
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-800 hover:text-black"
                    to="/study-planner"
                  >
                    Open study planner <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border-2 border-black bg-white p-6   sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-800">
                  <Sparkles aria-hidden="true" size={19} />
                </span>
                <div>
                  <h2 className="text-base font-semibold">AI learning tutor</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Ask questions using your course outline, saved transcripts,
                    and personal lesson notes.
                  </p>
                  <Link
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-800 hover:text-black"
                    to="/ai-tutor"
                  >
                    Ask the tutor <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>
              </div>
            </article>

            <article
              className="scroll-mt-6 rounded-3xl border-2 border-black bg-white p-6   sm:p-8"
              id="account"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Account
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">Profile details</h2>
                </div>
                <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <Settings2 aria-hidden="true" size={19} />
                </span>
              </div>
              <form className="mt-5 space-y-4" onSubmit={saveProfile}>
                <label className="block text-sm font-medium text-slate-700">
                  Display name
                  <input
                    autoComplete="name"
                    className="mt-2 w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
                    maxLength={80}
                    minLength={2}
                    onChange={(event) => {
                      setName(event.target.value);
                      setMessage("");
                    }}
                    required
                    value={name}
                  />
                </label>
                <div>
                  <p className="text-sm font-medium text-slate-700">Email</p>
                  <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                </div>
                {message && (
                  <p aria-live="polite" className="text-sm text-emerald-700">
                    {message}
                  </p>
                )}
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Saving…" : "Save profile"}
                  {!isSaving && <ArrowRight aria-hidden="true" size={15} />}
                </button>
              </form>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
