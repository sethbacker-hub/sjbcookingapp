export async function POST(req: Request) {
  const { rawRecipe, cuisine } = await req.json() as {
    rawRecipe: string
    cuisine: string
  }

  try {
    // Extract JSON from raw text (model may wrap in markdown)
    let recipeData: Record<string, unknown>
    const jsonMatch = rawRecipe.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      recipeData = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    } else {
      recipeData = JSON.parse(rawRecipe) as Record<string, unknown>
    }

    const macrosRaw = recipeData.macros as Record<string, unknown> | undefined

    const formatted = {
      name: String(recipeData.name ?? "Delicious Recipe"),
      ingredients: Array.isArray(recipeData.ingredients)
        ? recipeData.ingredients.map(String)
        : [],
      instructions: Array.isArray(recipeData.instructions)
        ? recipeData.instructions.map(String)
        : [],
      macros: {
        calories: Number(macrosRaw?.calories) || 400,
        protein: Number(macrosRaw?.protein) || 25,
        carbs: Number(macrosRaw?.carbs) || 45,
        fat: Number(macrosRaw?.fat) || 15,
      },
      healthScore: Math.min(
        10,
        Math.max(1, Number(recipeData.healthScore) || 7)
      ),
      healthSummary: String(
        recipeData.healthSummary ?? "A balanced, nutritious meal"
      ),
      cuisine: cuisine ?? "International",
    }

    return Response.json(formatted)
  } catch {
    return Response.json({
      name: "Recipe",
      ingredients: [],
      instructions: [],
      macros: { calories: 400, protein: 25, carbs: 45, fat: 15 },
      healthScore: 7,
      healthSummary: "A balanced meal",
      cuisine: cuisine ?? "International",
    })
  }
}
