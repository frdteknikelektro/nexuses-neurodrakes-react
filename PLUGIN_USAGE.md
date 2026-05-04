# Nexuses & Neurodrakes - Hermes Plugin

## Installation

From a git remote (recommended):
```bash
hermes plugins install frdteknikelektro/nexuses-neurodrakes
hermes plugins enable nexuses-neurodrakes
hermes chat
```

Develop locally:
```bash
git clone https://github.com/frdteknikelektro/nexuses-neurodrakes
cd nexuses-neurodrakes
ln -sfn "$(pwd)" ~/.hermes/plugins/nexuses-neurodrakes
hermes plugins enable nexuses-neurodrakes
hermes chat
```

## Usage

Inside Hermes chat, simply say:
- "Let's play Nexuses & Neurodrakes"
- "Start the neurodrakes game"
- "I want to play N&N"

The agent will call `nn_start`, which:
1. Builds the React app (if needed - runs `npm install && npm run build`)
2. Starts a local HTTP server on port 3456 (configurable via `NN_PORT`)
3. Opens your browser automatically (disable with `NN_AUTO_OPEN_BROWSER=0`)

Then open http://localhost:3456 in your browser to play!

## Tools

| Tool | Description |
|------|-------------|
| `nn_start` | Start a game session. Builds if needed, starts server, opens browser. |
| `nn_status` | Check session status and server health. |
| `nn_end` | Stop the session and shut down the server. |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NN_PORT` | 3456 | Port for the HTTP server |
| `NN_AUTO_OPEN_BROWSER` | 1 | Set to 0 to disable auto-opening browser |
| `NN_NODE_PATH` | (PATH search) | Path to Node.js binary |

## Requirements

- Python 3.9+
- Node.js and npm (for building the React app)
- Hermes agent

## Architecture

The plugin follows the vdotool pattern:
- Thin Python wrapper around a local web stack
- Uses Python's built-in HTTPServer (no extra dependencies)
- Auto-builds on first launch
- Tracks one active session at a time
- Cleanup on Hermes exit
