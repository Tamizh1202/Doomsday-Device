"use client";

import type { SearchFilters } from "@/types/search";

type Props = {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  projects: { id: string; name: string }[];
  uploaders: string[];
};

const SOURCE_TYPES = [
  { value: "", label: "All Types" },
  { value: "image", label: "Image" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "text", label: "Plain Text" },
  { value: "plain-text", label: "Plain Text (input)" },
];

export function FilterBar({ filters, onChange, projects, uploaders }: Props) {
  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onChange({ ...filters, [key]: value || undefined });
  }

  const hasActiveFilters =
    filters.projectId || filters.sourceType || filters.uploadedBy || filters.dateFrom || filters.dateTo;

  function clearAll() {
    onChange({ query: filters.query });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Project */}
      {projects.length > 1 && (
        <Select
          value={filters.projectId ?? ""}
          onChange={(v) => set("projectId", v || undefined)}
          options={[
            { value: "", label: "All Projects" },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      )}

      {/* File Type */}
      <Select
        value={filters.sourceType ?? ""}
        onChange={(v) => set("sourceType", v || undefined)}
        options={SOURCE_TYPES}
      />

      {/* Uploaded By */}
      {uploaders.length > 0 && (
        <Select
          value={filters.uploadedBy ?? ""}
          onChange={(v) => set("uploadedBy", v || undefined)}
          options={[
            { value: "", label: "All Uploaders" },
            ...uploaders.map((u) => ({ value: u, label: u })),
          ]}
        />
      )}

      {/* Date From */}
      <input
        type="date"
        value={filters.dateFrom ?? ""}
        onChange={(e) => set("dateFrom", e.target.value || undefined)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-600"
        title="From date"
      />

      {/* Date To */}
      <input
        type="date"
        value={filters.dateTo ?? ""}
        onChange={(e) => set("dateTo", e.target.value || undefined)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-600"
        title="To date"
      />

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg bg-red-50 hover:bg-red-100"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
