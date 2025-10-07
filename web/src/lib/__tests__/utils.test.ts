import { describe, expect, it } from "vitest";

import { formatGreeting } from "../utils";

describe("formatGreeting", () => {
  it("returns a personalized greeting", () => {
    expect(formatGreeting("Mistral")).toBe("Hello, Mistral!");
  });
});
