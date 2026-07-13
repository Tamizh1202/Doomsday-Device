import Link from "next/link";
import type { RelatedDocumentResult } from "@/lib/services/embeddings/similarityService";

const FILE_ICONS: Record<string, string> = {
  image: "🖼️", pdf: "📄", docx: "📝", text: "📋", "plain-text": "📋",
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

async function fetchRelated(entryId: string): Promise<RelatedDocumentResult[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/knowledge/${entryId}/related`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.related ?? [];
}

export async function RelatedDocuments({ entryId }: { entryId: string }) {
  const related = await fetchRelated(entryId);

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-gray-900 text-lg">Related Documents</h2>

      {related.length === 0 ? (
        <p className="text-sm text-gray-400">No related documents found yet.</p>
      ) : (
        <div className="space-y-3">
          {related.map((doc) => (
            <Link key={doc.id} href={`/knowledge/${doc.id}`} className="block group">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 transition-all">
                <span className="text-2xl select-none pt-0.5">
                  {FILE_ICONS[doc.sourceType] ?? "📁"}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
                      {doc.filename}
                    </p>
                    <span className="shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                      {Math.round(doc.score * 100)}% Match
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {formatDate(doc.uploadedAt)}
                  </p>
                  {doc.summary && (
                    <p className="text-sm text-gray-600 line-clamp-2">{doc.summary}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
