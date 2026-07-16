import { prisma } from "@/lib/database/prisma";
import type { KnowledgeEntry, Project } from "@prisma/client";
import path from "path";
import fs from "fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

export type KnowledgeEntryWithProject = KnowledgeEntry & { project: Project };

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/**
 * Save a file buffer.
 * - Production (Vercel): uploads to Vercel Blob, returns the public blob URL.
 * - Development (local): saves to ./uploads/, returns the stored filename.
 */
export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const timestamp = Date.now();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${timestamp}_${safe}`;

  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${storedName}`, buffer, { access: "public" });
    console.log(`[KnowledgeService] Uploaded to Vercel Blob: ${blob.url}`);
    return blob.url;
  }

  await ensureUploadsDir();
  const fullPath = path.join(UPLOADS_DIR, storedName);
  await fs.writeFile(fullPath, buffer);
  console.log(`[KnowledgeService] Saved local file: ${fullPath}`);
  return storedName;
}

/**
 * Read a stored file.
 * - If storedFilename is a URL (blob), fetch it.
 * - Otherwise read from local disk.
 */
export async function readStoredFile(storedFilename: string): Promise<Buffer> {
  if (storedFilename.startsWith("http://") || storedFilename.startsWith("https://")) {
    const res = await fetch(storedFilename);
    if (!res.ok) throw new Error(`Failed to fetch blob: ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const fullPath = path.join(UPLOADS_DIR, storedFilename);
  return fs.readFile(fullPath);
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

export async function listKnowledgeEntries(): Promise<KnowledgeEntryWithProject[]> {
  const project = await getDefaultProject();
  return prisma.knowledgeEntry.findMany({
    where: { projectId: project.id },
    include: { project: true },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntryWithProject | null> {
  return prisma.knowledgeEntry.findUnique({
    where: { id },
    include: { project: true },
  });
}
