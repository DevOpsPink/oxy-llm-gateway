"""
An OpenAI-compatible provider that records everything it receives.

The proofs point the engine at it (OPENAI_API_BASE) and then ask it what
actually arrived: how many completions were served and the full body of every
request, so a secret that slipped past DLP or a call after a kill switch shows
up here and nowhere else.

  POST /v1/chat/completions   answer with a fixed completion and usage
  GET  /_stats                {"count": N}
  GET  /_requests             [{"t": unix_time, "body": {...}}, ...]
  POST /_reset                forget everything

Usage per completion is fixed (PROMPT_TOKENS, COMPLETION_TOKENS) and matches
what the engine reserves for a one-message request, so the money a completion
really costs equals the money the gateway set aside for it. A small delay
(DELAY_MS) keeps concurrent requests in flight together.
"""

import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROMPT_TOKENS = int(os.getenv("PROMPT_TOKENS", "1500"))
COMPLETION_TOKENS = int(os.getenv("COMPLETION_TOKENS", "2000"))
DELAY_MS = int(os.getenv("DELAY_MS", "50"))

_lock = threading.Lock()
_requests = []


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def _send(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw)
        except ValueError:
            return {"_raw": raw.decode("utf-8", "replace")}

    def do_GET(self):
        if self.path == "/_stats":
            with _lock:
                return self._send(200, {"count": len(_requests)})
        if self.path == "/_requests":
            with _lock:
                return self._send(200, list(_requests))
        if self.path in ("/", "/health", "/v1/models"):
            return self._send(200, {"object": "list", "data": [{"id": "gpt-4o-mini", "object": "model"}]})
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        body = self._body()
        if self.path == "/_reset":
            with _lock:
                _requests.clear()
            return self._send(200, {"count": 0})
        if self.path.rstrip("/").endswith("/chat/completions"):
            with _lock:
                _requests.append({"t": time.time(), "body": body})
            time.sleep(DELAY_MS / 1000)
            return self._send(200, {
                "id": "chatcmpl-fake",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": body.get("model", "gpt-4o-mini"),
                "choices": [{"index": 0, "finish_reason": "stop",
                             "message": {"role": "assistant", "content": "ok"}}],
                "usage": {"prompt_tokens": PROMPT_TOKENS, "completion_tokens": COMPLETION_TOKENS,
                          "total_tokens": PROMPT_TOKENS + COMPLETION_TOKENS},
            })
        return self._send(404, {"error": "not found"})


if __name__ == "__main__":
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer(("0.0.0.0", int(os.getenv("PORT", "9000"))), Handler).serve_forever()
