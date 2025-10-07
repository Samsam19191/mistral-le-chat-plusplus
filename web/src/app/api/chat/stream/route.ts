import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

const sendPayloadSchema = z.object({
  messages: z.array(messageSchema).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const encoder = new TextEncoder();

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const chunks = [
  "Streaming mock response",
  "for the Mistral",
  "Le Chat++ preview.",
  "This endpoint",
  "simulates latency",
  "with placeholder tokens",
  "so the UI can",
  "render incremental text.",
];

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

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`${chunk} `));
        await delay(randomDelay());
      }
      controller.enqueue(encoder.encode("\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

function randomDelay(): number {
  return 100 + Math.floor(Math.random() * 150);
}
