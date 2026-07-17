"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/search/SearchBar";
import type { TimelineEventItem, TimelineFiltersState } from "@/types/timeline";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, FAILURE_TYPES, RETRY_TYPES, RUNNING_TYPES } from "@/types/timeline";

const DEBOUNCE_MS = 300;
// just_to_add_something
const EVENT_TYPE_OPTIONS = [
  { value: "",                      label: "All Events" },
  { value: "document.uploaded",     label: "Uploads" },
  { value: "extraction.started",    label: "Extraction Started" },
  { value: "extraction.completed",  label: "Extraction Completed" },
  { value: "extraction.failed",     label: "Extraction Failed" },
  { value: "modules.assigned",      label: "Modules Assigned" },
  { value: "modules.failed",        label: "Module Classification Failed" },
  { value: "related.computed",      label: "Related Docs Found" },
  { value: "related.failed",        label: "Related Docs Failed" },
  { value: "pipeline.retry",        label: "Retries" },
  { value: "pipeline.failed",       label: "Pipeline Failed" },
  { value: "pipeline.skipped",      label: "Skipped" },
];

type PipelineHealth = { completed: number; failed: number; retried: number };

// ── Grouping ───────────────────────────────────────────────────────────────────

type DocumentGroup = {
  entryId: string;
  filename: string;
  events: TimelineEventItem[];
  firstAt: string; // ISO — used for sorting groups
};

function groupByDocument(events: TimelineEventItem[]): DocumentGroup[] {
  const map = new Map<string, DocumentGroup>();

  for (const ev of events) {
    const key = ev.entryId ?? "__no_entry__";
    if (!map.has(key)) {
      map.set(key, {
        entryId: key,
        filename: ev.entry?.filename ?? "Unknown document",
        events: [],
        firstAt: ev.createdAt,
      });
    }
    const group = map.get(key)!;
    group.events.push(ev);
    // Track earliest event time for the group
    if (ev.createdAt < group.firstAt) group.firstAt = ev.createdAt;
  }

  // Sort groups by most recent event (groups already ordered by backend per-event)
  return [...map.values()];
}

// ── Pipeline stage derivation ──────────────────────────────────────────────────

type StageStatus = "completed" | "failed" | "retried" | "skipped" | "processing" | "pending";

type PipelineStage = { label: string; status: StageStatus; error: string | null; retryCount: number };

const PIPELINE_STAGES = [
  { key: "upload",      label: "Uploaded" },
  { key: "extraction",  label: "AI Extraction" },
  { key: "modules",     label: "Module Assignment" },
  { key: "related",     label: "Related Documents" },
];

function deriveStages(events: TimelineEventItem[]): PipelineStage[] {
  const stageMap = new Map<string, { status: StageStatus; error: string | null; retryCount: number }>();

  stageMap.set("upload", { status: "completed", error: null, retryCount: 0 });

  for (const ev of [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const desc = ev.description;
    switch (ev.eventType) {
      case "extraction.started":
        if (!stageMap.has("extraction"))
          stageMap.set("extraction", { status: "processing", error: null, retryCount: 0 });
        break;
      case "extraction.completed":
        stageMap.set("extraction", { status: "completed", error: null, retryCount: stageMap.get("extraction")?.retryCount ?? 0 });
        break;
      case "extraction.failed":
        stageMap.set("extraction", { status: "failed", error: typeof desc.error === "string" ? desc.error : null, retryCount: stageMap.get("extraction")?.retryCount ?? 0 });
        break;
      case "pipeline.retry": {
        const cur = stageMap.get("extraction") ?? { status: "retried" as StageStatus, error: null, retryCount: 0 };
        stageMap.set("extraction", { ...cur, status: "retried", retryCount: cur.retryCount + 1 });
        break;
      }
      case "modules.assigned":
        stageMap.set("modules", { status: "completed", error: null, retryCount: 0 });
        break;
      case "modules.failed":
        stageMap.set("modules", { status: "failed", error: typeof desc.error === "string" ? desc.error : null, retryCount: 0 });
        break;
      case "related.computed":
        stageMap.set("related", { status: "completed", error: null, retryCount: 0 });
        break;
      case "related.failed":
        stageMap.set("related", { status: "failed", error: typeof desc.error === "string" ? desc.error : null, retryCount: 0 });
        break;
      case "pipeline.skipped":
        stageMap.set("related", { status: "skipped", error: null, retryCount: 0 });
        break;
    }
  }

  return PIPELINE_STAGES.map(({ key, label }) => {
    const d = stageMap.get(key) ?? { status: "pending" as StageStatus, error: null, retryCount: 0 };
    return { label, ...d };
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const FILE_ICONS: Record<string, string> = {
  image: "🖼️", pdf: "📄", docx: "📝", text: "📋", "plain-text": "📋",
};

function fileIcon(events: TimelineEventItem[]) {
  const upload = events.find((e) => e.eventType === "document.uploaded");
  const sourceType = upload?.description?.sourceType as string | undefined;
  return FILE_ICONS[sourceType ?? ""] ?? "📁";
}

function uploadedBy(events: TimelineEventItem[]) {
  const upload = events.find((e) => e.eventType === "document.uploaded");
  return upload?.actor ?? null;
}

function stageIcon(status: StageStatus): string {
  if (status === "completed")  return "🟢";
  if (status === "failed")     return "🔴";
  if (status === "retried")    return "🔵";
  if (status === "processing") return "🟡";
  if (status === "skipped")    return "⚪";
  return "⚪";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PipelineHealthCard({ health }: { health: PipelineHealth }) {
  const stats = [
    { label: "Completed", value: health.completed, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
    { label: "Failed",    value: health.failed,    color: "text-red-600",   bg: "bg-red-50",   border: "border-red-200"   },
    { label: "Retried",   value: health.retried,   color: "text-blue-600",  bg: "bg-blue-50",  border: "border-blue-200"  },
  ];
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline Health</p>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-lg border px-3 py-2 text-center ${s.bg} ${s.border}`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiResultsSummary({ events }: { events: TimelineEventItem[] }) {
  const ev = events.find((e) => e.eventType === "extraction.completed");
  if (!ev) return null;
  const d = ev.description;
  const items = [
    { icon: "📝", label: "Change Requests", count: d.changeRequestCount as number | undefined },
    { icon: "✅", label: "Action Items",    count: d.actionItemCount as number | undefined },
    { icon: "👥", label: "People Mentioned", count: d.peopleMentioned as number | undefined },
    { icon: "⚖️",  label: "Decisions",       count: d.decisionCount as number | undefined },
  ].filter((i) => i.count != null && (i.count as number) > 0);
  if (items.length === 0) return null;
  
  return (
    <div className="border-t border-gray-100 pt-3 mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Results</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {items.map((item) => (
          <span key={item.label} className="text-sm text-gray-700">
            {item.icon} <span className="font-semibold">{item.count}</span>{" "}
            <span className="text-gray-500">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ModulesBadges({ events }: { events: TimelineEventItem[] }) {
  const ev = events.find((e) => e.eventType === "modules.assigned");
  if (!ev) return null;
  const modules = Array.isArray(ev.description.modules) ? (ev.description.modules as string[]) : [];
  if (modules.length === 0) return null;

  return (
    <div className="border-t border-gray-100 pt-3 mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modules</p>
      <div className="flex flex-wrap gap-1.5">
        {modules.map((m) => (
          <span key={m} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full font-medium">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function AuditTrail({ events }: { events: TimelineEventItem[] }) {
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Event History</p>
      {sorted.map((ev) => {
        const isFail = FAILURE_TYPES.has(ev.eventType);
        const isRetry = RETRY_TYPES.has(ev.eventType);
        const isRunning = RUNNING_TYPES.has(ev.eventType);
        const color = isFail ? "text-red-500" : isRetry ? "text-blue-500" : isRunning ? "text-amber-500" : "text-green-500";
        return (
          <div key={ev.id} className="flex items-start gap-3 text-xs">
            <span className="text-gray-300 tabular-nums shrink-0 w-10">{formatTime(ev.createdAt)}</span>
            <span className={`shrink-0 ${color}`}>●</span>
            <div className="min-w-0">
              <span className="text-gray-700 font-medium">{EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}</span>
              {ev.eventType === "pipeline.retry" && !!ev.description.attempt && (
                <span className="text-gray-400 ml-1">— Attempt {String(ev.description.attempt)}</span>
              )}
              {isFail && !!ev.description.error && (
                <p className="text-red-400 mt-0.5 truncate" title={String(ev.description.error)}>
                  {String(ev.description.error).slice(0, 100)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentCard({ group }: { group: DocumentGroup }) {
  const [expanded, setExpanded] = useState(false);
  const stages = deriveStages(group.events);
  const actor = uploadedBy(group.events);
  const icon = fileIcon(group.events);
  const uploadEvent = group.events.find((e) => e.eventType === "document.uploaded");
  const uploadTime = uploadEvent?.createdAt ?? group.firstAt;
  const hasFailure = stages.some((s) => s.status === "failed");

  return (
    <div className={`bg-white border rounded-xl shadow-sm transition-all ${hasFailure ? "border-red-200" : "border-gray-200"}`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl select-none">{icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{group.filename}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {actor ? `Uploaded by ${actor} · ` : ""}{formatDate(uploadTime)} · {formatTime(uploadTime)}
            </p>
          </div>
        </div>

        {/* Pipeline stages */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Pipeline</p>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 sm:grid-cols-4">
            {stages.map((stage) => (
              <div key={stage.label} className="flex items-center gap-1.5">
                <span className="text-sm">{stageIcon(stage.status)}</span>
                <span className={`text-xs ${stage.status === "failed" ? "text-red-600 font-medium" : stage.status === "pending" ? "text-gray-300" : "text-gray-700"}`}>
                  {stage.label}
                  {stage.retryCount > 0 && (
                    <span className="text-blue-400 ml-1">({stage.retryCount}↺)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Results */}
        <AiResultsSummary events={group.events} />

        {/* Modules */}
        <ModulesBadges events={group.events} />

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <span>{expanded ? "▲" : "▼"}</span>
            {expanded ? "Hide" : "Show"} event history
          </button>
          {group.entryId !== "__no_entry__" && (
            <Link
              href={`/knowledge/${group.entryId}`}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              View Knowledge Entry →
            </Link>
          )}
        </div>
      </div>

      {/* Expandable audit trail */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5">
          <AuditTrail events={group.events} />
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [filters, setFilters] = useState<TimelineFiltersState>({
    search: "", type: "", dateFrom: "", dateTo: "", order: "desc",
  });
  const [events, setEvents] = useState<TimelineEventItem[]>([]);
  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runFetch = useCallback(async (f: TimelineFiltersState) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.search)   params.set("search",   f.search);
      if (f.type)     params.set("type",      f.type);
      if (f.dateFrom) params.set("dateFrom",  f.dateFrom);
      if (f.dateTo)   params.set("dateTo",    f.dateTo);
      params.set("order", f.order);

      const [evRes, healthRes] = await Promise.all([
        fetch(`/api/timeline?${params}`),
        fetch("/api/timeline/health"),
      ]);
      const evData = await evRes.json();
      const healthData = await healthRes.json();

      setEvents(evData.events ?? []);
      setHealth(healthData.health ?? null);
      setLoaded(true);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { runFetch(filters); }, [runFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(next: TimelineFiltersState) {
    setFilters(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runFetch(next), DEBOUNCE_MS);
  }

  const groups = groupByDocument(events);

  return (
    <main className="p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
          {loaded && !loading && (
            <p className="mt-0.5 text-sm text-gray-400">
              {groups.length} document{groups.length !== 1 ? "s" : ""}
              {filters.search ? ` matching "${filters.search}"` : ""}
            </p>
          )}
        </div>

        {/* Pipeline Health */}
        {health && <PipelineHealthCard health={health} />}

        {/* Search */}
        <SearchBar
          value={filters.search}
          onChange={(q) => handleChange({ ...filters, search: q })}
          placeholder="Search events…"
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filters.type}
            onChange={(e) => handleChange({ ...filters, type: e.target.value })}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
          >
            {EVENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleChange({ ...filters, dateFrom: e.target.value })}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-600"
            title="From date"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleChange({ ...filters, dateTo: e.target.value })}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-600"
            title="To date"
          />

          <select
            value={filters.order}
            onChange={(e) => handleChange({ ...filters, order: e.target.value as "asc" | "desc" })}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>

          {(filters.type || filters.dateFrom || filters.dateTo) && (
            <button
              type="button"
              onClick={() => handleChange({ ...filters, type: "", dateFrom: "", dateTo: "" })}
              className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Document Cards */}
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : loaded && groups.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-3xl">📭</p>
            <p className="font-medium text-gray-700">No events found.</p>
            <p className="text-sm text-gray-400">
              {filters.search || filters.type ? "Try adjusting your filters." : "Upload a document to get started."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <DocumentCard key={group.entryId} group={group} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
