import { NextRequest, NextResponse } from "next/server";
import { processDocument } from "@/lib/documentProcessor/documentProcessor";
import { saveFile, createKnowledgeEntry } from "@/lib/services/knowledge/knowledgeService";
import { runExtraction } from "@/lib/services/knowledge/extractionService";
import { runModuleAssignment } from "@/lib/services/modules/moduleAssignmentService";
import { computeAndStoreRelated } from "@/lib/services/embeddings/similarityService";
import { prisma } from "@/lib/database/prisma";
import { createEvent, TimelineEventType } from "@/lib/services/timeline/timelineService";

export const runtime = "nodejs";
export const maxDuration = 60;

function triggerExtraction(entryId: string, masterTranscript: string) {
  runExtraction(entryId, masterTranscript)
    .then(async (extraction) => {
      await runModuleAssignment(entryId, masterTranscript);
      // Only generate embeddings if extraction succeeded
      if (extraction.status === "completed" && extraction) {
        await computeAndStoreRelated(entryId, extraction).catch(async (err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[API] Embedding/similarity error for ${entryId}:`, message);
          // Fetch projectId for the timeline event
          try {
            const row = await prisma.knowledgeEntry.findUnique({
              where: { id: entryId },
              select: { projectId: true },
            });
            if (row) {
              createEvent({
                projectId: row.projectId,
                entryId,
                eventType: TimelineEventType.RELATED_FAILED,
                title: "Related Documents Failed",
                description: { step: "Embedding / Related Documents", error: message },
              }).catch(() => {});
            }
          } catch {
            // Never let timeline logging crash
          }
        });
      } else if (extraction.status !== "completed") {
        // Extraction failed — skip embedding, log as skipped
        try {
          const row = await prisma.knowledgeEntry.findUnique({
            where: { id: entryId },
            select: { projectId: true },
          });
          if (row) {
            createEvent({
              projectId: row.projectId,
              entryId,
              eventType: TimelineEventType.PIPELINE_SKIPPED,
              title: "Related Documents Skipped",
              description: { step: "Embedding / Related Documents", reason: "Extraction did not complete" },
            }).catch(() => {});
          }
        } catch {
          // Never let timeline logging crash
        }
      }
    })
    .catch((err) =>
      console.error(`[API] Background extraction error for ${entryId}:`, err)
    );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const uploadedBy = (formData.get("uploadedBy") as string | null) ?? "Anonymous";

    // ── Plain-text path ──────────────────────────────────────────────────────
    const plainText = formData.get("text");
    if (typeof plainText === "string" && plainText.trim().length > 0) {
      console.log("[API] Plain text received.");
      const result = await processDocument({ kind: "text", content: plainText });

      console.log("[API] Saving transcript...");
      const entry = await createKnowledgeEntry({
        filename: "plain-text.txt",
        originalFileType: "text/plain",
        sourceType: "plain-text",
        uploadedBy,
        storedFilename: "",
        masterTranscript: result.extractedText,
      });

      console.log("[API] Processing complete. Triggering knowledge extraction...");
      triggerExtraction(entry.id, result.extractedText);
      createEvent({
        projectId: entry.projectId,
        entryId: entry.id,
        eventType: TimelineEventType.DOCUMENT_UPLOADED,
        title: `Document uploaded: ${entry.filename}`,
        description: { sourceType: entry.sourceType, uploadedBy },
        actor: uploadedBy,
      }).catch(() => {});

      return NextResponse.json({ result, entryId: entry.id });
    }

    // ── File path ────────────────────────────────────────────────────────────
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file or text provided." }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const fileName = file instanceof File ? file.name : "upload";

    console.log(`[API] Uploading... file: ${fileName}, size: ${file.size} bytes`);
    console.log(`[API] Detected file type: ${mimeType}`);
    console.log("[API] Sending document to Gemini...");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processDocument({ kind: "file", buffer, mimeType, fileName });

    console.log(`[API] Processing time: ${result.processingTime}ms | Model: ${result.modelUsed}`);

    console.log("[API] Saving original file...");
    const storedFilename = await saveFile(buffer, fileName);

    console.log("[API] Saving transcript...");
    const entry = await createKnowledgeEntry({
      filename: fileName,
      originalFileType: mimeType,
      sourceType: result.fileType,
      uploadedBy,
      storedFilename,
      masterTranscript: result.extractedText,
    });

    console.log(`[API] Processing complete. Knowledge Entry ID: ${entry.id}. Triggering knowledge extraction...`);
    triggerExtraction(entry.id, result.extractedText);
    createEvent({
      projectId: entry.projectId,
      entryId: entry.id,
      eventType: TimelineEventType.DOCUMENT_UPLOADED,
      title: `Document uploaded: ${entry.filename}`,
      description: { sourceType: entry.sourceType, uploadedBy },
      actor: uploadedBy,
    }).catch(() => {});

    return NextResponse.json({ result, entryId: entry.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API] Extraction failed:", message);
    return NextResponse.json({ error: `Extraction failed: ${message}` }, { status: 500 });
  }
}
