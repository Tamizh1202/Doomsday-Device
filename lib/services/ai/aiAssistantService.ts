import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/database/prisma";
import { getDefaultProject } from "@/lib/services/knowledge/knowledgeService";

const EMBEDDING_MODEL = "gemini-embedding-001";
const GENERATION_MODEL = "gemini-1.5-flash";
const TOP_K = 5;
const MIN_SCORE = 0.3;

// ── Types ──────────────────────────────────────────────────────────────────────

export type AiSource = {
  entryId: string;
  filename: string;
  score: number;
};

export type AiAssistantResponse = {
  answer: string;
  sources: AiSource[];
  retrievedCount: number;
};

type RetrievedEntry = {
  entryId: string;
  filename: string;
  score: number;
  masterTranscript: string;
  summary: string | null;
  changeRequests: unknown[];
  actionItems: unknown[];
  decisions: unknown[];
  peopleMentioned: unknown[];
  mentionedAssets: unknown[];
  modules: string[];
};

// ── Embedding ──────────────────────────────────────────────────────────────────

async function embedQuestion(question: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(question);
  return result.embedding.values;
}

// ── Cosine similarity ──────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Retrieval ──────────────────────────────────────────────────────────────────

async function retrieveRelevantEntries(
  questionEmbedding: number[],
  projectId: string
): Promise<RetrievedEntry[]> {
  const embeddings = await prisma.knowledgeEmbedding.findMany({
    where: { entry: { projectId } },
    select: {
      knowledgeEntryId: true,
      embedding: true,
      entry: {
        select: {
          filename: true,
          masterTranscript: true,
          extraction: {
            select: {
              summary: true,
              changeRequests: true,
              actionItems: true,
              decisions: true,
              peopleMentioned: true,
              mentionedAssets: true,
            },
          },
          entryModules: {
            select: { module: { select: { name: true } } },
          },
        },
      },
    },
  });

  const scored = embeddings
    .map((row) => ({
      entryId: row.knowledgeEntryId,
      filename: row.entry.filename,
      score: cosineSimilarity(questionEmbedding, row.embedding as number[]),
      masterTranscript: row.entry.masterTranscript,
      summary: row.entry.extraction?.summary ?? null,
      changeRequests: (row.entry.extraction?.changeRequests as unknown[]) ?? [],
      actionItems: (row.entry.extraction?.actionItems as unknown[]) ?? [],
      decisions: (row.entry.extraction?.decisions as unknown[]) ?? [],
      peopleMentioned: (row.entry.extraction?.peopleMentioned as unknown[]) ?? [],
      mentionedAssets: (row.entry.extraction?.mentionedAssets as unknown[]) ?? [],
      modules: row.entry.entryModules.map((em) => em.module.name),
    }))
    .filter((e) => e.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  return scored;
}

// ── Prompt construction ────────────────────────────────────────────────────────

function buildPrompt(question: string, entries: RetrievedEntry[]): string {
  const contextBlocks = entries.map((e, i) => {
    const lines: string[] = [
      `--- Document ${i + 1}: "${e.filename}" (relevance: ${(e.score * 100).toFixed(0)}%) ---`,
    ];
    if (e.summary) lines.push(`Summary: ${e.summary}`);
    if (e.changeRequests.length) {
      const items = (e.changeRequests as { description?: string }[])
        .map((r) => r.description ?? String(r))
        .join("; ");
      lines.push(`Change Requests: ${items}`);
    }
    if (e.actionItems.length) {
      const items = (e.actionItems as { task?: string }[])
        .map((a) => a.task ?? String(a))
        .join("; ");
      lines.push(`Action Items: ${items}`);
    }
    if (e.decisions.length) {
      lines.push(`Decisions: ${(e.decisions as string[]).join("; ")}`);
    }
    if (e.peopleMentioned.length) {
      lines.push(`People Mentioned: ${(e.peopleMentioned as string[]).join(", ")}`);
    }
    if (e.mentionedAssets.length) {
      lines.push(`Assets: ${(e.mentionedAssets as string[]).join(", ")}`);
    }
    if (e.modules.length) {
      lines.push(`Modules: ${e.modules.join(", ")}`);
    }
    lines.push(`\nFull Transcript:\n${e.masterTranscript.slice(0, 3000)}`);
    return lines.join("\n");
  });

  return `You are an AI Knowledge Assistant for a creative agency project management tool called Doomsday Device.

Your ONLY source of truth is the project knowledge provided below.
You must NEVER use your general training knowledge to answer questions.
You must NEVER invent facts, people, decisions, or details.
If the answer cannot be found in the provided knowledge, respond ONLY with:
"I couldn't find information related to that within this project's knowledge."

Answer using structured sections. Prefer bullet points over paragraphs.
Use clear headings where appropriate (e.g. Summary, Action Items, Change Requests, Decisions, People Mentioned).
Be concise and professional.

===== PROJECT KNOWLEDGE =====

${contextBlocks.join("\n\n")}

===== END OF KNOWLEDGE =====

User Question: ${question}

Answer (based strictly on the knowledge above):`;
}

// ── Generation ─────────────────────────────────────────────────────────────────

async function generateAnswer(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: GENERATION_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function askAssistant(
  question: string,
  projectId?: string
): Promise<AiAssistantResponse> {
  const pid = projectId ?? (await getDefaultProject()).id;

  const questionEmbedding = await embedQuestion(question);
  const entries = await retrieveRelevantEntries(questionEmbedding, pid);

  if (entries.length === 0) {
    return {
      answer: "I couldn't find information related to that within this project's knowledge.",
      sources: [],
      retrievedCount: 0,
    };
  }

  const prompt = buildPrompt(question, entries);
  const answer = await generateAnswer(prompt);

  return {
    answer,
    sources: entries.map((e) => ({ entryId: e.entryId, filename: e.filename, score: e.score })),
    retrievedCount: entries.length,
  };
}

