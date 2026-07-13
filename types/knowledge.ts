export type KnowledgeEntryRow = {
  id: string;
  projectId: string;
  filename: string;
  originalFileType: string;
  sourceType: string;
  uploadedBy: string;
  uploadedAt: string; // ISO string from JSON
  originalFilePath: string;
  masterTranscript: string;
  aiSummary: string | null;
  category: string | null;
  modules: string | null;
  project: { id: string; name: string };
};
