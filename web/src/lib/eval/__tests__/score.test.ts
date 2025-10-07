import { describe, expect, it } from "vitest";

import { normalize, containsAll, scoreContainsAll, computeStats } from "../score";

describe("normalize", () => {
  it("lowercases text", () => {
    expect(normalize("HELLO WORLD")).toBe("hello world");
  });

  it("trims whitespace", () => {
    expect(normalize("  hello world  ")).toBe("hello world");
  });

  it("collapses multiple spaces", () => {
    expect(normalize("hello    world")).toBe("hello world");
    expect(normalize("hello\n\tworld")).toBe("hello world");
  });
});

describe("containsAll", () => {
  it("returns true when all needles are found", () => {
    expect(containsAll("The Eiffel Tower is in Paris", ["Eiffel Tower", "Paris"])).toBe(true);
  });

  it("returns false when some needles are missing", () => {
    expect(containsAll("The Eiffel Tower is beautiful", ["Eiffel Tower", "Paris"])).toBe(false);
  });

  it("handles case insensitive matching", () => {
    expect(containsAll("HELLO WORLD", ["hello", "WORLD"])).toBe(true);
  });

  it("returns true for empty needles array", () => {
    expect(containsAll("any text", [])).toBe(true);
  });
});

describe("scoreContainsAll", () => {
  it("scores perfect match", () => {
    const result = scoreContainsAll("The answer is 4", ["answer", "4"]);
    expect(result).toEqual({ pass: true, hits: 2, total: 2 });
  });

  it("scores partial match", () => {
    const result = scoreContainsAll("The answer is 4", ["answer", "5"]);
    expect(result).toEqual({ pass: false, hits: 1, total: 2 });
  });

  it("scores no match", () => {
    const result = scoreContainsAll("Hello world", ["foo", "bar"]);
    expect(result).toEqual({ pass: false, hits: 0, total: 2 });
  });

  it("handles empty expectations", () => {
    const result = scoreContainsAll("Hello world", []);
    expect(result).toEqual({ pass: true, hits: 0, total: 0 });
  });
});

describe("computeStats", () => {
  it("computes stats for valid samples", () => {
    const samples = [
      { latencyMs: 100, pass: true },
      { latencyMs: 200, pass: false },
      { latencyMs: 300, pass: true },
      { latencyMs: 400, pass: true }
    ];
    
    const stats = computeStats(samples);
    expect(stats.count).toBe(4);
    expect(stats.passRate).toBe(0.75);
    expect(stats.p50).toBe(250); // median of [100, 200, 300, 400]
    expect(stats.p95).toBe(385); // 95th percentile
  });

  it("handles empty samples", () => {
    const stats = computeStats([]);
    expect(stats.count).toBe(0);
    expect(stats.passRate).toBeNaN();
    expect(stats.p50).toBeNaN();
    expect(stats.p95).toBeNaN();
  });

  it("handles single sample", () => {
    const samples = [{ latencyMs: 150, pass: true }];
    const stats = computeStats(samples);
    expect(stats.count).toBe(1);
    expect(stats.passRate).toBe(1.0);
    expect(stats.p50).toBe(150);
    expect(stats.p95).toBe(150);
  });

  it("computes correct percentiles for edge case", () => {
    const samples = [
      { latencyMs: 100, pass: true },
      { latencyMs: 200, pass: false }
    ];
    
    const stats = computeStats(samples);
    expect(stats.p50).toBe(150); // median
    expect(stats.p95).toBe(195); // 95th percentile
  });
});