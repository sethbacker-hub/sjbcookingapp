import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const { ingredients, imageBase64, cuisine, modifier } = await request.json()

  if (!ingredients && !imageBase64) {
    return NextResponse.json({ error: "No ingredients provided" }, { status: 400 })
  }

  const gatewayUrl = process.env.VERCEL_AI_GATEWAY_URL || "https://ai-gateway.vercel.com"
  const apiKey = process.env.AI_GATEWAY_API_KEY || ""

  const cuisineMap: Record<string, string> = {
    italian: "Italian",
    japanese: "Japanese",
    mexican: "Mexican",
    surprise: "any creative international",
  }
  const cuisineLabel = cuisineMap[cuisine] || "any"

  const modifierMap: Record<string, string> = {
    healthier: "Make it as healthy as possible — reduce fat, increase fiber and protein.",
    faster: "Make it as quick as possible — under 20 minutes total.",
    "less-ingredients": "Use the fewest ingredients possible.",
  }
  const modifierNote = modifier ? (modifierMap[modifier] ?? "") : ""

  // Build the messages array for the AI call
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
          text: `Identify the ingredients visible in this image${ingredients ? `, plus these additional ingredients: ${ingredients}` : ""}. Then create a ${cuisineLabel} recipe. ${modifierNote}

Return ONLY this JSON, no markdown:
{"name":"","ingredients":[],"instructions":[],"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"healthScore":0,"healthSummary":"","cuisine":"${cuisineLabel}"}`,
        },
      ]
    : `Create a ${cuisineLabel} recipe using: ${ingredients}. ${modifierNote}

Return ONLY this JSON, no markdown:
{"name":"","ingredients":[],"instructions":[],"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"healthScore":0,"healthSummary":"","cuisine":"${cuisineLabel}"}`

  const aiRes = await fetch(`${gatewayUrl}/v1/chat/completions`, {
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
          content:
            "You are a professional chef and nutritionist. Always return ONLY valid JSON — no markdown, no code blocks, no explanation.",
        },
        { role: "user", content: userContent },
      ],
    }),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    return NextResponse.json(
      { error: `AI Gateway error: ${aiRes.status} — ${errText}` },
      { status: 502 }
    )
  }

  const aiJson = await aiRes.json()
  const rawText: string = aiJson.choices?.[0]?.message?.content ?? ""

  // Parse the recipe JSON from the model response
  let recipe: Record<string, unknown>
  try {
    const match = rawText.match(/\{[\s\S]*\}/)
    recipe = JSON.parse(match ? match[0] : rawText)
  } catch {
    return NextResponse.json(
      { error: `Failed to parse recipe JSON. Raw response: ${rawText.slice(0, 200)}` },
      { status: 500 }
    )
  }

  // Normalise and return
  const macros = (recipe.macros ?? {}) as Record<string, unknown>
  return NextResponse.json({
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
  })
}
