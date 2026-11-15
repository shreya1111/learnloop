import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/http.js";
import { useAuthStore } from "../store/authStore.js";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <main
        aria-live="polite"
        className="grid min-h-svh place-items-center bg-black font-mono text-xs uppercase tracking-[-0.02em] text-white"
        role="status"
      >
        Checking your session…
      </main>
    );
  }

  if (user) {
    return <Navigate replace to="/dashboard" />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      if (isRegister) {
        await register({ name, email, password });
      } else {
        await login({ email, password });
      }
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "field-dark mt-2 w-full border-2 border-white/30 bg-black px-3 py-2.5 font-mono text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brand";

  return (
    <main className="grid min-h-svh bg-black text-white lg:grid-cols-[1.05fr_1fr]">
      <section className="flex flex-col justify-between gap-10 bg-brand px-5 py-8 text-black sm:px-9 sm:py-10">
        <Link
          aria-label="LearnLoop home"
          className="inline-flex w-fit items-center gap-2 border-2 border-black bg-brand px-2.5 py-2"
          to="/"
        >
          <span className="grid size-6 place-items-center bg-black font-display text-[11px] leading-none text-brand">
            LL
          </span>
          <span className="font-display text-sm uppercase tracking-[-0.04em]">
            LearnLoop
          </span>
        </Link>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/70">
            {isRegister ? "New account" : "Returning learner"}
          </p>
          <h1 className="mt-5 font-display text-[15vw] uppercase leading-[0.85] tracking-[-0.04em] lg:text-[7vw]">
            {isRegister ? (
              <>
                Start the
                <br />
                loop.
              </>
            ) : (
              <>
                Welcome
                <br />
                back.
              </>
            )}
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-black/80">
            {isRegister
              ? "Save your courses, shape outlines, and plan study weeks around your own schedule."
              : "Sign in to pick up exactly where your learning left off."}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 border-t-2 border-black pt-4 font-mono text-[10px] uppercase tracking-[-0.02em]">
          <span>Independent learning platform</span>
          <span className="hidden sm:inline">Est. 2026</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-9">
        <div className="w-full max-w-md">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
            {isRegister ? "Register" : "Sign in"} / 02
          </p>

          <form
            className="mt-5 border-2 border-white/25 p-6 sm:p-8"
            onSubmit={handleSubmit}
          >
            <h2 className="font-display text-2xl uppercase leading-none tracking-[-0.04em]">
              {isRegister ? "Create account" : "Sign in"}
            </h2>

            <div className="mt-6 space-y-5">
              {isRegister && (
                <label className="block font-mono text-[10px] uppercase tracking-[-0.02em] text-white/60">
                  Name
                  <input
                    autoComplete="name"
                    className={inputClass}
                    maxLength={80}
                    minLength={2}
                    onChange={(event) => setName(event.target.value)}
                    required
                    value={name}
                  />
                </label>
              )}
              <label className="block font-mono text-[10px] uppercase tracking-[-0.02em] text-white/60">
                Email
                <input
                  autoComplete="email"
                  className={inputClass}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="block font-mono text-[10px] uppercase tracking-[-0.02em] text-white/60">
                Password
                <input
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  className={inputClass}
                  maxLength={72}
                  minLength={isRegister ? 12 : 1}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                {isRegister && (
                  <span className="mt-2 block font-mono text-[9px] normal-case tracking-normal text-white/40">
                    Use at least 12 characters.
                  </span>
                )}
              </label>
            </div>

            {formError && (
              <p
                aria-live="polite"
                className="mt-5 border-2 border-brand bg-black px-3 py-2.5 font-mono text-[11px] uppercase leading-5 tracking-[-0.02em] text-brand"
                role="alert"
              >
                {formError}
              </p>
            )}

            <button
              className="mt-6 w-full rounded-full bg-brand px-5 py-3 font-mono text-xs uppercase tracking-[-0.02em] text-black transition-transform duration-300 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Please wait…"
                : isRegister
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-[-0.02em] text-white/60">
            {isRegister ? "Already have an account?" : "New to LearnLoop?"}{" "}
            <Link
              className="text-brand underline underline-offset-4 transition hover:text-white"
              to={isRegister ? "/login" : "/register"}
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>

          <Link
            className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[-0.02em] text-white/40 transition hover:text-brand"
            to="/"
          >
            ← Back to the landing page
          </Link>
        </div>
      </section>
    </main>
  );
}
