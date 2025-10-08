// Runtime environment validation ensures only safe values are exposed.

import { z } from "zod";

export const envSchema = z
  .object({
    NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Le Chat++"),
    USE_MOCK: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    MISTRAL_MODEL: z
      .string()
      .min(1)
      .default("mistral-small-latest"),
    TEMPERATURE_DEFAULT: z
      .string()
      .optional()
      .default("0.2")
      .transform((value) => parseFloat(value))
      .refine((value) => !isNaN(value), {
        message: "TEMPERATURE_DEFAULT must be a number",
      })
      .refine((value) => value >= 0 && value <= 2, {
        message: "TEMPERATURE_DEFAULT must be between 0 and 2",
      }),
    MISTRAL_API_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.USE_MOCK && (!data.MISTRAL_API_KEY || data.MISTRAL_API_KEY.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MISTRAL_API_KEY is required when USE_MOCK is false",
        path: ["MISTRAL_API_KEY"],
      });
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;

function readEnv(): ServerEnv {
  const parsed = envSchema.safeParse({
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    MISTRAL_MODEL: process.env.MISTRAL_MODEL,
    TEMPERATURE_DEFAULT: process.env.TEMPERATURE_DEFAULT,
    USE_MOCK: process.env.USE_MOCK,
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    throw new Error(
      `Invalid environment variables: ${JSON.stringify({
        fieldErrors: flattened.fieldErrors,
        formErrors: flattened.formErrors,
      })}`,
    );
  }

  return parsed.data;
}

export function isMock(): boolean {
  return getServerEnv().USE_MOCK;
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() should only be called on the server.");
  }

  return readEnv();
}
