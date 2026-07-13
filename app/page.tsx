"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import Link from "next/link";
import type { ExtractionResult } from "@/types/extraction";

type ApiResponse =
  | { result: ExtractionResult; entryId: string }
  | { error: string };

const ACCEPTED = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [plainText, setPlainText] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [entryId, setEntryId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setResult(null);
      setEntryId("");
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: false,
  });

  async function handleSubmit() {
    setError("");
    setResult(null);
    setEntryId("");

    if (!file && !plainText.trim()) {
      setError("Please upload a file or enter plain text.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      if (file) {
        form.append("file", file);
      } else {
        form.append("text", plainText);
      }
      form.append("uploadedBy", uploadedBy.trim() || "Anonymous");

      const res = await fetch("/api/extract", { method: "POST", body: form });
      const json: ApiResponse = await res.json();

      if ("error" in json) {
        setError(json.error);
      } else {
        setResult(json.result);
        setEntryId(json.entryId);
        console.log("[ExtractionResult]", json.result);
        console.log("[KnowledgeEntry ID]", json.entryId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setFile(null);
    setPlainText("");
    setResult(null);
    setEntryId("");
    setError("");
  }

  return (
    <main className="p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a file to extract and save it to the Knowledge Base.
          </p>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-gray-400"
          }`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="space-y-1">
              <p className="font-medium text-gray-800">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB &mdash; {file.type || "unknown type"}
              </p>
              <p className="text-xs text-blue-600 mt-2">Click or drag to replace</p>
            </div>
          ) : isDragActive ? (
            <p className="text-blue-600 font-medium">Drop the file here…</p>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-600">Drag &amp; drop a file here</p>
              <p className="text-sm text-gray-400">PNG, JPG, WEBP, PDF, DOCX, TXT</p>
              <button
                type="button"
                className="mt-2 px-4 py-2 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              >
                Browse File
              </button>
            </div>
          )}
        </div>

        {/* Plain text */}
        {!file && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Or paste plain text</label>
            <textarea
              rows={5}
              value={plainText}
              onChange={(e) => setPlainText(e.target.value)}
              placeholder="Paste your text here…"
              className="w-full border border-gray-300 rounded p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Uploader name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Your name (optional)</label>
          <input
            type="text"
            value={uploadedBy}
            onChange={(e) => setUploadedBy(e.target.value)}
            placeholder="e.g. Tamizh"
            className="w-full border border-gray-300 rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Extracting & Saving…" : "Extract & Save"}
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded border border-gray-300 hover:bg-gray-200"
          >
            Clear
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Success + Result */}
        {result && entryId && (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="p-4 bg-green-50 border border-green-200 rounded flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">✅ Saved to Knowledge Base</p>
                <p className="text-xs text-green-600 mt-0.5">Entry ID: {entryId}</p>
              </div>
              <Link
                href={`/knowledge/${entryId}`}
                className="px-3 py-1.5 bg-green-700 text-white text-xs font-medium rounded hover:bg-green-800"
              >
                View Entry →
              </Link>
            </div>

            {/* Metadata cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetaCard label="File Type" value={result.fileType} />
              <MetaCard label="Model Used" value={result.modelUsed} />
              <MetaCard
                label="Processing Time"
                value={result.modelUsed === "passthrough" ? "—" : `${result.processingTime} ms`}
              />
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 space-y-1">
                {result.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
              </div>
            )}

            {/* Extracted text */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Extracted Text</p>
              <pre className="whitespace-pre-wrap break-words bg-white border border-gray-200 rounded p-4 text-sm font-mono text-gray-800 max-h-[32rem] overflow-y-auto leading-relaxed">
                {result.extractedText || "(no text extracted)"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 truncate" title={value}>{value}</p>
    </div>
  );
}
