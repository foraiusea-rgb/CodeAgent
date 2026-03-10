# ⚡ CodeAgent

AI-powered code review and optimization. Upload your files, get structured findings, apply fixes with one click.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/codeagent)

## Features

- 🔍 **Review mode** — bugs, security issues, code smells
- 🚀 **Optimize mode** — performance, patterns, readability  
- ⚡ **Pipeline mode** — full review + optimize in one pass
- ✅ **Approve/reject** individual findings with one click
- 📋 **Diff view** — see before/after for every fix
- 🔑 **Any model** — OpenRouter (free tier!) or Google AI Studio

## Deploy to Vercel

1. Fork this repo
2. Go to [vercel.com/new](https://vercel.com/new) and import your fork
3. Click Deploy — no environment variables needed
4. Open the app, go to Config, paste your API key

## Run Locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Getting an API Key

**OpenRouter (recommended — has free models):**
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Go to Keys → Create Key
3. Paste in CodeAgent Config tab
4. Use any ⭐ FREE model — no credit card needed

**Google AI Studio:**
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create key, paste in Config tab
3. Select a Gemini model

## Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Framer Motion**
- **Zustand** (state)
- **Vercel Edge Runtime** (AI API calls)

## Privacy

API keys are stored in `sessionStorage` only — they're never sent to any server except directly to OpenRouter/Gemini. Keys are cleared when you close the tab.

## License

MIT
