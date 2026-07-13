import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeEntry } from "@/lib/services/knowledge/knowledgeService";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await getKnowledgeEntry(id);
    if (!entry) {
      return NextResponse.json({ error: "Knowledge entry not found." }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/knowledge/[id]] Failed:", message);
    return NextResponse.json({ error: "Failed to load entry." }, { status: 500 });
  }
}
