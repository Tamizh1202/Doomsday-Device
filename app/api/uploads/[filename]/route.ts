import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "@/lib/services/knowledge/knowledgeService";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename || filename.includes("..")) {
      return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
    }

    const buffer = await readStoredFile(filename);

    // Derive a content-type from extension
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const contentTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
    };
    const contentType = contentTypeMap[ext] ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/uploads] Failed to serve file:", message);
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
