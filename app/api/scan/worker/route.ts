import { NextResponse } from "next/server";
import { drainPendingScans } from "@/lib/scan/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WORKER_TOKEN = process.env.SCAN_WORKER_TOKEN ?? "";

export async function POST(req: Request) {
  if (WORKER_TOKEN) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${WORKER_TOKEN}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const batch = clampInt(url.searchParams.get("batch"), 1, 50, 20);
  const concurrency = clampInt(url.searchParams.get("concurrency"), 1, 25, 10);

  const result = await drainPendingScans({ batch, concurrency });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return POST(req);
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
