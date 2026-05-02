# Nexuses & Neurodrakes — Experimental

> **Experimental Hackathon Build** — A dialog survival game where **Hermes Agent** powers the AI minds that guard the exit.

Built for the **Hermes Agent Creative Hackathon** by Nous Research.

## What This Is

A sci-fi dialog survival game where you don't just shoot your way out — you **talk** your way through. Each guardian you meet is powered by Hermes Agent, acting as a game engine that:

- Judges your intent (not just your keywords)
- Manages trust, insight, and pressure meters
- Generates contextual narrative beats
- Decides when you've earned passage or triggered combat

The AI **is** the game master. Every encounter is a live parley with physical stakes.

## Screenshots

![Hero Selection](/assets/screenshots/hero-select.png)
*Choose your hero — each with unique stats and skills*

![Parley Encounter](/assets/screenshots/parley.png)
*A live dialog encounter with AI-powered guardians*

![Dialog Tools](/assets/screenshots/tools.png)
*Use dialog tools and parenthesized actions to navigate conversations*

## Quick Start

### Prerequisites

- Node.js 18+
- Hermes Agent running as OpenAI API Compatible server on `localhost:8642`

### Activate Hermes Agent

Hermes Agent runs an OpenAI-compatible API server via the gateway. Configure it in `~/.hermes/config.yaml`:

```yaml
# Add to ~/.hermes/config.yaml
platforms:
  api_server:
    enabled: true
    extra:
      host: 127.0.0.1
      port: 8642
      cors_origins: "*"
```

Then start the gateway:

```bash
hermes gateway
```

You should see: `[API Server] API server listening on http://127.0.0.1:8642`

The game expects the standard OpenAI-compatible endpoints:
- `POST /v1/chat/completions` for dialog engine
- Model name: `hermes-agent`

### Setup

```bash
# Clone and install
npm install

# Configure environment
cp .env.example .env
# .env is pre-configured for local Hermes Agent:
# OPENAI_BASE_URL=http://localhost:8642/v1
# OPENAI_MODEL=hermes-agent

# Run dev server
npm run dev
```

The game will be available at `http://localhost:5173`.

## How to Play

1. **Choose a hero** — Each has different stats and skills
2. **Enter a parley** — You'll face AI guardians blocking your escape
3. **Type anything** — Dialogue, questions, or parenthesized actions like `(I lower my weapon)`
4. **Read the room** — Watch trust, insight, and pressure meters
5. **Survive 3 encounters** — Each guardian tests different tactics

### Dialog Tools (Hotkeys)

- `1` — **Promise** — Trade future commitment for present trust
- `2` — **Probe** — Analyze patterns and gain insight
- `3` — **Empathize** — Show understanding, build connection
- `4` — **Deflect** — Redirect pressure, reduce danger
- `5` — **Anchor** — Calm yourself, recover stability

## Why Hermes Agent

Hermes Agent shines as a **customizable game engine** through its skill system:

- **Install skills** to extend AI capabilities — add negotiation tactics, emotional analysis, or lore generation
- **Generic tool support** — while Hermes Agent's OpenAI-compatible API has limitations (it doesn't support external tool calling outside its internal skill system), you can still build rich mechanics using:
  - Structured JSON responses for game state management
  - System prompts that embed tool definitions
  - Custom skills that handle specialized game logic

**Current limitation:** The OpenAI-compatible endpoint doesn't expose external tool calling — everything must route through Hermes Agent's internal skill framework. This works great for self-contained game logic, but hybrid setups (calling external APIs during gameplay) would benefit from expanded tool support.

**The vision:** Skills + structured outputs = programmable NPCs that can adapt to any genre — mystery, negotiation, psychological horror, or tactical diplomacy.

## Project Structure

```
src/
  engine/dmHandler.ts    # AI game engine — Hermes integration
  hooks/useParleyAI.ts   # React hooks for AI communication
  components/            # UI components
  App.tsx                # Main game loop

public/
  assets/                # Character portraits, backgrounds, items
```

## Technical Notes

- Built with React + TypeScript + Vite
- TailwindCSS for styling
- Connects to Hermes Agent via OpenAI-compatible API at `localhost:8642`

## Hackathon Context

Submitted to the **Hermes Agent Creative Hackathon** (May 2026).

**Track Eligibility:** Main Track + Kimi Track (uses Hermes Agent)

**Creative Domain:** Interactive media / AI-powered gameplay

---

*This is an experimental build created under time constraints. The core concept — AI as game engine — is what matters.*
