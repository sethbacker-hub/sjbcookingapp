export interface Macro {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface Recipe {
  id: string
  name: string
  ingredients: string[]
  instructions: string[]
  macros: Macro
  healthScore: number
  healthSummary: string
  cuisine: string
  /** Total estimated prep + cook time (minutes), computed in a Vercel Sandbox. */
  prepTimeMinutes?: number
  savedAt?: string
}

export interface WorkflowStep {
  step: 'analyzing' | 'generating' | 'formatting' | 'complete' | 'error'
  message: string
}

export type CuisineType = 'italian' | 'japanese' | 'mexican' | 'surprise'

export interface CuisineOption {
  value: CuisineType
  label: string
  emoji: string
}

export type ModifierType = 'healthier' | 'faster' | 'less-ingredients'
