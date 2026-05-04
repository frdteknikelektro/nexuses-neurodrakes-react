"""Tool schemas for nexuses-neurodrakes plugin."""

START = {
    "type": "object",
    "properties": {
        "port": {
            "type": "integer",
            "description": "Port for the HTTP server. Defaults to env NN_PORT or 3456.",
            "minimum": 1024,
            "maximum": 65535,
        },
        "force": {
            "type": "boolean",
            "description": "If true, start a new session even if one is already active.",
        },
    },
}

STATUS = {
    "type": "object",
    "properties": {},
}

END = {
    "type": "object",
    "properties": {
        "keep_session": {
            "type": "boolean",
            "description": "If true, do not clear the active session state.",
        },
    },
}
