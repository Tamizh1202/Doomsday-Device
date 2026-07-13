import { NextResponse } from "next/server";
import { listKnowledgeEntries } from "@/lib/services/knowledge/knowledgeService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const entries = await listKnowledgeEntries();
    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/knowledge] Failed to list entries:", message);
    return NextResponse.json({ error: "Failed to load knowledge base." }, { status: 500 });
  }
}
