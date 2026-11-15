import { useEffect } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import AuthPage from "./pages/AuthPage.jsx";
import CourseDetailsPage from "./pages/CourseDetailsPage.jsx";
import CourseSetupPage from "./pages/CourseSetupPage.jsx";
import CoursePlayer from "./pages/CoursePlayer.jsx";
import StudyPlannerPage from "./pages/StudyPlannerPage.jsx";
import QuizzesPage from "./pages/QuizzesPage.jsx";
import AiTutorPage from "./pages/AiTutorPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import { useAuthStore } from "./store/authStore.js";

const navLinks = [
  { href: "#top", label: "Index" },
  { href: "#method", label: "Method" },
  { href: "#services", label: "Services" },
];

const services = [
  {
    index: "01",
    title: "Import",
    tags: ["YouTube playlists", "Up to 500 lessons", "Owner scoped"],
  },
  {
    index: "02",
    title: "Structure",
    tags: ["AI outline", "Chapters", "Validated order"],
  },
  {
    index: "03",
    title: "Plan",
    tags: ["Study windows", "Per-session focus", "Revision"],
  },
  {
    index: "04",
    title: "Practise",
    tags: ["Quizzes", "Placement tests", "Scored attempts"],
  },
  {
    index: "05",
    title: "Track",
    tags: ["Streaks", "Study time", "Weekly progress"],
  },
  {
    index: "06",
    title: "Tutor",
    tags: ["Course context", "Lesson citations", "Your notes"],
  },
];

function ScrollIndicator() {
  return (
    <a
      aria-label="Scroll down to the method"
      className="group relative grid size-36 shrink-0 place-items-center justify-self-center"
      href="#method"
    >
      <svg
        aria-hidden="true"
        className="spin-slow absolute inset-0 size-full"
        viewBox="0 0 144 144"
      >
        <defs>
          <path
            d="M72 72 m -58 0 a 58 58 0 1 1 116 0 a 58 58 0 1 1 -116 0"
            fill="none"
            id="scroll-ring"
          />
        </defs>
        <text
          fill="#000000"
          fontFamily={'"Space Mono", monospace'}
          fontSize="9"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          <textPath href="#scroll-ring" startOffset="0">
            {"SCROLL DOWN • ".repeat(4)}
          </textPath>
        </text>
      </svg>
      <span className="grid size-11 place-items-center rounded-full border-2 border-black transition-transform duration-300 group-hover:translate-y-1 sm:size-12">
        <ArrowDown aria-hidden="true" size={18} strokeWidth={2.5} />
      </span>
    </a>
  );
}

function MarqueeRow({ className = "", reverse = false, text }) {
  return (
    <div className="overflow-hidden">
      <div
        className={
          reverse ? "marquee-track marquee-track--reverse" : "marquee-track"
        }
      >
        {[0, 1].map((copy) => (
          <span
            aria-hidden={copy === 1}
            className={`flex shrink-0 whitespace-pre text-center font-display uppercase tracking-[-0.04em] ${className}`}
            key={copy}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

function HomePage() {
  const user = useAuthStore((state) => state.user);
  const startHref = user ? "/dashboard" : "/register";

  return (
    <main className="overflow-x-hidden bg-brand text-black">
      <header className="fixed inset-x-0 top-0 z-50 px-3 py-3 sm:px-6 sm:py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <Link
            aria-label="LearnLoop home"
            className="inline-flex items-center gap-2 justify-self-start border-2 border-black bg-brand px-2 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2"
            to="/"
          >
            <span className="grid size-5 place-items-center bg-black font-display text-[10px] leading-none text-brand sm:size-6 sm:text-xs">
              LL
            </span>
            <span className="hidden font-display text-[11px] uppercase tracking-[-0.04em] min-[420px]:inline sm:text-sm">
              LearnLoop
            </span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="flex items-center justify-self-center rounded-full bg-black p-1"
          >
            {navLinks.map((link) => (
              <a
                className="whitespace-nowrap rounded-full px-1.5 py-2.5 font-mono text-[10px] uppercase tracking-[-0.02em] text-white transition-colors duration-200 hover:bg-white hover:text-black sm:px-4 sm:py-2 sm:text-xs"
                href={link.href}
                key={link.label}
              >
                {link.label}
              </a>
            ))}
            <Link
              className="ml-0.5 whitespace-nowrap rounded-full bg-brand px-2 py-2.5 font-mono text-[9.5px] uppercase tracking-[-0.02em] text-black transition-colors duration-200 hover:bg-white sm:ml-1 sm:px-4 sm:py-2 sm:text-xs"
              to={user ? "/dashboard" : "/login"}
            >
              {user ? "Workspace" : "Sign in"}
            </Link>
          </nav>

        </div>
      </header>

      <section
        className="flex min-h-svh flex-col px-3 pt-20 sm:px-6 sm:pt-24"
        id="top"
      >
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] sm:text-xs">
            Video playlists → structured courses
          </p>
          <h1 className="mt-5 font-display text-[19vw] uppercase leading-[0.85] tracking-[-0.04em] sm:mt-6 sm:text-[16vw]">
            <span className="block">Learn</span>
            <span className="block">Louder.</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 items-center gap-4 border-t-2 border-black py-4 sm:grid-cols-3 sm:gap-4 sm:py-6">
          <div className="font-mono text-[10px] uppercase leading-5 tracking-[-0.02em] sm:text-[11px] sm:leading-6">
            <p className="text-black/60">Based in</p>
            <p>The internet, worldwide</p>
          </div>
          <ScrollIndicator />
          <div className="font-mono text-[10px] uppercase leading-5 tracking-[-0.02em] sm:text-right sm:text-[11px] sm:leading-6">
            <p>Independent learning platform</p>
            <p className="text-black/60">Built for self-directed people</p>
          </div>
        </div>
      </section>

      <section
        className="scroll-mt-24 overflow-hidden py-12 sm:py-20"
        id="method"
      >
        <div className="-mx-[6%] w-[112%] -rotate-2 bg-black py-8 sm:py-12">
          <MarqueeRow
            className="text-[10vw] leading-[0.95] text-brand"
            text={"STRUCTURE  •  MOMENTUM  •  CLARITY  •  ".repeat(2)}
          />
          <div className="h-2 sm:h-4" />
          <MarqueeRow
            className="text-[7vw] leading-[0.95] text-white/80"
            reverse
            text={"IMPORT  •  ARRANGE  •  PRACTISE  •  REVISIT  •  ".repeat(2)}
          />
        </div>
      </section>

      <section
        className="scroll-mt-24 bg-black pb-16 pt-6 text-white sm:pb-24 sm:pt-10"
        id="services"
      >
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/20 py-6">
            <p className="font-mono text-xs uppercase tracking-[-0.02em] text-brand">
              Services / 06
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[-0.02em] text-white/60 sm:text-xs">
              Everything after the import
            </p>
          </div>

          <ul>
            {services.map((service) => (
              <li className="border-b border-white/20" key={service.index}>
                <Link
                  className="group relative grid grid-cols-[1.75rem_1fr] items-start gap-3 py-6 transition-colors duration-200 hover:bg-white/5 sm:grid-cols-[4rem_1fr_auto] sm:items-center sm:gap-6 sm:py-8"
                  to={startHref}
                >
                  <span className="pt-1 font-mono text-[11px] uppercase tracking-[-0.02em] text-brand sm:pt-0 sm:text-sm">
                    {service.index}
                  </span>
                  <div className="pr-7 sm:pr-0">
                    <h3 className="font-display text-[9.5vw] uppercase leading-[0.9] tracking-[-0.04em] transition-transform duration-300 sm:text-[7vw] sm:group-hover:translate-x-4">
                      {service.title}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2 transition-transform duration-300 sm:mt-4 sm:group-hover:translate-x-4">
                      {service.tags.map((tag) => (
                        <span
                          className="rounded-full border border-white/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[-0.02em] text-white/70 sm:px-3 sm:text-[11px]"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute right-0 top-6 size-6 text-brand transition duration-300 group-hover:-rotate-45 sm:static sm:mt-0 sm:size-14 sm:opacity-0 sm:group-hover:opacity-100"
                    strokeWidth={1.5}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="scroll-mt-24 px-4 pb-20 pt-20 text-center sm:px-6 sm:pb-28 sm:pt-28"
        id="start"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] sm:text-xs">
          Ready when you are
        </p>
        <h2 className="mt-5 font-display text-[14vw] uppercase leading-[0.85] tracking-[-0.04em]">
          <span className="block">Start the</span>
          <span className="block">Loop.</span>
        </h2>
        <Link
          className="mt-9 inline-flex items-center gap-3 rounded-full border-2 border-black bg-black px-7 py-4 font-mono text-[11px] uppercase tracking-[-0.02em] text-white transition-transform duration-300 hover:scale-110 sm:mt-11 sm:px-9 sm:py-5 sm:text-sm"
          to={startHref}
        >
          {user ? "Open workspace" : "Create account"}
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={2.5} />
        </Link>
        <p className="mx-auto mt-5 font-mono text-[10px] uppercase leading-5 tracking-[-0.02em] text-black/60">
          Import a playlist · Shape the path · Plan the week
        </p>
      </section>

      <footer className="border-t-2 border-black px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[-0.02em] sm:text-xs">
            © 2026 LearnLoop — All rights reserved
          </p>
        </div>
      </footer>
    </main>
  );
}

function ProtectedRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const initialize = useAuthStore((state) => state.initialize);

  if (isLoading) {
    return <LoadingPage />;
  }

  if (error) {
    return (
      <main className="grid min-h-svh place-items-center bg-black px-5 py-12 text-white">
        <section className="w-full max-w-md border-2 border-brand bg-black p-7 sm:p-8">
          <h1 className="mt-4 font-display text-2xl uppercase leading-none tracking-[-0.04em]">
            Could not verify your session
          </h1>
          <p className="mt-4 font-mono text-[11px] uppercase leading-5 tracking-[-0.02em] text-white/60">
            {error}
          </p>
          <button
            className="mt-6 rounded-full bg-brand px-5 py-2.5 font-mono text-xs uppercase tracking-[-0.02em] text-black transition-transform duration-300 hover:scale-105"
            onClick={() => initialize(true)}
            type="button"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return user ? children : <Navigate replace to="/login" />;
}

function LoadingPage() {
  return (
    <main
      aria-live="polite"
      className="grid min-h-svh place-items-center bg-black font-mono text-xs uppercase tracking-[-0.02em] text-brand"
      role="status"
    >
      Checking your session…
    </main>
  );
}

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<AuthPage mode="login" />} path="/login" />
      <Route element={<AuthPage mode="register" />} path="/register" />
      <Route
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
        path="/dashboard"
      />
      <Route
        element={
          <ProtectedRoute>
            <CourseDetailsPage />
          </ProtectedRoute>
        }
        path="/courses/:courseId"
      />
      <Route
        element={
          <ProtectedRoute>
            <CourseSetupPage />
          </ProtectedRoute>
        }
        path="/courses/:courseId/setup"
      />
      <Route
        element={
          <ProtectedRoute>
            <CoursePlayer />
          </ProtectedRoute>
        }
        path="/courses/:courseId/learn"
      />
      <Route
        element={
          <ProtectedRoute>
            <StudyPlannerPage />
          </ProtectedRoute>
        }
        path="/study-planner"
      />
      <Route
        element={
          <ProtectedRoute>
            <StudyPlannerPage />
          </ProtectedRoute>
        }
        path="/courses/:courseId/planner"
      />
      <Route
        element={
          <ProtectedRoute>
            <QuizzesPage />
          </ProtectedRoute>
        }
        path="/courses/:courseId/quizzes"
      />
      <Route
        element={
          <ProtectedRoute>
            <AiTutorPage />
          </ProtectedRoute>
        }
        path="/ai-tutor"
      />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
