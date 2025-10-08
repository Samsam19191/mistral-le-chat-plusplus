# mistral-le-chat-plusplus

A clean, testable demo app showcasing a chat UX, a Prompt Lab for A/B testing system prompts, and a lightweight Eval Dashboard for batch evaluation.
Built with Next.js (App Router) + TypeScript, mock/real Mistral streaming via a server proxy, and simple local persistence (localStorage).

**Goals:** easy setup, best practices (strict TS, tests, feature flag for mock mode), and a repo that's quick to review.

## Features

- **Chat** with streaming UX (send, cancel, retry, clear), latency HUD, and local message persistence.
- **Mock ↔ Real feature flag:**
  - **Mock mode** (default): no API key, deterministic responses.
  - **Real mode**: calls Mistral via server-side proxy (API key stays server-only).
- **Prompt Lab** (`/lab`): A/B test two system prompts side-by-side with live streaming and JSONL export.
- **Eval Dashboard** (`/eval`): Run a small JSONL dataset, get pass-rate (contains-all heuristic) and latency p50/p95. Export CSV/JSON.
- **Good DX**: strict TypeScript, simple Makefile, Playwright/Vitest tests, Docker workflow.

## 🚀 Quick Start (Local)

```bash
# 1) Clone
git clone https://github.com/Samsam19191/mistral-le-chat-plusplus.git
cd mistral-le-chat-plusplus

# 2) Install & run in mock mode (no API key needed)
cp web/.env.example web/.env
make setup
make dev
```

Open http://localhost:3000

- **Chat**: `/` (streams mock tokens)
- **Prompt Lab**: `/lab`
- **Eval Dashboard**: `/eval`

**Switch to Real Mode (locally):**

```bash
# in web/.env
USE_MOCK=false
MISTRAL_API_KEY=your_actual_key_here
MISTRAL_MODEL=mistral-small-latest
TEMPERATURE_DEFAULT=0.2

# restart
make dev
```

## 🐳 Testing the App with Docker

### Basic Setup (Mock Mode — No API Key Required)

```bash
git clone https://github.com/Samsam19191/mistral-le-chat-plusplus.git
cd mistral-le-chat-plusplus
make docker:build && make docker:up
```

Open http://localhost:3000

- App runs with mock AI responses
- **Chat**: send messages and see streamed mock output
- **Eval Dashboard**: `/eval`
- **Prompt Lab**: `/lab`

### Real API Mode (With Mistral API)

1. Get an API key from [Mistral's console](https://console.mistral.ai/).

2. Configure environment:

```bash
cp web/.env.example web/.env
# Edit web/.env:
# USE_MOCK=false
# MISTRAL_API_KEY=your_actual_key_here
# (optional) MISTRAL_MODEL=mistral-small-latest
```

3. Restart:

```bash
make docker:down && make docker:up
```

Now:

- Chat streams real Mistral responses
- Eval runs use the real API

**Stop Docker:**

```bash
make docker:down
```

## 🔄 Modes (Feature Flag)

- **Mock mode** (default): `USE_MOCK=true`
  - No key required, stable/deterministic, great for demos and tests.
- **Real mode**: `USE_MOCK=false` + `MISTRAL_API_KEY`
  - Server proxies your requests to Mistral; key never reaches the browser.

`.env.example` includes:

```bash
USE_MOCK=true
MISTRAL_API_KEY=your_key_here
MISTRAL_MODEL=mistral-small-latest
TEMPERATURE_DEFAULT=0.2
NEXT_PUBLIC_APP_NAME=Le Chat++
```

## 📁 Project Structure

```
mistral-le-chat-plusplus/
  README.md
  .env.example
  Makefile
  docker/
    Dockerfile.web
  docker-compose.yml

  datasets/
    sanity.jsonl           # tiny eval set (contains-all heuristic)

  web/
    src/app/               # Next.js (App Router)
      (chat)/              # route group for chat
      api/
        chat/
          stream/route.ts  # server proxy (mock vs real)
          config/route.ts  # exposes model/mode
        eval/
          run/route.ts     # batch eval runner
      eval/page.tsx        # /eval
      page.tsx             # / (main chat)

    src/lib/
      hooks/useChat.ts     # chat state, streaming, cancel/retry
      persist.ts           # localStorage (versioned)
      env.ts               # runtime env parsing (server-only for keys)
      providers/
        mock.ts            # fake streaming
        mistral.ts         # real Mistral adapter
      eval/score.ts        # contains-all scoring & latency stats
      export.ts            # CSV/JSON export helpers

    e2e/                   # Playwright tests
    src/lib/__tests__/     # Vitest unit tests
```

## 💡 Usage Notes

### Chat (`/`)

- Streaming messages with Send / Stop / Retry / Clear.
- HUD shows mode (Mock/Real), model, and last latency.
- Messages are persisted locally (localStorage). Use Clear to wipe.

### Prompt Lab (`/lab`)

- Two system prompts (A/B), one user input, run A/B or both.
- Side-by-side streaming results with latency and character counts.
- Export JSONL for your run data.

### Eval Dashboard (`/eval`)

- Runs `datasets/sanity.jsonl` by default.
- Reports pass rate (contains-all heuristic) and latency p50/p95.
- Export CSV/JSON summaries and per-sample results.
- Works in both modes (mock recommended for speed).

## 🛠 Makefile (Common Targets)

```bash
# Development
make setup          # Install dependencies
make dev            # Start dev server
make lint           # Run ESLint
make typecheck      # TypeScript check
make test           # Unit tests (Vitest)
make test:e2e       # E2E tests (Playwright)
make build          # Build production
make start          # Start production server

# Docker
make docker:build   # Build Docker image
make docker:up      # Start Docker container
make docker:down    # Stop Docker container
```
