import { storeMode } from "@/lib/memory-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    mode: storeMode(),
    providers: ["openai", "deepseek", "openrouter", "groq", "gemini"],
    version: "1.0.0",
  });
}
