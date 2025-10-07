'use server';

import { getServerEnv } from "../env";
import type { SendPayload } from "../types";

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const encoder = new TextEncoder();

/**
 * Streams chat completions from Mistral's API, flattening the SSE payload to a plain text stream.
 */
export async function streamResponse(
  payload: SendPayload,
  apiKey: string,
  model: string,
): Promise<ReadableStream<Uint8Array>> {
  if (typeof window !== "undefined") {
    throw new Error("Mistral streaming must be invoked on the server");
  }

  const env = getServerEnv();
  const resolvedModel = payload.model ?? model ?? env.MISTRAL_MODEL;
  const temperature = payload.temperature ?? env.TEMPERATURE_DEFAULT;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = await globalThis.fetch(MISTRAL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: payload.messages,
            temperature,
            stream: true,
          }),
        });

        if (!response.ok || !response.body) {
          const errorText = await safeReadText(response);
          throw new Error(
            errorText || `Mistral streaming failed with status ${response.status}`,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;

          buffer += decoder.decode(value, { stream: true });
          buffer = processBuffer(buffer, controller);
        }

        // flush remaining buffer
        buffer += decoder.decode();
        processBuffer(buffer, controller);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function processBuffer(buffer: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  const lines = buffer.split("\n");
  let pending = lines.pop() ?? "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "data: [DONE]") {
      continue;
    }

    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (!payload) continue;

      try {
        const data = JSON.parse(payload);
        const chunk =
          data?.choices?.[0]?.delta?.content ??
          data?.choices?.[0]?.message?.content ??
          "";
        if (chunk) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        controller.error(
          new Error(
            `Failed to parse streaming chunk from Mistral: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    }
  }

  return pending;
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return null;
  }
}
