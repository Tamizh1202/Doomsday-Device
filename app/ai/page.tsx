"use client";

import { useState } from "react";
import { SUGGESTED_QUESTIONS } from "@/lib/services/ai/aiConstants";
import type { AiAssistantResponse } from "@/lib/services/ai/aiAssistantService";

export default function AiTestPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data as AiAssistantResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Knowledge Assistant</h1>
          <p className="text-sm text-gray-500 mt-1">
            Developer test interface — answers are grounded in project knowledge only.
          </p>
        </div>

        {/* Suggested questions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Suggested Questions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-3 py-1.5 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
            placeholder="Ask anything about this project…"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            className="bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-5">

            {/* Answer */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Answer — {result.retrievedCount} document{result.retrievedCount !== 1 ? "s" : ""} retrieved
              </div>
              <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
                {result.answer}
              </div>
            </div>

            {/* Sources */}
            {result.sources.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Sources</div>
                <ul className="space-y-2">
                  {result.sources.map((s) => (
                    <li key={s.entryId} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400 text-xs tabular-nums w-12 shrink-0">
                        {(s.score * 100).toFixed(0)}%
                      </span>
                      <a
                        href={`/knowledge/${s.entryId}`}
                        className="text-indigo-600 hover:underline font-medium truncate"
                      >
                        {s.filename}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
