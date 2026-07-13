import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule, getEntriesForModule } from "@/lib/services/modules/moduleService";

function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const FILE_ICONS: Record<string, string> = {
  image: "🖼️", pdf: "📄", docx: "📝", text: "📋", "plain-text": "📋",
};

export default async function ModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [mod, entries] = await Promise.all([
    getModule(id),
    getEntriesForModule(id),
  ]);

  if (!mod) notFound();

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400">
          <Link href="/modules" className="hover:text-gray-600">Modules</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 font-medium">{mod.name}</span>
        </nav>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{mod.name}</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {mod.project.name} · {mod._count.entryModules} document{mod._count.entryModules !== 1 ? "s" : ""}
          </p>
          {mod.description && (
            <p className="mt-2 text-sm text-gray-600">{mod.description}</p>
          )}
        </div>

        {/* Entries */}
        {entries.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No documents assigned to this module yet.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Link key={entry.id} href={`/knowledge/${entry.id}`} className="block group">
                <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl select-none">
                      {FILE_ICONS[entry.sourceType] ?? "📁"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                        {entry.filename}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {entry.project.name} · {formatDate(entry.uploadedAt)} · by {entry.uploadedBy}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase tracking-wide">
                      {entry.sourceType}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
