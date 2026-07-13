"use client";

import { useEffect, useState, useCallback } from "react";

type PipelineStageStatus = "pending" | "processing" | "completed" | "failed" | "retried" | "skipped";

type PipelineStage = {
  key: string;
  label: string;
  status: PipelineStageStatus;
  error: string | null;
  retryCount: number;
  description: Record<string, unknown> | null;
};

type PipelineStatusResult = {
  stages: PipelineStage[];
  overallStatus: "processing" | "completed" | "failed" | "partially_failed";
  summary: string;
  isProcessing: boolean;
};

const STATUS_ICON: Record<PipelineStageStatus, string> = {
  completed:  "🟢",
  processing: "🟡",
  failed:     "🔴",
  retried:    "🔵",
  skipped:    "⚪",
  pending:    "⚪",
};

const STATUS_LABEL: Record<PipelineStageStatus, string> = {
  completed:  "Completed",
  processing: "Processing",
  failed:     "Failed",
  retried:    "Retried",
  skipped:    "Skipped",
  pending:    "Pending",
};

function StageRow({ stage }: { stage: PipelineStage }) {
  const [expanded, setExpanded] = useState(false);
  const isFailed = stage.status === "failed";

  return (
    <div className={`flex flex-col gap-1 py-2.5 border-b border-gray-100 last:border-0 ${isFailed ? "bg-red-50 -mx-4 px-4 rounded" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm shrink-0">{STATUS_ICON[stage.status]}</span>
          <span className={`text-sm font-medium ${isFailed ? "text-red-800" : "text-gray-800"}`}>
            {stage.label}
          </span>
          {stage.retryCount > 0 && (
            <span className="text-xs text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">
              {stage.retryCount} retry
            </span>
          )}
        </div>
        <span className={`shrink-0 text-xs font-medium ${
          isFailed           ? "text-red-600" :
          stage.status === "processing" ? "text-amber-600" :
          stage.status === "completed"  ? "text-green-600" :
          "text-gray-400"
        }`}>
          {STATUS_LABEL[stage.status]}
        </span>
      </div>

      {/* Expandable error */}
      {isFailed && stage.error && (
        <div className="ml-7">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2"
          >
            {expanded ? "Hide details" : "Show details"}
          </button>
          {expanded && (
            <pre className="mt-1.5 text-xs text-red-600 bg-red-100 border border-red-200 rounded p-2 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {stage.error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function OverallBanner({ status, summary }: { status: string; summary: string }) {
  const styles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    completed:        { bg: "bg-green-50",  border: "border-green-200", text: "text-green-800", icon: "✓" },
    failed:           { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-800",   icon: "✗" },
    partially_failed: { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-800", icon: "⚠" },
    processing:       { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-800",  icon: "…" },
  };
  const s = styles[status] ?? styles.processing;

  const title: Record<string, string> = {
    completed:        "Pipeline Complete",
    failed:           "Pipeline Failed",
    partially_failed: "Pipeline Partially Failed",
    processing:       "Processing",
  };

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border ${s.bg} ${s.border}`}>
      <span className={`text-sm font-bold ${s.text} shrink-0`}>{s.icon}</span>
      <div>
        <p className={`text-sm font-semibold ${s.text}`}>{title[status] ?? "Processing"}</p>
        <p className={`text-xs mt-0.5 ${s.text} opacity-80`}>{summary}</p>
      </div>
    </div>
  );
}

export function PipelineStatus({ entryId }: { entryId: string }) {
  const [result, setResult] = useState<PipelineStatusResult | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/knowledge/${entryId}/pipeline-status`);
      if (!res.ok) return;
      const data = await res.json();
      setResult(data.status ?? null);
    } catch {
      // silently ignore
    }
  }, [entryId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while processing
  useEffect(() => {
    if (!result?.isProcessing) return;
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [result?.isProcessing, fetchStatus]);

  if (!result) return null;

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 text-lg">Pipeline Status</h2>
      <OverallBanner status={result.overallStatus} summary={result.summary} />
      <div>
        {result.stages.map((stage) => (
          <StageRow key={stage.key} stage={stage} />
        ))}
      </div>
    </section>
  );
}
