import { prisma } from "@/lib/database/prisma";
import type { KnowledgeEntry, Project } from "@prisma/client";
import path from "path";
import fs from "fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export type KnowledgeEntryWithProject = KnowledgeEntry & { project: Project };

/** Ensure the uploads directory exists. */
async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/** Save a file buffer to disk. Returns the relative file path. */
export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  await ensureUploadsDir();
  const timestamp = Date.now();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${timestamp}_${safe}`;
  const fullPath = path.join(UPLOADS_DIR, storedName);
  await fs.writeFile(fullPath, buffer);
  console.log(`[KnowledgeService] Saving original file: ${fullPath}`);
  return storedName;
}

/** Get or create the default project. */
export async function getDefaultProject(): Promise<Project> {
  const project = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (project) return project;
  return prisma.project.create({ data: { name: "Surge Coffee" } });
}

export type CreateEntryInput = {
  filename: string;
  originalFileType: string;
  sourceType: string;
  uploadedBy: string;
  storedFilename: string;
  masterTranscript: string;
};

/** Persist a KnowledgeEntry to the database. */
export async function createKnowledgeEntry(input: CreateEntryInput): Promise<KnowledgeEntry> {
  const project = await getDefaultProject();
  console.log("[KnowledgeService] Creating Knowledge Entry...");

  const entry = await prisma.knowledgeEntry.create({
    data: {
      projectId: project.id,
      filename: input.filename,
      originalFileType: input.originalFileType,
      sourceType: input.sourceType,
      uploadedBy: input.uploadedBy,
      originalFilePath: input.storedFilename,
      masterTranscript: input.masterTranscript,
    },
  });

  console.log(`[KnowledgeService] Knowledge Entry created: ${entry.id}`);
  return entry;
}

/** List all knowledge entries for the default project, newest first. */
export async function listKnowledgeEntries(): Promise<KnowledgeEntryWithProject[]> {
  const project = await getDefaultProject();
  return prisma.knowledgeEntry.findMany({
    where: { projectId: project.id },
    include: { project: true },
    orderBy: { uploadedAt: "desc" },
  });
}

/** Get a single knowledge entry by ID. */
export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntryWithProject | null> {
  return prisma.knowledgeEntry.findUnique({
    where: { id },
    include: { project: true },
  });
}

/** Read a stored file and return its buffer. */
export async function readStoredFile(storedFilename: string): Promise<Buffer> {
  const fullPath = path.join(UPLOADS_DIR, storedFilename);
  return fs.readFile(fullPath);
}
