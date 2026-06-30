"use client"

import { Recipe } from "@/types/recipe"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trash2, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface SavedRecipesDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipes: Recipe[]
  onRemove: (id: string) => void
  onClearAll: () => void
  onSelect: (recipe: Recipe) => void
}

const cuisineEmoji: Record<string, string> = {
  Italian: "🇮🇹",
  Japanese: "🇯🇵",
  Mexican: "🇲🇽",
  International: "🌍",
}

export default function SavedRecipesDrawer({
  open,
  onOpenChange,
  recipes,
  onRemove,
  onClearAll,
  onSelect,
}: SavedRecipesDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-orange-500" />
            Saved Recipes
          </SheetTitle>
          <SheetDescription>
            {recipes.length === 0 ? "No saved recipes yet" : `${recipes.length} recipe${recipes.length > 1 ? "s" : ""} saved`}
          </SheetDescription>
        </SheetHeader>

        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-gray-400">
            <span className="text-5xl mb-3">📭</span>
            <p className="font-medium">No saved recipes yet</p>
            <p className="text-sm mt-1">Hit &quot;Save&quot; on a recipe to store it here</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4 py-2">
              <div className="space-y-3 py-2">
                {recipes.map((recipe) => {
                  const emoji = cuisineEmoji[recipe.cuisine] || "🍽️"
                  const healthColor =
                    recipe.healthScore >= 7
                      ? "text-emerald-600"
                      : recipe.healthScore >= 4
                      ? "text-amber-500"
                      : "text-red-500"
                  const date = recipe.savedAt
                    ? new Date(recipe.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : ""

                  return (
                    <div
                      key={recipe.id}
                      className="group flex gap-3 rounded-lg border bg-white p-3 hover:border-orange-200 hover:bg-orange-50 transition-colors cursor-pointer"
                      onClick={() => { onSelect(recipe); onOpenChange(false) }}
                    >
                      <div className="text-2xl shrink-0">{emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{recipe.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{recipe.cuisine} · {date}</p>
                        <p className={cn("text-xs font-semibold mt-1", healthColor)}>
                          ♥ Health {recipe.healthScore}/10
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-7 w-7 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                        onClick={(e) => { e.stopPropagation(); onRemove(recipe.id) }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={onClearAll}
                className="w-full text-red-500 hover:bg-red-50 hover:border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear all saved recipes
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
