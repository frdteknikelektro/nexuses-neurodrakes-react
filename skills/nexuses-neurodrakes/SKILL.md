# Nexuses & Neurodrakes Agent Skill

You are an AI agent with access to **Nexuses & Neurodrakes** — a turn-based RPG "dialog survival game" that runs as a local web application. The player navigates a futuristic world (year 2187) with glowing portals and mind-dragons, engaging in parley-based combat where words and actions drive every turn.

Use it when the user wants to play a single-player RPG against an AI Game Master.

---

## CRITICAL RULES — Read These First

1. **NEVER manually navigate to directories.** Do NOT run `cd ~/nexuses-neurodrakes`. Do NOT list files. Do NOT check git status. The plugin handles everything.

2. **NEVER run `npm run dev` manually.** The plugin provides `nn_start` which builds and serves the game. Manual npm commands bypass the plugin and cause conflicts.

3. **When user says "Let's play Nexuses & Neurodrakes" — IMMEDIATELY call `nn_start`.** No exploration. No checking if files exist. Just call the tool.

4. **After `nn_start`, your reply MUST contain the URL from `user_facing_message`.** The browser opens automatically. Tell the user to look for the new tab.

---

## Tools (3)

| Tool | Purpose |
|------|---------|
| `nn_start` | Start game session: builds React app, starts HTTP server, opens browser. Returns URL in `user_facing_message`. |
| `nn_status` | Poll session state and server health. |
| `nn_end` | Stop the session and shut down the server. |

---

## How to Launch

When the user says: *"Let's play Nexuses & Neurodrakes"*, *"I want to play N&N"*, *"Start the game"* — **call `nn_start` immediately.**

The tool auto-builds on first launch (runs `npm install && npm run build` internally), starts the server on port 3456 (or `NN_PORT` env), and opens the browser.

If `nn_start` is unavailable, the plugin isn't enabled:
```
ln -sfn /Users/frdinawan/WebstormProjects/nexuses-neurodrakes ~/.hermes/plugins/nexuses-neurodrakes
hermes plugins enable nexuses-neurodrakes
```

---

## Game Flow

1. **Launch** (`nn_start`): Browser opens to hero selection screen
2. **Player plays**: They choose a hero, start the run, encounter enemies
3. **AI Game Master**: The game has its own GM (Hermes-powered via the web UI)
4. **Session ends**: Player closes tab or asks to stop — you don't need to do anything special

The game is **self-contained** in the browser. The Hermes plugin just launches it.

---

## Example Session

```
User: Let's play Nexuses & Neurodrakes

Agent [calls nn_start]

Agent (chat): "Nexuses & Neurodrakes is ready! Open this link to start playing: http://localhost:3456"

[Player opens link, selects hero, plays the game]

User: I'm done playing

Agent [calls nn_end]

Agent (chat): "Session ended. Thanks for playing!"
```

---

## Error Handling

| Error | What to do |
|-------|------------|
| `session_already_active` | Tell user a session is already running at the URL. Ask if they want to start fresh. |
| `start_failed` (Node not installed) | Tell user to install Node.js from https://nodejs.org/ |
| `start_failed` (build error) | Suggest running `npm install && npm run build` manually in the plugin directory |

---

## Tips

- **Don't over-explain the game** — the web UI has tutorials and the GM guides the player
- **One session at a time** — the plugin tracks one active game; starting a new one requires `force=true`
- **Browser opens automatically** — user just needs to look for the new tab
- **No multiplayer** — this is strictly single-player vs AI

---

## Note on AI Integration

Currently the game calls its own AI backend for the Game Master. Future versions may bridge to the active Hermes chat session for a unified experience.
