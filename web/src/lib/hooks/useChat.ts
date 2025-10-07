import { useCallback, useMemo, useRef, useState } from "react";

import {
  defaultStreamSettings,
  type ChatMessage,
  type StreamSettings,
  type SendPayload,
} from "../types";

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
}

// TODO: integrate token usage tracking once backend supports it.
export function useChat({
  initialMessages = [SYSTEM_GREETING],
  settings,
}: UseChatOptions = {}) {
  const settingsWithDefaults = useMemo<StreamSettings>(
    () => ({
      ...defaultStreamSettings,
      ...settings,
    }),
    [settings],
  );

  const initialSnapshotRef = useRef<ChatMessage[]>(
    cloneMessages(initialMessages),
  );
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialSnapshotRef.current,
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

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
    setMessages(cloneMessages(initialSnapshotRef.current));
    setError(null);
    setLatencyMs(null);
    setInput("");
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
