import { generateText, gateway } from "ai"
import { Sandbox } from "@vercel/sandbox"

export interface RecipeInput {
  ingredients?: string
  imageBase64?: string
  cuisine?: string
  modifier?: string
}

export interface RecipeMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface GeneratedRecipe {
  id: string
  name: string
  ingredients: string[]
  instructions: string[]
  macros: RecipeMacros
  healthScore: number
  healthSummary: string
  cuisine: string
}

export interface RecipeResult extends GeneratedRecipe {
  /** Total estimated prep + cook time, computed inside a Vercel Sandbox. */
  prepTimeMinutes: number
}

/**
 * Durable workflow that turns a set of ingredients into a recipe.
 *
 * Step 1 calls the AI Gateway to generate the recipe. Step 2 spins up a
 * Vercel Sandbox to parse the ingredient list and compute an estimated prep
 * time. The final result combines both.
 */
export async function findRecipeWorkflow(input: RecipeInput): Promise<RecipeResult> {
  "use workflow"

  const recipe = await generateRecipeStep(input)
  const prepTimeMinutes = await computePrepTimeStep(recipe)

  return { ...recipe, prepTimeMinutes }
}

/**
 * Step 1 — the original AI Gateway call, moved verbatim into a durable step.
 */
async function generateRecipeStep(input: RecipeInput): Promise<GeneratedRecipe> {
  "use step"

  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not set. Add it in your Vercel project environment variables."
    )
  }

  const { ingredients, imageBase64, cuisine, modifier } = input

  if (!ingredients && !imageBase64) {
    throw new Error("No ingredients provided")
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

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image"; image: string; mimeType?: string }

  // imageBase64 arrives as a data URL: "data:image/jpeg;base64,<data>"
  // The AI SDK ImagePart expects raw base64 + mimeType separately.
  let imageContent: ContentPart | undefined
  if (imageBase64) {
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
    imageContent = match
      ? { type: "image", image: match[2], mimeType: match[1] }
      : { type: "image", image: imageBase64 }
  }

  const userContent: string | ContentPart[] = imageContent
    ? [imageContent, { type: "text", text: textPrompt }]
    : textPrompt

  let rawText: string
  try {
    const result = await generateText({
      model: gateway("openai/gpt-4o-mini"),
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      maxOutputTokens: 2048,
      temperature: 0.7,
    })
    rawText = result.text
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[recipe] generateText error:", msg)
    throw new Error(`AI error: ${msg}`)
  }

  let recipe: Record<string, unknown>
  try {
    const match = rawText.match(/\{[\s\S]*\}/)
    recipe = JSON.parse(match ? match[0] : rawText)
  } catch {
    console.error("[recipe] JSON parse failed. Raw:", rawText.slice(0, 300))
    throw new Error(`Could not parse recipe JSON. Model said: ${rawText.slice(0, 200)}`)
  }

  const macros = (recipe.macros ?? {}) as Record<string, unknown>
  return {
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
}

/**
 * Node script (run inside the sandbox) that reads the recipe JSON, parses the
 * ingredient list, and estimates total prep + cook time from it.
 */
const COMPUTE_SCRIPT = `
const fs = require("fs")

const recipe = JSON.parse(fs.readFileSync("/vercel/sandbox/recipe.json", "utf8"))
const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : []

// Prep keywords add time on top of the base handling cost per ingredient.
const PREP_KEYWORDS = [
  ["marinate", 10],
  ["soak", 8],
  ["knead", 6],
  ["mince", 4],
  ["chop", 3],
  ["dice", 3],
  ["slice", 2],
  ["grate", 2],
  ["peel", 2],
]

let prep = 0
for (const raw of ingredients) {
  const s = String(raw).toLowerCase()
  let t = 2 // base handling time per ingredient
  for (const [kw, mins] of PREP_KEYWORDS) {
    if (s.includes(kw)) t += mins
  }
  prep += t
}

// Assume roughly 4 minutes of cooking per instruction step.
const cook = instructions.length * 4
const prepTimeMinutes = Math.max(5, Math.round(prep + cook))

process.stdout.write(
  JSON.stringify({
    prepTimeMinutes,
    ingredientCount: ingredients.length,
    stepCount: instructions.length,
  })
)
`

/**
 * Step 2 — create a Vercel Sandbox, write the recipe JSON into it, run a
 * command that parses the ingredients and computes the total estimated prep
 * time, then stop the sandbox.
 */
async function computePrepTimeStep(recipe: GeneratedRecipe): Promise<number> {
  "use step"

  const sandbox = await Sandbox.create()

  try {
    await sandbox.writeFiles([
      { path: "recipe.json", content: JSON.stringify(recipe) },
      { path: "compute.js", content: COMPUTE_SCRIPT },
    ])

    const result = await sandbox.runCommand("node", ["/vercel/sandbox/compute.js"])

    if (result.exitCode !== 0) {
      const stderr = await result.stderr()
      throw new Error(`Sandbox prep-time computation failed: ${stderr}`)
    }

    const stdout = await result.stdout()
    const parsed = JSON.parse(stdout) as { prepTimeMinutes: number }
    return parsed.prepTimeMinutes
  } finally {
    await sandbox.stop()
  }
}
