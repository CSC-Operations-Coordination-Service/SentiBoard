"use client";

/* Floating assistant: a launcher button and a non-modal chat panel, on every page when the
   chatbot is enabled (ChatMount). The conversation lives in this component's state, so it survives
   client-side navigation (the widget sits in the root layout) and is gone on reload.

   Each question is sent with the page context (page-context.ts) read from the browser URL at that
   moment. Answers are shown as plain text: nothing from the chatbot is rendered as HTML.

   Keyboard: the pages listen for keys on document/window (Escape clears a selection, [ and ]
   cycle datatakes, Enter plays/pauses the globe) without checking where focus is. So every
   keydown inside the widget is handled by a native listener on the widget root and stopped
   there, before it reaches those handlers. Escape closes the panel and returns focus to the
   launcher; Enter sends, Shift+Enter starts a new line. */

import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, RotateCcw, SendHorizontal, X } from "lucide-react";
import { useHydrated } from "@/lib/use-hydrated";
import { sendChatMessage, type ChatResult } from "./actions";
import { buildPageContext } from "./page-context";
import { HISTORY_SENT, MAX_CONTENT_CHARS } from "./limits";
import { parseResponse } from "./parse-response";
import AssistantAnswer from "./AssistantAnswer";
import s from "./chat-widget.module.css";

type Role = "user" | "assistant";
interface Message {
  id: number;
  role: Role;
  content: string;
  requestId?: string;
}

/** Pure helper: creates an assistant Message from a successful chat result. */
export function makeAssistantMessage(
  id: number,
  answer: string,
  requestId: string,
): Message {
  return { id, role: "assistant", content: answer, requestId };
}
type FailureKind = Extract<ChatResult, { ok: false }>["kind"];

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const FAILURE_TEXT: Record<FailureKind, string> = {
  unreachable: "The assistant is unreachable right now.",
  error: "The assistant could not answer this question.",
  invalid: "This message could not be sent.",
  disabled: "The assistant is switched off.",
};

function currentContext() {
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  return buildPageContext(window.location.href, BASE_PATH, new Date(), timeZone);
}

export default function ChatWidget() {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<FailureKind | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const panelId = useId();
  const titleId = useId();

  /** Ask the chatbot about the conversation `history` (its last message is the question). */
  async function ask(history: Message[]) {
    setPending(true);
    setFailure(null);
    const result = await sendChatMessage({
      messages: history.slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content })),
      context: currentContext(),
    });
    setPending(false);
    if (result.ok) {
      setMessages((m) => [
        ...m,
        makeAssistantMessage(nextId.current++, result.answer, result.requestId),
      ]);
    } else {
      setFailure(result.kind);
    }
  }

  function send() {
    const content = draft.trim();
    if (!content || pending) return;
    const history = [...messages, { id: nextId.current++, role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    void ask(history);
  }

  function retry() {
    if (pending || messages.at(-1)?.role !== "user") return;
    void ask(messages);
  }

  function reset() {
    setMessages([]);
    setFailure(null);
    setDraft("");
    inputRef.current?.focus();
  }

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  // Latest handlers for the native key listener, which is attached once.
  const keyHandlers = useRef({ send, close });
  useEffect(() => {
    keyHandlers.current = { send, close };
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation(); // keep page shortcuts out of the widget, see the header
      if (e.key === "Escape") {
        e.preventDefault();
        keyHandlers.current.close();
      } else if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.isComposing &&
        e.target === inputRef.current
      ) {
        e.preventDefault();
        keyHandlers.current.send();
      }
    };
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, [hydrated]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending, failure, open]);

  // Server HTML and hydration render nothing: the widget needs JavaScript to work.
  if (!hydrated) return null;

  const canRetry = failure !== null && failure !== "disabled" && messages.at(-1)?.role === "user";

  return (
    <div ref={rootRef} className={s.root}>
      <section
        id={panelId}
        className={s.panel}
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
      >
        <header className={s.head}>
          <h2 id={titleId} className={s.title}>
            Assistant
          </h2>
          <button
            type="button"
            className={s.iconBtn}
            onClick={reset}
            disabled={pending || messages.length === 0}
            aria-label="New conversation"
            title="New conversation"
          >
            <RotateCcw size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={s.iconBtn}
            onClick={close}
            aria-label="Close assistant"
            title="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div ref={logRef} className={s.log} role="log" aria-live="polite" aria-busy={pending}>
          {messages.length === 0 && (
            <p className={s.empty}>
              Ask about what you see on this page. The assistant is told which page you are on and
              which filters are applied.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? s.user : s.answer}>
              <span className={s.srOnly}>{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.role === "assistant"
                ? <AssistantAnswer segments={parseResponse(m.content)} />
                : m.content}
            </div>
          ))}
          {pending && (
            <div className={s.pending} role="status">
              <span className={s.dots} aria-hidden />
              Thinking…
            </div>
          )}
          {failure && (
            <div className={s.failure} role="alert">
              {FAILURE_TEXT[failure]}
              {canRetry && (
                <button type="button" className={s.retry} onClick={retry}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            className={s.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_CONTENT_CHARS}
            rows={2}
            placeholder="Ask a question…"
            aria-label="Your question"
          />
          <button
            type="submit"
            className={s.send}
            disabled={pending || draft.trim() === ""}
            aria-label="Send"
            title="Send"
          >
            <SendHorizontal size={18} aria-hidden />
          </button>
        </form>
        <p className={s.note}>Answers are generated by AI and may be wrong.</p>
      </section>

      <button
        ref={launcherRef}
        type="button"
        className={s.launcher}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? <X size={22} aria-hidden /> : <MessageCircle size={22} aria-hidden />}
      </button>
    </div>
  );
}
