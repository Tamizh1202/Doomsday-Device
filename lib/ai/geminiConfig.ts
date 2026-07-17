import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Single source of truth for Gemini configuration.
 * Every generation service must import from here — never hardcode a model
 * string or read process.env.GEMINI_MODEL directly elsewhere.
 */

/** Embedding model — deliberately separate from the generation model. Not env-configurable. */
export const EMBEDDING_MODEL = "gemini-embedding-001";

/** Deterministic settings for structured-output generation (extraction, module assignment, assistant). */
export const DETERMINISTIC_GENERATION_CONFIG = {
  temperature: 0,
  topP: 1,
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[GeminiConfig] Missing required environment variable: ${name}. ` +
      `Set it in .env.local (local) or the Vercel project's Environment Variables (production). ` +
      `The application will not fall back to a different model.`
    );
  }
  return value;
}

let cachedClient: GoogleGenerativeAI | null = null;
let cachedModel: string | null = null;

function getClient(): GoogleGenerativeAI {
  const apiKey = requireEnv("GEMINI_API_KEY");
  if (!cachedClient) {
    cachedClient = new GoogleGenerativeAI(apiKey);
  }
  return cachedClient;
}

/** The configured generation model name, e.g. "gemini-3.1-flash-lite". Throws if unset. */
export function getGenerationModelName(): string {
  if (!cachedModel) {
    cachedModel = requireEnv("GEMINI_MODEL");
  }
  return cachedModel;
}

/** A GenerativeModel instance for the configured generation model, with optional per-call overrides. */
export function getGenerationModel(
  options?: Parameters<GoogleGenerativeAI["getGenerativeModel"]>[0] extends infer T
    ? T extends { model: string }
      ? Omit<T, "model">
      : never
    : never
) {
  return getClient().getGenerativeModel({
    model: getGenerationModelName(),
    ...options,
  });
}

/** A GenerativeModel instance for the fixed embedding model. */
export function getEmbeddingModel() {
  return getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
}
