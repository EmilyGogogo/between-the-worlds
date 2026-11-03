"""Regression tests for failure paths used by the CI gate."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT))
import check_all
import check_repository


class RepositoryChecks(unittest.TestCase):
    def inspect(self, name, content):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / name
            path.write_text(content, encoding='utf-8')
            return check_repository.inspect_file(path)

    def test_invalid_python_fails(self):
        self.assertTrue(self.inspect('bad.py', 'def broken(:\n'))

    def test_invalid_json_fails(self):
        self.assertTrue(self.inspect('bad.json', '{"a":}'))

    def test_conflict_fails(self):
        self.assertTrue(self.inspect('file.md', '<<<<<<< HEAD\na\n=======\nb\n>>>>>>> main\n'))

    def test_lfs_pointer_fails_for_binary_extension(self):
        self.assertTrue(self.inspect('bird.glb', 'version https://git-lfs.github.com/spec/v1\noid sha256:123\nsize 5\n'))

    def test_valid_source_passes(self):
        self.assertEqual(self.inspect('good.py', 'value = 42\n'), [])
        self.assertEqual(self.inspect('good.json', '{"a": 1}'), [])

    def test_vendor_and_local_state_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('frontend/src/main.js', 'frontend/vendor/library.js', 'project/__pycache__/x.py'):
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('', encoding='utf-8')
            self.assertEqual(check_repository.source_files(root), [root / 'frontend/src/main.js'])


class CheckRunner(unittest.TestCase):
    def test_docs_only_does_not_start_browser_and_records_result(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with patch.object(sys, 'argv', ['check_all.py', '--only', 'docs', '--output', directory]), \
                    patch.object(check_all, 'find_chrome', side_effect=AssertionError('browser started')):
                self.assertEqual(check_all.main(), 0)
            result = json.loads((output / 'result.json').read_text(encoding='utf-8'))
            self.assertEqual(result['docs'], 'passed')
            self.assertEqual(result['browser'], 'not_run')
            self.assertEqual(result['status'], 'passed')

    def test_source_zip_without_git_can_still_run_docs(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(sys, 'argv', ['check_all.py', '--only', 'docs', '--output', directory]), \
                    patch.object(check_all.shutil, 'which', return_value=None):
                self.assertEqual(check_all.main(), 0)
            result = json.loads((Path(directory) / 'result.json').read_text(encoding='utf-8'))
            self.assertEqual(result['commit'], 'unknown')
            self.assertIsNone(result['worktreeDirty'])

    def test_stale_result_from_another_run_is_not_merged(self):
        with tempfile.TemporaryDirectory() as directory:
            stale = {'status': 'failed', 'module': 'browser', 'docs': 'not_run', 'browser': 'failed',
                     'error': 'Browser checks failed', 'commit': 'old-commit', 'worktreeDirty': False}
            (Path(directory) / 'result.json').write_text(json.dumps(stale), encoding='utf-8')
            with patch.object(sys, 'argv', ['check_all.py', '--only', 'docs', '--output', directory]):
                self.assertEqual(check_all.main(), 0)
            result = json.loads((Path(directory) / 'result.json').read_text(encoding='utf-8'))
            self.assertEqual(result['module'], 'docs')
            self.assertEqual(result['browser'], 'not_run')
            self.assertEqual(result['status'], 'passed')
            self.assertNotIn('error', result)

    def test_missing_browser_returns_failure_with_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(sys, 'argv', ['check_all.py', '--only', 'browser', '--output', directory]), \
                    patch.object(check_all, 'find_chrome', side_effect=RuntimeError('Chrome not found')):
                self.assertEqual(check_all.main(), 1)
            result = json.loads((Path(directory) / 'result.json').read_text(encoding='utf-8'))
            self.assertEqual(result['status'], 'failed')
            self.assertEqual(result['docs'], 'not_run')
            self.assertIn('Chrome not found', result['error'])


if __name__ == '__main__':
    unittest.main()
