import { NextResponse } from "next/server";
import { getAllModules } from "@/lib/services/modules/moduleService";

export const runtime = "nodejs";

export async function GET() {
  const modules = await getAllModules();
  return NextResponse.json({ modules });
}
