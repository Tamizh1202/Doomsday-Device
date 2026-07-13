export type SupportedFileType = "image" | "pdf" | "docx" | "text" | "plain-text";

export type ExtractionResult = {
  extractedText: string;
  processingTime: number;
  modelUsed: string;
  fileType: SupportedFileType;
  warnings: string[];
};

/** Contract every document processor must implement. */
export interface DocumentProcessorInterface {
  process(input: ProcessorInput): Promise<ExtractionResult>;
}

export type ProcessorInput =
  | { kind: "file"; buffer: Buffer; mimeType: string; fileName: string }
  | { kind: "text"; content: string };
