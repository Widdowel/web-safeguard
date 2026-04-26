import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getQueueStats } from "@/lib/scan/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stats = await getQueueStats();
  return NextResponse.json(stats);
}
