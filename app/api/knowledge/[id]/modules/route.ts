import { NextRequest, NextResponse } from "next/server";
import { getModulesForEntry } from "@/lib/services/modules/moduleService";
import { runModuleAssignment } from "@/lib/services/modules/moduleAssignmentService";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const modules = await getModulesForEntry(id);
  return NextResponse.json({ modules });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id },
    select: { masterTranscript: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  runModuleAssignment(id, entry.masterTranscript).catch(console.error);
  return NextResponse.json({ status: "triggered" });
}
