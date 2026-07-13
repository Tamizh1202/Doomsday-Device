export type SearchFilters = {
  query: string;
  projectId?: string;
  sourceType?: string;     // image | pdf | docx | text | plain-text
  uploadedBy?: string;
  dateFrom?: string;       // ISO date string
  dateTo?: string;
};

/** Which fields the query matched in — used for "Matched in:" display */
export type MatchedField =
  | "filename"
  | "masterTranscript"
  | "summary"
  | "changeRequests"
  | "actionItems"
  | "projectModules"
  | "mentionedAssets"
  | "peopleMentioned"
  | "decisions";

export const MATCHED_FIELD_LABELS: Record<MatchedField, string> = {
  filename: "Filename",
  masterTranscript: "Master Transcript",
  summary: "Summary",
  changeRequests: "Change Requests",
  actionItems: "Action Items",
  projectModules: "Project Modules",
  mentionedAssets: "Mentioned Assets",
  peopleMentioned: "People Mentioned",
  decisions: "Decisions",
};

export type SearchResultItem = {
  id: string;
  filename: string;
  sourceType: string;
  uploadedBy: string;
  uploadedAt: string;
  project: { id: string; name: string };
  summary: string | null;
  transcriptSnippet: string;
  matchedFields: MatchedField[];
};
