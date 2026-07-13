import Link from "next/link";
import { getAllModules } from "@/lib/services/modules/moduleService";

const COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-green-100 text-green-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

function colorClass(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % COLORS.length;
  return COLORS[hash];
}

export default async function ModulesPage() {
  const modules = await getAllModules();

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Modules</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {modules.length} module{modules.length !== 1 ? "s" : ""} across all projects
          </p>
        </div>

        {modules.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-3xl">🗂️</p>
            <p className="font-medium text-gray-700">No modules yet.</p>
            <p className="text-sm text-gray-400">
              Upload documents — modules are assigned automatically by AI.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map((mod) => (
              <Link key={mod.id} href={`/modules/${mod.id}`} className="block group">
                <div className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${colorClass(mod.name)}`}
                      >
                        {mod.project.name}
                      </span>
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600">
                        {mod.name}
                      </p>
                      {mod.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {mod.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
                      {mod._count.entryModules}
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
