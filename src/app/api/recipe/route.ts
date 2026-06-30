import { NextRequest, NextResponse } from "next/server"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { v4 as uuidv4 } from "uuid"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Vercel AI Gateway — compatibility:'compatible' skips OpenAI key validation
// so the gateway token is accepted as-is.
const gateway = createOpenAI({
  baseURL: `${process.env.VERCEL_AI_GATEWAY_URL || "https://ai-gateway.vercel.com"}/v1`,
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
  compatibility: "compatible",
})

const model = gateway("anthropic/claude-sonnet-4-6")

export async function POST(request: NextRequest) {
  // Client sends: { ingredients, imageBase64, cuisine, modifier }
  const { ingredients, imageBase64, cuisine, modifier } = await request.json()

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = async (data: Record<string, unknown>) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  ;(async () => {
    try {
      // ── Step 1: Identify ingredients (Workflow Step 1) ─────────────────────
      await send({ step: "analyzing", message: "Analyzing your ingredients..." })

      let identifiedIngredients: string = ingredients || ""

      if (imageBase64) {
        type ImageContent = { type: "image"; image: string }
        type TextContent = { type: "text"; text: string }
        const content: Array<ImageContent | TextContent> = [
          { type: "image", image: imageBase64 },
          {
            type: "text",
            text: `List every food ingredient, produce item, protein, and pantry item visible in this image.${
              ingredients ? ` Also include these additional ingredients: ${ingredients}.` : ""
            } Return a comma-separated list of ingredients only, nothing else.`,
          },
        ]

        const { text } = await generateText({
          model,
          messages: [{ role: "user", content }],
        })
        identifiedIngredients = text.trim()
      }

      if (!identifiedIngredients) {
        await send({ step: "error", message: "No ingredients found. Please type some ingredients or upload a photo." })
        await writer.close()
        return
      }

      // ── Step 2: Generate recipe (Workflow Step 2) ──────────────────────────
      await send({ step: "generating", message: "Generating your recipe..." })

      const cuisineMap: Record<string, string> = {
        italian: "Italian",
        japanese: "Japanese",
        mexican: "Mexican",
        surprise: "any creative international",
      }
      const cuisineLabel = cuisineMap[cuisine] || "any"

      const modifierMap: Record<string, string> = {
        healthier: "Make it as healthy as possible — reduce fat, increase fiber and protein, use healthier cooking methods.",
        faster: "Make it as quick as possible — aim for under 20 minutes total, suggest shortcuts.",
        "less-ingredients": "Simplify to use the fewest ingredients possible while keeping it delicious.",
      }
      const modifierNote = modifier ? (modifierMap[modifier] ?? "") : ""

      const { text: recipeText } = await generateText({
        model,
        system: "You are a professional chef and nutritionist. Return ONLY valid JSON, no markdown, no code blocks.",
        messages: [
          {
            role: "user",
            content: `Create a ${cuisineLabel} recipe using these ingredients: ${identifiedIngredients}. ${modifierNote}

Return ONLY this JSON structure, nothing else:
{
  "name": "Recipe Name",
  "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1: ...", "Step 2: ..."],
  "macros": { "calories": 450, "protein": 35, "carbs": 40, "fat": 12 },
  "healthScore": 8,
  "healthSummary": "High protein, low carb — great post-workout meal",
  "cuisine": "${cuisineLabel}"
}`,
          },
        ],
      })

      // ── Step 3: Format via Sandbox endpoint ────────────────────────────────
      await send({ step: "formatting", message: "Formatting your recipe card..." })

      // Resolve the format URL robustly for both Vercel and local dev
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

      const formatRes = await fetch(`${baseUrl}/api/format`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawRecipe: recipeText, cuisine: cuisineLabel }),
      })

      if (!formatRes.ok) {
        await send({ step: "error", message: "Failed to format recipe. Please try again." })
        await writer.close()
        return
      }

      const formatted = await formatRes.json()
      const recipe = { ...formatted, id: uuidv4(), cuisine: cuisineLabel }

      await send({ step: "complete", recipe })
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      await send({ step: "error", message })
    } finally {
      await writer.close()
    }
  })()

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
