"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Module = { id: string; name: string; description: string | null };

const COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-teal-100 text-teal-700 border-teal-200",
];

function badgeColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % COLORS.length;
  return COLORS[hash];
}

export function ModuleBadges({ entryId }: { entryId: string }) {
  const [modules, setModules] = useState<Module[] | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      const res = await fetch(`/api/knowledge/${entryId}/modules`);
      if (!res.ok) return;
      const data = await res.json();
      const mods: Module[] = data.modules ?? [];
      if (!active) return;
      setModules(mods);
      // If none assigned yet, keep polling briefly (assignment is async)
      if (mods.length === 0) {
        setTimeout(poll, 4000);
      }
    }

    poll();
    return () => { active = false; };
  }, [entryId]);

  if (modules === null) return null; // loading — show nothing
  if (modules.length === 0) return null; // still assigning or genuinely empty

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
      <h2 className="font-semibold text-gray-900">Modules</h2>
      <div className="flex flex-wrap gap-2">
        {modules.map((mod) => (
          <Link
            key={mod.id}
            href={`/modules/${mod.id}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-opacity hover:opacity-80 ${badgeColor(mod.name)}`}
          >
            {mod.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
