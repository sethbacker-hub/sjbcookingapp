"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import RecipeCard from "@/components/RecipeCard"
import SavedRecipesDrawer from "@/components/SavedRecipesDrawer"
import { Recipe, CuisineType, ModifierType } from "@/types/recipe"
import { ChefHat, X, BookOpen, Loader2, AlertCircle } from "lucide-react"
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
  { value: "italian"       as CuisineType, label: "Italian",       emoji: "🇮🇹", tint: "#FFF1EF" },
  { value: "japanese"      as CuisineType, label: "Japanese",      emoji: "🇯🇵", tint: "#FFF0F6" },
  { value: "mexican"       as CuisineType, label: "Mexican",       emoji: "🇲🇽", tint: "#F0FFF4" },
  { value: "american"      as CuisineType, label: "American",      emoji: "🇺🇸", tint: "#F0F5FF" },
  { value: "thai"          as CuisineType, label: "Thai",          emoji: "🇹🇭", tint: "#FFFBEB" },
  { value: "indian"        as CuisineType, label: "Indian",        emoji: "🇮🇳", tint: "#FFF7ED" },
  { value: "french"        as CuisineType, label: "French",        emoji: "🇫🇷", tint: "#F8F0FF" },
  { value: "mediterranean" as CuisineType, label: "Mediterranean", emoji: "🫒", tint: "#F0FAFF" },
  { value: "korean"        as CuisineType, label: "Korean",        emoji: "🇰🇷", tint: "#FFF0F0" },
  { value: "chinese"       as CuisineType, label: "Chinese",       emoji: "🇨🇳", tint: "#FFF8F0" },
  { value: "surprise"      as CuisineType, label: "Surprise me",   emoji: "🌍", tint: "#F5FFEB" },
]

function FridgeIcon() {
  return (
    <svg width="44" height="56" viewBox="0 0 44 56" fill="none" aria-hidden>
      <rect x="5" y="2" width="34" height="52" rx="7" fill="#F0EDE8" stroke="#C9BEAF" strokeWidth="1.5"/>
      <line x1="5" y1="20" x2="39" y2="20" stroke="#C9BEAF" strokeWidth="1.5"/>
      <rect x="28" y="10" width="8" height="2.5" rx="1.25" fill="#B5ADA3"/>
      <rect x="28" y="32" width="8" height="2.5" rx="1.25" fill="#B5ADA3"/>
      <path d="M22 47 L22 39" stroke="#CC4E0D" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M18.5 42.5 L22 39 L25.5 42.5" stroke="#CC4E0D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* Flat-illustration style food decorations for the hero gutters */
function TomatoDecoration() {
  return (
    <svg viewBox="0 0 100 118" fill="none" aria-hidden>
      {/* Calyx */}
      <path d="M50 30 C50 22 50 14 52 8 C52 14 50 30 50 30Z" fill="#4E9040"/>
      <path d="M50 30 C46 22 38 16 34 20 C38 22 48 28 50 30Z" fill="#5BA34A"/>
      <path d="M50 30 C44 22 40 15 38 12 C40 17 48 27 50 30Z" fill="#4E9040"/>
      <path d="M50 30 C54 22 62 16 66 20 C62 22 52 28 50 30Z" fill="#4E9040"/>
      <path d="M50 30 C56 22 60 15 62 12 C60 17 52 27 50 30Z" fill="#5BA34A"/>
      {/* Body */}
      <circle cx="50" cy="72" r="38" fill="#E8503A"/>
      {/* Depth - bottom shadow */}
      <ellipse cx="62" cy="90" rx="22" ry="14" fill="rgba(0,0,0,0.07)"/>
      {/* Highlight */}
      <ellipse cx="34" cy="54" rx="10" ry="8" fill="rgba(255,255,255,0.28)" transform="rotate(-22 34 54)"/>
      <ellipse cx="28" cy="60" rx="4" ry="3" fill="rgba(255,255,255,0.16)"/>
    </svg>
  )
}

function PepperDecoration() {
  return (
    <svg viewBox="0 0 64 110" fill="none" aria-hidden>
      {/* Stem */}
      <path d="M34 10 C34 6 36 2 40 2 C37 5 34 10 34 10Z" fill="#4E9040"/>
      <path d="M34 10 C30 5 26 4 24 6" stroke="#5BA34A" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Body */}
      <path d="M34 12 C42 14 48 26 48 44 C48 64 40 82 32 92 C26 100 18 98 16 92 C14 86 16 76 22 66 C28 56 28 40 28 26 C28 18 30 12 34 12Z" fill="#E06B20"/>
      {/* Tip curve */}
      <path d="M32 92 C28 100 22 106 22 106 C25 102 28 97 32 92Z" fill="#C85210"/>
      {/* Shadow side */}
      <path d="M34 12 C40 14 46 26 46 44 C46 64 38 82 32 92 C36 82 44 64 44 44 C44 26 38 14 34 12Z" fill="rgba(0,0,0,0.08)"/>
      {/* Highlight */}
      <ellipse cx="28" cy="36" rx="5" ry="11" fill="rgba(255,255,255,0.22)" transform="rotate(-6 28 36)"/>
    </svg>
  )
}

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
            <span className="font-display text-[15px] tracking-tight text-[#1C1917]" style={{ fontWeight: 700 }}>Seth&apos;s Cooking Assistant</span>
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

      {/* Hero — full-width so illustrations live in the page gutters, never over text */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(165deg, #FDEEDD 0%, #FEF3E6 30%, #FDF8F2 60%, #F7F6F4 100%)" }}
      >
        {/* Tomato illustration — left gutter, only at lg+ where gutters are ≥176px */}
        <div aria-hidden className="pointer-events-none absolute left-0 bottom-0 w-36 opacity-70 hidden lg:block">
          <TomatoDecoration />
        </div>
        {/* Pepper illustration — right gutter */}
        <div aria-hidden className="pointer-events-none absolute right-0 top-6 w-24 opacity-65 hidden lg:block" style={{ transform: "rotate(10deg)" }}>
          <PepperDecoration />
        </div>
        {/* Text — constrained, z-10 so it's always above */}
        <div className="relative z-10 mx-auto max-w-2xl px-4 py-10 text-center select-none">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: "var(--accent)" }}>
            AI Recipe Generator
          </p>
          <h1
            className="font-display text-[2.6rem] sm:text-[3.2rem] font-extrabold leading-[1.08] tracking-tight text-[#1C1917]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Seth&apos;s Cooking Assistant
          </h1>
          <p className="mt-3 text-[#78716C] text-base leading-relaxed">
            Drop in what&apos;s in your kitchen — I&apos;ll turn it into something worth eating.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-2xl px-4 pb-12 space-y-5 mt-5">
        {/* Input card */}
        <Card className="recipe-input-card p-6 space-y-5 border border-[#E7E4DF] bg-white rounded-3xl">
          {/* Image upload */}
          <div>
            <label className="block text-sm font-semibold text-[#1C1917] mb-2">
              Upload a photo <span className="font-normal text-[#A8A29E]">(optional)</span>
            </label>
            {isConverting ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E8DACE] bg-[#FEF8F3] p-6">
                <Loader2 className="h-7 w-7 animate-spin mb-2" style={{ color: "var(--accent)" }} />
                <p className="text-sm text-[#78716C]">Converting image…</p>
              </div>
            ) : imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-[#E8DACE] bg-[#FEF8F3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Fridge preview" className="w-full max-h-52 object-cover" />
                {/* Scanning overlay while loading */}
                {isLoading && (
                  <div className="scan-overlay absolute inset-0 bg-[#1C1917]/30 pointer-events-none rounded-2xl">
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
                  "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-colors duration-200",
                  isDragging
                    ? "dropzone--dragging"
                    : "border-[#E8DACE] bg-[#FEF8F3] hover:border-[#D4956A] hover:bg-[#FDF3EA]"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FridgeIcon />
                <div className="mt-3 text-center">
                  {isDragging ? (
                    <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Release to upload</p>
                  ) : (
                    <>
                      <p className="text-sm text-[#78716C]">Drop a fridge photo here or <span className="font-semibold text-[#1C1917] underline underline-offset-2 decoration-[#C9BEAF]">browse</span></p>
                      <p className="text-xs text-[#A8A29E] mt-1">PNG, JPG, HEIC, WebP, PDF — up to 10 MB</p>
                    </>
                  )}
                </div>
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
              className="ingredient-textarea w-full rounded-2xl border border-[#E8DACE] bg-[#FEF8F3] px-4 py-3 text-sm text-[#1C1917] placeholder:text-[#C4B8AF] resize-none"
            />
          </div>

          {/* Cuisine selector */}
          <div>
            <label className="block text-sm font-semibold text-[#1C1917] mb-2">Cuisine</label>
            <div className="flex flex-wrap gap-2">
              {CUISINE_OPTIONS.map((opt) => {
                const isSelected = cuisine === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setCuisine(opt.value)}
                    style={isSelected ? undefined : { "--hover-tint": opt.tint } as React.CSSProperties}
                    className={cn(
                      "cuisine-btn flex flex-col items-center justify-center gap-0.5 rounded-2xl border py-2 px-3",
                      isSelected
                        ? "cuisine-btn--selected"
                        : "border-[#E7E4DF] bg-white text-[#57534E] hover:border-[#C9BEAF]"
                    )}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = opt.tint }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "" }}
                  >
                    <span className="text-[17px] leading-none">{opt.emoji}</span>
                    <span className="text-[11px] font-medium whitespace-nowrap mt-0.5">{opt.label}</span>
                  </button>
                )
              })}
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
          <div className="flex items-center gap-3 rounded-2xl border border-[#E7E4DF] bg-white px-4 py-3.5 shadow-[0_1px_4px_rgba(28,25,23,0.05)]">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: "var(--accent)" }} />
            <p className="text-sm text-[#57534E]">Working on your recipe — usually takes 10–20 seconds.</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
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
