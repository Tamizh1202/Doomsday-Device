import { prisma } from "@/lib/database/prisma";
import type { KnowledgeExtraction } from "@prisma/client";
import { getEmbeddingModel, EMBEDDING_MODEL } from "@/lib/ai/geminiConfig";

function buildEmbeddingText(extraction: KnowledgeExtraction): string {
  const parts: string[] = [];

  if (extraction.summary) {
    parts.push(`Summary: ${extraction.summary}`);
  }

  const changeRequests = extraction.changeRequests as { description: string }[];
  if (changeRequests?.length) {
    parts.push(`Change Requests: ${changeRequests.map((r) => r.description).join("; ")}`);
  }

  const actionItems = extraction.actionItems as { task: string }[];
  if (actionItems?.length) {
    parts.push(`Action Items: ${actionItems.map((a) => a.task).join("; ")}`);
  }

  const mentionedAssets = extraction.mentionedAssets as string[];
  if (mentionedAssets?.length) {
    parts.push(`Mentioned Assets: ${mentionedAssets.join(", ")}`);
  }

  const peopleMentioned = extraction.peopleMentioned as string[];
  if (peopleMentioned?.length) {
    parts.push(`People Mentioned: ${peopleMentioned.join(", ")}`);
  }

  const decisions = extraction.decisions as string[];
  if (decisions?.length) {
    parts.push(`Decisions: ${decisions.join("; ")}`);
  }

  const projectModules = extraction.projectModules as string[];
  if (projectModules?.length) {
    parts.push(`Project Modules: ${projectModules.join(", ")}`);
  }

  return parts.join("\n\n");
}

export async function generateAndStoreEmbedding(
  knowledgeEntryId: string,
  extraction: KnowledgeExtraction
): Promise<number[]> {
  const text = buildEmbeddingText(extraction);
  if (!text.trim()) throw new Error("No embeddable content in extraction.");

  const model = getEmbeddingModel();

  const result = await model.embedContent(text);
  const embedding = result.embedding.values;

  console.log(
    `[EmbeddingService] Generated embedding for ${knowledgeEntryId} — ${embedding.length} dimensions`
  );

  await prisma.knowledgeEmbedding.upsert({
    where: { knowledgeEntryId },
    create: { knowledgeEntryId, embedding, model: EMBEDDING_MODEL },
    update: { embedding, model: EMBEDDING_MODEL },
  });

  return embedding;
}

export async function getStoredEmbedding(
  knowledgeEntryId: string
): Promise<number[] | null> {
  const record = await prisma.knowledgeEmbedding.findUnique({
    where: { knowledgeEntryId },
  });
  if (!record) return null;
  return record.embedding as number[];
}

export async function regenerateEmbedding(knowledgeEntryId: string): Promise<void> {
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: knowledgeEntryId },
    include: { extraction: true },
  });
  if (!entry?.extraction) {
    throw new Error("No extraction found for this entry — cannot regenerate embedding.");
  }
  await generateAndStoreEmbedding(knowledgeEntryId, entry.extraction);
}
