#!/usr/bin/env python3
"""Run data validation and existing browser checks with an isolated local Chrome."""
import argparse
import json
import os
import platform
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def wait_ready(url, process, timeout=45):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'Process exited ({process.returncode}) before {url} was ready')
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(.2)
    raise TimeoutError(f'Timed out waiting for {url}')


def find_chrome(explicit):
    candidates = [explicit, os.environ.get('CHROME_BIN')]
    candidates += [shutil.which(name) for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser')]
    candidates += ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    for variable in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
        if os.environ.get(variable):
            candidates.append(str(Path(os.environ[variable]) / 'Google/Chrome/Application/chrome.exe'))
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(candidate)
    raise RuntimeError('Chrome not found. Install Chrome or pass --chrome PATH.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chrome', help='Path to Chrome executable')
    parser.add_argument('--only', choices=('all', 'docs', 'browser'), default='all',
                        help='Run one CI module or the complete local check')
    parser.add_argument('--output', type=Path, default=ROOT / '.work/collaboration-checks')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    os.environ['PYTHONUTF8'] = '1'
    revision, dirty = 'unknown', None
    if shutil.which('git'):
        revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT,
                                  capture_output=True, text=True, check=False).stdout.strip() or 'unknown'
        state = subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT,
                               capture_output=True, text=True, check=False)
        if state.returncode == 0:
            dirty = bool(state.stdout.strip())
    result_path = args.output / 'result.json'
    result = {'status': 'running', 'docs': 'not_run', 'browser': 'not_run', 'manualQA': 'not_run',
              'performance': 'not_measured', 'realLux3D': 'not_verified',
              'module': args.only, 'commit': revision, 'worktreeDirty': dirty,
              'platform': platform.platform(), 'python': platform.python_version()}
    # CI runs docs and browser modules into one directory; keep the other
    # module's result only when it came from the same clean commit.
    other = {'docs': 'browser', 'browser': 'docs'}.get(args.only)
    if other and result_path.exists():
        try:
            previous = json.loads(result_path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            previous = None
        if (isinstance(previous, dict) and previous.get('module') == other and revision != 'unknown'
                and previous.get('commit') == revision and dirty is False and previous.get('worktreeDirty') is False):
            result[other] = previous.get(other, 'not_run')
            if previous.get('chrome'):
                result['chrome'] = previous['chrome']
            result['module'] = 'all'
    processes = []
    try:
        if args.only != 'browser':
            with (args.output / 'docs.log').open('w', encoding='utf-8') as log:
                docs = subprocess.run([sys.executable, str(ROOT / 'project/validate_docs.py')],
                                      cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=120)
            print((args.output / 'docs.log').read_text(encoding='utf-8'), flush=True)
            result['docs'] = 'passed' if docs.returncode == 0 else 'failed'
            if docs.returncode:
                raise RuntimeError('Documentation/data checks failed; see docs.log')
        if args.only == 'docs':
            result['status'] = 'passed'
            return 0
        chrome = find_chrome(args.chrome)
        result['browser'] = 'failed'
        http_port = free_port()
        debug_port = free_port()
        while debug_port == http_port:
            debug_port = free_port()
        url = f'http://127.0.0.1:{http_port}/'
        with tempfile.TemporaryDirectory(prefix='wanwu-qa-') as profile, \
                (args.output / 'server.log').open('w', encoding='utf-8') as server_log, \
                (args.output / 'chrome.log').open('w', encoding='utf-8') as chrome_log:
            try:
                server = subprocess.Popen([sys.executable, str(ROOT / 'frontend/serve.py'), '--port', str(http_port)],
                                          cwd=ROOT, stdout=server_log, stderr=subprocess.STDOUT)
                processes.append(server)
                wait_ready(url, server)
                browser = subprocess.Popen([
                    chrome, '--headless=new', '--no-first-run', '--no-default-browser-check',
                    '--disable-background-networking', '--disable-extensions', '--disable-dev-shm-usage',
                    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                    '--remote-debugging-address=127.0.0.1', f'--remote-debugging-port={debug_port}',
                    f'--user-data-dir={profile}', url + '?debug',
                ], stdout=chrome_log, stderr=subprocess.STDOUT)
                processes.append(browser)
                wait_ready(f'http://127.0.0.1:{debug_port}/json/version', browser)
                # check_browser.py clears localStorage first, so it needs an HTTP origin.
                sys.path.insert(0, str(ROOT / 'frontend/tests'))
                from cdp import CDP
                client = CDP(debug_port)
                try:
                    client.wait_for('location.origin===' + json.dumps(url.rstrip('/'))
                                    + '&&document.readyState==="complete"&&!!window.__world', 90)
                    result['chrome'] = client.call('Browser.getVersion')
                finally:
                    client.socket.close()
                with (args.output / 'browser.log').open('w', encoding='utf-8') as log:
                    check = subprocess.run([
                        sys.executable, str(ROOT / 'frontend/tests/check_browser.py'),
                        '--port', str(debug_port), '--url', url,
                    ], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=300)
                print((args.output / 'browser.log').read_text(encoding='utf-8'), flush=True)
                if check.returncode:
                    result['browser'] = 'failed'
                    raise RuntimeError('Browser checks failed; see browser.log')
                result['browser'] = 'passed'
                result['status'] = 'passed'
            finally:
                for process in reversed(processes):
                    if process.poll() is None:
                        process.terminate()
                        try:
                            process.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            process.kill()
                            process.wait(timeout=10)
        return 0
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        result['status'] = 'failed'
        result['error'] = str(error)
        print(f'FAIL: {error}', file=sys.stderr)
        return 1
    finally:
        if 'failed' in (result['docs'], result['browser']):
            result['status'] = 'failed'
        result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    sys.exit(main())
