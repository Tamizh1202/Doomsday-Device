-- CreateTable
CREATE TABLE "ProjectModule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntryModule" (
    "entryId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeEntryModule_pkey" PRIMARY KEY ("entryId","moduleId")
);

-- CreateIndex
CREATE INDEX "ProjectModule_projectId_idx" ON "ProjectModule"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectModule_projectId_name_key" ON "ProjectModule"("projectId", "name");

-- AddForeignKey
ALTER TABLE "ProjectModule" ADD CONSTRAINT "ProjectModule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntryModule" ADD CONSTRAINT "KnowledgeEntryModule_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntryModule" ADD CONSTRAINT "KnowledgeEntryModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ProjectModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
