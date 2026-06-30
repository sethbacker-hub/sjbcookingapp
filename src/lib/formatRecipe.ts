export function formatRecipe(rawRecipe: string, cuisine: string): Record<string, unknown> {
  try {
    const jsonMatch = rawRecipe.match(/\{[\s\S]*\}/)
    const recipeData: Record<string, unknown> = JSON.parse(
      jsonMatch ? jsonMatch[0] : rawRecipe
    )
    const macrosRaw = recipeData.macros as Record<string, unknown> | undefined
    return {
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
      healthScore: Math.min(10, Math.max(1, Number(recipeData.healthScore) || 7)),
      healthSummary: String(recipeData.healthSummary ?? "A balanced, nutritious meal"),
      cuisine: cuisine ?? "International",
    }
  } catch {
    return {
      name: "Recipe",
      ingredients: [],
      instructions: [],
      macros: { calories: 400, protein: 25, carbs: 45, fat: 15 },
      healthScore: 7,
      healthSummary: "A balanced meal",
      cuisine: cuisine ?? "International",
    }
  }
}
