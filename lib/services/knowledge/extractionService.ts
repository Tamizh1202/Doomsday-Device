import type { GenerativeModel } from "@google/generative-ai";
import { prisma } from "@/lib/database/prisma";
import type { KnowledgeExtraction } from "@prisma/client";
import { createEvent, TimelineEventType } from "@/lib/services/timeline/timelineService";
import { getGenerationModel, DETERMINISTIC_GENERATION_CONFIG } from "@/lib/ai/geminiConfig";

// ── Prompt ────────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a structured information extraction engine.

You will receive a Master Transcript — a faithful, verbatim record of an uploaded document.

Your job is to extract structured information from this transcript and return it as a single valid JSON object.

STRICT RULES:
- Return ONLY valid JSON. No markdown. No code blocks. No explanation. No preamble.
- Do NOT invent information. If a field has no evidence in the transcript, return null or [].
- Do NOT summarise beyond what is stated. Stay faithful to the source.
- Extract only what is explicitly present.

Return this exact JSON shape:

{
  "summary": "A concise factual summary of what this document is about. 2-4 sentences maximum. Null if not determinable.",
  "changeRequests": [
    { "description": "Exact description of the change request as stated", "requestedBy": "Name if mentioned or null" }
  ],
  "actionItems": [
    { "task": "Exact task description", "assignedTo": "Name if mentioned or null", "dueDate": "Date if mentioned or null" }
  ],
  "projectModules": ["Module name as mentioned"],
  "mentionedAssets": ["Asset name or URL exactly as mentioned"],
  "peopleMentioned": ["Full name or handle exactly as it appears"],
  "decisions": ["Exact decision statement as written"],
  "priority": "low | medium | high | critical | null — based only on explicit language in the document"
}

Master Transcript:
`;

// ── Validation ────────────────────────────────────────────────────────────────

export type ExtractionPayload = {
  summary: string | null;
  changeRequests: { description: string; requestedBy: string | null }[];
  actionItems: { task: string; assignedTo: string | null; dueDate: string | null }[];
  projectModules: string[];
  mentionedAssets: string[];
  peopleMentioned: string[];
  decisions: string[];
  priority: string | null;
};

const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical", null]);

function validatePayload(raw: unknown): ExtractionPayload {
  if (typeof raw !== "object" || raw === null) throw new Error("Response is not an object.");

  const obj = raw as Record<string, unknown>;

  const ensureStringArray = (val: unknown, field: string): string[] => {
    if (!Array.isArray(val)) return [];
    return val.filter((v) => {
      if (typeof v !== "string") {
        console.warn(`[ExtractionService] Non-string item in ${field} — skipped.`);
        return false;
      }
      return true;
    });
  };

  const changeRequests = Array.isArray(obj.changeRequests)
    ? obj.changeRequests
        .filter((v): v is { description: string; requestedBy: string | null } =>
          typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).description === "string"
        )
    : [];

  const actionItems = Array.isArray(obj.actionItems)
    ? obj.actionItems
        .filter((v): v is { task: string; assignedTo: string | null; dueDate: string | null } =>
          typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).task === "string"
        )
    : [];

  const priority = typeof obj.priority === "string" && VALID_PRIORITIES.has(obj.priority)
    ? obj.priority
    : null;

  return {
    summary: typeof obj.summary === "string" ? obj.summary : null,
    changeRequests,
    actionItems,
    projectModules: ensureStringArray(obj.projectModules, "projectModules"),
    mentionedAssets: ensureStringArray(obj.mentionedAssets, "mentionedAssets"),
    peopleMentioned: ensureStringArray(obj.peopleMentioned, "peopleMentioned"),
    decisions: ensureStringArray(obj.decisions, "decisions"),
    priority,
  };
}

// ── Gemini call ───────────────────────────────────────────────────────────────

function cleanJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function callGeminiOnce(
  generativeModel: GenerativeModel,
  masterTranscript: string,
  attempt: number
): Promise<ExtractionPayload> {
  const response = await generativeModel.generateContent({
    contents: [{ role: "user", parts: [{ text: EXTRACTION_PROMPT + masterTranscript }] }],
    generationConfig: { ...DETERMINISTIC_GENERATION_CONFIG, responseMimeType: "application/json" },
  });

  const raw = response.response.text();
  const usage = response.response.usageMetadata;
  const finishReason = response.response.candidates?.[0]?.finishReason ?? "unknown";

  console.log(
    `[ExtractionService] Attempt ${attempt} — finishReason: ${finishReason}` +
    ` | inputTokens: ${usage?.promptTokenCount ?? "?"} | outputTokens: ${usage?.candidatesTokenCount ?? "?"}` +
    ` | responseLength: ${raw.length}`
  );

  const cleaned = cleanJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(`[ExtractionService] Attempt ${attempt} — raw response:\n${raw}`);
    throw new Error(`Gemini returned invalid JSON (attempt ${attempt}): ${cleaned.slice(0, 300)}`);
  }

  return validatePayload(parsed);
}

async function callGemini(
  masterTranscript: string,
  projectId: string,
  entryId: string
): Promise<ExtractionPayload> {
  const generativeModel = getGenerationModel();

  try {
    return await callGeminiOnce(generativeModel, masterTranscript, 1);
  } catch (firstErr) {
    const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    console.warn(`[ExtractionService] Attempt 1 failed — retrying once. Reason: ${firstMsg}`);

    createEvent({
      projectId,
      entryId,
      eventType: TimelineEventType.PIPELINE_RETRY,
      title: "Retrying Knowledge Extraction",
      description: { step: "Knowledge Extraction", attempt: 2, of: 2, reason: firstMsg },
    }).catch(() => {});

    try {
      return await callGeminiOnce(generativeModel, masterTranscript, 2);
    } catch (secondErr) {
      const msg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      throw new Error(`Both extraction attempts failed. Last error: ${msg}`);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run knowledge extraction for a KnowledgeEntry.
 * Creates (or updates on retry) a KnowledgeExtraction record.
 * Never throws — failures are recorded in the DB with status="failed".
 */
export async function runExtraction(
  knowledgeEntryId: string,
  masterTranscript: string
): Promise<KnowledgeExtraction> {
  console.log(`[ExtractionService] Starting extraction for entry: ${knowledgeEntryId}`);

  // Fetch projectId once — needed for timeline events
  const entryRow = await prisma.knowledgeEntry.findUnique({
    where: { id: knowledgeEntryId },
    select: { projectId: true },
  });
  const projectId = entryRow?.projectId ?? "";

  // Upsert a pending record so the UI can show "processing" immediately
  await prisma.knowledgeExtraction.upsert({
    where: { knowledgeEntryId },
    create: { knowledgeEntryId, status: "pending" },
    update: { status: "pending", error: null },
  });

  createEvent({
    projectId,
    entryId: knowledgeEntryId,
    eventType: TimelineEventType.EXTRACTION_STARTED,
    title: "AI extraction started",
    description: {},
  }).catch(() => {});

  try {
    const payload = await callGemini(masterTranscript, projectId, knowledgeEntryId);
    console.log(`[ExtractionService] Extraction successful for entry: ${knowledgeEntryId}`);

    const updated = await prisma.knowledgeExtraction.update({
      where: { knowledgeEntryId },
      data: {
        status: "completed",
        error: null,
        summary: payload.summary,
        changeRequests: payload.changeRequests,
        actionItems: payload.actionItems,
        projectModules: payload.projectModules,
        mentionedAssets: payload.mentionedAssets,
        peopleMentioned: payload.peopleMentioned,
        decisions: payload.decisions,
        priority: payload.priority,
      },
    });

    createEvent({
      projectId,
      entryId: knowledgeEntryId,
      eventType: TimelineEventType.EXTRACTION_COMPLETED,
      title: "AI extraction completed",
      description: {
        changeRequestCount: payload.changeRequests.length,
        actionItemCount:    payload.actionItems.length,
        peopleMentioned:    payload.peopleMentioned.length,
        decisionCount:      payload.decisions.length,
        priority:           payload.priority,
      },
    }).catch(() => {});

    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ExtractionService] Extraction failed for entry ${knowledgeEntryId}:`, message);

    const failed = await prisma.knowledgeExtraction.update({
      where: { knowledgeEntryId },
      data: { status: "failed", error: message },
    });

    createEvent({
      projectId,
      entryId: knowledgeEntryId,
      eventType: TimelineEventType.EXTRACTION_FAILED,
      title: "AI extraction failed",
      description: { error: message },
    }).catch(() => {});

    return failed;
  }
}

/** Fetch the extraction record for a given entry. */
export async function getExtraction(knowledgeEntryId: string): Promise<KnowledgeExtraction | null> {
  return prisma.knowledgeExtraction.findUnique({ where: { knowledgeEntryId } });
}
