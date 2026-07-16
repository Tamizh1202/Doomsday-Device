import { NextRequest, NextResponse } from "next/server";
import { getFileUrl } from "@/lib/services/knowledge/knowledgeService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const storedPath = req.nextUrl.searchParams.get("path");
    if (!storedPath) {
      return NextResponse.json({ error: "path is required." }, { status: 400 });
    }

    // Local file — serve via /api/uploads
    if (!storedPath.startsWith("http")) {
      return NextResponse.json({ url: `/api/uploads/${storedPath}` });
    }

    const url = await getFileUrl(storedPath);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/file-url] Failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
