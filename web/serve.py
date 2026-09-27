#!/usr/bin/env python3
"""Local test server for Kona World. Binds 127.0.0.1 only.

GET static files from public/.
POST /snap?name=...  raw PNG body → ../renders/review/<utc>_<name>.png
GET /health
"""
import os, re, json
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, 'public')
REVIEW = os.path.join(HERE, '..', 'renders', 'review')
os.makedirs(REVIEW, exist_ok=True)
PORT = 8791


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        path = self.path.split('?', 1)[0]
        if path in ('/', '/index.html', '/assets/raceweek.json'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?', 1)[0] == '/health':
            body = json.dumps({'ok': True, 'build': 'test-2026-09-27'}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        path, _, qs = self.path.partition('?')
        if path != '/snap':
            self.send_error(404)
            return
        n = int(self.headers.get('Content-Length', '0'))
        if n <= 0 or n > 12_000_000:
            self.send_error(400)
            return
        data = self.rfile.read(n)
        if not data.startswith(b'\x89PNG'):
            self.send_error(415)
            return
        name = 'shot'
        for part in qs.split('&'):
            if part.startswith('name='):
                name = part[5:]
        name = re.sub(r'[^a-zA-Z0-9_-]', '', name)[:48] or 'shot'
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        dest = os.path.join(REVIEW, f'{stamp}_{name}.png')
        with open(dest, 'wb') as f:
            f.write(data)
        body = json.dumps({'ok': True, 'file': os.path.basename(dest)}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        print('snap', dest, n, flush=True)


if __name__ == '__main__':
    httpd = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Kona test http://127.0.0.1:{PORT}', flush=True)
    httpd.serve_forever()
