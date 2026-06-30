export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ ok: true, build: "b8864ca", routes: ["/api/recipe", "/api/format", "/api/workflow"] })
}
