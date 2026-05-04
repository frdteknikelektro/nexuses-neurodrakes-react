"""Nexuses & Neurodrakes Hermes agent plugin.

A turn-based RPG that launches as a local web application. The plugin:
- Builds the React app if needed (npm install && npm run build)
- Starts a Python HTTP server to serve the static files
- Opens the browser automatically
- Tracks one active session at a time

Tools:
  - nn_start      Start a game session (build, serve, open browser)
  - nn_status     Check session and server health
  - nn_end        Stop the session and server

Example:
  User: "Let's play Nexuses & Neurodrakes"
  Agent: [calls nn_start] "Game ready! Open http://localhost:3456 to play!"
"""

from __future__ import annotations

import atexit
import json
import logging
import os
import threading
from pathlib import Path
from typing import Dict

from . import schemas
from . import tools
from . import stack as _stack

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Active session state
# ---------------------------------------------------------------------------

_active_session: Dict = {
    "session_id": None,
    "port": None,
    "url": None,
    "started_at": None,
}
_session_lock = threading.RLock()


def get_active_session() -> Dict:
    with _session_lock:
        return _active_session


def clear_active_session() -> None:
    with _session_lock:
        for key in _active_session:
            _active_session[key] = None


# ---------------------------------------------------------------------------
# Tool wrappers
# ---------------------------------------------------------------------------


def _start_wrapper(args: dict, **kwargs) -> str:
    """Start a game session with session state binding."""
    with _session_lock:
        return tools.start(args, session_state=_active_session)


def _status_wrapper(args: dict, **kwargs) -> str:
    """Get status with session state binding."""
    with _session_lock:
        return tools.get_status(args, session_state=_active_session)


def _end_wrapper(args: dict, **kwargs) -> str:
    """End session with session state binding."""
    with _session_lock:
        return tools.end(args, session_state=_active_session)


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

_TOOL_REGISTRY = [
    ("nn_start", schemas.START, _start_wrapper),
    ("nn_status", schemas.STATUS, _status_wrapper),
    ("nn_end", schemas.END, _end_wrapper),
]


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def _on_pre_llm_call(session_id, user_message, **kwargs):
    """Inject context at the start of each turn to guide agent behavior."""
    sess = _active_session
    if not sess.get("session_id"):
        # No active session - remind about tools if user mentions playing
        msg_lower = (user_message or "").lower()
        if any(k in msg_lower for k in ["play", "game", "nexuses", "neurodrakes", "n&n"]):
            return {
                "context": "[nexuses-neurodrakes] User wants to play. Use nn_start tool immediately. DO NOT manually navigate directories or run npm."
            }
        return None
    
    # Active session - provide status
    return {
        "context": f"[nexuses-neurodrakes] Game session active at {sess.get('url')}. Use nn_status to check health, nn_end to stop."
    }


def register(ctx):
    """Register the plugin with Hermes."""
    for name, schema, handler in _TOOL_REGISTRY:
        ctx.register_tool(
            name=name,
            toolset="nexuses-neurodrakes",
            schema=schema,
            handler=handler,
        )
        logger.info("Registered tool: %s", name)

    # Register skills if present
    skills_dir = Path(__file__).parent / "skills"
    if skills_dir.exists():
        for child in sorted(skills_dir.iterdir()):
            skill_md = child / "SKILL.md"
            if child.is_dir() and skill_md.exists():
                ctx.register_skill(child.name, skill_md)
                logger.info("Registered skill: %s", child.name)

    # Register hook for context injection
    ctx.register_hook("pre_llm_call", _on_pre_llm_call)
    logger.info("Registered pre_llm_call hook")

    # Cleanup on exit
    atexit.register(_cleanup)

    logger.info("nexuses-neurodrakes plugin registered (%d tools, 1 hook)", len(_TOOL_REGISTRY))


def _cleanup():
    """Cleanup function called at exit."""
    logger.info("Cleaning up nexuses-neurodrakes plugin...")
    try:
        _stack.stop()
    except Exception:
        pass
    clear_active_session()
