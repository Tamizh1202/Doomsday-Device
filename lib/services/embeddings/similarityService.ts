import { prisma } from "@/lib/database/prisma";
import { generateAndStoreEmbedding, getStoredEmbedding } from "./embeddingService";
import type { KnowledgeExtraction } from "@prisma/client";
import { createEvent, TimelineEventType } from "@/lib/services/timeline/timelineService";

const TOP_K = 5;

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

export async function computeAndStoreRelated(
  knowledgeEntryId: string,
  extraction: KnowledgeExtraction
): Promise<void> {
  // Get or generate embedding for this entry
  let targetEmbedding = await getStoredEmbedding(knowledgeEntryId);
  if (!targetEmbedding) {
    targetEmbedding = await generateAndStoreEmbedding(knowledgeEntryId, extraction);
  }

  // Fetch all other entries in the same project that have embeddings
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: knowledgeEntryId },
    select: { projectId: true },
  });
  if (!entry) return;

  const siblings = await prisma.knowledgeEmbedding.findMany({
    where: {
      knowledgeEntryId: { not: knowledgeEntryId },
      entry: { projectId: entry.projectId },
    },
    select: { knowledgeEntryId: true, embedding: true },
  });

  if (siblings.length === 0) {
    console.log(`[SimilarityService] No other entries in project to compare against.`);
    return;
  }

  // Score all siblings
  const scored = siblings.map((s) => ({
    relatedEntryId: s.knowledgeEntryId,
    score: cosineSimilarity(targetEmbedding, s.embedding as number[]),
  }));

  // Sort descending, take top K
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, TOP_K);

  // Replace stored related documents for this entry
  await prisma.$transaction([
    prisma.relatedDocument.deleteMany({ where: { entryId: knowledgeEntryId } }),
    prisma.relatedDocument.createMany({
      data: top.map((t) => ({
        entryId: knowledgeEntryId,
        relatedEntryId: t.relatedEntryId,
        score: t.score,
      })),
    }),
  ]);

  console.log(
    `[SimilarityService] Stored ${top.length} related documents for ${knowledgeEntryId}` +
    ` (top score: ${top[0]?.score.toFixed(4) ?? "n/a"})`
  );

  createEvent({
    projectId: entry.projectId,
    entryId: knowledgeEntryId,
    eventType: TimelineEventType.RELATED_COMPUTED,
    title: `Found ${top.length} related document${top.length !== 1 ? "s" : ""}`,
    description: { count: top.length, topScore: top[0]?.score ?? null },
  }).catch(() => {});

  // Also update related documents for each sibling that now has this entry as a candidate
  // (Run in background — don't await)
  updateSiblingsRelated(knowledgeEntryId, entry.projectId, targetEmbedding).catch(
    (err) => console.error("[SimilarityService] Sibling update error:", err)
  );
}

async function updateSiblingsRelated(
  newEntryId: string,
  projectId: string,
  newEmbedding: number[]
): Promise<void> {
  const allEmbeddings = await prisma.knowledgeEmbedding.findMany({
    where: { entry: { projectId } },
    select: { knowledgeEntryId: true, embedding: true },
  });

  for (const sibling of allEmbeddings) {
    if (sibling.knowledgeEntryId === newEntryId) continue;

    const siblingVec = sibling.embedding as number[];
    const score = cosineSimilarity(siblingVec, newEmbedding);

    // Check if new entry should displace the current worst related doc
    const existing = await prisma.relatedDocument.findMany({
      where: { entryId: sibling.knowledgeEntryId },
      orderBy: { score: "asc" },
    });

    const worstScore = existing[0]?.score ?? -1;
    const alreadyContains = existing.some((r) => r.relatedEntryId === newEntryId);

    if (alreadyContains) continue;

    if (existing.length < TOP_K || score > worstScore) {
      await prisma.$transaction([
        // Remove worst if at capacity
        ...(existing.length >= TOP_K && existing[0]
          ? [prisma.relatedDocument.delete({ where: { id: existing[0].id } })]
          : []),
        prisma.relatedDocument.create({
          data: { entryId: sibling.knowledgeEntryId, relatedEntryId: newEntryId, score },
        }),
      ]);
    }
  }
}

export type RelatedDocumentResult = {
  id: string;
  filename: string;
  sourceType: string;
  uploadedAt: Date;
  uploadedBy: string;
  summary: string | null;
  score: number;
};

export async function getRelatedDocuments(
  knowledgeEntryId: string
): Promise<RelatedDocumentResult[]> {
  const rows = await prisma.relatedDocument.findMany({
    where: { entryId: knowledgeEntryId },
    orderBy: { score: "desc" },
    include: {
      relatedEntry: {
        select: {
          id: true,
          filename: true,
          sourceType: true,
          uploadedAt: true,
          uploadedBy: true,
          extraction: { select: { summary: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.relatedEntry.id,
    filename: r.relatedEntry.filename,
    sourceType: r.relatedEntry.sourceType,
    uploadedAt: r.relatedEntry.uploadedAt,
    uploadedBy: r.relatedEntry.uploadedBy,
    summary: r.relatedEntry.extraction?.summary ?? null,
    score: r.score,
  }));
}
