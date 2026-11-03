"""Small local Chrome DevTools client, using only Python's standard library."""
import base64
import json
import os
import socket
import struct
import time
from urllib.parse import urlparse
from urllib.request import urlopen


class CDP:
    def __init__(self, port=9222):
        tabs = json.load(urlopen(f'http://127.0.0.1:{port}/json'))
        tab = next(t for t in tabs if t['type'] == 'page')
        url = urlparse(tab['webSocketDebuggerUrl'])
        self.socket = socket.create_connection((url.hostname, url.port), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        request = f'GET {url.path} HTTP/1.1\r\nHost: {url.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'
        self.socket.sendall(request.encode())
        header = b''
        while b'\r\n\r\n' not in header:
            header += self.socket.recv(1)
        if b' 101 ' not in header.split(b'\r\n', 1)[0]:
            raise RuntimeError(header.decode())
        self.seq = 0
        self.events = []

    def read_bytes(self, n):
        result = b''
        while len(result) < n:
            chunk = self.socket.recv(n-len(result))
            if not chunk:
                raise EOFError('Chrome closed connection')
            result += chunk
        return result

    def send(self, data):
        payload = json.dumps(data).encode()
        mask = os.urandom(4)
        n = len(payload)
        frame = bytes([0x81])
        frame += bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack('!H', n) if n < 65536 else bytes([0x80 | 127]) + struct.pack('!Q', n)
        self.socket.sendall(frame + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def receive(self):
        a, b = self.read_bytes(2)
        n = b & 127
        if n == 126:
            n = struct.unpack('!H', self.read_bytes(2))[0]
        elif n == 127:
            n = struct.unpack('!Q', self.read_bytes(8))[0]
        mask = self.read_bytes(4) if b & 128 else None
        data = self.read_bytes(n)
        if mask:
            data = bytes(v ^ mask[i % 4] for i, v in enumerate(data))
        if a & 15 == 8:
            raise EOFError('Chrome sent close')
        return json.loads(data)

    def call(self, method, params=None):
        self.seq += 1
        self.send({'id': self.seq, 'method': method, 'params': params or {}})
        while True:
            result = self.receive()
            if result.get('id') == self.seq:
                if 'error' in result:
                    raise RuntimeError(result['error'])
                return result.get('result', {})
            self.events.append(result)

    def evaluate(self, expression):
        result = self.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
        if 'exceptionDetails' in result:
            raise RuntimeError(result['exceptionDetails'])
        return result.get('result', {}).get('value')

    def screenshot(self, path):
        data = self.call('Page.captureScreenshot', {'format': 'png'})['data']
        with open(path, 'wb') as f:
            f.write(base64.b64decode(data))

    def wait_for(self, expression, timeout=30):
        start = time.monotonic()
        while time.monotonic()-start < timeout:
            if self.evaluate(expression):
                return
            time.sleep(.2)
        raise TimeoutError(expression)
