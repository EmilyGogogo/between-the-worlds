#!/usr/bin/env python3
"""Export a complete source snapshot with a per-file SHA-256 manifest, no local state."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ('frontend', 'data', 'docs', 'project', '.github', 'assets')
ROOT_FILES = ('README.md', 'AGENTS.md', 'GLOSSARY.md', 'DEFERRED.md', '.gitignore',
              '启动游戏.command', '启动游戏.bat')
EXCLUDED_DIRS = {'.git', '.work', '__pycache__', 'node_modules', '.venv', 'venv'}


def included(path):
    name = path.name
    return (not any(part in EXCLUDED_DIRS for part in path.relative_to(ROOT).parts)
            and name not in {'.DS_Store', 'Thumbs.db', 'Desktop.ini', '.env'}
            and (not name.startswith('.env.') or name == '.env.example')
            and path.suffix.lower() not in {'.pyc', '.pyo', '.key', '.pem', '.blend1', '.blend2'})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '输出/协作分享')
    args = parser.parse_args()
    subprocess.run([sys.executable, str(ROOT / 'project/validate_docs.py')], cwd=ROOT, check=True)
    files = [ROOT / name for name in ROOT_FILES]
    for directory in DIRECTORIES:
        folder = ROOT / directory
        if folder.exists():
            files.extend(path for path in folder.rglob('*') if path.is_file() and included(path))
    files = sorted(set(files))
    payload = {}
    for path in files:
        # Links could silently pull private files from outside the project.
        if path.is_symlink() or any((ROOT / parent).is_symlink() for parent in path.relative_to(ROOT).parents):
            raise ValueError(f'Refusing symlink: {path.relative_to(ROOT)}')
        content = path.read_bytes()
        if content.startswith(b'version https://git-lfs.github.com/spec/v1\n'):
            raise ValueError(f'LFS object not downloaded; run git lfs pull: {path.relative_to(ROOT)}')
        payload[path.relative_to(ROOT).as_posix()] = content
    checksums = {name: hashlib.sha256(content).hexdigest() for name, content in payload.items()}
    fingerprint = hashlib.sha256(json.dumps(checksums, sort_keys=True).encode()).hexdigest()
    now = datetime.now().astimezone()
    build_id = f'{now:%Y%m%d-%H%M%S}-{fingerprint[:8]}'
    entities = json.loads(payload['data/entities.json'])
    spec_version = entities['_meta']['specVersion']
    manifest = {'buildId': build_id, 'createdAt': now.isoformat(), 'specVersion': spec_version,
                'kind': 'complete-development-source', 'contentSha256': fingerprint,
                'files': checksums, 'models': {
                    'bodyTypes': len(entities['entities']),
                    'placeholderBodies': sum(e['asset']['status'] == 'placeholder' for e in entities['entities']),
                    'lux3dBodyIds': [e['id'] for e in entities['entities'] if e['asset']['lux3dUsed']]},
                'validation': 'documentation/data passed at export; browser/manual QA recorded separately'}
    folder = f'万物之间_完整游戏协作版_{build_id}'
    args.output.mkdir(parents=True, exist_ok=True)
    archive = args.output / f'{folder}.zip'
    with ZipFile(archive, 'x', ZIP_DEFLATED) as zip_file:
        for name, content in payload.items():
            info = ZipInfo.from_file(ROOT / name, arcname=f'{folder}/{name}')
            info.compress_type = ZIP_DEFLATED
            zip_file.writestr(info, content)
        zip_file.writestr(f'{folder}/build-info.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{archive_hash}  {archive.name}\n', encoding='utf-8')
    print(f'{archive}\n{len(payload)} files; {archive.stat().st_size} bytes; SHA-256 {archive_hash}')


if __name__ == '__main__':
    main()
