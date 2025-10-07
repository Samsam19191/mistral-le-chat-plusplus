'use client';

import React, { useCallback, useRef, useState } from "react";
import type { ButtonHTMLAttributes } from "react";

type LabRunRecord = {
  label: "A" | "B";
  systemPrompt: string;
  userPrompt: string;
  output: string;
  latencyMs: number | null;
  timestamp: string;
};

interface LabRunnerState {
  output: string;
  isStreaming: boolean;
  latencyMs: number | null;
  run: (systemPrompt: string, userPrompt: string) => Promise<void>;
  clear: () => void;
}

const decoder = new TextDecoder();

function useLabRunner(label: "A" | "B", onFinish: (record: LabRunRecord) => void): LabRunnerState {
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setOutput("");
    setIsStreaming(false);
    setLatencyMs(null);
  }, []);

  const run = useCallback(
    async (systemPrompt: string, userPrompt: string) => {
      if (!systemPrompt.trim() || !userPrompt.trim()) {
        return;
      }

      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setOutput("");
      setIsStreaming(true);
      setLatencyMs(null);

      const start = performance.now();
      let aggregated = "";
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const errorText = await response.text();
          throw new Error(errorText || `Run ${label} failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const textChunk = decoder.decode(value, { stream: !readerDone });
            if (textChunk) {
              aggregated += textChunk;
              setOutput(aggregated);
            }
          }
        }

        setOutput(aggregated);

        const elapsed = performance.now() - start;
        setLatencyMs(elapsed);
        const record: LabRunRecord = {
          label,
          systemPrompt,
          userPrompt,
          output: aggregated,
          latencyMs: elapsed,
          timestamp: new Date().toISOString(),
        };
        onFinish(record);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // ignore
        } else {
          const message = error instanceof Error ? error.message : String(error);
          setOutput((prev) => (prev ? `${prev}\n[error] ${message}` : `[error] ${message}`));
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [label, onFinish],
  );

  return {
    output,
    isStreaming,
    latencyMs,
    run,
    clear,
  };
}

export default function LabPage() {
  const [systemPromptA, setSystemPromptA] = useState("You are prompt A.");
  const [systemPromptB, setSystemPromptB] = useState("You are prompt B.");
  const [userPrompt, setUserPrompt] = useState("");
  const [records, setRecords] = useState<LabRunRecord[]>([]);

  const pushRecord = useCallback((record: LabRunRecord) => {
    setRecords((prev) => [...prev, record]);
  }, []);

  const runnerA = useLabRunner("A", pushRecord);
  const runnerB = useLabRunner("B", pushRecord);

  const runA = useCallback(() => {
    void runnerA.run(systemPromptA, userPrompt);
  }, [runnerA, systemPromptA, userPrompt]);

  const runB = useCallback(() => {
    void runnerB.run(systemPromptB, userPrompt);
  }, [runnerB, systemPromptB, userPrompt]);

  const runBoth = useCallback(() => {
    runA();
    runB();
  }, [runA, runB]);

  const clearAll = useCallback(() => {
    runnerA.clear();
    runnerB.clear();
    setUserPrompt("");
    setRecords([]);
  }, [runnerA, runnerB]);

  const exportJsonl = useCallback(() => {
    if (records.length === 0) return;
    const lines = records.map((record) =>
      JSON.stringify({
        promptLabel: record.label,
        systemPrompt: record.systemPrompt,
        user: record.userPrompt,
        output: record.output,
        latencyMs: record.latencyMs,
        timestamp: record.timestamp,
      }),
    );
    const blob = new Blob([lines.join("\n")], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lab-runs-${Date.now()}.jsonl`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [records]);

  const charCountA = runnerA.output.length;
  const charCountB = runnerB.output.length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Prompt Lab</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Compare two system prompts against the same user input. Runs hit the same streaming endpoint as the main chat.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">System Prompt A</span>
          <textarea
            value={systemPromptA}
            onChange={(event) => setSystemPromptA(event.target.value)}
            rows={6}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Describe system prompt A here..."
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">System Prompt B</span>
          <textarea
            value={systemPromptB}
            onChange={(event) => setSystemPromptB(event.target.value)}
            rows={6}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Describe system prompt B here..."
          />
        </label>
      </section>

      <section className="space-y-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">User Input</span>
          <textarea
            value={userPrompt}
            onChange={(event) => setUserPrompt(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="User message to test with both prompts..."
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button disabled={!userPrompt.trim()} onClick={runA}>
            Run A
          </Button>
          <Button disabled={!userPrompt.trim()} onClick={runB}>
            Run B
          </Button>
          <Button disabled={!userPrompt.trim()} onClick={runBoth}>
            Run Both
          </Button>
          <Button variant="outline" onClick={clearAll}>
            Clear
          </Button>
          <Button variant="ghost" onClick={exportJsonl} disabled={records.length === 0}>
            Export JSONL
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ResultCard
          label="A"
          output={runnerA.output}
          isStreaming={runnerA.isStreaming}
          latencyMs={runnerA.latencyMs}
          charCount={charCountA}
        />
        <ResultCard
          label="B"
          output={runnerB.output}
          isStreaming={runnerB.isStreaming}
          latencyMs={runnerB.latencyMs}
          charCount={charCountB}
        />
      </section>
    </main>
  );
}

interface ResultCardProps {
  label: "A" | "B";
  output: string;
  isStreaming: boolean;
  latencyMs: number | null;
  charCount: number;
}

function ResultCard({ label, output, isStreaming, latencyMs, charCount }: ResultCardProps) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Prompt {label}</span>
        <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {isStreaming ? "Streaming…" : "Idle"}
        </span>
      </header>
      <dl className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-1">
          <dt className="font-semibold text-zinc-700 dark:text-zinc-300">Latency:</dt>
          <dd>{latencyMs != null ? `${Math.round(latencyMs)} ms` : "—"}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="font-semibold text-zinc-700 dark:text-zinc-300">Chars:</dt>
          <dd>{charCount}</dd>
        </div>
      </dl>
      <div className="min-h-[160px] flex-1 rounded-md border border-zinc-200 bg-white/70 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200">
        {output ? output : <span className="text-zinc-400 dark:text-zinc-500">Awaiting output…</span>}
        {isStreaming ? <span className="ml-1 inline-block animate-pulse">▌</span> : null}
      </div>
    </article>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

function Button({ variant = "default", className = "", type = "button", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60";
  const variants: Record<string, string> = {
    default:
      "border-transparent bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
    outline:
      "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
    ghost:
      "border-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
  };
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
