'use server';

// Runtime environment validation ensures only safe values are exposed.

import { z } from "zod";

const envSchema = z.object({
  MISTRAL_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Le Chat++"),
});

type ServerEnv = z.infer<typeof envSchema>;

let cachedEnv: ServerEnv | null = null;

function readEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse({
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${parsed.error.flatten().fieldErrors}`,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export const serverEnv = readEnv();

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() should only be called on the server.");
  }

  return readEnv();
}
