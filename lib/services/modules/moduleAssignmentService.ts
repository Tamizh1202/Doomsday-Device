import { getModulesForProject, upsertModule, assignEntryToModules } from "./moduleService";
import { prisma } from "@/lib/database/prisma";
import { createEvent, TimelineEventType } from "@/lib/services/timeline/timelineService";
import { getGenerationModel, DETERMINISTIC_GENERATION_CONFIG } from "@/lib/ai/geminiConfig";

const ASSIGNMENT_PROMPT = (
  transcript: string,
  existingModules: { name: string; description: string | null }[]
) => `
You are a project organiser at a creative agency. Your job is to assign documents to project modules.

Project modules are NOT business categories or departments.
They are reusable workstream buckets that a team member would browse months later to find related documents.

Think of them as folders inside a real agency project — the kind that emerge naturally over time.

GOOD module examples:
Homepage, Landing Pages, Mobile App, SEO Blogs, Product Pages, Email Marketing,
WhatsApp Creatives, Social Media, Meta Ads, Google Ads, Product Photography,
Packaging, Brand Guidelines, UI Design, UX Research, Dashboard, Client Feedback,
QA Testing, Bug Reports, Feature Requests, Content Writing, Copywriting,
Video Production, Brochures, Presentations, Sales Deck, Summer Campaign,
Admissions Campaign, Loyalty Campaign

BAD module examples (never create these):
Marketing, Marketing Strategy, Business, Business Growth, Design, Development,
Technology, App Development, Creative, Innovation, Communication

EXISTING MODULES for this project (reuse whenever they clearly fit — use the EXACT name shown):
${existingModules.length > 0
    ? existingModules.map((m) => `- "${m.name}"${m.description ? `: ${m.description}` : ""}`).join("\n")
    : "(none yet — you will create the first modules)"}

ASSIGNMENT RULES:
1. Always reuse an existing module when it clearly fits — never create a synonym.
   e.g. if "Landing Pages" exists, do NOT create "Landing Page" or "Website Landing Page".
2. Create a new module only when the document introduces a workstream not covered by any existing module.
3. Assign 1–4 modules per document.
4. Module names must be 2–4 words, title-cased, and name a deliverable or workstream.
5. Do NOT create modules based solely on people, filenames, dates, or one-off requests.
6. Before creating any module, ask: "Would a teammate click this folder six months later looking for similar work?"
7. Return ONLY valid JSON — no markdown, no prose.

RESPONSE FORMAT:
{
  "assignments": [
    { "name": "Module Name", "isNew": false, "description": "one-line description of what this module covers — only if isNew is true" }
  ]
}

TRANSCRIPT:
${transcript.slice(0, 6000)}
`.trim();

export async function runModuleAssignment(
  knowledgeEntryId: string,
  masterTranscript: string
): Promise<void> {
  try {
    const entry = await prisma.knowledgeEntry.findUnique({
      where: { id: knowledgeEntryId },
      select: { projectId: true },
    });
    if (!entry) return;

    const existingModules = await getModulesForProject(entry.projectId);

    const model = getGenerationModel({
      generationConfig: { ...DETERMINISTIC_GENERATION_CONFIG, responseMimeType: "application/json" },
    });

    const prompt = ASSIGNMENT_PROMPT(
      masterTranscript,
      existingModules.map((m) => ({ name: m.name, description: m.description }))
    );

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = JSON.parse(raw) as {
      assignments: { name: string; isNew: boolean; description?: string }[];
    };

    const assignments = parsed.assignments ?? [];
    const moduleIds: string[] = [];

    for (const a of assignments) {
      const mod = await upsertModule(
        entry.projectId,
        a.name,
        a.isNew ? (a.description ?? undefined) : undefined
      );
      moduleIds.push(mod.id);
    }

    await assignEntryToModules(knowledgeEntryId, moduleIds);

    createEvent({
      projectId: entry.projectId,
      entryId: knowledgeEntryId,
      eventType: TimelineEventType.MODULES_ASSIGNED,
      title: `Assigned to ${assignments.length} module${assignments.length !== 1 ? "s" : ""}`,
      description: {
        modules: assignments.map((a) => a.name),
        newModuleCount: assignments.filter((a) => a.isNew).length,
      },
    }).catch(() => {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ModuleAssignment] Failed for entry ${knowledgeEntryId}:`, message);

    // Fetch projectId for the timeline event (entry may not be in scope)
    try {
      const row = await prisma.knowledgeEntry.findUnique({
        where: { id: knowledgeEntryId },
        select: { projectId: true },
      });
      if (row) {
        createEvent({
          projectId: row.projectId,
          entryId: knowledgeEntryId,
          eventType: TimelineEventType.MODULES_FAILED,
          title: "Module Classification Failed",
          description: { step: "Module Classification", error: message },
        }).catch(() => {});
      }
    } catch {
      // Never let timeline logging crash the pipeline
    }
  }
}
