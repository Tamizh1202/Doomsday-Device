import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Both local files and private blobs are served through /api/uploads, which proxies the bytes server-side. */
export async function GET(req: NextRequest) {
  const storedPath = req.nextUrl.searchParams.get("path");
  if (!storedPath) {
    return NextResponse.json({ error: "path is required." }, { status: 400 });
  }
  return NextResponse.json({ url: `/api/uploads/${encodeURIComponent(storedPath)}` });
}
