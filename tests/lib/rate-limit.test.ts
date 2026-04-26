import { describe, expect, test } from "vitest";
import { checkRateLimit } from "@/lib/ingest/rate-limit";

describe("checkRateLimit", () => {
  test("allows up to limit, then denies", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, 5, 60_000);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
    const denied = checkRateLimit(key, 5, 60_000);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  test("isolates by key", () => {
    const a = checkRateLimit(`a-${Math.random()}`, 1, 60_000);
    const b = checkRateLimit(`b-${Math.random()}`, 1, 60_000);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  test("resetAt is in the future", () => {
    const r = checkRateLimit(`t-${Math.random()}`, 5, 60_000);
    expect(r.resetAt).toBeGreaterThan(Date.now());
  });
});
