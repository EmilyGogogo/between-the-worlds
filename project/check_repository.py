#!/usr/bin/env python3
"""Check first-party source without installing packages or changing files."""
import argparse
import ast
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', '.work', '.venv', 'venv', 'node_modules', '__pycache__', 'vendor'}
TEXT_SUFFIXES = {'.py', '.js', '.json', '.gltf', '.md', '.yml', '.yaml', '.html', '.css', '.csv', '.svg'}
CONFLICT = re.compile(r'^(?:<{7} |={7}$|>{7} |\|{7} )', re.M)


def source_files(root):
    roots = [root / name for name in ('frontend', 'project', 'data', 'docs', '.github', 'assets')]
    files = list(root.glob('*.md'))
    for folder in roots:
        if folder.exists():
            files.extend(p for p in folder.rglob('*') if p.is_file()
                         and not EXCLUDED.intersection(p.relative_to(root).parts))
    return sorted(set(files))


def inspect_file(path):
    errors = []
    with path.open('rb') as stream:
        if stream.read(128).startswith(b'version https://git-lfs.github.com/spec/v1'):
            return ['LFS object missing; run git lfs pull']
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return errors
    try:
        text = path.read_text(encoding='utf-8-sig')
        if CONFLICT.search(text):
            errors.append('unresolved merge conflict')
        if path.suffix == '.py':
            ast.parse(text, filename=str(path))
        elif path.suffix.lower() in {'.json', '.gltf'}:
            json.loads(text)
    except (UnicodeError, SyntaxError, ValueError) as error:
        errors.append(str(error))
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--javascript', action='store_true', help='Also check ES module syntax with Node.js')
    args = parser.parse_args()
    node = shutil.which('node') if args.javascript else None
    if args.javascript and not node:
        parser.error('Node.js is required with --javascript')
    if node:
        version = subprocess.run([node, '--version'], capture_output=True, text=True, timeout=30).stdout.strip()
        print(f'Node.js {version or "unknown"}: {node}')
    failures = []
    files = source_files(ROOT)
    for path in files:
        failures.extend(f'{path.relative_to(ROOT)}: {error}' for error in inspect_file(path))
        if node and path.suffix == '.js':
            # stdin avoids interpreting browser modules as CommonJS on older setups.
            result = subprocess.run([node, '--input-type=module', '--check'],
                                    input=path.read_text(encoding='utf-8'), text=True,
                                    encoding='utf-8', capture_output=True, timeout=30)
            if result.returncode:
                failures.append(f'{path.relative_to(ROOT)}: {result.stderr.strip()}')
    for error in failures:
        print('FAIL: ' + error)
    print(f'{len(files)} first-party files checked; {len(failures)} errors; '
          f'JavaScript syntax: {"checked" if node else "not run"}.')
    return int(bool(failures))


if __name__ == '__main__':
    sys.exit(main())
