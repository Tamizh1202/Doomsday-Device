import { NextRequest, NextResponse } from "next/server";
import { getRelatedDocuments } from "@/lib/services/embeddings/similarityService";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const related = await getRelatedDocuments(id);
  return NextResponse.json({ related });
}
