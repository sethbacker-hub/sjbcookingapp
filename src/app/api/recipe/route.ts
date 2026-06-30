import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/recipe",
    model: "gpt-4o",
    hasKey: !!process.env.OPENAI_API_KEY,
  })
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY environment variable is not set" }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { ingredients, imageBase64, cuisine, modifier } = body as {
    ingredients?: string
    imageBase64?: string
    cuisine?: string
    modifier?: string
  }

  if (!ingredients && !imageBase64) {
    return NextResponse.json({ error: "No ingredients provided" }, { status: 400 })
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

  const systemPrompt =
    "You are a professional chef and nutritionist. Always return ONLY valid JSON — no markdown, no code blocks, no explanation."

  const jsonTemplate = `{"name":"","ingredients":[],"instructions":[],"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"healthScore":0,"healthSummary":"","cuisine":"${cuisineLabel}"}`

  const textPrompt = imageBase64
    ? `Identify the food ingredients visible in this image${ingredients ? `, along with these additional ingredients: ${ingredients}` : ""}. Then create a ${cuisineLabel} recipe using them. ${modifierNote}\n\nReturn ONLY this JSON structure, filled in:\n${jsonTemplate}`
    : `Create a ${cuisineLabel} recipe using these ingredients: ${ingredients}. ${modifierNote}\n\nReturn ONLY this JSON structure, filled in:\n${jsonTemplate}`

  // Build OpenAI message content — supports vision (gpt-4o handles image_url)
  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "auto" } }

  const userContent: string | ContentPart[] = imageBase64
    ? [
        { type: "image_url", image_url: { url: imageBase64, detail: "auto" } },
        { type: "text", text: textPrompt },
      ]
    : textPrompt

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    console.error("[recipe] OpenAI error:", openaiRes.status, errText)
    return NextResponse.json(
      { error: `OpenAI API ${openaiRes.status}: ${errText}` },
      { status: 502 }
    )
  }

  const openaiJson = await openaiRes.json()
  const rawText: string = openaiJson.choices?.[0]?.message?.content ?? ""

  let recipe: Record<string, unknown>
  try {
    const match = rawText.match(/\{[\s\S]*\}/)
    recipe = JSON.parse(match ? match[0] : rawText)
  } catch {
    console.error("[recipe] JSON parse failed. Raw:", rawText.slice(0, 300))
    return NextResponse.json(
      { error: `Could not parse recipe JSON. Model said: ${rawText.slice(0, 200)}` },
      { status: 500 }
    )
  }

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
