import { NextRequest, NextResponse } from "next/server"
import { createVercel } from "@ai-sdk/vercel"
import { generateText } from "ai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const vercelProvider = createVercel({
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
  baseURL: "https://ai-gateway.vercel.com/v1/sjbcookingapp",
})
const model = vercelProvider("gpt-4o-mini")

export async function POST(request: NextRequest) {
  const { ingredients, imageBase64, cuisine, modifier } = await request.json()

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const sendEvent = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  ;(async () => {
    try {
      await sendEvent({ step: "analyzing", message: "Analyzing your ingredients..." })

      let identifiedIngredients: string = ingredients || ""

      if (imageBase64) {
        type ImageContent = { type: "image"; image: string }
        type TextContent = { type: "text"; text: string }
        const content: Array<ImageContent | TextContent> = [
          { type: "image", image: imageBase64 },
          {
            type: "text",
            text: "List all food ingredients visible in this image as a comma-separated list. Nothing else.",
          },
        ]
        const { text } = await generateText({
          model,
          messages: [{ role: "user", content }],
        })
        identifiedIngredients = `${identifiedIngredients ? identifiedIngredients + ", " : ""}${text.trim()}`
      }

      if (!identifiedIngredients) {
        await sendEvent({ step: "error", message: "No ingredients provided." })
        await writer.close()
        return
      }

      await sendEvent({ step: "generating", message: "Generating your recipe..." })

      const cuisineMap: Record<string, string> = {
        italian: "Italian",
        japanese: "Japanese",
        mexican: "Mexican",
        surprise: "any creative international",
      }
      const cuisineLabel = cuisineMap[cuisine] || "any"

      const modifierMap: Record<string, string> = {
        healthier: "Make it as healthy as possible — reduce fat, increase fiber and protein.",
        faster: "Make it as quick as possible — under 20 minutes.",
        "less-ingredients": "Simplify to the fewest ingredients possible.",
      }
      const modifierInstructions = modifier ? (modifierMap[modifier] ?? "") : ""

      const { text: recipeText } = await generateText({
        model,
        system: "You are a professional chef. Return ONLY valid JSON, no markdown.",
        messages: [
          {
            role: "user",
            content: `Create a ${cuisineLabel} recipe using: ${identifiedIngredients}. ${modifierInstructions}
Return ONLY this JSON:
{"name":"","ingredients":[],"instructions":[],"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"healthScore":0,"healthSummary":"","cuisine":"${cuisineLabel}"}`,
          },
        ],
      })

      await sendEvent({ step: "formatting", message: "Formatting your recipe card..." })

      let rawRecipe: Record<string, unknown>
      try {
        rawRecipe = JSON.parse(recipeText.replace(/```json\n?|\n?```/g, "").trim())
      } catch {
        await sendEvent({ step: "error", message: "Failed to parse recipe. Please try again." })
        await writer.close()
        return
      }

      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

      const formatRes = await fetch(`${baseUrl}/api/format`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawRecipe: JSON.stringify(rawRecipe), cuisine: cuisineLabel }),
      })

      const formatted = await formatRes.json()
      await sendEvent({ step: "complete", recipe: { ...formatted, cuisine: cuisineLabel } })
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      await sendEvent({ step: "error", message })
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
