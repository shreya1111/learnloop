import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getApiErrorMessage, http } from "../api/http.js";
import BrandMark from "../components/BrandMark.jsx";

export default function AiTutorPage() {
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const messageEndRef = useRef(null);

  const loadCourses = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await http.get("/api/courses");
      setCourses(response.data.data.courses);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    const requestedCourseId = searchParams.get("courseId");
    if (
      !courseId &&
      requestedCourseId &&
      courses.some((course) => course._id === requestedCourseId)
    ) {
      void selectCourse(requestedCourseId);
    }
  }, [courseId, courses, searchParams]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function selectCourse(nextCourseId) {
    setCourseId(nextCourseId);
    setConversationId("");
    setMessages([]);
    setConversations([]);
    setError("");
    if (!nextCourseId) return;

    setIsLoadingConversation(true);
    try {
      const response = await http.get(`/api/chat/courses/${nextCourseId}`);
      const threads = response.data.data.conversations;
      setConversations(threads);
      if (threads.length > 0) {
        await openConversation(threads[0]);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoadingConversation(false);
    }
  }

  function startNewConversation() {
    setConversationId("");
    setMessages([]);
    setDraft("");
    setError("");
  }

  async function openConversation(conversation) {
    setConversationId(conversation._id);
    setError("");
    setIsLoadingConversation(true);
    try {
      const response = await http.get(
        `/api/chat/conversations/${conversation._id}`,
      );
      setMessages(response.data.data.conversation.messages);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoadingConversation(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!courseId || !draft.trim()) return;

    const message = draft.trim();
    setDraft("");
    setError("");
    setIsSending(true);
    try {
      const response = await http.post(
        `/api/chat/courses/${courseId}/messages`,
        {
          message,
          ...(conversationId ? { conversationId } : {}),
        },
        // Tutor answers stream from the AI provider and routinely take longer
        // than the default request timeout.
        { timeout: 70000 },
      );
      const conversation = response.data.data.conversation;
      setConversationId(conversation._id);
      setMessages(conversation.messages);
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item._id !== conversation._id),
      ]);
    } catch (requestError) {
      setDraft(message);
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSending(false);
    }
  }

  const selectedCourse = courses.find((course) => course._id === courseId);

  return (
    <main className="min-h-screen bg-brand px-5 py-6 text-slate-900 sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <BrandMark />
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          to="/dashboard"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Workspace
        </Link>
      </header>

      <section className="mx-auto max-w-6xl py-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
            Course-aware AI tutor
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Learn by asking better questions.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Answers use your selected course outline, transcripts you provided,
            and your saved lesson notes. The tutor will say when that material
            does not support an answer.
          </p>
        </div>

        {error && (
          <p
            aria-live="polite"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="py-16 text-center text-sm text-slate-500" role="status">
            Loading your courses…
          </p>
        ) : courses.length === 0 ? (
          <div className="mt-8 rounded-3xl border-2 border-black bg-white p-8 text-center">
            <BookOpen aria-hidden="true" className="mx-auto text-slate-400" size={25} />
            <h2 className="mt-4 text-lg font-semibold">Import a course to begin</h2>
            <p className="mt-2 text-sm text-slate-500">
              The tutor needs a course outline or learning materials for context.
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
              to="/dashboard#my-courses"
            >
              Open your library <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
        ) : (
          <div className="mt-7 grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="rounded-3xl border-2 border-black bg-white p-4">
              <label className="block text-xs font-semibold text-slate-700">
                Course context
                <select
                  className="mt-2 w-full rounded-xl border-2 border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10"
                  onChange={(event) => selectCourse(event.target.value)}
                  value={courseId}
                >
                  <option value="">Choose a course</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>

              {courseId && (
                <>
                  <button
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white"
                    onClick={startNewConversation}
                    type="button"
                  >
                    <Plus aria-hidden="true" size={15} />
                    New conversation
                  </button>
                  {conversations.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Recent conversations
                      </p>
                      <div className="space-y-1">
                        {conversations.map((conversation) => (
                          <button
                            className={`w-full rounded-xl px-3 py-2 text-left text-xs leading-5 transition ${
                              conversationId === conversation._id
                                ? "bg-cyan-50 font-semibold text-cyan-950"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                            key={conversation._id}
                            onClick={() => void openConversation(conversation)}
                            type="button"
                          >
                            <span className="block truncate">
                              {conversation.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-normal text-slate-400">
                              <MessageCircle aria-hidden="true" size={11} />
                              {conversation.messageCount} messages
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedCourse && (
                    <Link
                      className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 hover:text-black"
                      to={`/courses/${selectedCourse._id}`}
                    >
                      View course <ArrowRight aria-hidden="true" size={13} />
                    </Link>
                  )}
                </>
              )}
            </aside>

            <section
              aria-label="Tutor conversation"
              className="flex min-h-[32rem] flex-col overflow-hidden rounded-3xl border-2 border-black bg-white "
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <span className="grid size-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-800">
                  <Sparkles aria-hidden="true" size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">
                    {selectedCourse?.title ?? "Select a course"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Grounded in available course materials
                  </p>
                </div>
              </div>

              <div
                aria-live="polite"
                className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
                role="log"
              >
                {isLoadingConversation ? (
                  <p className="py-12 text-center text-sm text-slate-500" role="status">
                    Loading conversations…
                  </p>
                ) : !courseId ? (
                  <p className="py-12 text-center text-sm text-slate-500">
                    Choose a course to start a conversation.
                  </p>
                ) : messages.length === 0 ? (
                  <div className="mx-auto max-w-md py-12 text-center">
                    <MessageCircle
                      aria-hidden="true"
                      className="mx-auto text-cyan-700"
                      size={25}
                    />
                    <h3 className="mt-4 text-sm font-semibold">
                      What would you like to understand?
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Ask about a course idea, request an explanation, or
                      connect concepts from different lessons.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <article
                      className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "ml-auto bg-slate-950 text-white"
                          : "border-2 border-black bg-slate-50 text-slate-800"
                      }`}
                      key={message._id}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.text}
                      </p>
                      {message.role === "assistant" &&
                        message.citations?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                            {message.citations.map((citation) => (
                              <Link
                                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-cyan-900 hover:bg-brand hover:text-black"
                                key={citation.videoId}
                                to={`/courses/${courseId}/learn?lesson=${encodeURIComponent(citation.videoId)}`}
                              >
                                {citation.title}
                                <ArrowRight aria-hidden="true" size={11} />
                              </Link>
                            ))}
                          </div>
                        )}
                    </article>
                  ))
                )}
                {isSending && (
                  <p className="text-xs text-slate-500" role="status">
                    The tutor is thinking…
                  </p>
                )}
                <div ref={messageEndRef} />
              </div>

              <form
                className="border-t border-slate-100 p-4 sm:p-5"
                onSubmit={sendMessage}
              >
                <label className="sr-only" htmlFor="tutor-message">
                  Ask the course tutor
                </label>
                <div className="flex items-end gap-2">
                  <textarea
                    className="max-h-40 min-h-12 flex-1 resize-y rounded-xl border-2 border-black px-3.5 py-3 text-sm leading-5 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10 disabled:bg-slate-50"
                    disabled={!courseId || isSending || isLoadingConversation}
                    id="tutor-message"
                    maxLength={5000}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask a question about this course…"
                    required
                    value={draft}
                  />
                  <button
                    aria-label="Send message"
                    className="grid size-12 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!courseId || !draft.trim() || isSending}
                    type="submit"
                  >
                    <Send aria-hidden="true" size={17} />
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                  AI can make mistakes. Check important information against
                  your lesson materials.
                </p>
              </form>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
