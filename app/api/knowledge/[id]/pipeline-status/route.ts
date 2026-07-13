import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

// Maps timeline eventType → pipeline stage key
const STAGE_EVENT_MAP: Record<string, { stage: string; status: "completed" | "failed" | "retried" | "skipped" }> = {
  "document.uploaded":    { stage: "upload",       status: "completed" },
  "extraction.started":   { stage: "extraction",   status: "completed" }, // overridden if failed
  "extraction.completed": { stage: "extraction",   status: "completed" },
  "extraction.failed":    { stage: "extraction",   status: "failed"    },
  "modules.assigned":     { stage: "modules",      status: "completed" },
  "modules.failed":       { stage: "modules",      status: "failed"    },
  "related.computed":     { stage: "related",      status: "completed" },
  "related.failed":       { stage: "related",      status: "failed"    },
  "pipeline.skipped":     { stage: "skipped",      status: "skipped"   },
  "pipeline.retry":       { stage: "extraction",   status: "retried"   },
};

export type PipelineStageStatus = "pending" | "processing" | "completed" | "failed" | "retried" | "skipped";

export type PipelineStage = {
  key: string;
  label: string;
  status: PipelineStageStatus;
  error: string | null;
  retryCount: number;
  description: Record<string, unknown> | null;
};

export type PipelineStatusResult = {
  stages: PipelineStage[];
  overallStatus: "processing" | "completed" | "failed" | "partially_failed";
  summary: string;
  isProcessing: boolean;
};

const STAGE_DEFS: { key: string; label: string }[] = [
  { key: "upload",      label: "Upload" },
  { key: "transcript",  label: "Master Transcript" },
  { key: "extraction",  label: "Knowledge Extraction" },
  { key: "modules",     label: "Module Assignment" },
  { key: "related",     label: "Related Documents" },
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check entry exists
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id },
    select: { id: true, masterTranscript: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch all timeline events for this entry, oldest first
  const events = await prisma.timelineEvent.findMany({
    where: { entryId: id },
    orderBy: { createdAt: "asc" },
  });

  // Build a map of stage key → latest state
  type StageData = { status: PipelineStageStatus; error: string | null; retryCount: number; description: Record<string, unknown> | null };
  const stageMap = new Map<string, StageData>();

  // Upload always happened if the entry exists
  stageMap.set("upload", { status: "completed", error: null, retryCount: 0, description: null });
  // Transcript always happened if the entry exists (Gemini ran synchronously)
  stageMap.set("transcript", { status: "completed", error: null, retryCount: 0, description: null });

  for (const ev of events) {
    const mapped = STAGE_EVENT_MAP[ev.eventType];
    if (!mapped) continue;

    const desc = ev.description as Record<string, unknown>;

    if (ev.eventType === "pipeline.retry") {
      // Increment retry count on extraction stage
      const existing = stageMap.get("extraction") ?? { status: "retried" as PipelineStageStatus, error: null, retryCount: 0, description: null };
      stageMap.set("extraction", {
        ...existing,
        status: "retried",
        retryCount: existing.retryCount + 1,
        description: desc,
      });
      continue;
    }

    if (ev.eventType === "pipeline.skipped") {
      // Mark the step named in description as skipped
      const step = String(desc?.step ?? "").toLowerCase();
      if (step.includes("related") || step.includes("embedding")) {
        stageMap.set("related", { status: "skipped", error: null, retryCount: 0, description: desc });
      }
      continue;
    }

    if (ev.eventType === "extraction.started") {
      // Mark as processing if not yet completed/failed
      if (!stageMap.has("extraction")) {
        stageMap.set("extraction", { status: "processing", error: null, retryCount: 0, description: null });
      }
      continue;
    }

    stageMap.set(mapped.stage, {
      status: mapped.status,
      error: typeof desc?.error === "string" ? desc.error : null,
      retryCount: stageMap.get(mapped.stage)?.retryCount ?? 0,
      description: desc,
    });
  }

  // Derive processing state: if extraction is pending (no event yet after upload), it's processing
  if (!stageMap.has("extraction")) {
    // Check if there's a KnowledgeExtraction record with pending status
    const extraction = await prisma.knowledgeExtraction.findUnique({
      where: { knowledgeEntryId: id },
      select: { status: true },
    });
    if (extraction?.status === "pending") {
      stageMap.set("extraction", { status: "processing", error: null, retryCount: 0, description: null });
    }
  }

  // Build ordered stages
  const stages: PipelineStage[] = STAGE_DEFS.map((def) => {
    const data = stageMap.get(def.key);
    return {
      key: def.key,
      label: def.label,
      status: data?.status ?? "pending",
      error: data?.error ?? null,
      retryCount: data?.retryCount ?? 0,
      description: data?.description ?? null,
    };
  });

  // Determine overall status
  const hasProcessing = stages.some((s) => s.status === "processing");
  const hasFailed = stages.some((s) => s.status === "failed");
  const allTerminal = stages.every((s) =>
    ["completed", "failed", "skipped", "pending"].includes(s.status)
  );

  let overallStatus: PipelineStatusResult["overallStatus"];
  let summary: string;

  if (hasProcessing) {
    overallStatus = "processing";
    summary = "Processing — stages are still running.";
  } else if (hasFailed && allTerminal) {
    const failedStage = stages.find((s) => s.status === "failed");
    overallStatus = "failed";
    summary = `${failedStage?.label ?? "A stage"} failed.${stages.some((s) => s.status === "skipped") ? " Remaining stages were skipped." : ""}`;
  } else if (!hasFailed && stages.every((s) => ["completed", "skipped"].includes(s.status) || s.status === "pending")) {
    // All important stages done
    const anySkipped = stages.some((s) => s.status === "skipped");
    overallStatus = anySkipped ? "partially_failed" : "completed";
    summary = anySkipped ? "Completed with skipped stages." : "All processing stages completed successfully.";
  } else {
    overallStatus = "processing";
    summary = "Processing in progress.";
  }

  return NextResponse.json({
    status: {
      stages,
      overallStatus,
      summary,
      isProcessing: hasProcessing,
    },
  });
}
