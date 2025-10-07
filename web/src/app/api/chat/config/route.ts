'use server';

import { getServerEnv, isMock } from "@/lib/env";

export async function GET() {
  const env = getServerEnv();

  return Response.json({
    model: env.MISTRAL_MODEL,
    temperature: env.TEMPERATURE_DEFAULT,
    mock: isMock(),
  });
}
