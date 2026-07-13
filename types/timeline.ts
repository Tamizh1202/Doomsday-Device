export type TimelineEventItem = {
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

export type TimelineFiltersState = {
  search: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  order: "asc" | "desc";
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  "document.uploaded":    "Document Uploaded",
  "extraction.started":   "Extraction Started",
  "extraction.completed": "Extraction Completed",
  "extraction.failed":    "Extraction Failed",
  "modules.assigned":     "Modules Assigned",
  "modules.failed":       "Module Classification Failed",
  "related.computed":     "Related Docs Found",
  "related.failed":       "Related Docs Failed",
  "pipeline.retry":       "Retrying",
  "pipeline.failed":      "Pipeline Failed",
  "pipeline.skipped":     "Stage Skipped",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  "document.uploaded":    "#3b82f6",
  "extraction.started":   "#f59e0b",
  "extraction.completed": "#10b981",
  "extraction.failed":    "#ef4444",
  "modules.assigned":     "#8b5cf6",
  "modules.failed":       "#ef4444",
  "related.computed":     "#6b7280",
  "related.failed":       "#ef4444",
  "pipeline.retry":       "#3b82f6",
  "pipeline.failed":      "#ef4444",
  "pipeline.skipped":     "#9ca3af",
};

// Which event types indicate a failure state
export const FAILURE_TYPES = new Set([
  "extraction.failed",
  "modules.failed",
  "related.failed",
  "pipeline.failed",
]);

// Which event types indicate a success state
export const SUCCESS_TYPES = new Set([
  "extraction.completed",
  "modules.assigned",
  "related.computed",
  "document.uploaded",
]);

// Which event types indicate a running/pending state
export const RUNNING_TYPES = new Set([
  "extraction.started",
]);

// Which event types indicate a retry
export const RETRY_TYPES = new Set([
  "pipeline.retry",
]);
