"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import RecipeCard from "@/components/RecipeCard"
import SavedRecipesDrawer from "@/components/SavedRecipesDrawer"
import { Recipe, CuisineType, ModifierType } from "@/types/recipe"
import { ChefHat, Upload, X, BookOpen, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/** Convert any image file (including HEIC and PDF) to a JPEG data URL. */
async function normalizeImageFile(file: File): Promise<{ dataUrl: string; previewUrl: string }> {
  const type = file.type.toLowerCase()

  // HEIC / HEIF — convert with heic2any
  if (type === "image/heic" || type === "image/heif" || file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
    const heic2any = (await import("heic2any")).default
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 }) as Blob
    const dataUrl = await blobToDataUrl(blob)
    return { dataUrl, previewUrl: dataUrl }
  }

  // PDF — render first page to canvas via pdfjs-dist
  if (type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjsLib = await import("pdfjs-dist")
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    return { dataUrl, previewUrl: dataUrl }
  }

  // Everything else — read as-is (PNG, JPEG, WebP, GIF are all fine)
  const dataUrl = await blobToDataUrl(file)
  return { dataUrl, previewUrl: dataUrl }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const CUISINE_OPTIONS = [
  { value: "italian" as CuisineType, label: "Italian", emoji: "🇮🇹" },
  { value: "japanese" as CuisineType, label: "Japanese", emoji: "🇯🇵" },
  { value: "mexican" as CuisineType, label: "Mexican", emoji: "🇲🇽" },
  { value: "american" as CuisineType, label: "American", emoji: "🇺🇸" },
  { value: "thai" as CuisineType, label: "Thai", emoji: "🇹🇭" },
  { value: "indian" as CuisineType, label: "Indian", emoji: "🇮🇳" },
  { value: "french" as CuisineType, label: "French", emoji: "🇫🇷" },
  { value: "mediterranean" as CuisineType, label: "Mediterranean", emoji: "🫒" },
  { value: "korean" as CuisineType, label: "Korean", emoji: "🇰🇷" },
  { value: "chinese" as CuisineType, label: "Chinese", emoji: "🇨🇳" },
  { value: "surprise" as CuisineType, label: "Surprise me", emoji: "🌍" },
]

const SAVED_KEY = "sjb-saved-recipes"

export default function CookingApp() {
  const [ingredients, setIngredients] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [cuisine, setCuisine] = useState<CuisineType>("surprise")
  const [recipe, setRecipe] = useState<Recipe | null>(null)
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

  const handleImageSelect = async (file: File) => {
    setImageFile(file)
    setIsConverting(true)
    setError(null)
    try {
      const { dataUrl, previewUrl } = await normalizeImageFile(file)
      setImageDataUrl(dataUrl)
      setImagePreview(previewUrl)
    } catch (err) {
      setError(`Could not process image: ${err instanceof Error ? err.message : "Unknown error"}`)
      setImageFile(null)
    } finally {
      setIsConverting(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageSelect(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageDataUrl(null)
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

    // imageDataUrl is already normalized to a supported format (JPEG/PNG)
    const imageBase64 = imageDataUrl ?? undefined

    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients, imageBase64, cuisine, modifier }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Request failed: ${res.status} ${res.statusText}`)
      }

      setRecipe(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
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
    <div className="min-h-screen" style={{ backgroundColor: "#F7F6F4" }}>
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[#E7E4DF] bg-[#F7F6F4]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <span className="font-display text-[15px] font-700 tracking-tight text-[#1C1917]" style={{ fontWeight: 700 }}>Big Tex</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="gap-1.5 border-[#E7E4DF] bg-white text-[#1C1917] hover:bg-[#F0EDE8] text-xs h-8"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Saved recipes</span>
            <span className="sm:hidden">Saved</span>
            {savedRecipes.length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-white text-[10px] font-semibold" style={{ backgroundColor: "var(--accent)" }}>
                {savedRecipes.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-12 space-y-5">
        {/* Hero */}
        <div className="relative pt-10 pb-8 text-center overflow-hidden">
          {/* Soft radial glow behind headline */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-52"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgb(204 78 13 / 0.08) 0%, transparent 70%)",
            }}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: "var(--accent)" }}>
            AI Recipe Generator
          </p>
          <h1 className="font-display text-[2.6rem] sm:text-[3.2rem] font-extrabold leading-[1.08] tracking-tight text-[#1C1917]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Big Tex Cooking Engine
          </h1>
          <p className="mt-3 text-[#78716C] text-base leading-relaxed">
            Drop in what&apos;s in your kitchen — we&apos;ll turn it into something worth eating.
          </p>
        </div>

        {/* Input card */}
        <Card className="recipe-input-card p-6 space-y-5 border border-[#E7E4DF] bg-white rounded-2xl shadow-[0_1px_4px_rgba(28,25,23,0.06),0_4px_16px_rgba(28,25,23,0.04)]">
          {/* Image upload */}
          <div>
            <label className="block text-sm font-semibold text-[#1C1917] mb-2">
              Upload a photo <span className="font-normal text-[#A8A29E]">(optional)</span>
            </label>
            {isConverting ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E7E4DF] bg-[#F7F6F4] p-6">
                <Loader2 className="h-7 w-7 animate-spin mb-2" style={{ color: "var(--accent)" }} />
                <p className="text-sm text-[#78716C]">Converting image…</p>
              </div>
            ) : imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Fridge preview" className="w-full max-h-52 object-cover" />
                {/* Scanning overlay while loading */}
                {isLoading && (
                  <div className="scan-overlay absolute inset-0 bg-[#1C1917]/30 pointer-events-none rounded-xl">
                    <div className="scan-line absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[11px] font-semibold text-white/80 tracking-[0.14em] uppercase">Scanning…</span>
                    </div>
                  </div>
                )}
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
                  "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors duration-150",
                  isDragging
                    ? "dropzone--dragging"
                    : "border-[#E7E4DF] hover:border-[#C9BEAF] hover:bg-[#F7F6F4]"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={cn("h-6 w-6 mb-2 transition-colors duration-150", isDragging ? "text-[#CC4E0D]" : "text-[#C9BEAF]")} />
                {isDragging ? (
                  <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>Release to upload</p>
                ) : (
                  <>
                    <p className="text-sm text-[#78716C]">Drop a fridge photo here or <span className="font-medium text-[#1C1917]">browse</span></p>
                    <p className="text-xs text-[#A8A29E] mt-1">PNG, JPG, HEIC, WebP, PDF — up to 10 MB</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif,.pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }}
            />
          </div>

          {/* Ingredients text */}
          <div>
            <label className="block text-sm font-semibold text-[#1C1917] mb-2">
              Or type your ingredients
            </label>
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="e.g. chicken thighs, garlic, lemon, cherry tomatoes, spinach..."
              rows={3}
              className="ingredient-textarea w-full rounded-xl border border-[#E7E4DF] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#1C1917] placeholder:text-[#C4B8AF] resize-none"
            />
          </div>

          {/* Cuisine selector */}
          <div>
            <label className="block text-sm font-semibold text-[#1C1917] mb-2">Cuisine</label>
            <div className="flex flex-wrap gap-2">
              {CUISINE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCuisine(opt.value)}
                  className={cn(
                    "cuisine-btn flex flex-col items-center justify-center gap-0.5 rounded-xl border py-2 px-3",
                    cuisine === opt.value
                      ? "cuisine-btn--selected"
                      : "border-[#E7E4DF] bg-white text-[#57534E] hover:bg-[#F7F6F4]"
                  )}
                >
                  <span className="text-[17px] leading-none">{opt.emoji}</span>
                  <span className="text-[11px] font-medium whitespace-nowrap mt-0.5">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={() => runWorkflow()}
            disabled={isLoading}
            className="recipe-submit-btn w-full h-11 font-display font-bold text-[15px] text-white tracking-tight"
          >
            {isLoading ? (
              <span className="flex items-center gap-2.5">
                <span className="flex gap-1">
                  <span className="loading-dot h-1.5 w-1.5 rounded-full bg-white/80 inline-block" />
                  <span className="loading-dot h-1.5 w-1.5 rounded-full bg-white/80 inline-block" />
                  <span className="loading-dot h-1.5 w-1.5 rounded-full bg-white/80 inline-block" />
                </span>
                Generating your recipe
              </span>
            ) : (
              "Find me a recipe"
            )}
          </Button>
        </Card>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-3 rounded-xl border border-[#E7E4DF] bg-white px-4 py-3.5 shadow-[0_1px_4px_rgba(28,25,23,0.05)]">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: "var(--accent)" }} />
            <p className="text-sm text-[#57534E]">Working on your recipe — usually takes 10–20 seconds.</p>
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

        {/* Detected ingredient tags — only when image was used */}
        {recipe && !isLoading && imagePreview && recipe.ingredients.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A8A29E] px-1">Detected from your photo</p>
            <div className="flex flex-wrap gap-1.5">
              {recipe.ingredients.map((ing, i) => (
                <span
                  key={ing}
                  className="ingredient-tag inline-flex items-center rounded-full bg-white border border-[#E7E4DF] px-2.5 py-1 text-xs text-[#57534E]"
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  {ing}
                </span>
              ))}
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
