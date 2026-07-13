"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/search/SearchBar";
import { FilterBar } from "@/components/search/FilterBar";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchFilters } from "@/types/search";
import type { SearchResultItem } from "@/types/search";

const DEBOUNCE_MS = 300;

export default function KnowledgePage() {
  const [filters, setFilters] = useState<SearchFilters>({ query: "" });
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [uploaders, setUploaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (f: SearchFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.query) params.set("q", f.query);
      if (f.projectId) params.set("projectId", f.projectId);
      if (f.sourceType) params.set("sourceType", f.sourceType);
      if (f.uploadedBy) params.set("uploadedBy", f.uploadedBy);
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setProjects(data.projects ?? []);
      setUploaders(data.uploaders ?? []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — show all entries
  useEffect(() => {
    runSearch({ query: "" });
  }, [runSearch]);

  // Debounced search on filter/query change
  function handleFiltersChange(next: SearchFilters) {
    setFilters(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  function handleQueryChange(q: string) {
    handleFiltersChange({ ...filters, query: q });
  }

  const hasFilters =
    filters.projectId || filters.sourceType || filters.uploadedBy ||
    filters.dateFrom || filters.dateTo;

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
            {searched && !loading && (
              <p className="mt-0.5 text-sm text-gray-400">
                {results.length} document{results.length !== 1 ? "s" : ""}
                {filters.query ? ` matching "${filters.query}"` : ""}
              </p>
            )}
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + Upload
          </Link>
        </div>

        {/* Search */}
        <SearchBar value={filters.query} onChange={handleQueryChange} />

        {/* Filters */}
        <FilterBar
          filters={filters}
          onChange={handleFiltersChange}
          projects={projects}
          uploaders={uploaders}
        />

        {/* Divider */}
        {(filters.query || hasFilters) && <hr className="border-gray-200" />}

        {/* Results */}
        <SearchResults
          results={results}
          query={filters.query}
          loading={loading}
          searched={searched}
        />

      </div>
    </main>
  );
}
