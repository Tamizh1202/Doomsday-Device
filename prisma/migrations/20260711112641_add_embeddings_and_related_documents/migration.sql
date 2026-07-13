-- CreateTable
CREATE TABLE "KnowledgeEmbedding" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatedDocument" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "relatedEntryId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEmbedding_knowledgeEntryId_key" ON "KnowledgeEmbedding"("knowledgeEntryId");

-- CreateIndex
CREATE INDEX "RelatedDocument_entryId_idx" ON "RelatedDocument"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "RelatedDocument_entryId_relatedEntryId_key" ON "RelatedDocument"("entryId", "relatedEntryId");

-- AddForeignKey
ALTER TABLE "KnowledgeEmbedding" ADD CONSTRAINT "KnowledgeEmbedding_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedDocument" ADD CONSTRAINT "RelatedDocument_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedDocument" ADD CONSTRAINT "RelatedDocument_relatedEntryId_fkey" FOREIGN KEY ("relatedEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
