"use client";

type Props = { text: string; query: string };

/**
 * Renders `text` with every case-insensitive occurrence of `query` wrapped in
 * a highlighted <mark> span. Safe — splits on string, no dangerouslySetInnerHTML.
 */
export function Highlight({ text, query }: Props) {
  if (!query.trim()) return <span>{text}</span>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
