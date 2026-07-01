import { NextRequest, NextResponse } from "next/server"
import { start } from "workflow/api"
import { findRecipeWorkflow, type RecipeInput } from "@/workflows/recipe"

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
