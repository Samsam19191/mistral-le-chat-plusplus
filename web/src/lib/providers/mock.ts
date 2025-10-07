'use server';

import { type SendPayload } from "../types";

const encoder = new TextEncoder();

/**
 * Provides a deterministic mock streaming response for local development.
 * Converts a static token list into a timed text stream so the UI can exercise
 * its streaming behaviour without hitting the real API.
 */
export async function streamResponse(
  _payload: SendPayload,
): Promise<ReadableStream<Uint8Array>> {
  const tokens = [
    "Streaming",
    "mock",
    "response",
    "generated",
    "from",
    "local",
    "payload.",
    "Great",
    "for",
    "testing!",
  ];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const token of tokens) {
          controller.enqueue(encoder.encode(`${token} `));
          await delay(120);
        }
        controller.enqueue(encoder.encode("\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
