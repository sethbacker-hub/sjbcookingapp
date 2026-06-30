"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import RecipeCard from "@/components/RecipeCard"
import SavedRecipesDrawer from "@/components/SavedRecipesDrawer"
import { Recipe, CuisineType, WorkflowStep, ModifierType } from "@/types/recipe"
import { ChefHat, Upload, X, BookOpen, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const CUISINE_OPTIONS = [
  { value: "italian" as CuisineType, label: "Italian", emoji: "🇮🇹" },
  { value: "japanese" as CuisineType, label: "Japanese", emoji: "🇯🇵" },
  { value: "mexican" as CuisineType, label: "Mexican", emoji: "🇲🇽" },
  { value: "surprise" as CuisineType, label: "Surprise me", emoji: "🌍" },
]

const SAVED_KEY = "sjb-saved-recipes"

export default function CookingApp() {
  const [ingredients, setIngredients] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [cuisine, setCuisine] = useState<CuisineType>("surprise")
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(SAVED_KEY)
    if (stored) {
      const parsed: Recipe[] = JSON.parse(stored)
      setSavedRecipes(parsed)
      setSavedIds(new Set(parsed.map((r) => r.id)))
    }
  }, [])

  const persistRecipes = (updated: Recipe[]) => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated))
    setSavedRecipes(updated)
    setSavedIds(new Set(updated.map((r) => r.id)))
  }

  const handleImageSelect = (file: File) => {
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) handleImageSelect(file)
  }, [])

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const runWorkflow = async (modifier?: ModifierType) => {
    if (!ingredients.trim() && !imageFile) {
      setError("Please enter ingredients or upload a photo of your fridge.")
      return
    }

    setIsLoading(true)
    setError(null)
    setRecipe(null)

    let imageBase64: string | undefined
    if (imageFile) {
      imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(imageFile)
      })
    }

    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients, imageBase64, cuisine, modifier }),
      })

      if (!res.ok || !res.body) throw new Error("Request failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = JSON.parse(line.slice(6))
          if (data.step === "complete") {
            setRecipe(data.recipe)
            setWorkflowStep(null)
          } else if (data.step === "error") {
            setError(data.message)
            setWorkflowStep(null)
          } else {
            setWorkflowStep({ step: data.step, message: data.message })
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
      setWorkflowStep(null)
    }
  }

  const handleSave = () => {
    if (!recipe) return
    const withDate = { ...recipe, savedAt: new Date().toISOString() }
    persistRecipes([withDate, ...savedRecipes.filter((r) => r.id !== recipe.id)])
  }

  const handleRemove = (id: string) => persistRecipes(savedRecipes.filter((r) => r.id !== id))
  const handleClearAll = () => persistRecipes([])
  const handleSelectSaved = (r: Recipe) => setRecipe(r)

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-orange-500" />
            <span className="font-bold text-gray-900 text-lg">Cook Tonight</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
            {savedRecipes.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold">
                {savedRecipes.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Hero text */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            What Should I Cook Tonight?
          </h1>
          <p className="text-gray-500 text-base">
            Tell us what you have — we&apos;ll find you something delicious.
          </p>
        </div>

        {/* Input card */}
        <Card className="p-6 space-y-5 shadow-lg border-0">
          {/* Image upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Upload a photo <span className="font-normal text-gray-400">(optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Fridge preview" className="w-full max-h-52 object-cover" />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
                  isDragging ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Drop a fridge photo here or <span className="text-orange-500 font-medium">browse</span></p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }}
            />
          </div>

          {/* Ingredients text */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Or type your ingredients
            </label>
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="e.g. chicken thighs, garlic, lemon, cherry tomatoes, spinach..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
            />
          </div>

          {/* Cuisine selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Choose a cuisine vibe</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CUISINE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCuisine(opt.value)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 px-2 text-sm font-medium transition-all",
                    cuisine === opt.value
                      ? "border-orange-400 bg-orange-50 text-orange-700 shadow-sm"
                      : "border-gray-100 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/50"
                  )}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={() => runWorkflow()}
            disabled={isLoading}
            className="w-full h-11 text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md hover:shadow-lg transition-all"
          >
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Working on it...</>
            ) : (
              <><ChefHat className="h-5 w-5" /> Find me a recipe</>
            )}
          </Button>
        </Card>

        {/* Loading state */}
        {isLoading && workflowStep && (
          <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">{workflowStep.message}</p>
              <div className="flex gap-1 mt-2">
                {["analyzing", "generating", "formatting"].map((s) => (
                  <div
                    key={s}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      workflowStep.step === s ? "w-8 bg-orange-500" : "w-3 bg-gray-200"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Something went wrong</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Recipe card */}
        {recipe && !isLoading && (
          <RecipeCard
            recipe={recipe}
            onModify={(modifier) => runWorkflow(modifier)}
            onSave={handleSave}
            isSaved={savedIds.has(recipe.id)}
            isLoading={isLoading}
          />
        )}
      </main>

      <SavedRecipesDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        recipes={savedRecipes}
        onRemove={handleRemove}
        onClearAll={handleClearAll}
        onSelect={handleSelectSaved}
      />
    </div>
  )
}
