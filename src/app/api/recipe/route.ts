import { NextRequest, NextResponse } from "next/server"
import { start } from "workflow/api"
import { findRecipeWorkflow, type RecipeInput } from "@/workflows/recipe"

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

function validateImageDataUrl(dataUrl: string): { ok: true } | { ok: false; error: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,/)
  if (!match) {
    return { ok: false, error: "Image could not be read — please try a different file." }
  }
  const mimeType = match[1].toLowerCase()
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: `Unsupported image format "${mimeType}". Please upload a JPEG, PNG, WebP, or GIF. For iPhone photos (HEIC) or PDFs, try converting to JPEG first.`,
    }
  }
  return { ok: true }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/recipe",
    model: "openai/gpt-4o-mini",
    hasApiKey: !!process.env.AI_GATEWAY_API_KEY,
    workflow: "findRecipeWorkflow",
  })
}

export async function POST(request: NextRequest) {
  let body: RecipeInput
  try {
    body = (await request.json()) as RecipeInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { ingredients, imageBase64, cuisine, modifier } = body

  if (!ingredients && !imageBase64) {
    return NextResponse.json({ error: "No ingredients provided" }, { status: 400 })
  }

  if (imageBase64) {
    const check = validateImageDataUrl(imageBase64)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }
  }

  try {
    // Kick off the durable workflow and wait for its result. The workflow
    // orchestrates the Gateway call (step 1) and the Vercel Sandbox prep-time
    // computation (step 2).
    const run = await start(findRecipeWorkflow, [
      { ingredients, imageBase64, cuisine, modifier },
    ])

    const recipe = await run.returnValue

    return NextResponse.json(recipe)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[recipe] workflow error:", msg)
    const status = msg.includes("AI_GATEWAY_API_KEY") ? 500 : 502
    return NextResponse.json({ error: msg }, { status })
  }
}
