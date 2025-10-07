import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const encoder = new TextEncoder();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tokens = [
  "Streaming",
  "mock",
  "response",
  "for",
  "mistral",
  "le",
  "chat++",
  "integration",
  "preview.",
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = requestSchema.safeParse(body);
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
      try {
        for (const token of tokens) {
          controller.enqueue(encoder.encode(`data: ${token}\n\n`));
          await delay(150);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
