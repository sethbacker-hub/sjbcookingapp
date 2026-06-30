import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET — confirms the route is reachable and shows which AI backend is configured
export async function GET() {
  const gatewayUrl = process.env.VERCEL_AI_GATEWAY_URL
  const hasGatewayKey = !!process.env.AI_GATEWAY_API_KEY
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
  const backend = gatewayUrl && hasGatewayKey ? "vercel-ai-gateway" : hasAnthropicKey ? "anthropic-direct" : "none"
  return NextResponse.json({ ok: true, route: "/api/recipe", build: "d8ad9cd-dualbackend", backend })
}

export async function POST(request: NextRequest) {
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
    italian: "Italian", japanese: "Japanese", mexican: "Mexican", surprise: "any creative international",
  }
  const cuisineLabel = cuisineMap[cuisine ?? ""] || "any"

  const modifierMap: Record<string, string> = {
    healthier: "Make it as healthy as possible — reduce fat, increase fiber and protein.",
    faster: "Make it as quick as possible — under 20 minutes total.",
    "less-ingredients": "Use the fewest ingredients possible.",
  }
  const modifierNote = modifier ? (modifierMap[modifier] ?? "") : ""

  const systemPrompt = "You are a professional chef. Return ONLY valid JSON — no markdown, no code blocks, no explanation."
  const userPrompt = imageBase64
    ? `Identify the ingredients visible in this image${ingredients ? `, plus: ${ingredients}` : ""}. Then create a ${cuisineLabel} recipe. ${modifierNote}\n\nReturn ONLY this JSON:\n{"name":"","ingredients":[],"instructions":[],"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"healthScore":0,"healthSummary":"","cuisine":"${cuisineLabel}"}`
    : `Create a ${cuisineLabel} recipe using: ${ingredients}. ${modifierNote}\n\nReturn ONLY this JSON:\n{"name":"","ingredients":[],"instructions":[],"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"healthScore":0,"healthSummary":"","cuisine":"${cuisineLabel}"}`

  // ── Choose backend ─────────────────────────────────────────────────────────
  // Option A: Vercel AI Gateway (requires VERCEL_AI_GATEWAY_URL to be the full
  //   scoped URL from your Vercel dashboard, e.g.
  //   https://ai-gateway.vercel.com/v1/{team-slug}/{gateway-name}
  //   AND AI_GATEWAY_API_KEY set to your Vercel API token)
  //
  // Option B: Anthropic direct (requires ANTHROPIC_API_KEY)
  const gatewayUrl = process.env.VERCEL_AI_GATEWAY_URL
  const gatewayKey = process.env.AI_GATEWAY_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const useGateway = !!(gatewayUrl && gatewayKey)
  const useAnthropic = !!anthropicKey

  if (!useGateway && !useAnthropic) {
    return NextResponse.json(
      { error: "No AI backend configured. Set ANTHROPIC_API_KEY for direct Anthropic access, or VERCEL_AI_GATEWAY_URL + AI_GATEWAY_API_KEY for Vercel AI Gateway." },
      { status: 500 }
    )
  }

  let rawText: string

  if (useGateway) {
    // Vercel AI Gateway — OpenAI-compatible endpoint
    // gatewayUrl must be the full scoped URL, e.g.:
    //   https://ai-gateway.vercel.com/v1/{team}/{gateway}
    // The /chat/completions path is appended here.
    const endpoint = `${gatewayUrl}/chat/completions`
    console.log("[recipe] using Vercel AI Gateway:", endpoint)

    type GatewayContent =
      | string
      | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>

    const userContent: GatewayContent = imageBase64
      ? [{ type: "image_url", image_url: { url: imageBase64 } }, { type: "text", text: userPrompt }]
      : userPrompt

    const aiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayKey}` },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error("[recipe] gateway error:", aiRes.status, errText)
      return NextResponse.json({ error: `AI Gateway ${aiRes.status}: ${errText}` }, { status: 502 })
    }

    const aiJson = await aiRes.json()
    rawText = aiJson.choices?.[0]?.message?.content ?? ""

  } else {
    // Anthropic API direct
    console.log("[recipe] using Anthropic direct API")

    type AnthropicContent =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } }

    const contentBlocks: AnthropicContent[] = []
    if (imageBase64) {
      const [header, data] = imageBase64.split(",")
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg"
      contentBlocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data } })
    }
    contentBlocks.push({ type: "text", text: userPrompt })

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error("[recipe] Anthropic error:", aiRes.status, errText)
      return NextResponse.json({ error: `Anthropic API ${aiRes.status}: ${errText}` }, { status: 502 })
    }

    const aiJson = await aiRes.json()
    rawText = aiJson.content?.[0]?.text ?? ""
  }

  console.log("[recipe] raw response (first 200):", rawText.slice(0, 200))

  let recipe: Record<string, unknown>
  try {
    const match = rawText.match(/\{[\s\S]*\}/)
    recipe = JSON.parse(match ? match[0] : rawText)
  } catch {
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
