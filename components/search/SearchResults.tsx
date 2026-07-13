"use client";

import Link from "next/link";
import { Highlight } from "./Highlight";
import type { SearchResultItem } from "@/types/search";
import { MATCHED_FIELD_LABELS } from "@/types/search";

const FILE_ICONS: Record<string, string> = {
  image: "🖼️",
  pdf: "📄",
  docx: "📝",
  text: "📋",
  "plain-text": "📋",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

type Props = {
  results: SearchResultItem[];
  query: string;
  loading: boolean;
  searched: boolean;
};

export function SearchResults({ results, query, loading, searched }: Props) {
  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        Searching…
      </div>
    );
  }

  if (searched && results.length === 0) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-3xl">🔍</p>
        <p className="font-medium text-gray-700">No matching documents found.</p>
        <p className="text-sm text-gray-400">Try a different search term or adjust your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {searched && results.length > 0 && (
        <p className="text-xs text-gray-400">
          {results.length} result{results.length !== 1 ? "s" : ""}
          {query ? ` for "${query}"` : ""}
        </p>
      )}
      {results.map((item) => (
        <ResultCard key={item.id} item={item} query={query} />
      ))}
    </div>
  );
}

function ResultCard({ item, query }: { item: SearchResultItem; query: string }) {
  return (
    <Link href={`/knowledge/${item.id}`} className="block group">
      <div className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="text-3xl select-none pt-0.5">
            {FILE_ICONS[item.sourceType] ?? "📁"}
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                <Highlight text={item.filename} query={query} />
              </p>
              <span className="shrink-0 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase tracking-wide">
                {item.sourceType}
              </span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
              <span>{item.project.name}</span>
              <span>{formatDate(item.uploadedAt)}</span>
              <span>by {item.uploadedBy}</span>
            </div>

            {/* Snippet */}
            <p className="text-sm text-gray-600 leading-snug line-clamp-3">
              <Highlight text={item.transcriptSnippet} query={query} />
            </p>

            {/* Matched fields */}
            {item.matchedFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-xs text-gray-400">Matched in:</span>
                {item.matchedFields.map((f) => (
                  <span
                    key={f}
                    className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full"
                  >
                    {MATCHED_FIELD_LABELS[f]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
