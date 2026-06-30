export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ ok: true, build: "35c0d66-logging", routes: ["/api/recipe", "/api/format", "/api/workflow"] })
}
