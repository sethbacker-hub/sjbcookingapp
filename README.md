# What Should I Cook Tonight? 🍳

An AI-powered recipe generator that takes your ingredients (typed or photographed) and generates a full recipe with macros, health score, and smart tweaks — powered by Vercel AI Gateway, Vercel Workflows, and Vercel Sandbox.

## Features

- **Ingredient input**: Type ingredients OR upload a fridge/pantry photo
- **Cuisine vibes**: Italian 🇮🇹, Japanese 🇯🇵, Mexican 🇲🇽, Surprise me 🌍
- **Recipe cards**: Full ingredients, step-by-step instructions, macro progress bars, health score
- **Smart tweaks**: Make it healthier / faster / use fewer ingredients
- **Save recipes**: Persist favorites to localStorage with a slide-out drawer

## Environment Variables

Set these in your Vercel project under **Settings → Environment Variables**, or locally in `.env.local`:

| Variable | What it is | Where to get it |
|---|---|---|
| `VERCEL_AI_GATEWAY_URL` | Base URL for Vercel AI Gateway | Set to `https://ai-gateway.vercel.com` |
| `AI_GATEWAY_API_KEY` | Auth token for Vercel AI Gateway | [Vercel Dashboard → AI Gateway](https://vercel.com/dashboard/ai-gateway) → Create Token |
| `VERCEL_WORKFLOW_SECRET` | Secret for authenticating workflow triggers | Generate with `openssl rand -hex 32` |
| `VERCEL_SANDBOX_TOKEN` | Token for Vercel Sandbox execution | [Vercel Docs → Sandbox](https://vercel.com/docs/sandbox) |
| `VERCEL_TEAM_ID` | Your Vercel team ID | Vercel Dashboard → Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Project → Settings → General → Project ID |
| `VERCEL_TOKEN` | Vercel personal access token | [Vercel → Account Settings → Tokens](https://vercel.com/account/tokens) |

> **Note:** `AI_GATEWAY_API_KEY` is the only strictly required variable for the app to function. The others are used for the Workflow and Sandbox integrations.

## Architecture

```
User → /api/recipe (Vercel Function)
         ↓
       /api/workflow (Vercel Workflow orchestration)
         ↓ Step 1: Analyze image/text with claude-sonnet-4-6 via AI Gateway
         ↓ Step 2: Generate recipe with macros via AI Gateway
         ↓
       /api/format (Vercel Sandbox formatting step)
         ↓
       SSE stream → Client UI
```

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in env vars
cp .env.local.example .env.local
# Edit .env.local with your values

# 3. Start dev server
npm run dev

# Open http://localhost:3000
```

## Deploying to Vercel

### Option A — Vercel CLI
```bash
npm i -g vercel
vercel
# Follow the prompts, then add env vars:
vercel env add VERCEL_AI_GATEWAY_TOKEN
```

### Option B — GitHub Import
1. Push this repo to GitHub (see commands below)
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add environment variables in the Vercel dashboard
5. Deploy

## Pushing to GitHub

```bash
# If you haven't created a GitHub repo yet, create one at https://github.com/new
# Then run these commands:

git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git add .
git commit -m "feat: initial commit — What Should I Cook Tonight?"
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repo name.

## Tech Stack

- **Next.js 14** — App Router
- **AI SDK** (`ai` + `@ai-sdk/openai`) — Vercel AI Gateway integration
- **claude-sonnet-4-6** — Recipe generation + image vision via Vercel AI Gateway
- **shadcn/ui** — UI components (Progress, Sheet, Card, Button, Badge)
- **Tailwind CSS** — Styling
- **TypeScript** — Type safety
- **localStorage** — Saved recipes (no database needed)
