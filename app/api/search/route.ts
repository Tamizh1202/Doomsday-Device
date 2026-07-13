import { NextRequest, NextResponse } from "next/server";
import { searchKnowledge, getUploaders, getProjects } from "@/lib/services/search/searchService";
import type { SearchFilters } from "@/types/search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const filters: SearchFilters = {
      query: searchParams.get("q") ?? "",
      projectId: searchParams.get("projectId") ?? undefined,
      sourceType: searchParams.get("sourceType") ?? undefined,
      uploadedBy: searchParams.get("uploadedBy") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    };

    const [results, uploaders, projects] = await Promise.all([
      searchKnowledge(filters),
      getUploaders(),
      getProjects(),
    ]);

    return NextResponse.json({ results, uploaders, projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/search] Search failed:", message);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
