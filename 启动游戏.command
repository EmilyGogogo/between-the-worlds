#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
python3 project/sync_runtime.py || exit 1
exec python3 frontend/serve.py --open
