import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  defaultStreamSettings,
  type ChatMessage,
  type StreamSettings,
  type SendPayload,
} from "../types";
import { clearMessages, loadMessages, saveMessages } from "../persist";

const SYSTEM_GREETING: ChatMessage = {
  id: "system-greeting",
  role: "system",
  content: "Welcome to Le Chat++.",
  createdAt: Date.now(),
};

const HISTORY_LIMIT = 20;

interface UseChatOptions {
  initialMessages?: ChatMessage[];
  settings?: Partial<StreamSettings>;
  defaults?: Partial<StreamSettings>;
}

// TODO: integrate token usage tracking once backend supports it.
export function useChat({
  initialMessages = [SYSTEM_GREETING],
  settings,
  defaults,
}: UseChatOptions = {}) {
  const [baseDefaults, setBaseDefaults] = useState<StreamSettings>({
    ...defaultStreamSettings,
    ...defaults,
  });

  const defaultsSignature = defaults
    ? `${defaults.model ?? ""}|${defaults.temperature ?? ""}`
    : null;

  useEffect(() => {
    if (defaults) {
      setBaseDefaults((prev) => {
        const nextModel = defaults.model ?? prev.model;
        const nextTemp = defaults.temperature ?? prev.temperature;
        if (nextModel === prev.model && nextTemp === prev.temperature) {
          return prev;
        }
        return {
          ...prev,
          model: nextModel,
          temperature: nextTemp,
        };
      });
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    async function loadDefaults() {
      try {
        const response = await fetch("/api/chat/config");
        if (!response.ok) return;
        const data: {
          model?: string;
          temperature?: number;
        } = await response.json();
        if (cancelled) return;
        setBaseDefaults((prev) => {
          const nextModel =
            typeof data.model === "string" && data.model.length > 0
              ? data.model
              : prev.model;
          const nextTemp =
            typeof data.temperature === "number"
              ? data.temperature
              : prev.temperature;
          if (nextModel === prev.model && nextTemp === prev.temperature) {
            return prev;
          }
          return {
            ...prev,
            model: nextModel,
            temperature: nextTemp,
          };
        });
      } catch {
        // ignore config fetch failures
      }
    }

    loadDefaults();

    return () => {
      cancelled = true;
    };
  }, [defaultsSignature]);

  const settingsWithDefaults = useMemo<StreamSettings>(
    () => ({
      ...baseDefaults,
      ...settings,
    }),
    [baseDefaults, settings],
  );

  const initialSnapshotRef = useRef<ChatMessage[]>(cloneMessages(initialMessages));
  const [messages, setMessages] = useState<ChatMessage[]>(initialSnapshotRef.current);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = loadMessages();
    if (stored && stored.length > 0) {
      const cloned = cloneMessages(stored);
      initialSnapshotRef.current = cloned;
      setMessages(cloned);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      const shouldPersist = !isDefaultMessageSet(messages);
      if (shouldPersist) {
        saveMessages(messages);
      } else {
        clearMessages();
      }
      saveTimeoutRef.current = null;
    }, 200);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [messages]);

  const latencyStartRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const lastUserMessageRef = useRef<string>("");

  const resetController = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    streamingMessageIdRef.current = null;
    latencyStartRef.current = null;
  }, []);

  const finalizeLatency = useCallback(() => {
    if (latencyStartRef.current != null) {
      setLatencyMs(performance.now() - latencyStartRef.current);
      latencyStartRef.current = null;
    }
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessageContent = useCallback(
    (id: string, updater: (current: string) => string) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, content: updater(message.content) } : message,
        ),
      );
    },
    [],
  );

  const handleStreamError = useCallback((err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") {
      setError(null);
    } else if (err instanceof Error) {
      setError(err.message);
    } else {
      setError("Unexpected streaming error");
    }
    setIsStreaming(false);
    finalizeLatency();
  }, [finalizeLatency]);

  const send = useCallback(
    async (overrideInput?: string) => {
      const text = (overrideInput ?? input).trim();
      if (!text || isStreaming) {
        return;
      }

      setError(null);
      setInput("");
      setLatencyMs(null);

      const userMessage = createUserMessage(text);
      setMessages((prev) => [...prev, userMessage]);
      lastUserMessageRef.current = text;

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      latencyStartRef.current = performance.now();

      const history = [...messages, userMessage].slice(-HISTORY_LIMIT);
      const payload: SendPayload = {
        messages: history.map(({ role, content }) => ({
          role,
          content,
        })),
        model: settingsWithDefaults.model,
        temperature: settingsWithDefaults.temperature,
      };

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const message =
            (await safeParseError(response)) ??
            `Request failed with status ${response.status}`;
          throw new Error(message);
        }

        const decoder = new TextDecoder();
        const assistantMessage = createAssistantMessage();
        streamingMessageIdRef.current = assistantMessage.id;
        appendMessage(assistantMessage);

        const reader = response.body.getReader();
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value && streamingMessageIdRef.current) {
            const textChunk = decoder.decode(value, { stream: !readerDone });
            if (textChunk) {
              updateMessageContent(streamingMessageIdRef.current, (current) =>
                current + textChunk,
              );
            }
          }
        }

        if (streamingMessageIdRef.current) {
          const trailing = decoder.decode(new Uint8Array(), { stream: false });
          if (trailing) {
            updateMessageContent(streamingMessageIdRef.current, (current) =>
              current + trailing,
            );
          }
        }

        finalizeLatency();
      } catch (err) {
        handleStreamError(err);
      } finally {
        resetController();
        setIsStreaming(false);
      }
    },
    [
      appendMessage,
      finalizeLatency,
      handleStreamError,
      input,
      isStreaming,
      messages,
      resetController,
      settingsWithDefaults.model,
      settingsWithDefaults.temperature,
      updateMessageContent,
    ],
  );

  const cancel = useCallback(() => {
    resetController();
    setIsStreaming(false);
  }, [resetController]);

  const retryLast = useCallback(() => {
    if (lastUserMessageRef.current) {
      void send(lastUserMessageRef.current);
    }
  }, [send]);

  const clear = useCallback(() => {
    resetController();
    const baseline = cloneMessages(initialMessages);
    initialSnapshotRef.current = baseline;
    setMessages(baseline);
    setError(null);
    setLatencyMs(null);
    setInput("");
    if (typeof window !== "undefined") {
      clearMessages();
    }
  }, [resetController]);

  return {
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
  };
}

function createUserMessage(content: string): ChatMessage {
  return {
    id: `user-${crypto.randomUUID()}`,
    role: "user",
    content,
    createdAt: Date.now(),
  };
}

function createAssistantMessage(): ChatMessage {
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: "assistant",
    content: "",
    createdAt: Date.now(),
  };
}

type ErrorResponse = { error?: string } | string;

async function safeParseError(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    if (!text) return null;

    const data: ErrorResponse = JSON.parse(text);
    if (typeof data === "string") return data;
    if (data && typeof data === "object" && "error" in data && data.error) {
      return data.error;
    }
    return text;
  } catch (error) {
    return (error as Error).message;
  }
}

function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({ ...message }));
}

function isDefaultMessageSet(messages: ChatMessage[]): boolean {
  if (messages.length === 0) return true;
  if (messages.length === 1) {
    const [message] = messages;
    return message.id === SYSTEM_GREETING.id && message.role === "system";
  }
  return false;
}
