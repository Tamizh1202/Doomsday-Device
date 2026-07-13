import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeEntry } from "@/lib/services/knowledge/knowledgeService";
import { runExtraction, getExtraction } from "@/lib/services/knowledge/extractionService";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET — return the current extraction record for an entry */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const extraction = await getExtraction(id);
    return NextResponse.json({ extraction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — retry a failed or missing extraction */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const entry = await getKnowledgeEntry(id);
    if (!entry) {
      return NextResponse.json({ error: "Knowledge entry not found." }, { status: 404 });
    }

    console.log(`[API] Retrying extraction for entry: ${id}`);
    const extraction = await runExtraction(id, entry.masterTranscript);
    return NextResponse.json({ extraction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[API] Retry extraction failed for ${id}:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
