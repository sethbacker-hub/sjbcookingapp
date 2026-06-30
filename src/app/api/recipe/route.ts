import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET probe — confirms the route is reachable without needing a POST body
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/recipe",
    build: "35c0d66-logging",
    env: {
      hasGatewayUrl: !!process.env.VERCEL_AI_GATEWAY_URL,
      hasApiKey: !!process.env.AI_GATEWAY_API_KEY,
      gatewayUrl: process.env.VERCEL_AI_GATEWAY_URL || "(not set — will use default)",
    },
  })
}

export async function POST(request: NextRequest) {
  console.log("[recipe] POST received")

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch (e) {
    console.error("[recipe] Failed to parse request body:", e)
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { ingredients, imageBase64, cuisine, modifier } = body as {
    ingredients?: string
    imageBase64?: string
    cuisine?: string
    modifier?: string
  }

  console.log("[recipe] inputs:", {
    hasIngredients: !!ingredients,
    hasImage: !!imageBase64,
    cuisine,
    modifier,
  })

  if (!ingredients && !imageBase64) {
    return NextResponse.json({ error: "No ingredients provided" }, { status: 400 })
  }

  const gatewayUrl = process.env.VERCEL_AI_GATEWAY_URL || "https://ai-gateway.vercel.com"
  const apiKey = process.env.AI_GATEWAY_API_KEY || ""

  if (!apiKey) {
    console.error("[recipe] AI_GATEWAY_API_KEY is not set")
    return NextResponse.json({ error: "AI_GATEWAY_API_KEY environment variable is not set" }, { status: 500 })
  }

  const cuisineMap: Record<string, string> = {
    italian: "Italian",
    japanese: "Japanese",
    mexican: "Mexican",
    surprise: "any creative international",
  }
  const cuisineLabel = cuisineMap[cuisine ?? ""] || "any"

  const modifierMap: Record<string, string> = {
    healthier: "Make it as healthy as possible — reduce fat, increase fiber and protein.",
    faster: "Make it as quick as possible — under 20 minutes total.",
    "less-ingredients": "Use the fewest ingredients possible.",
  }
  const modifierNote = modifier ? (modifierMap[modifier] ?? "") : ""

  type MessageContent =
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >

  const userContent: MessageContent = imageBase64
    ? [
        { type: "image_url", image_url: { url: imageBase64 } },
        {
          type: "text",
          text: `Identify the ingredients visible in this image${ingredients ? `, plus: ${ingredients}` : ""}. Then create a ${cuisineLabel} recipe. ${modifierNote}

Return ONLY this JSON, no markdown:
{"name":"","ingredients":[],"instructions":[],"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"healthScore":0,"healthSummary":"","cuisine":"${cuisineLabel}"}`,
        },
      ]
    : `Create a ${cuisineLabel} recipe using: ${ingredients}. ${modifierNote}

Return ONLY this JSON, no markdown:
{"name":"","ingredients":[],"instructions":[],"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"healthScore":0,"healthSummary":"","cuisine":"${cuisineLabel}"}`

  const endpoint = `${gatewayUrl}/v1/chat/completions`
  console.log("[recipe] calling gateway:", endpoint)

  let aiRes: Response
  try {
    aiRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        messages: [
          {
            role: "system",
            content: "You are a professional chef. Return ONLY valid JSON — no markdown, no code blocks.",
          },
          { role: "user", content: userContent },
        ],
      }),
    })
  } catch (e) {
    console.error("[recipe] fetch to gateway threw:", e)
    return NextResponse.json({ error: `Network error reaching AI Gateway: ${String(e)}` }, { status: 502 })
  }

  console.log("[recipe] gateway status:", aiRes.status)

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    console.error("[recipe] gateway error body:", errText)
    return NextResponse.json(
      { error: `AI Gateway returned ${aiRes.status}: ${errText}` },
      { status: 502 }
    )
  }

  const aiJson = await aiRes.json()
  const rawText: string = aiJson.choices?.[0]?.message?.content ?? ""
  console.log("[recipe] raw model response (first 200 chars):", rawText.slice(0, 200))

  let recipe: Record<string, unknown>
  try {
    const match = rawText.match(/\{[\s\S]*\}/)
    recipe = JSON.parse(match ? match[0] : rawText)
  } catch (e) {
    console.error("[recipe] JSON parse failed:", e, "raw:", rawText.slice(0, 300))
    return NextResponse.json(
      { error: `Could not parse recipe JSON. Model said: ${rawText.slice(0, 200)}` },
      { status: 500 }
    )
  }

  const macros = (recipe.macros ?? {}) as Record<string, unknown>
  const result = {
    id: crypto.randomUUID(),
    name: String(recipe.name ?? "Mystery Recipe"),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(String) : [],
    instructions: Array.isArray(recipe.instructions) ? recipe.instructions.map(String) : [],
    macros: {
      calories: Number(macros.calories) || 400,
      protein: Number(macros.protein) || 25,
      carbs: Number(macros.carbs) || 45,
      fat: Number(macros.fat) || 15,
    },
    healthScore: Math.min(10, Math.max(1, Number(recipe.healthScore) || 7)),
    healthSummary: String(recipe.healthSummary ?? "A balanced, nutritious meal"),
    cuisine: cuisineLabel,
  }

  console.log("[recipe] success, returning recipe:", result.name)
  return NextResponse.json(result)
}
