import { NextRequest, NextResponse } from "next/server";
import { listEvents } from "@/lib/services/timeline/timelineService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const events = await listEvents({
      type:     searchParams.get("type")     ?? undefined,
      search:   searchParams.get("search")   ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo:   searchParams.get("dateTo")   ?? undefined,
      order:    (searchParams.get("order") as "asc" | "desc") || "desc",
    });

    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/timeline] Failed:", message);
    return NextResponse.json({ error: "Failed to load timeline." }, { status: 500 });
  }
}
