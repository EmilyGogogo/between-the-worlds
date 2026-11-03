"""WebSocket framing regressions for the browser checker's CDP transport."""
import json
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'frontend/tests'))
from cdp import CDP


class ChunkedSocket:
    def __init__(self, data):
        self.data = data

    def recv(self, size):
        # Reject bogus lengths without making the huge allocation seen in CI.
        if size > len(self.data):
            raise AssertionError(f'Requested {size} bytes with only {len(self.data)} remaining')
        count = min(size, 17)
        chunk, self.data = self.data[:count], self.data[count:]
        return chunk


def frame(size, masked=False):
    payload = json.dumps({'value': 'x' * (size - 13)}).encode('ascii')
    assert len(payload) == size
    if size < 126:
        header = bytes([size])
    elif size < 65536:
        header = b'\x7e' + struct.pack('!H', size)
    else:
        header = b'\x7f' + struct.pack('!Q', size)
    if masked:
        mask = b'\x12\x34\x56\x78'
        header = bytes([header[0] | 128]) + header[1:] + mask
        payload = bytes(value ^ mask[i % 4] for i, value in enumerate(payload))
    return b'\x81' + header + payload


class WebSocketLengths(unittest.TestCase):
    def check_lengths(self, masked):
        for size in (125, 126, 127, 128, 65535, 65536):
            with self.subTest(size=size, masked=masked):
                client = CDP.__new__(CDP)
                client.socket = ChunkedSocket(frame(size, masked) + frame(125, masked))
                self.assertEqual(client.receive(), {'value': 'x' * (size - 13)})
                self.assertEqual(client.receive(), {'value': 'x' * 112})
                self.assertEqual(client.socket.data, b'')

    def test_unmasked_lengths_with_partial_reads_and_next_frame(self):
        self.check_lengths(masked=False)

    def test_masked_lengths_with_partial_reads_and_next_frame(self):
        self.check_lengths(masked=True)


if __name__ == '__main__':
    unittest.main()
