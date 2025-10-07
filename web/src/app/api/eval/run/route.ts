import { NextRequest } from "next/server";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";

import { getServerEnv, isMock } from "@/lib/env";
import type { SendPayload, ChatMessage } from "@/lib/types";
import { streamResponse as streamMock } from "@/lib/providers/mock";
import { streamResponse as streamMistral, streamResponseWithUsage as streamMistralWithUsage } from "@/lib/providers/mistral";
import { scoreContainsAll, computeStats } from "@/lib/eval/score";

const requestSchema = z.object({
  dataset: z.string(),
  promptA: z.string().optional(),
  promptB: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const datasetItemSchema = z.object({
  id: z.string(),
  user: z.string(),
  expect_contains: z.array(z.string()),
});

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

// Simple concurrency limiter
class ConcurrencyLimiter {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;

  constructor(private limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.running++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.running < this.limit && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}

const limiter = new ConcurrencyLimiter(3);

async function loadDataset(datasetName: string) {
  const datasetPath = path.join(process.cwd(), "..", "datasets", `${datasetName}.jsonl`);
  
  try {
    const content = await readFile(datasetPath, "utf-8");
    const lines = content.trim().split("\n");
    const items = lines.map(line => {
      const parsed = JSON.parse(line);
      return datasetItemSchema.parse(parsed);
    });
    return items;
  } catch (error) {
    throw new Error(`Failed to load dataset ${datasetName}: ${error}`);
  }
}

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode(); // flush
    return result;
  } finally {
    reader.releaseLock();
  }
}

async function runEvaluation(
  item: z.infer<typeof datasetItemSchema>,
  systemPrompt: string | undefined,
  model: string | undefined,
  temperature: number | undefined
): Promise<EvalResult> {
  const messages: Array<Pick<ChatMessage, "role" | "content">> = [];
  
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  messages.push({
    role: "user", 
    content: item.user,
  });

  const payload: SendPayload = {
    messages,
    ...(model && { model }),
    ...(temperature !== undefined && { temperature }),
  };

  const start = performance.now();
  
  let output: string;
  let tokensUsed: number | undefined;
  
  if (isMock()) {
    const stream = await streamMock(payload);
    output = await streamToString(stream);
  } else {
    const env = getServerEnv();
    if (!env.MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY missing");
    }
    const result = await streamMistralWithUsage(payload, env.MISTRAL_API_KEY, env.MISTRAL_MODEL);
    output = await streamToString(result.stream);
    const usage = await result.getUsage();
    tokensUsed = usage.totalTokens;
  }

  const latencyMs = performance.now() - start;
  const score = scoreContainsAll(output, item.expect_contains);
  
  // Create snippet (first 100 chars)
  const outputSnippet = output.length > 100 ? output.slice(0, 100) + "..." : output;

  return {
    id: item.id,
    latencyMs,
    pass: score.pass,
    outputSnippet,
    ...(tokensUsed !== undefined && { tokensUsed }),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { dataset, promptA, promptB, model, temperature } = parsed.data;

    // Load dataset
    const items = await loadDataset(dataset);
    
    // Run evaluation for prompt A
    const resultsA: EvalResult[] = [];
    
    for (const item of items) {
      const result = await limiter.run(() => 
        runEvaluation(item, promptA, model, temperature)
      );
      resultsA.push(result);
    }

    // Run evaluation for prompt B if provided
    let resultsB: EvalResult[] | undefined;
    if (promptB) {
      resultsB = [];
      for (const item of items) {
        const result = await limiter.run(() => 
          runEvaluation(item, promptB, model, temperature)
        );
        resultsB.push(result);
      }
    }

    // Compute summaries
    const summaryA = computeStats(
      resultsA.map(r => ({ 
        latencyMs: r.latencyMs, 
        pass: r.pass, 
        ...(r.tokensUsed !== undefined && { tokensUsed: r.tokensUsed })
      }))
    );

    const summaryB = resultsB ? computeStats(
      resultsB.map(r => ({ 
        latencyMs: r.latencyMs, 
        pass: r.pass, 
        ...(r.tokensUsed !== undefined && { tokensUsed: r.tokensUsed })
      }))
    ) : undefined;

    const response = {
      mode: isMock() ? "mock" as const : "real" as const,
      model: model || (isMock() ? "mock-model" : getServerEnv().MISTRAL_MODEL),
      count: items.length,
      resultsA,
      ...(resultsB && { resultsB }),
      summary: {
        A: summaryA,
        ...(summaryB && { B: summaryB }),
      },
    };

    return Response.json(response);

  } catch (error) {
    console.error("Evaluation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}