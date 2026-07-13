import { NextResponse } from "next/server";
import { getPipelineHealth } from "@/lib/services/timeline/timelineService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const health = await getPipelineHealth();
    return NextResponse.json({ health });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/timeline/health] Failed:", message);
    return NextResponse.json({ health: { completed: 0, failed: 0, retried: 0 } });
  }
}
