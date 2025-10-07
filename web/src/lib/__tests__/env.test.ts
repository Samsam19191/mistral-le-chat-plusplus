import { describe, expect, it, vi } from "vitest";
import { envSchema } from "../env";

describe("env parsing", () => {
  it("treats USE_MOCK=true as mock mode", () => {
    const result = envSchema.safeParse({
      USE_MOCK: "true",
      NEXT_PUBLIC_APP_NAME: "Example",
      MISTRAL_MODEL: "test-model",
      TEMPERATURE_DEFAULT: "0.4",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.USE_MOCK).toBe(true);
    }
  });

  it("requires API key when USE_MOCK=false", () => {
    const result = envSchema.safeParse({
      USE_MOCK: "false",
      NEXT_PUBLIC_APP_NAME: "Example",
      MISTRAL_MODEL: "test-model",
      TEMPERATURE_DEFAULT: "0.3",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message =
        result.error.flatten().fieldErrors.MISTRAL_API_KEY?.[0] ?? "";
      expect(message).toMatch(/MISTRAL_API_KEY/);
    }
  });
});
