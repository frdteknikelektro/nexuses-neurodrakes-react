"""Tool handlers for nexuses-neurodrakes plugin."""

import json
import os
import uuid
from pathlib import Path
from typing import Optional

from . import stack


def _get_project_root() -> Path:
    """Get the project root directory (where the plugin is installed)."""
    return Path(__file__).parent


def _get_node_path() -> Optional[str]:
    """Get Node.js path from env or None to use PATH."""
    return os.environ.get("NN_NODE_PATH") or None


def _get_auto_open() -> bool:
    """Get auto-open browser setting from env."""
    return os.environ.get("NN_AUTO_OPEN_BROWSER", "1") == "1"


def start(args: dict, session_state: dict) -> str:
    """Start a Nexuses & Neurodrakes game session.

    Builds the React app if needed, starts the HTTP server, and opens the browser.
    """
    # Check for existing session
    if session_state.get("session_id") and not args.get("force"):
        return json.dumps({
            "error": {
                "code": "session_already_active",
                "message": f"Session {session_state['session_id']} already active. Use force=true to start new.",
            }
        })

    # Determine port
    port = args.get("port")
    if port is None:
        port = int(os.environ.get("NN_PORT", "3456"))

    project_root = _get_project_root()
    node_path = _get_node_path()

    # Ensure stack is running
    url, ok, msg = stack.ensure_running(project_root, port, node_path)

    if not ok:
        return json.dumps({
            "error": {
                "code": "start_failed",
                "message": msg,
            }
        })

    # Open browser
    auto_open = _get_auto_open()
    opened, open_msg = stack.open_browser(url, auto_open)

    # Create session
    session_id = str(uuid.uuid4())[:8]
    session_state.update({
        "session_id": session_id,
        "port": port,
        "url": url,
        "started_at": json.dumps({"unix_ms": int(__import__('time').time() * 1000)}),
    })

    return json.dumps({
        "session_id": session_id,
        "url": url,
        "browser_opened": opened,
        "message": f"Session started. Open {url} to play!",
        "user_facing_message": f"Nexuses & Neurodrakes is ready! Open this link to start playing: {url}",
    })


def get_status(args: dict, session_state: dict) -> str:
    """Get the current session status."""
    sess = session_state
    if not sess.get("session_id"):
        return json.dumps({
            "active": False,
            "message": "No active session. Call nn_start to begin.",
        })

    port = sess.get("port")
    health = stack.health_check(port) if port else {"reachable": False}

    return json.dumps({
        "active": True,
        "session_id": sess["session_id"],
        "url": sess.get("url"),
        "port": port,
        "server_reachable": health.get("reachable", False),
        "started_at": sess.get("started_at"),
    })


def end(args: dict, session_state: dict) -> str:
    """End the current session and stop the server."""
    sess = session_state
    if not sess.get("session_id"):
        return json.dumps({
            "error": {
                "code": "no_active_session",
                "message": "No active session to end.",
            }
        })

    # Stop server
    stopped, msg = stack.stop()

    keep = args.get("keep_session", False)
    if not keep:
        # Clear session state
        for key in sess:
            sess[key] = None

    return json.dumps({
        "ended": True,
        "server_stopped": stopped,
        "message": msg,
    })
