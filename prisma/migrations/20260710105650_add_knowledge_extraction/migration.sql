-- CreateTable
CREATE TABLE "KnowledgeExtraction" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "summary" TEXT,
    "changeRequests" JSONB NOT NULL DEFAULT '[]',
    "actionItems" JSONB NOT NULL DEFAULT '[]',
    "projectModules" JSONB NOT NULL DEFAULT '[]',
    "mentionedAssets" JSONB NOT NULL DEFAULT '[]',
    "peopleMentioned" JSONB NOT NULL DEFAULT '[]',
    "decisions" JSONB NOT NULL DEFAULT '[]',
    "priority" TEXT,

    CONSTRAINT "KnowledgeExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeExtraction_knowledgeEntryId_key" ON "KnowledgeExtraction"("knowledgeEntryId");

-- AddForeignKey
ALTER TABLE "KnowledgeExtraction" ADD CONSTRAINT "KnowledgeExtraction_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
