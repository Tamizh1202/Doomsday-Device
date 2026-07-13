import { NextRequest, NextResponse } from "next/server";
import { askAssistant } from "@/lib/services/ai/aiAssistantService";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "question is required." }, { status: 400 });
    }

    const result = await askAssistant(question, body?.projectId ?? undefined);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/ai/ask] Failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
