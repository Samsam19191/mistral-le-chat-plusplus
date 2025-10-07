import { z } from "zod";

import { getServerEnv, isMock } from "@/lib/env";
import type { SendPayload } from "@/lib/types";
import { streamResponse as streamMock } from "@/lib/providers/mock";
import { streamResponse as streamMistral } from "@/lib/providers/mistral";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

const sendPayloadSchema = z.object({
  messages: z.array(messageSchema).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const ENABLE_DEV_RATELIMIT = true;
const RATE_LIMIT_TOKENS = 30;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

const tokenBuckets = new Map<
  string,
  { tokens: number; updatedAt: number }
>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = sendPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (ENABLE_DEV_RATELIMIT) {
    const clientKey =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for") ??
      "local";
    const now = Date.now();
    const bucket = tokenBuckets.get(clientKey);

    if (!bucket) {
      tokenBuckets.set(clientKey, {
        tokens: RATE_LIMIT_TOKENS - 1,
        updatedAt: now,
      });
    } else {
      const elapsed = now - bucket.updatedAt;
      if (elapsed > RATE_LIMIT_WINDOW_MS) {
        bucket.tokens = RATE_LIMIT_TOKENS - 1;
        bucket.updatedAt = now;
      } else if (bucket.tokens > 0) {
        bucket.tokens -= 1;
      } else {
        return Response.json({ error: "rate limit" }, { status: 429 });
      }
    }
  }

  const payload: SendPayload = {
    messages: parsed.data.messages,
    ...(parsed.data.model !== undefined && { model: parsed.data.model }),
    ...(parsed.data.temperature !== undefined && { temperature: parsed.data.temperature }),
  };
  const start = performance.now();

  let stream: ReadableStream<Uint8Array>;

  if (isMock()) {
    stream = await streamMock(payload);
  } else {
    const env = getServerEnv();
    if (!env.MISTRAL_API_KEY) {
      return Response.json(
        { error: "MISTRAL_API_KEY missing" },
        { status: 500 },
      );
    }
    stream = await streamMistral(payload, env.MISTRAL_API_KEY, env.MISTRAL_MODEL);
  }

  const responseTime = `${Math.max(0, Math.round(performance.now() - start))}ms`;

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Response-Time": responseTime,
    },
  });
}
