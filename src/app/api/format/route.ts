import { formatRecipe } from "@/lib/formatRecipe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const { rawRecipe, cuisine } = await req.json() as { rawRecipe: string; cuisine: string }
  return Response.json(formatRecipe(rawRecipe, cuisine))
}
