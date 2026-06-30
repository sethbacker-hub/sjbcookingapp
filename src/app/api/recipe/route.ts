import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { v4 as uuidv4 } from "uuid"

const gateway = createOpenAI({
  baseURL: `${process.env.VERCEL_AI_GATEWAY_URL}/v1`,
  apiKey: process.env.VERCEL_AI_GATEWAY_TOKEN!,
})

export async function POST(req: Request) {
  const { ingredients, image, cuisine, modifier } = await req.json() as {
    ingredients: string
    image?: string
    cuisine: string
    modifier?: string
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        // Step 1: Analyze ingredients (Vercel Workflow Step 1)
        send({ step: "analyzing", message: "Analyzing your ingredients..." })

        type MessageContent =
          | string
          | Array<
              | { type: "text"; text: string }
              | { type: "image"; image: string }
            >

        const analysisMessages: Array<{
          role: "user"
          content: MessageContent
        }> = []

        if (image) {
          analysisMessages.push({
            role: "user",
            content: [
              { type: "image", image },
              {
                type: "text",
                text: `Also consider these additional ingredients: ${
                  ingredients || "none"
                }. List all ingredients you can identify as a JSON array of strings. Return ONLY the JSON array.`,
              },
            ],
          })
        } else {
          analysisMessages.push({
            role: "user",
            content: `Identify and list the ingredients from this text: "${ingredients}". Return ONLY a JSON array of ingredient strings. Example: ["chicken breast", "garlic", "olive oil"]`,
          })
        }

        const { text: ingredientsList } = await generateText({
          model: gateway("anthropic/claude-sonnet-4-6"),
          system:
            "You are a helpful cooking assistant. When analyzing ingredients, return ONLY a JSON array of ingredient strings, no other text.",
          messages: analysisMessages,
        })

        // Step 2: Generate recipe (Vercel Workflow Step 2)
        send({ step: "generating", message: "Generating your recipe..." })

        const cuisineMap: Record<string, string> = {
          italian: "Italian",
          japanese: "Japanese",
          mexican: "Mexican",
          surprise: "any world cuisine (be creative and unexpected!)",
        }

        const modifierText =
          modifier === "healthier"
            ? "Make it as healthy as possible with lower calories and higher nutritional value."
            : modifier === "faster"
            ? "Make it as quick to prepare as possible, ready in under 20 minutes."
            : modifier === "less-ingredients"
            ? "Simplify the recipe to use as few ingredients as possible."
            : ""

        const { text: recipeText } = await generateText({
          model: gateway("anthropic/claude-sonnet-4-6"),
          system:
            "You are a professional chef and nutritionist. Generate recipes in valid JSON format only. No markdown, no explanation, just the raw JSON object.",
          messages: [
            {
              role: "user",
              content: `Create a ${
                cuisineMap[cuisine] ?? "delicious"
              } recipe using these ingredients: ${ingredientsList}. ${modifierText}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "name": "Recipe Name",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "instructions": ["Step 1: description", "Step 2: description"],
  "macros": {
    "calories": 450,
    "protein": 35,
    "carbs": 42,
    "fat": 18
  },
  "healthScore": 8,
  "healthSummary": "High protein, balanced macros — great for an active lifestyle"
}`,
            },
          ],
        })

        // Step 3: Format (Vercel Sandbox simulation)
        send({ step: "formatting", message: "Formatting your recipe card..." })

        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000"

        const formatRes = await fetch(`${baseUrl}/api/format`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawRecipe: recipeText, cuisine }),
        })

        const formatted = await formatRes.json() as Record<string, unknown>

        const recipe = {
          ...formatted,
          id: uuidv4(),
          cuisine,
        }

        send({ step: "complete", recipe })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        send({ step: "error", message: `Error: ${message}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
