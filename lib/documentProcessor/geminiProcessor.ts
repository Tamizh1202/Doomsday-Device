import type { Part } from "@google/generative-ai";
import type {
  DocumentProcessorInterface,
  ExtractionResult,
  ProcessorInput,
  SupportedFileType,
} from "@/types/extraction";
import {
  getGenerationModel,
  getGenerationModelName,
  DETERMINISTIC_GENERATION_CONFIG,
} from "@/lib/ai/geminiConfig";

/**
 * Core extraction rules injected into every prompt.
 * Gemini is responsible ONLY for extracting and organising visible content.
 * It must never analyse, interpret, describe, or observe.
 */
const BASE_RULES = `
STRICT RULES — no exceptions:
- Extract only what is explicitly visible in the document.
- Do NOT summarise, paraphrase, interpret, categorise, or prioritise.
- Do NOT invent, infer, or add anything not present in the document.
- Do NOT correct spelling, grammar, or punctuation.
- Do NOT generate observations, notes, descriptions, or explanations.
- Do NOT produce sections like "Notes", "Observations", "This appears to be", or "The document contains".
- Preserve every sender name, recipient, timestamp, number, price, and date exactly as written.
- Preserve document order, message order, and page order exactly.
- If a section has no content, omit it entirely. Never output empty headings.
- Output Markdown only. No preamble. No closing remarks.
`.trim();

/**
 * Per-file-type prompts.
 * Each prompt produces a predictable Markdown structure.
 * Metadata (filename, upload time, document type) is injected by the application — NOT by Gemini.
 */
const PROMPTS: Record<string, string> = {

  image: `You are a forensic transcription engine. Your only job is to extract visible text and describe visible annotations.

${BASE_RULES}

Additional rules for annotations:
- Do NOT infer client intent from annotations.
- Do NOT convert annotations into change requests or action items.
- Describe only what is visually observable.
- Associate a nearby comment to an annotation ONLY when the visual relationship is unambiguous. Do NOT guess.

─── STEP 1: ANNOTATION DETECTION (do this first) ───

Before transcribing text, inspect the image for human-drawn annotations: highlights, circles, arrows, underlines, or freehand marks.

If ANY annotations are present, output this section FIRST:

## Visual Annotations

For each annotation, output a block in this exact format:

**Annotation [N]**

**Type:** <Highlight | Circle | Arrow | Underline | Freehand Mark | Other>
**Location:** <Top | Upper Left | Upper Right | Centre | Lower Left | Lower Right | Bottom | or a natural spanning description>
**Marked Content:** <Describe the actual content enclosed or marked — name the specific elements visible inside the annotation (e.g. "The document title, SEO meta description and introductory paragraph are enclosed within a freehand outline." not "heading and first paragraph"). Make the description understandable without seeing the image.>
**Associated Comment:** <If a message in the conversation immediately follows or clearly refers to this marked region, copy it exactly as written. If no association is visually obvious, write: None identified.>

Rules for Marked Content:
- Name the specific content enclosed, not just its position or generic label.
- Focus on WHAT is marked, not the shape of the annotation.
- Prefer: "The hero banner and call-to-action button" over "the top section".
- Prefer: "The pricing table" over "a table".
- Do NOT interpret why it is marked.

Rules for Associated Comment:
- Only associate a comment when the relationship is visually unambiguous: a message immediately below the image, a reply directly after the image, or text that clearly references the marked region.
- Copy the comment exactly as written — do not paraphrase.
- If uncertain, write: None identified.

Repeat for every distinct annotation found. Number them sequentially.

If NO annotations are present, omit the Visual Annotations section entirely.

─── STEP 2: TEXT TRANSCRIPTION ───

After the annotation section (if any), transcribe all visible text.

Determine what the screenshot contains (WhatsApp chat, email, webpage, photo, or mixed content) and use the matching structure.

─── WHATSAPP SCREENSHOT ───

## WhatsApp Screenshot

For each message, use:

**Sender:** <name exactly as shown>
**Timestamp:** <timestamp exactly as shown>

> <message text exactly as shown>

Repeat this block for every message in order. Do not merge messages.

If the client wrote a message alongside the screenshot, place it under:

### Client Message

<Client-written text only. Exactly as written.>

─── EMAIL / GMAIL SCREENSHOT ───

## Email Screenshot

**Sender:** <sender name and address exactly as shown>
**Recipient:** <recipient exactly as shown, omit if not visible>
**Subject:** <subject line exactly as shown>
**Timestamp:** <timestamp exactly as shown>

### Email Body

<Full visible email body, exactly as shown, line by line.>

### Client Message

<Only if the client wrote something alongside the screenshot. Omit if absent.>

─── OTHER SCREENSHOT (webpage, image, document photo, mixed) ───

## Screenshot

### On-Screen Text

<Every word visible on screen, in reading order, exactly as it appears. Preserve layout using line breaks.>

### Client Message

<Only if the client wrote something alongside the screenshot. Omit if absent.>

Begin with annotation detection, then transcription:`,


  pdf: `You are a forensic transcription engine. Your only job is to extract visible text from a PDF.

${BASE_RULES}

Output structure:

## PDF

Transcribe each page separately. Do not merge pages.

### Page 1

<All text from page 1 exactly as it appears. Preserve headings, lists, tables, and paragraph breaks.>

### Page 2

<All text from page 2 exactly as it appears.>

Continue for every page in order.

Begin extraction now:`,


  docx: `You are a forensic transcription engine. Your only job is to extract visible text from a Word document.

${BASE_RULES}

Output structure:

## Document

Preserve the original document hierarchy exactly:
- Use ## for top-level headings found in the document.
- Use ### for sub-headings found in the document.
- Preserve bullet points with - markers.
- Preserve numbered lists with their original numbers.
- Represent tables as Markdown tables.
- Preserve all paragraph breaks.

Do not add headings that are not in the original document.

Begin extraction now:`,


  xlsx: `You are a forensic transcription engine. Your only job is to preserve spreadsheet data exactly as provided.

${BASE_RULES}

The spreadsheet data has been pre-extracted and is provided as structured text below.
Your job is to reformat it cleanly into Markdown tables — do NOT alter any values.

Output structure:

## Spreadsheet

For each sheet provided, output:

### Sheet: <sheet name>

Render the data as a Markdown table with proper column headers.
If there are no headers in the data, use Column 1, Column 2, etc.
Preserve every cell value exactly — numbers, dates, formulas as text, empty cells as blank table cells.

Begin extraction now:`,


  csv: `You are a forensic transcription engine. Your only job is to preserve CSV data exactly as provided.

${BASE_RULES}

The CSV data has been pre-extracted and is provided as structured text below.
Your job is to reformat it cleanly into a Markdown table — do NOT alter any values.

Output structure:

## CSV Data

Render the data as a Markdown table.
Use the first row as column headers if present.
Preserve every cell value exactly — numbers, text, empty cells as blank table cells.

Begin extraction now:`,


  pptx: `You are a forensic transcription engine. Your only job is to extract visible text from a PowerPoint presentation.

${BASE_RULES}

The presentation content has been pre-extracted and is provided as structured text below.
Your job is to reformat it cleanly — do NOT alter any content.

Output structure:

## Presentation

For each slide provided, output:

### Slide <N>

**Title:** <slide title exactly as written, omit if absent>

**Body:**
<All body text exactly as written, preserving bullet points with - markers>

**Notes:**
<Speaker notes exactly as written, omit section if no notes>

Begin extraction now:`,


  text: `You are a forensic transcription engine. Your only job is to preserve plain text exactly.

${BASE_RULES}

Output structure:

## Plain Text

<The full text content exactly as provided. Preserve all line breaks and spacing.>

Begin extraction now:`,
};

/** Maps MIME types to supported file types */
const SUPPORTED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function detectFileType(mimeType: string, fileName: string): SupportedFileType {
  if (SUPPORTED_IMAGE_MIMES.has(mimeType)) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.toLowerCase().endsWith(".docx")
  ) return "docx";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileName.toLowerCase().endsWith(".xlsx")
  ) return "xlsx";
  if (
    mimeType === "text/csv" ||
    mimeType === "application/csv" ||
    fileName.toLowerCase().endsWith(".csv")
  ) return "csv";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    fileName.toLowerCase().endsWith(".pptx")
  ) return "pptx";
  if (mimeType === "text/plain") return "text";
  throw new Error(
    `Unsupported file type: ${mimeType} (${fileName}). Supported: images (PNG/JPG/WEBP), PDF, DOCX, XLSX, CSV, PPTX, plain text.`
  );
}

// ── Pre-processors ─────────────────────────────────────────────────────────────
// These convert binary formats to plain text before sending to Gemini.
// Gemini never receives binary XLSX/CSV/PPTX — only structured text derived from them.

function extractXlsx(buffer: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // sheet_to_csv preserves structure faithfully; we wrap it so Gemini sees the sheet name
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim().length === 0) continue;
    sections.push(`[Sheet: ${sheetName}]\n${csv}`);
  }

  return sections.join("\n\n");
}

function extractCsv(buffer: Buffer): string {
  // CSV is plain text — decode and return directly
  return buffer.toString("utf-8");
}

async function extractPptx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const officeparser = require("officeparser") as {
    parseOfficeAsync: (input: Buffer | string, config?: Record<string, unknown>) => Promise<string>;
  };
  const text = await officeparser.parseOfficeAsync(buffer, { outputErrorToConsole: false });
  return text;
}

/**
 * Builds the metadata header that is prepended to every transcript by the application.
 * This keeps application-generated facts out of the Gemini prompt entirely.
 */
export function buildTranscriptHeader(opts: {
  fileType: string;
  fileName: string;
  uploadedAt: Date;
}): string {
  const docTypeLabel: Record<string, string> = {
    image: "Image",
    pdf: "PDF",
    docx: "DOCX",
    xlsx: "Spreadsheet (XLSX)",
    csv: "CSV",
    pptx: "Presentation (PPTX)",
    text: "Plain Text",
    "plain-text": "Plain Text",
  };

  const lines = [
    "# Master Transcript",
    "",
    `**Document Type:** ${docTypeLabel[opts.fileType] ?? opts.fileType}`,
    `**Original Filename:** ${opts.fileName}`,
    `**Uploaded At:** ${opts.uploadedAt.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })}`,
    "**Transcript Version:** 1",
    "**Source:** Manual Upload",
    "",
    "---",
    "",
  ];

  return lines.join("\n");
}

export class GeminiProcessor implements DocumentProcessorInterface {
  private readonly model: string;

  constructor() {
    this.model = getGenerationModelName();
  }

  async process(input: ProcessorInput): Promise<ExtractionResult> {
    const start = Date.now();
    const uploadedAt = new Date();

    // ── Plain text passthrough ──────────────────────────────────────────────
    if (input.kind === "text") {
      console.log("[GeminiProcessor] Plain text input — returning as-is.");
      const header = buildTranscriptHeader({
        fileType: "plain-text",
        fileName: "plain-text.txt",
        uploadedAt,
      });
      return {
        extractedText: header + "## Plain Text\n\n" + input.content,
        processingTime: Date.now() - start,
        modelUsed: "passthrough",
        fileType: "plain-text",
        warnings: [],
      };
    }

    // ── File processing ─────────────────────────────────────────────────────
    const { buffer, mimeType, fileName } = input;
    const fileType = detectFileType(mimeType, fileName);

    console.log(`[GeminiProcessor] Detected file type: ${fileType}`);
    console.log(`[GeminiProcessor] Sending document to Gemini (model: ${this.model})...`);

    const warnings: string[] = [];
    let parts: Part[];

    if (fileType === "docx") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth") as {
        extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: { message: string }[] }>;
      };
      console.log("[GeminiProcessor] Extracting DOCX text with mammoth...");
      const result = await mammoth.extractRawText({ buffer });
      if (result.messages.length > 0) {
        warnings.push(...result.messages.map((m) => m.message));
      }
      parts = [{ text: PROMPTS.docx }, { text: result.value }];

    } else if (fileType === "xlsx") {
      console.log("[GeminiProcessor] Extracting XLSX data with xlsx library...");
      const extracted = extractXlsx(buffer);
      console.log(`[GeminiProcessor] Extracted ${extracted.length} chars from XLSX`);
      parts = [{ text: PROMPTS.xlsx }, { text: extracted }];

    } else if (fileType === "csv") {
      console.log("[GeminiProcessor] Decoding CSV...");
      const extracted = extractCsv(buffer);
      parts = [{ text: PROMPTS.csv }, { text: extracted }];

    } else if (fileType === "pptx") {
      console.log("[GeminiProcessor] Extracting PPTX text with officeparser...");
      const extracted = await extractPptx(buffer);
      console.log(`[GeminiProcessor] Extracted ${extracted.length} chars from PPTX`);
      parts = [{ text: PROMPTS.pptx }, { text: extracted }];

    } else {
      // image, pdf, text — send as inline binary data
      const base64 = buffer.toString("base64");
      const prompt = PROMPTS[fileType] ?? PROMPTS.image;
      parts = [
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ];
    }

    console.log("[GeminiProcessor] Waiting for Gemini response...");
    const generativeModel = getGenerationModel();
    const response = await generativeModel.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: DETERMINISTIC_GENERATION_CONFIG,
    });
    const geminiOutput = response.response.text().trim();

    // Prepend application-generated metadata header
    const header = buildTranscriptHeader({ fileType, fileName, uploadedAt });
    const extractedText = header + geminiOutput;

    const processingTime = Date.now() - start;
    console.log(`[GeminiProcessor] Processing completed in ${processingTime}ms. Model: ${this.model}`);

    return { extractedText, processingTime, modelUsed: this.model, fileType, warnings };
  }
}
