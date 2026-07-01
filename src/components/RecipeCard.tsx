"use client"

import { Recipe, ModifierType } from "@/types/recipe"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Heart, Check, Salad, Zap, Minus, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface RecipeCardProps {
  recipe: Recipe
  onModify: (modifier: ModifierType) => void
  onSave: () => void
  isSaved: boolean
  isLoading: boolean
}

const MACRO_MAX = { calories: 800, protein: 60, carbs: 100, fat: 50 }

const cuisineEmoji: Record<string, string> = {
  Italian: "🇮🇹",
  Japanese: "🇯🇵",
  Mexican: "🇲🇽",
  International: "🌍",
  any: "🌍",
}

export default function RecipeCard({ recipe, onModify, onSave, isSaved, isLoading }: RecipeCardProps) {
  const healthColor =
    recipe.healthScore >= 7 ? "text-emerald-600" : recipe.healthScore >= 4 ? "text-amber-500" : "text-red-500"
  const healthBg =
    recipe.healthScore >= 7 ? "bg-emerald-50 border-emerald-200" : recipe.healthScore >= 4 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"

  const emoji = cuisineEmoji[recipe.cuisine] || "🍽️"

  return (
    <Card className="w-full shadow-xl border-0 bg-white overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-br from-orange-50 to-amber-50 border-b pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{recipe.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                {emoji} {recipe.cuisine}
              </Badge>
              {typeof recipe.prepTimeMinutes === "number" && (
                <Badge variant="secondary" className="gap-1 text-sm">
                  <Clock className="h-3.5 w-3.5" /> {recipe.prepTimeMinutes} min
                </Badge>
              )}
            </div>
          </div>
          <Button
            onClick={onSave}
            variant={isSaved ? "secondary" : "outline"}
            size="sm"
            disabled={isSaved}
            className={cn("shrink-0 gap-1.5", isSaved && "text-rose-600 border-rose-200 bg-rose-50")}
          >
            {isSaved ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
            {isSaved ? "Saved!" : "Save"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Ingredients */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Ingredients</h3>
          <ul className="space-y-1.5">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                {ing}
              </li>
            ))}
          </ul>
        </section>

        {/* Instructions */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Instructions</h3>
          <ol className="space-y-3">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 font-semibold text-xs">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step.replace(/^Step \d+:\s*/i, "")}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Macros */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Nutrition</h3>
          <div className="grid grid-cols-2 gap-4">
            <MacroBar label="Calories" value={recipe.macros.calories} unit="kcal" max={MACRO_MAX.calories} color="bg-orange-400" />
            <MacroBar label="Protein" value={recipe.macros.protein} unit="g" max={MACRO_MAX.protein} color="bg-blue-500" />
            <MacroBar label="Carbs" value={recipe.macros.carbs} unit="g" max={MACRO_MAX.carbs} color="bg-amber-400" />
            <MacroBar label="Fat" value={recipe.macros.fat} unit="g" max={MACRO_MAX.fat} color="bg-rose-400" />
          </div>
        </section>

        {/* Health Score */}
        <section className={cn("rounded-lg border p-4", healthBg)}>
          <div className="flex items-center gap-4">
            <div className={cn("text-4xl font-black tabular-nums", healthColor)}>
              {recipe.healthScore}<span className="text-lg font-medium text-gray-400">/10</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Health Score</p>
              <p className="text-sm text-gray-700">{recipe.healthSummary}</p>
            </div>
          </div>
        </section>

        {/* Modifier buttons */}
        <section>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tweak this recipe</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onModify("healthier")}
              disabled={isLoading}
              className="justify-start gap-2 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
            >
              <Salad className="h-4 w-4" /> Make it healthier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onModify("faster")}
              disabled={isLoading}
              className="justify-start gap-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
            >
              <Zap className="h-4 w-4" /> Make it faster
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onModify("less-ingredients")}
              disabled={isLoading}
              className="justify-start gap-2 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
            >
              <Minus className="h-4 w-4" /> Use less ingredients
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

function MacroBar({
  label,
  value,
  unit,
  max,
  color,
}: {
  label: string
  value: number
  unit: string
  max: number
  color: string
}) {
  const pct = Math.min(Math.round((value / max) * 100), 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">
          {value}
          <span className="text-gray-400 ml-0.5">{unit}</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
