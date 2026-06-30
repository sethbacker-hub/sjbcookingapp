import { NextRequest, NextResponse } from "next/server"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"

const gateway = createOpenAI({
  baseURL: `${process.env.VERCEL_AI_GATEWAY_URL || "https://ai-gateway.vercel.com"}/v1`,
  apiKey: process.env.VERCEL_AI_GATEWAY_TOKEN || "",
})

const model = gateway("anthropic/claude-sonnet-4-6")

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
      // ── Step 1: Identify ingredients (Vercel Workflow Step 1) ──────────────
      await sendEvent({ step: "analyzing", message: "Analyzing your ingredients..." })

      let identifiedIngredients = ingredients || ""

      if (imageBase64) {
        const imageAnalysis = await generateText({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  image: imageBase64,
                },
                {
                  type: "text",
                  text: "Look at this image and list all the food ingredients, produce, proteins, and pantry items you can see. Return a comma-separated list of ingredients only, nothing else.",
                },
              ],
            },
          ],
        })
        identifiedIngredients = imageBase64
          ? `${identifiedIngredients ? identifiedIngredients + ", " : ""}${imageAnalysis.text}`
          : identifiedIngredients
      }

      if (!identifiedIngredients) {
        await sendEvent({ step: "error", message: "No ingredients provided. Please type ingredients or upload a photo." })
        await writer.close()
        return
      }

      // ── Step 2: Generate recipe (Vercel Workflow Step 2) ───────────────────
      await sendEvent({ step: "generating", message: "Generating your recipe..." })

      const cuisineMap: Record<string, string> = {
        italian: "Italian",
        japanese: "Japanese",
        mexican: "Mexican",
        surprise: "any creative international",
      }
      const cuisineLabel = cuisineMap[cuisine] || "any"

      const modifierInstructions = modifier
        ? {
            healthier: "Make this recipe as healthy as possible — reduce fat, increase fiber and protein, use healthier cooking methods.",
            faster: "Optimize this recipe for speed — minimize prep and cook time, suggest shortcuts, aim for under 20 minutes total.",
            "less-ingredients": "Simplify this recipe to use the fewest ingredients possible while keeping it delicious.",
          }[modifier] || ""
        : ""

      const recipePrompt = `You are a professional chef. Using these ingredients: ${identifiedIngredients}
      
Create a delicious ${cuisineLabel} cuisine recipe. ${modifierInstructions}

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "name": "Recipe Name",
  "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "macros": {
    "calories": 450,
    "protein": 35,
    "carbs": 40,
    "fat": 12
  },
  "healthScore": 8,
  "healthSummary": "High protein, low carb — great post-workout meal",
  "cuisine": "${cuisineLabel}"
}`

      const recipeResponse = await generateText({
        model,
        messages: [{ role: "user", content: recipePrompt }],
      })

      let rawRecipe: Record<string, unknown>
      try {
        const jsonText = recipeResponse.text.replace(/```json\n?|\n?```/g, "").trim()
        rawRecipe = JSON.parse(jsonText)
      } catch {
        await sendEvent({ step: "error", message: "Failed to parse recipe response. Please try again." })
        await writer.close()
        return
      }

      // ── Step 3: Format via Sandbox endpoint ────────────────────────────────
      await sendEvent({ step: "formatting", message: "Formatting your recipe card..." })

      const formatResponse = await fetch(
        new URL("/api/format", request.url).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe: rawRecipe, cuisine }),
        }
      )

      if (!formatResponse.ok) {
        await sendEvent({ step: "error", message: "Failed to format recipe." })
        await writer.close()
        return
      }

      const { recipe } = await formatResponse.json()

      await sendEvent({ step: "complete", recipe })
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
