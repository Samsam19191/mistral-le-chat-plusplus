'use client';

import React, { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button";
import { toCSV, downloadFile } from "@/lib/export";

interface EvalResult {
  id: string;
  latencyMs: number;
  pass: boolean;
  outputSnippet: string;
  tokensUsed?: number;
}

interface EvalSummary {
  count: number;
  passRate: number;
  p50: number;
  p95: number;
  avgTokens?: number;
  totalTokens?: number;
}

interface EvalResponse {
  mode: "mock" | "real";
  model: string;
  count: number;
  resultsA: EvalResult[];
  resultsB?: EvalResult[];
  summary: {
    A: EvalSummary;
    B?: EvalSummary;
  };
}

interface ConfigResponse {
  model: string;
  mode: "mock" | "real";
}

export default function EvalPage() {
  const [dataset, setDataset] = useState("sanity");
  const [promptA, setPromptA] = useState("You are a helpful assistant.");
  const [promptB, setPromptB] = useState("");
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<EvalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/chat/config");
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch (err) {
        console.error("Failed to load config:", err);
      }
    }
    loadConfig();
  }, []);

  const runEvaluation = useCallback(async () => {
    if (!dataset.trim()) return;

    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      const payload = {
        dataset,
        promptA: promptA.trim() || undefined,
        promptB: promptB.trim() || undefined,
      };

      const response = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Evaluation failed");
      }

      const data: EvalResponse = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  }, [dataset, promptA, promptB]);

  const exportCSV = useCallback(() => {
    if (!results) return;

    // Prepare detailed rows
    const detailedRows = [
      ...results.resultsA.map((r) => ({
        Set: "A",
        ID: r.id,
        Pass: r.pass,
        LatencyMs: r.latencyMs,
        TokensUsed: r.tokensUsed || "",
        OutputSnippet: r.outputSnippet,
      })),
      ...(results.resultsB || []).map((r) => ({
        Set: "B", 
        ID: r.id,
        Pass: r.pass,
        LatencyMs: r.latencyMs,
        TokensUsed: r.tokensUsed || "",
        OutputSnippet: r.outputSnippet,
      })),
    ];

    // Prepare summary rows
    const summaryRows = [
      {
        Set: "A",
        Count: results.summary.A.count,
        PassRate: results.summary.A.passRate,
        P50: results.summary.A.p50,
        P95: results.summary.A.p95,
        AvgTokens: results.summary.A.avgTokens || "",
        TotalTokens: results.summary.A.totalTokens || "",
      },
      ...(results.summary.B ? [{
        Set: "B",
        Count: results.summary.B.count,
        PassRate: results.summary.B.passRate,
        P50: results.summary.B.p50,
        P95: results.summary.B.p95,
        AvgTokens: results.summary.B.avgTokens || "",
        TotalTokens: results.summary.B.totalTokens || "",
      }] : []),
    ];

    const detailedCSV = toCSV(detailedRows);
    const summaryCSV = toCSV(summaryRows);
    
    // Combine both sections
    const combinedCSV = `Summary\n${summaryCSV}\n\nDetailed Results\n${detailedCSV}`;
    
    downloadFile(`eval-${dataset}-${Date.now()}.csv`, "text/csv", combinedCSV);
  }, [results, dataset]);

  const exportJSON = useCallback(() => {
    if (!results) return;

    const jsonContent = JSON.stringify(results, null, 2);
    downloadFile(`eval-${dataset}-${Date.now()}.json`, "application/json", jsonContent);
  }, [results, dataset]);

  const formatLatency = (ms: number) => {
    return isNaN(ms) ? "—" : `${Math.round(ms)}ms`;
  };

  const formatPassRate = (rate: number) => {
    return isNaN(rate) ? "—" : `${Math.round(rate * 100)}%`;
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          Evaluation Dashboard
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Run evaluations against datasets and compare prompt performance.
        </p>
      </header>

      {/* Controls */}
      <section className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Dataset
            </label>
            <select
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              disabled={isRunning}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="sanity">sanity</option>
            </select>
          </div>

          <div className="flex gap-4">
            {config && (
              <>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Model
                  </label>
                  <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {config.model}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Mode
                  </label>
                  <div className={`rounded-md px-3 py-2 text-sm font-medium ${
                    config.mode === "mock" 
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  }`}>
                    {config.mode.toUpperCase()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Prompt A
            </label>
            <textarea
              value={promptA}
              onChange={(e) => setPromptA(e.target.value)}
              disabled={isRunning}
              placeholder="System prompt for variant A..."
              rows={4}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Prompt B (Optional)
            </label>
            <textarea
              value={promptB}
              onChange={(e) => setPromptB(e.target.value)}
              disabled={isRunning}
              placeholder="System prompt for variant B..."
              rows={4}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            onClick={runEvaluation} 
            disabled={isRunning || !dataset.trim()}
          >
            {isRunning ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running...
              </>
            ) : (
              "Run Eval"
            )}
          </Button>
          
          {results && (
            <div className="flex gap-2">
              <Button 
                onClick={exportCSV}
                className="border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Export CSV
              </Button>
              <Button 
                onClick={exportJSON}
                className="border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Export JSON
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/50 dark:text-red-200">
            {error}
          </div>
        )}
      </section>

      {/* Results */}
      {results && (
        <section className="space-y-6">
          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Prompt A Card */}
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Prompt A Results
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {results.summary.A.count}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">Count</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {formatPassRate(results.summary.A.passRate)}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">Pass Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {formatLatency(results.summary.A.p50)}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">P50 Latency</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {formatLatency(results.summary.A.p95)}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">P95 Latency</div>
                </div>
                {results.summary.A.avgTokens !== undefined && (
                  <div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {Math.round(results.summary.A.avgTokens)}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Avg Tokens</div>
                  </div>
                )}
                {results.summary.A.totalTokens !== undefined && (
                  <div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {results.summary.A.totalTokens.toLocaleString()}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Total Tokens</div>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt B Card */}
            {results.summary.B && (
              <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Prompt B Results
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {results.summary.B.count}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Count</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {formatPassRate(results.summary.B.passRate)}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Pass Rate</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {formatLatency(results.summary.B.p50)}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">P50 Latency</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {formatLatency(results.summary.B.p95)}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">P95 Latency</div>
                  </div>
                  {results.summary.B.avgTokens !== undefined && (
                    <div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {Math.round(results.summary.B.avgTokens)}
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">Avg Tokens</div>
                    </div>
                  )}
                  {results.summary.B.totalTokens !== undefined && (
                    <div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {results.summary.B.totalTokens.toLocaleString()}
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">Total Tokens</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Diff Row */}
          {results.summary.B && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Comparison (B - A)
              </h4>
              <div className="flex gap-8 flex-wrap">
                <div>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    ΔPass Rate: {formatPassRate(results.summary.B.passRate - results.summary.A.passRate)}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    ΔP95: {formatLatency(results.summary.B.p95 - results.summary.A.p95)}
                  </span>
                </div>
                {results.summary.B.avgTokens !== undefined && results.summary.A.avgTokens !== undefined && (
                  <div>
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      ΔAvg Tokens: {Math.round(results.summary.B.avgTokens - results.summary.A.avgTokens)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Tables */}
          <div className="grid gap-6 md:grid-cols-1">
            {/* Prompt A Table */}
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Prompt A Details
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">ID</th>
                      <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Pass</th>
                      <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Latency</th>
                      <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Tokens</th>
                      <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {results.resultsA.map((result) => (
                      <tr key={result.id}>
                        <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">{result.id}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            result.pass 
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}>
                            {result.pass ? "Pass" : "Fail"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                          {formatLatency(result.latencyMs)}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                          {result.tokensUsed ? result.tokensUsed.toLocaleString() : "—"}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                          {result.outputSnippet}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Prompt B Table */}
            {results.resultsB && (
              <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Prompt B Details
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">ID</th>
                        <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Pass</th>
                        <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Latency</th>
                        <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Tokens</th>
                        <th className="px-6 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Output</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {results.resultsB.map((result) => (
                        <tr key={result.id}>
                          <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">{result.id}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              result.pass 
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}>
                              {result.pass ? "Pass" : "Fail"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                            {formatLatency(result.latencyMs)}
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                            {result.tokensUsed ? result.tokensUsed.toLocaleString() : "—"}
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                            {result.outputSnippet}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}