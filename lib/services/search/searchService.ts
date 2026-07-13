import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@prisma/client";
import type { SearchFilters, SearchResultItem, MatchedField } from "@/types/search";

const SNIPPET_WINDOW = 200; // characters around first match to show

/** Extract a short snippet around the first occurrence of the query in text. */
function buildSnippet(text: string, query: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, SNIPPET_WINDOW);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + query.length + 120);
  const snippet = text.slice(start, end);
  return (start > 0 ? "…" : "") + snippet + (end < text.length ? "…" : "");
}

/** Check whether a JSON field (stored as Prisma.JsonValue) contains the query string. */
function jsonContains(value: Prisma.JsonValue, query: string): boolean {
  if (!value) return false;
  return JSON.stringify(value).toLowerCase().includes(query.toLowerCase());
}

export async function searchKnowledge(filters: SearchFilters): Promise<SearchResultItem[]> {
  const { query, projectId, sourceType, uploadedBy, dateFrom, dateTo } = filters;
  const q = query.trim().replace(/\s+/g, " ");

  // ── Build KnowledgeEntry WHERE clause ──────────────────────────────────────
  const entryWhere: Prisma.KnowledgeEntryWhereInput = {};

  if (projectId) entryWhere.projectId = projectId;
  if (sourceType) entryWhere.sourceType = sourceType;
  if (uploadedBy) {
    entryWhere.uploadedBy = { contains: uploadedBy, mode: "insensitive" };
  }
  if (dateFrom || dateTo) {
    entryWhere.uploadedAt = {};
    if (dateFrom) entryWhere.uploadedAt.gte = new Date(dateFrom);
    if (dateTo) {
      // Include the full end day
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      entryWhere.uploadedAt.lte = end;
    }
  }

  // Text search: match any of the searchable text fields
  if (q) {
    entryWhere.OR = [
      { filename: { contains: q, mode: "insensitive" } },
      { masterTranscript: { contains: q, mode: "insensitive" } },
      { uploadedBy: { contains: q, mode: "insensitive" } },
    ];
  }

  const entries = await prisma.knowledgeEntry.findMany({
    where: entryWhere,
    include: {
      project: true,
      extraction: true,
    },
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });

  // ── Post-process: determine matched fields, apply JSON search, build snippets ─
  const results: SearchResultItem[] = [];

  for (const entry of entries) {
    const matchedFields: MatchedField[] = [];
    const lq = q.toLowerCase();

    // Determine which fields matched
    if (!q) {
      // No query — show all (filter-only search)
    } else {
      if (entry.filename.toLowerCase().includes(lq)) matchedFields.push("filename");
      if (entry.masterTranscript.toLowerCase().includes(lq)) matchedFields.push("masterTranscript");

      if (entry.extraction) {
        const ex = entry.extraction;
        if (ex.summary?.toLowerCase().includes(lq)) matchedFields.push("summary");
        if (jsonContains(ex.changeRequests, q)) matchedFields.push("changeRequests");
        if (jsonContains(ex.actionItems, q)) matchedFields.push("actionItems");
        if (jsonContains(ex.projectModules, q)) matchedFields.push("projectModules");
        if (jsonContains(ex.mentionedAssets, q)) matchedFields.push("mentionedAssets");
        if (jsonContains(ex.peopleMentioned, q)) matchedFields.push("peopleMentioned");
        if (jsonContains(ex.decisions, q)) matchedFields.push("decisions");
      }

      // If nothing matched after JSON checks (can happen if only JSON fields match),
      // skip this entry — the Prisma OR only covers filename/transcript/uploadedBy
      // but JSON fields are post-filtered here. Re-include if JSON matched.
      const textFieldMatched =
        entry.filename.toLowerCase().includes(lq) ||
        entry.masterTranscript.toLowerCase().includes(lq) ||
        entry.uploadedBy.toLowerCase().includes(lq);

      const jsonFieldMatched = matchedFields.some(
        (f) => !["filename", "masterTranscript"].includes(f)
      );

      if (!textFieldMatched && !jsonFieldMatched) continue;
    }

    // Build transcript snippet — prefer summary if it matched, else transcript
    let transcriptSnippet = "";
    if (q && entry.extraction?.summary?.toLowerCase().includes(lq)) {
      transcriptSnippet = buildSnippet(entry.extraction.summary, q);
    } else if (q) {
      transcriptSnippet = buildSnippet(entry.masterTranscript, q);
    } else {
      transcriptSnippet = entry.masterTranscript.slice(0, SNIPPET_WINDOW);
    }

    results.push({
      id: entry.id,
      filename: entry.filename,
      sourceType: entry.sourceType,
      uploadedBy: entry.uploadedBy,
      uploadedAt: entry.uploadedAt.toISOString(),
      project: { id: entry.project.id, name: entry.project.name },
      summary: entry.extraction?.summary ?? null,
      transcriptSnippet,
      matchedFields,
    });
  }

  return results;
}

/** Fetch distinct uploadedBy values for the filter dropdown. */
export async function getUploaders(): Promise<string[]> {
  const rows = await prisma.knowledgeEntry.findMany({
    select: { uploadedBy: true },
    distinct: ["uploadedBy"],
    orderBy: { uploadedBy: "asc" },
  });
  return rows.map((r) => r.uploadedBy);
}

/** Fetch all projects for the filter dropdown. */
export async function getProjects(): Promise<{ id: string; name: string }[]> {
  return prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
