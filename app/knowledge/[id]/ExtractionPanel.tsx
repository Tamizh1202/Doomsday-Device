"use client";

import { useEffect, useState, useCallback } from "react";
import type { KnowledgeExtraction } from "@prisma/client";

type Props = {
  entryId: string;
  initialExtraction: KnowledgeExtraction | null;
};

type JsonArray = Record<string, string | null>[] | string[];

function isStringArray(arr: unknown[]): arr is string[] {
  return arr.every((v) => typeof v === "string");
}

export function ExtractionPanel({ entryId, initialExtraction }: Props) {
  const [extraction, setExtraction] = useState<KnowledgeExtraction | null>(initialExtraction);
  const [retrying, setRetrying] = useState(false);

  // Poll while status is "pending"
  useEffect(() => {
    if (extraction?.status !== "pending") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/knowledge/${entryId}/extraction`);
        const data = await res.json();
        if (data.extraction) {
          setExtraction(data.extraction);
          if (data.extraction.status !== "pending") clearInterval(interval);
        }
      } catch {
        // silently retry
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [entryId, extraction?.status]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/knowledge/${entryId}/extraction`, { method: "POST" });
      const data = await res.json();
      if (data.extraction) setExtraction(data.extraction);
    } catch {
      // error shown via extraction.status
    } finally {
      setRetrying(false);
    }
  }, [entryId]);

  // ── Status: no extraction record yet ───────────────────────────────────────
  if (!extraction) {
    return (
      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold text-gray-900 text-lg">Knowledge Extraction</h2>
        <p className="text-sm text-gray-400">No extraction found.</p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {retrying ? "Running…" : "Run Extraction"}
        </button>
      </section>
    );
  }

  // ── Status: pending ─────────────────────────────────────────────────────────
  if (extraction.status === "pending") {
    return (
      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold text-gray-900 text-lg">Knowledge Extraction</h2>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="animate-spin text-lg">⏳</span>
          <span>Extracting structured information… this usually takes a few seconds.</span>
        </div>
      </section>
    );
  }

  // ── Status: failed ──────────────────────────────────────────────────────────
  if (extraction.status === "failed") {
    return (
      <section className="bg-white border border-red-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold text-gray-900 text-lg">Knowledge Extraction</h2>
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Extraction failed: {extraction.error ?? "Unknown error."}
        </div>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Retry Extraction"}
        </button>
      </section>
    );
  }

  // ── Status: completed ───────────────────────────────────────────────────────
  const asArray = (val: unknown): unknown[] => (Array.isArray(val) ? val : []);

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-lg">Knowledge Extraction</h2>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="text-xs text-gray-400 hover:text-blue-600 disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "↻ Re-run"}
        </button>
      </div>

      {/* Overview / Summary */}
      <ExtractionBlock title="Overview">
        {extraction.summary ? (
          <p className="text-sm text-gray-700 leading-relaxed">{extraction.summary}</p>
        ) : (
          <Empty />
        )}
        {extraction.priority && (
          <div className="mt-3">
            <PriorityBadge priority={extraction.priority} />
          </div>
        )}
      </ExtractionBlock>

      {/* Change Requests */}
      <ExtractionBlock title="Change Requests">
        <ObjectList
          items={asArray(extraction.changeRequests) as JsonArray}
          primaryKey="description"
          secondaryKey="requestedBy"
          secondaryLabel="Requested by"
        />
      </ExtractionBlock>

      {/* Action Items */}
      <ExtractionBlock title="Action Items">
        <ObjectList
          items={asArray(extraction.actionItems) as JsonArray}
          primaryKey="task"
          secondaryKey="assignedTo"
          secondaryLabel="Assigned to"
          tertiaryKey="dueDate"
          tertiaryLabel="Due"
        />
      </ExtractionBlock>

      {/* Project Modules */}
      <ExtractionBlock title="Project Modules">
        <TagList items={asArray(extraction.projectModules)} />
      </ExtractionBlock>

      {/* Mentioned Assets */}
      <ExtractionBlock title="Mentioned Assets">
        <TagList items={asArray(extraction.mentionedAssets)} />
      </ExtractionBlock>

      {/* People Mentioned */}
      <ExtractionBlock title="People Mentioned">
        <TagList items={asArray(extraction.peopleMentioned)} />
      </ExtractionBlock>

      {/* Decisions */}
      <ExtractionBlock title="Decisions">
        <StringList items={asArray(extraction.decisions)} />
      </ExtractionBlock>
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ExtractionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-gray-400 italic">None identified.</p>;
}

function TagList({ items }: { items: unknown[] }) {
  const strings = items.filter((v) => typeof v === "string") as string[];
  if (strings.length === 0) return <Empty />;
  return (
    <div className="flex flex-wrap gap-2">
      {strings.map((v, i) => (
        <span key={i} className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
          {v}
        </span>
      ))}
    </div>
  );
}

function StringList({ items }: { items: unknown[] }) {
  const strings = items.filter((v) => typeof v === "string") as string[];
  if (strings.length === 0) return <Empty />;
  return (
    <ul className="space-y-1.5">
      {strings.map((v, i) => (
        <li key={i} className="text-sm text-gray-700 flex gap-2">
          <span className="text-gray-400 shrink-0">•</span>
          <span>{v}</span>
        </li>
      ))}
    </ul>
  );
}

function ObjectList({
  items,
  primaryKey,
  secondaryKey,
  secondaryLabel,
  tertiaryKey,
  tertiaryLabel,
}: {
  items: JsonArray;
  primaryKey: string;
  secondaryKey: string;
  secondaryLabel: string;
  tertiaryKey?: string;
  tertiaryLabel?: string;
}) {
  const objects = items.filter(
    (v): v is Record<string, string | null> => typeof v === "object" && v !== null && !Array.isArray(v)
  );
  if (objects.length === 0) return <Empty />;
  return (
    <ul className="space-y-3">
      {objects.map((item, i) => (
        <li key={i} className="text-sm">
          <p className="text-gray-800 font-medium">{item[primaryKey] ?? "—"}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-gray-400">
            {item[secondaryKey] && (
              <span>{secondaryLabel}: <span className="text-gray-600">{item[secondaryKey]}</span></span>
            )}
            {tertiaryKey && tertiaryLabel && item[tertiaryKey] && (
              <span>{tertiaryLabel}: <span className="text-gray-600">{item[tertiaryKey]}</span></span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${styles[priority] ?? "bg-gray-100 text-gray-600"}`}>
      {priority} priority
    </span>
  );
}
