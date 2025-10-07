'use client';

import { useEffect, useRef } from "react";

import Button from "@/components/ui/button";
import { useChat } from "@/lib/hooks/useChat";
import type { ChatMessage } from "@/lib/types";

const ROLE_LABEL: Record<ChatMessage["role"], string> = {
  system: "System",
  assistant: "Assistant",
  user: "You",
};

export default function ChatPage() {
  const {
    messages,
    input,
    setInput,
    send,
    cancel,
    retryLast,
    clear,
    isStreaming,
    error,
    latencyMs,
  } = useChat();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const sendDisabled = isStreaming || !input.trim();

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (sendDisabled) return;
    await send();
    textareaRef.current?.focus();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (sendDisabled) return;
    void (async () => {
      await send();
      textareaRef.current?.focus();
    })();
  };

  return (
    <section className="flex flex-col gap-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Chat Preview
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Mock streaming chat demo. Messages appear below as the mock endpoint streams
          tokens back.
        </p>
      </header>

      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          <span>Status</span>
          <span className="inline-flex items-center gap-2">
            <span
              className={[
                "h-2 w-2 rounded-full",
                isStreaming
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-500",
              ].join(" ")}
            />
            {isStreaming ? "Streaming…" : "Idle"}
            {latencyMs != null && !isStreaming ? `• ${latencyMs.toFixed(0)}ms` : null}
          </span>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div
          className="max-h-[360px] overflow-y-auto rounded-md border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
          aria-live="polite"
        >
          <ul className="flex flex-col gap-3">
            {messages.length === 0 ? (
              <li className="rounded-md border border-dashed border-zinc-300 bg-white/50 p-4 text-center text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-600">
                No messages yet — start the conversation below.
              </li>
            ) : (
              messages.map((message, index) => {
                const isLast = index === messages.length - 1;
                return (
                  <li
                    key={message.id}
                    ref={isLast ? messagesEndRef : undefined}
                    className="rounded-md border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      <span>{ROLE_LABEL[message.role]}</span>
                      <span className="tabular-nums">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
                      {message.content}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={cancel}
            disabled={!isStreaming}
            className="bg-zinc-200 text-zinc-900 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Stop
          </Button>
          <Button
            type="button"
            onClick={retryLast}
            disabled={isStreaming || !messages.some((message) => message.role === "user")}
            className="bg-zinc-200 text-zinc-900 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Retry
          </Button>
          <Button
            type="button"
            onClick={clear}
            disabled={isStreaming || messages.length === 0}
            className="bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Clear
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="sr-only" htmlFor="chat-input">
            Chat message
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            ref={textareaRef}
            rows={3}
            placeholder="Type your message…"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            disabled={isStreaming}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={sendDisabled}>
              {isStreaming ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
