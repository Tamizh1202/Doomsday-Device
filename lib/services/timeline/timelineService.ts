import { prisma } from "@/lib/database/prisma";
import { getDefaultProject } from "@/lib/services/knowledge/knowledgeService";
import { Prisma } from "@prisma/client";

// ── Event type constants ───────────────────────────────────────────────────────

export const TimelineEventType = {
  DOCUMENT_UPLOADED:    "document.uploaded",
  EXTRACTION_STARTED:   "extraction.started",
  EXTRACTION_COMPLETED: "extraction.completed",
  EXTRACTION_FAILED:    "extraction.failed",
  MODULES_ASSIGNED:     "modules.assigned",
  MODULES_FAILED:       "modules.failed",
  RELATED_COMPUTED:     "related.computed",
  RELATED_FAILED:       "related.failed",
  PIPELINE_RETRY:       "pipeline.retry",
  PIPELINE_FAILED:      "pipeline.failed",
  PIPELINE_SKIPPED:     "pipeline.skipped",
} as const;

export type TimelineEventTypeValue = typeof TimelineEventType[keyof typeof TimelineEventType];

// ── Input / output types ───────────────────────────────────────────────────────

export type CreateTimelineEventInput = {
  projectId: string;
  entryId?: string | null;
  eventType: TimelineEventTypeValue;
  title: string;
  description?: Record<string, unknown>;
  actor?: string | null;
};

export type TimelineFilters = {
  projectId?: string;
  type?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  order?: "asc" | "desc";
};

export type TimelineEventResult = {
  id: string;
  projectId: string;
  entryId: string | null;
  eventType: string;
  title: string;
  description: Record<string, unknown>;
  actor: string | null;
  createdAt: string;
  entry: { id: string; filename: string } | null;
};

export type PipelineHealth = {
  completed: number;
  failed: number;
  retried: number;
};

// ── Public API ─────────────────────────────────────────────────────────────────

export async function createEvent(input: CreateTimelineEventInput): Promise<void> {
  try {
    await prisma.timelineEvent.create({
      data: {
        projectId:   input.projectId,
        entryId:     input.entryId ?? null,
        eventType:   input.eventType,
        title:       input.title,
        description: (input.description ?? {}) as Prisma.InputJsonValue,
        actor:       input.actor ?? null,
      },
    });
  } catch (err) {
    console.error("[TimelineService] Failed to create event:", err instanceof Error ? err.message : err);
  }
}

export async function listEvents(filters: TimelineFilters): Promise<TimelineEventResult[]> {
  let projectId = filters.projectId;
  if (!projectId) {
    const project = await getDefaultProject();
    projectId = project.id;
  }

  const where: Prisma.TimelineEventWhereInput = {
    projectId,
    ...(filters.type ? { eventType: filters.type } : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } }
      : {}),
    ...((filters.dateFrom || filters.dateTo)
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo
              ? { lte: new Date(new Date(filters.dateTo).setHours(23, 59, 59, 999)) }
              : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.timelineEvent.findMany({
    where,
    orderBy: { createdAt: filters.order ?? "desc" },
    include: { entry: { select: { id: true, filename: true } } },
  });

  return rows.map((r) => ({
    id:          r.id,
    projectId:   r.projectId,
    entryId:     r.entryId,
    eventType:   r.eventType,
    title:       r.title,
    description: r.description as Record<string, unknown>,
    actor:       r.actor,
    createdAt:   r.createdAt.toISOString(),
    entry:       r.entry ?? null,
  }));
}

export async function getPipelineHealth(projectId?: string): Promise<PipelineHealth> {
  let pid = projectId;
  if (!pid) {
    const project = await getDefaultProject();
    pid = project.id;
  }

  const FAILURE_TYPES = ["extraction.failed", "modules.failed", "related.failed", "pipeline.failed"];
  const SUCCESS_TYPES = ["extraction.completed", "modules.assigned", "related.computed"];
  const RETRY_TYPES   = ["pipeline.retry"];

  const [completed, failed, retried] = await Promise.all([
    prisma.timelineEvent.count({ where: { projectId: pid, eventType: { in: SUCCESS_TYPES } } }),
    prisma.timelineEvent.count({ where: { projectId: pid, eventType: { in: FAILURE_TYPES } } }),
    prisma.timelineEvent.count({ where: { projectId: pid, eventType: { in: RETRY_TYPES } } }),
  ]);

  return { completed, failed, retried };
}
