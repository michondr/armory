import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import config
import vision


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok"})
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/score":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            rel = body.get("path", "")
            if not rel or ".." in rel or rel.startswith("/"):
                self._json(400, {"error": "invalid path"})
                return
            path = os.path.join(config.IMAGES_DIR, rel)
            result = vision.score_image(
                path, int(body.get("shotCount") or 0), int(body.get("maxScore") or 10)
            )
            self._json(200, result)
        except Exception as e:  # noqa: BLE001
            self._json(400, {"error": str(e)})

    def _json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # keep the poll-loop logs clean


def serve(port=8000):
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
