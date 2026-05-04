"""Stack manager for nexuses-neurodrakes plugin.

Handles:
- Node.js installation check
- Building the React app (npm install && npm run build)
- Starting/stopping the Python HTTP server
- Opening the browser
"""

import http.server
import os
import platform
import shutil
import socket
import socketserver
import subprocess
import threading
import webbrowser
from pathlib import Path
from typing import Optional, Tuple


class HTTPServerThread(threading.Thread):
    """HTTP server that runs in a background thread."""

    def __init__(self, directory: Path, port: int):
        super().__init__(daemon=True)
        self.directory = directory
        self.port = port
        self.server = None
        self._ready = threading.Event()

    def run(self):
        # Capture directory in local variable for the closure
        serve_dir = str(self.directory)
        
        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=serve_dir, **kwargs)

            def log_message(self, format, *args):
                # Suppress default logging
                pass

        # Use ThreadingHTTPServer for concurrent requests
        with socketserver.ThreadingTCPServer(("", self.port), Handler) as server:
            self.server = server
            server.allow_reuse_address = True
            self._ready.set()
            server.serve_forever()

    def stop(self):
        if self.server:
            self.server.shutdown()

    def wait_until_ready(self, timeout: float = 5.0):
        return self._ready.wait(timeout)


def check_node_installed(node_path: Optional[str] = None) -> Tuple[bool, str]:
    """Check if Node.js and npm are installed.

    Returns (is_installed, message).
    """
    node = node_path or "node"
    npm = "npm"

    node_exe = shutil.which(node)
    npm_exe = shutil.which(npm)

    if not node_exe:
        return False, f"Node.js not found in PATH. Install from https://nodejs.org/ (LTS recommended)."

    if not npm_exe:
        return False, f"npm not found in PATH. Usually bundled with Node.js."

    try:
        node_version = subprocess.run(
            [node_exe, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout.strip()
    except Exception as e:
        return False, f"Failed to check Node.js version: {e}"

    return True, f"Node.js {node_version} at {node_exe}"


def ensure_built(project_root: Path, node_path: Optional[str] = None) -> Tuple[bool, str]:
    """Ensure the React app is built.

    Runs npm install && npm run build if node_modules is missing or dist/ is stale.

    Returns (success, message).
    """
    dist_dir = project_root / "dist"
    node_modules = project_root / "node_modules"
    package_json = project_root / "package.json"

    # Check if build is needed
    needs_build = False

    if not dist_dir.exists():
        needs_build = True
    elif not node_modules.exists():
        needs_build = True
    else:
        # Check if package.json is newer than dist/
        dist_mtime = max((f.stat().st_mtime for f in dist_dir.rglob("*") if f.is_file()), default=0)
        pkg_mtime = package_json.stat().st_mtime
        if pkg_mtime > dist_mtime:
            needs_build = True

    if not needs_build:
        return True, "dist/ is up to date"

    # Check Node.js
    node_ok, node_msg = check_node_installed(node_path)
    if not node_ok:
        return False, node_msg

    node_exe = node_path or "node"
    npm_exe = "npm"

    # Run npm install
    try:
        result = subprocess.run(
            [npm_exe, "install"],
            cwd=str(project_root),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            return False, f"npm install failed: {result.stderr[:500]}"
    except subprocess.TimeoutExpired:
        return False, "npm install timed out (120s)"
    except Exception as e:
        return False, f"npm install error: {e}"

    # Run npm run build
    try:
        result = subprocess.run(
            [npm_exe, "run", "build"],
            cwd=str(project_root),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            return False, f"npm run build failed: {result.stderr[:500]}"
    except subprocess.TimeoutExpired:
        return False, "npm run build timed out (120s)"
    except Exception as e:
        return False, f"npm run build error: {e}"

    return True, "Build successful"


def find_free_port(start_port: int = 3456, max_attempts: int = 100) -> Optional[int]:
    """Find a free port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(("localhost", port)) != 0:
                return port
    return None


def open_browser(url: str, auto_open: bool = True) -> Tuple[bool, str]:
    """Open the browser to the given URL.

    Returns (opened, message).
    """
    if not auto_open:
        return False, "Auto-open disabled"

    try:
        # Try to open in default browser
        opened = webbrowser.open(url, new=2)  # new=2 opens in new tab
        if opened:
            return True, f"Opened browser: {url}"
        else:
            return False, f"Browser open returned False for {url}"
    except Exception as e:
        return False, f"Failed to open browser: {e}"


class StackManager:
    """Manages the HTTP server lifecycle."""

    def __init__(self):
        self._server_thread: HTTPServerThread | None = None
        self._lock = threading.Lock()

    def start(self, dist_dir: Path, port: int) -> tuple[bool, str]:
        """Start the HTTP server."""
        with self._lock:
            if self._server_thread is not None and self._server_thread.is_alive():
                return True, f"Server already running on port {self._server_thread.port}"

            # Check port availability
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                if sock.connect_ex(("localhost", port)) == 0:
                    return False, f"Port {port} is already in use"

            server = HTTPServerThread(dist_dir, port)
            server.start()
            ready = server.wait_until_ready(timeout=5.0)

            if not ready:
                return False, "Server failed to start within 5 seconds"

            self._server_thread = server
            return True, f"Server started on port {port}"

    def stop(self) -> tuple[bool, str]:
        """Stop the HTTP server."""
        with self._lock:
            if self._server_thread is None or not self._server_thread.is_alive():
                return False, "Server not running"

            self._server_thread.stop()
            self._server_thread.join(timeout=2.0)
            self._server_thread = None
            return True, "Server stopped"

    def is_running(self) -> bool:
        """Check if server is running."""
        with self._lock:
            return self._server_thread is not None and self._server_thread.is_alive()

    def get_port(self) -> Optional[int]:
        """Get the current server port."""
        with self._lock:
            if self._server_thread is not None:
                return self._server_thread.port
            return None


# Global stack manager instance
_stack_manager = StackManager()


def ensure_running(project_root: Path, port: int, node_path: Optional[str] = None) -> Tuple[str, bool, str]:
    """Ensure the stack is running: build if needed, start server.

    Returns (url, success, message).
    """
    # Build first
    build_ok, build_msg = ensure_built(project_root, node_path)
    if not build_ok:
        return "", False, build_msg

    dist_dir = project_root / "dist"
    if not dist_dir.exists():
        return "", False, "dist/ directory not found after build"

    # Start server
    start_ok, start_msg = _stack_manager.start(dist_dir, port)
    if not start_ok:
        return "", False, start_msg

    url = f"http://localhost:{port}"
    return url, True, "Stack ready"


def stop() -> tuple[bool, str]:
    """Stop the stack."""
    return _stack_manager.stop()


def health_check(port: int) -> dict:
    """Check if the server is healthy."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(2.0)
            result = sock.connect_ex(("localhost", port))
            return {
                "reachable": result == 0,
                "port": port,
            }
    except Exception as e:
        return {
            "reachable": False,
            "port": port,
            "error": str(e),
        }
