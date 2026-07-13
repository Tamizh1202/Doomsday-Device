import {
  GoogleGenerativeAI,
  type Part,
} from "@google/generative-ai";
import type {
  DocumentProcessorInterface,
  ExtractionResult,
  ProcessorInput,
  SupportedFileType,
} from "@/types/extraction";

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
  if (mimeType === "text/plain") return "text";
  throw new Error(
    `Unsupported file type: ${mimeType}. Supported: images (PNG/JPG/WEBP), PDF, DOCX, plain text.`
  );
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
  private readonly client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");
    if (!model) throw new Error("GEMINI_MODEL is not set in environment variables.");
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
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
    } else {
      const base64 = buffer.toString("base64");
      const prompt = PROMPTS[fileType] ?? PROMPTS.image;
      parts = [
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ];
    }

    console.log("[GeminiProcessor] Waiting for Gemini response...");
    const generativeModel = this.client.getGenerativeModel({ model: this.model });
    const response = await generativeModel.generateContent({ contents: [{ role: "user", parts }] });
    const geminiOutput = response.response.text().trim();

    // Prepend application-generated metadata header
    const header = buildTranscriptHeader({ fileType, fileName, uploadedAt });
    const extractedText = header + geminiOutput;

    const processingTime = Date.now() - start;
    console.log(`[GeminiProcessor] Processing completed in ${processingTime}ms. Model: ${this.model}`);

    return { extractedText, processingTime, modelUsed: this.model, fileType, warnings };
  }
}
