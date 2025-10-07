import React, { createRef, forwardRef, useImperativeHandle } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChat } from "../useChat";
import type { ChatMessage } from "../../types";

type ChatHandle = ReturnType<typeof useChat>;

const TEST_DEFAULTS = { model: "test-model", temperature: 0.4 };

const ChatHarness = forwardRef<ChatHandle>((_, ref) => {
  const chat = useChat({
    initialMessages: [],
    defaults: TEST_DEFAULTS,
  });

  useImperativeHandle(ref, () => chat, [chat]);

  return (
    <div>
      <input
        data-testid="input"
        value={chat.input}
        onChange={(event) => chat.setInput(event.target.value)}
      />
      <button data-testid="send" onClick={() => void chat.send()}>
        send
      </button>
      <button data-testid="cancel" onClick={() => chat.cancel()}>
        cancel
      </button>
      <button data-testid="retry" onClick={() => chat.retryLast()}>
        retry
      </button>
      <button data-testid="clear" onClick={() => chat.clear()}>
        clear
      </button>
    </div>
  );
});

ChatHarness.displayName = "ChatHarness";

const encoder = new TextEncoder();
let fetchSpy: any;
let uuidSpy: any;

describe("useChat", () => {
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(() =>
      Promise.reject(new Error("fetch mock not configured")),
    );
    let counter = 0;
    uuidSpy = vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      return `uuid-${counter++}`;
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    uuidSpy.mockRestore();
  });

  it("streams assistant responses after sending a message", async () => {
    setupStreamResponse(["Hello ", "world", "!"]);

    const ref = createRef<ChatHandle>();
    render(<ChatHarness ref={ref} />);

    fireEvent.change(screen.getByTestId("input"), {
      target: { value: "Hello there" },
    });
    fireEvent.click(screen.getByTestId("send"));

    await waitFor(() => expect(ref.current?.isStreaming).toBe(true));
    await waitFor(() =>
      expect(latestAssistant(ref.current?.messages)?.content).toContain("Hello"),
    );

    await waitFor(() => expect(ref.current?.isStreaming).toBe(false));

    const messages = ref.current?.messages ?? [];
    expect(messages).toHaveLength(2);

    const [userMessage, assistantMessage] = messages as [ChatMessage, ChatMessage];
    expect(userMessage.role).toBe("user");
    expect(userMessage.content).toBe("Hello there");
    expect(assistantMessage.role).toBe("assistant");
    expect(normalize(assistantMessage.content)).toBe("Hello world!");
  });

  it("cancels streaming and retains partial assistant output", async () => {
    setupStreamResponse(["Partial ", "additional ", "tokens"], {
      delayMs: 20,
    });

    const ref = createRef<ChatHandle>();
    render(<ChatHarness ref={ref} />);

    fireEvent.change(screen.getByTestId("input"), {
      target: { value: "Test cancel" },
    });
    fireEvent.click(screen.getByTestId("send"));

    await waitFor(() =>
      expect((latestAssistant(ref.current?.messages)?.content ?? "").length).toBeGreaterThan(0),
    );

    const assistantBeforeCancel = latestAssistant(ref.current?.messages);
    if (!assistantBeforeCancel) {
      throw new Error("Expected assistant message before cancel");
    }
    expect(assistantBeforeCancel?.content).toContain("Partial");

    fireEvent.click(screen.getByTestId("cancel"));

    await waitFor(() => expect(ref.current?.isStreaming).toBe(false));

    const assistantAfterCancel = latestAssistant(ref.current?.messages);
    if (!assistantAfterCancel) {
      throw new Error("Expected assistant message after cancel");
    }
    expect(assistantAfterCancel.content.trim().startsWith("Partial")).toBe(true);
    expect(ref.current?.error).toBeNull();
  });

  it("retries the last message after cancellation", async () => {
    fetchSpy
      .mockImplementationOnce((_url: RequestInfo | URL, init?: RequestInit) =>
        createResponse(["Partial ", "extra"], init?.signal ?? undefined, {
          delayMs: 20,
        }),
      )
      .mockImplementationOnce((_url: RequestInfo | URL, init?: RequestInit) =>
        createResponse(["Full ", "response", "!"], init?.signal ?? undefined),
      );

    const ref = createRef<ChatHandle>();
    render(<ChatHarness ref={ref} />);

    fireEvent.change(screen.getByTestId("input"), {
      target: { value: "Retry message" },
    });
    fireEvent.click(screen.getByTestId("send"));

    await waitFor(() => expect(ref.current?.isStreaming).toBe(true));

    fireEvent.click(screen.getByTestId("cancel"));

    await waitFor(() => expect(ref.current?.isStreaming).toBe(false));

    const assistantAfterCancel = latestAssistant(ref.current?.messages);
    if (!assistantAfterCancel) {
      throw new Error("Expected assistant after cancellation");
    }
    expect(assistantAfterCancel.content.trim().startsWith("Partial")).toBe(true);

    fireEvent.click(screen.getByTestId("retry"));

    await waitFor(() => expect(ref.current?.isStreaming).toBe(false));

    const assistants = (ref.current?.messages ?? []).filter(
      (message) => message.role === "assistant",
    );
    expect(assistants).toHaveLength(2);
    const latest = assistants.at(-1);
    if (!latest) {
      throw new Error("Expected latest assistant message");
    }
    expect(normalize(latest.content)).toBe("Full response!");
  });

  it("sets an error when the API responds with a failure status", async () => {
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Bad request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const ref = createRef<ChatHandle>();
    render(<ChatHarness ref={ref} />);

    fireEvent.change(screen.getByTestId("input"), {
      target: { value: "Trigger error" },
    });
    fireEvent.click(screen.getByTestId("send"));

    await waitFor(() => expect(ref.current?.isStreaming).toBe(false));
    expect(ref.current?.error).toBe("Bad request");
    expect(ref.current?.messages.map((m) => m.role)).toEqual(["user"]);
  });
});

interface StreamOptions {
  closeAfterChunks?: number;
  delayMs?: number;
}

function setupStreamResponse(chunks: string[], options: StreamOptions = {}) {
  fetchSpy.mockImplementation((_url: any, init?: any) =>
    createResponse(chunks, init?.signal ?? undefined, options),
  );
}

function createResponse(
  chunks: string[],
  signal: AbortSignal | undefined,
  options: StreamOptions = {},
) {
  const { closeAfterChunks, delayMs = 0 } = options;
  let dispatched = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const push = async (): Promise<void> => {
        if (signal?.aborted) {
          controller.close();
          return;
        }

        if (closeAfterChunks != null && dispatched >= closeAfterChunks) {
          controller.close();
          return;
        }

        if (dispatched >= chunks.length) {
          controller.enqueue(encoder.encode("\n"));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(chunks[dispatched] ?? ""));
        dispatched += 1;

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (signal?.aborted) {
            controller.close();
            return;
          }
        }

        await push();
      };

      signal?.addEventListener("abort", () => {
        controller.close();
      });

      await push();
    },
  });

  return Promise.resolve(
    new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
  );
}

function latestAssistant(messages: ChatMessage[] | undefined) {
  if (!messages) return undefined;
  return [...messages].reverse().find((message) => message.role === "assistant");
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
