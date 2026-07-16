import Link from "next/link";
import { notFound } from "next/navigation";
import type { KnowledgeEntryRow } from "@/types/knowledge";
import type { KnowledgeExtraction } from "@prisma/client";
import { ExtractionPanel } from "./ExtractionPanel";
import { ModuleBadges } from "./ModuleBadges";
import { RelatedDocuments } from "./RelatedDocuments";
import { PipelineStatus } from "./PipelineStatus";

async function getEntry(id: string): Promise<KnowledgeEntryRow | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/knowledge/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.entry ?? null;
}

async function getExtraction(id: string): Promise<KnowledgeExtraction | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/knowledge/${id}/extraction`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.extraction ?? null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entry, extraction] = await Promise.all([getEntry(id), getExtraction(id)]);
  if (!entry) notFound();

  const hasFile = entry.originalFilePath && entry.originalFilePath.length > 0;
  const fileUrl = entry.originalFilePath?.startsWith("http")
    ? entry.originalFilePath
    : entry.originalFilePath
      ? `/api/uploads/${entry.originalFilePath}`
      : null;

  return (
    <main className="p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 flex gap-2">
          <Link href="/knowledge" className="hover:text-blue-600">Knowledge Base</Link>
          <span>/</span>
          <span className="text-gray-700 truncate">{entry.filename}</span>
        </nav>

        {/* File Information */}
        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">File Information</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-sm">
            <InfoField label="Filename" value={entry.filename} />
            <InfoField label="File Type" value={entry.sourceType} />
            <InfoField label="MIME Type" value={entry.originalFileType} />
            <InfoField label="Upload Date" value={formatDateTime(entry.uploadedAt)} />
            <InfoField label="Uploaded By" value={entry.uploadedBy} />
            <InfoField label="Project" value={entry.project.name} />
          </dl>
        </section>

        {/* Original File */}
        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <h2 className="font-semibold text-gray-900 text-lg">Original File</h2>
          {hasFile ? (
            <a
              href={fileUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              <span>📎</span>
              <span>Open / Download {entry.filename}</span>
            </a>
          ) : (
            <p className="text-sm text-gray-400">No file stored (plain-text input).</p>
          )}
        </section>

        {/* Pipeline Status — client component polls while processing */}
        <PipelineStatus entryId={id} />

        {/* Module Badges — client component polls until assigned */}
        <ModuleBadges entryId={id} />

        {/* Knowledge Extraction — client component handles polling + retry */}
        <ExtractionPanel entryId={id} initialExtraction={extraction} />

        {/* Related Documents */}
        <RelatedDocuments entryId={id} />

        {/* Master Transcript — collapsible */}
        <details className="bg-white border border-gray-200 rounded-lg group">
          <summary className="p-6 cursor-pointer font-semibold text-gray-900 text-lg select-none list-none flex items-center justify-between">
            <span>Master Transcript</span>
            <span className="text-gray-400 text-sm font-normal group-open:hidden">Click to expand</span>
            <span className="text-gray-400 text-sm font-normal hidden group-open:inline">Click to collapse</span>
          </summary>
          <div className="px-6 pb-6">
            <pre className="whitespace-pre-wrap break-words text-sm font-mono text-gray-800 bg-gray-50 border border-gray-100 rounded p-4 max-h-[40rem] overflow-y-auto leading-relaxed">
              {entry.masterTranscript || "(empty transcript)"}
            </pre>
          </div>
        </details>

      </div>
    </main>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-800 break-all">{value}</dd>
    </div>
  );
}
