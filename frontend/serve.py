#!/usr/bin/env python3
"""Serve the self-contained browser prototype. No package installation required."""
import argparse
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


class Server(ThreadingHTTPServer):
    # The default listen backlog of 5 overflows when Chrome requests the ES module graph
    # on reload; macOS then resets connections and one failed import stops main.js.
    request_queue_size = 128


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--open', action='store_true', help='Open the experience in the default browser')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    server = Server((args.host, args.port), partial(Handler, directory=str(root)))
    print(f'万物之间 → http://{args.host}:{args.port}', flush=True)
    if args.open:
        threading.Timer(.4, lambda: webbrowser.open(f'http://{args.host}:{args.port}')).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
