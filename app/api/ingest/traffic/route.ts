import { NextResponse } from "next/server";
import { authenticateIngestToken, extractBearerToken } from "@/lib/ingest/auth";
import { parseNdjson } from "@/lib/ingest/parse";
import { persistTrafficBatch } from "@/lib/ingest/persist";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ingest/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_LINES_PER_BATCH = 5_000;
const RATE_LIMIT_PER_MIN = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const rawToken = extractBearerToken(req.headers);
  if (!rawToken) {
    return NextResponse.json(
      { error: "missing_authorization", hint: "Authorization: Bearer <token>" },
      { status: 401 },
    );
  }

  const token = await authenticateIngestToken(rawToken);
  if (!token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const limitResult = checkRateLimit(`ingest:${token.tokenId}`, RATE_LIMIT_PER_MIN, RATE_LIMIT_WINDOW_MS);
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAt: limitResult.resetAt },
      { status: 429, headers: rateLimitHeaders(limitResult, RATE_LIMIT_PER_MIN) },
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large", max: MAX_BODY_BYTES }, { status: 413 });
  }

  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large", max: MAX_BODY_BYTES }, { status: 413 });
  }

  const parsed = parseNdjson(body);
  if (parsed.length > MAX_LINES_PER_BATCH) {
    return NextResponse.json(
      { error: "batch_too_large", max: MAX_LINES_PER_BATCH },
      { status: 413, headers: rateLimitHeaders(limitResult, RATE_LIMIT_PER_MIN) },
    );
  }

  const errors = parsed.filter((p) => !p.ok) as Array<Extract<(typeof parsed)[number], { ok: false }>>;
  const valid = parsed.filter((p) => p.ok) as Array<Extract<(typeof parsed)[number], { ok: true }>>;

  const result = await persistTrafficBatch(valid.map((v) => v.event), token.sourceId);

  return NextResponse.json(
    {
      received: parsed.length,
      inserted: result.inserted,
      duplicates: result.duplicates,
      errors: errors.map((e) => ({ line: e.lineNo, error: e.error })),
      source: token.sourceName,
    },
    {
      status: errors.length === 0 ? 200 : 207,
      headers: rateLimitHeaders(limitResult, RATE_LIMIT_PER_MIN),
    },
  );
}

export function GET() {
  return NextResponse.json(
    {
      endpoint: "POST /api/ingest/traffic",
      content_type: "application/x-ndjson",
      max_lines_per_batch: MAX_LINES_PER_BATCH,
      rate_limit_per_minute: RATE_LIMIT_PER_MIN,
      schema: {
        ts: "ISO 8601 datetime",
        src_ip_hash: "hex string (HMAC-SHA256)",
        dst_domain: "lowercase domain",
        dst_ip: "IPv4 or IPv6 (optional)",
        bytes: "non-negative integer",
        country_iso: "ISO 3166-1 alpha-2",
      },
    },
    { status: 200 },
  );
}
