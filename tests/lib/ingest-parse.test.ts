import { describe, expect, test, vi } from "vitest";

vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("AUTH_SECRET", "x".repeat(32));

import { parseNdjson } from "@/lib/ingest/parse";

describe("parseNdjson", () => {
  test("parses valid lines", () => {
    const ndjson = [
      JSON.stringify({
        ts: "2026-04-26T12:00:00Z",
        src_ip_hash: "deadbeef".repeat(2),
        dst_domain: "example.com",
        dst_ip: "203.0.113.1",
        bytes: 1024,
        country_iso: "BJ",
      }),
      JSON.stringify({
        ts: "2026-04-26T12:01:00Z",
        src_ip_hash: "cafebabe".repeat(2),
        dst_domain: "example.org",
        bytes: 0,
        country_iso: "TG",
      }),
    ].join("\n");

    const results = parseNdjson(ndjson);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
    if (results[0].ok) {
      expect(results[0].event.dst_domain).toBe("example.com");
      expect(results[0].event.country_iso).toBe("BJ");
    }
  });

  test("skips empty lines", () => {
    const ndjson = `\n\n${JSON.stringify({
      ts: "2026-04-26T12:00:00Z",
      src_ip_hash: "deadbeef".repeat(2),
      dst_domain: "example.com",
      bytes: 100,
      country_iso: "BJ",
    })}\n\n`;

    const results = parseNdjson(ndjson);
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(true);
  });

  test("reports invalid JSON with line number", () => {
    const ndjson = "not-json\n{}";
    const results = parseNdjson(ndjson);
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(false);
    if (!results[0].ok) {
      expect(results[0].error).toContain("Invalid JSON");
      expect(results[0].lineNo).toBe(1);
    }
  });

  test("rejects invalid country_iso", () => {
    const ndjson = JSON.stringify({
      ts: "2026-04-26T12:00:00Z",
      src_ip_hash: "deadbeef".repeat(2),
      dst_domain: "example.com",
      bytes: 100,
      country_iso: "BENIN",
    });
    const results = parseNdjson(ndjson);
    expect(results[0].ok).toBe(false);
  });

  test("rejects invalid src_ip_hash (non-hex)", () => {
    const ndjson = JSON.stringify({
      ts: "2026-04-26T12:00:00Z",
      src_ip_hash: "not-hex-zzz",
      dst_domain: "example.com",
      bytes: 100,
      country_iso: "BJ",
    });
    const results = parseNdjson(ndjson);
    expect(results[0].ok).toBe(false);
  });

  test("normalizes domain to lowercase", () => {
    const ndjson = JSON.stringify({
      ts: "2026-04-26T12:00:00Z",
      src_ip_hash: "deadbeef".repeat(2),
      dst_domain: "EXAMPLE.com",
      bytes: 100,
      country_iso: "BJ",
    });
    const results = parseNdjson(ndjson);
    if (results[0].ok) {
      expect(results[0].event.dst_domain).toBe("example.com");
    }
  });
});
