import { prisma } from "@/lib/database/prisma";

export async function getModulesForProject(projectId: string) {
  return prisma.projectModule.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { entryModules: true } },
    },
  });
}

export async function getAllModules() {
  return prisma.projectModule.findMany({
    orderBy: { name: "asc" },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { entryModules: true } },
    },
  });
}

export async function upsertModule(
  projectId: string,
  name: string,
  description?: string,
  color?: string
) {
  return prisma.projectModule.upsert({
    where: { projectId_name: { projectId, name } },
    update: { description, color },
    create: { projectId, name, description, color },
  });
}

export async function assignEntryToModules(
  entryId: string,
  moduleIds: string[]
) {
  // Remove existing assignments then re-insert
  await prisma.knowledgeEntryModule.deleteMany({ where: { entryId } });
  if (moduleIds.length > 0) {
    await prisma.knowledgeEntryModule.createMany({
      data: moduleIds.map((moduleId) => ({ entryId, moduleId })),
      skipDuplicates: true,
    });
  }
}

export async function getModulesForEntry(entryId: string) {
  const rows = await prisma.knowledgeEntryModule.findMany({
    where: { entryId },
    include: { module: true },
    orderBy: { module: { name: "asc" } },
  });
  return rows.map((r) => r.module);
}

export async function getEntriesForModule(moduleId: string) {
  const rows = await prisma.knowledgeEntryModule.findMany({
    where: { moduleId },
    include: {
      entry: { include: { project: { select: { id: true, name: true } } } },
    },
    orderBy: { assignedAt: "desc" },
  });
  return rows.map((r) => r.entry);
}

export async function getModule(moduleId: string) {
  return prisma.projectModule.findUnique({
    where: { id: moduleId },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { entryModules: true } },
    },
  });
}
