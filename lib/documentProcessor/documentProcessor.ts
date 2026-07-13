import type { DocumentProcessorInterface, ExtractionResult, ProcessorInput } from "@/types/extraction";
import { GeminiProcessor } from "./geminiProcessor";

/**
 * Returns the active document processor.
 * Swap this factory function to plug in a different provider
 * (OpenAI, Claude, local model, etc.) without touching the API route or UI.
 */
function getProcessor(): DocumentProcessorInterface {
  return new GeminiProcessor();
}

export async function processDocument(input: ProcessorInput): Promise<ExtractionResult> {
  const processor = getProcessor();
  return processor.process(input);
}
