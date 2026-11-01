#!/usr/bin/env python3
"""Package the existing browser prototype as a self-contained HTML playtest."""
import argparse
import base64
import hashlib
import json
import posixpath
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'frontend'


def data_url(mime, data):
    return f'data:{mime};base64,' + base64.b64encode(data).decode('ascii')


def module_name(path):
    if path == 'vendor/three.module.js':
        return 'three'
    if path.startswith('vendor/addons/'):
        return 'three/addons/' + path.removeprefix('vendor/addons/')
    return 'between/' + path


def export(destination, frontend=FRONTEND):
    manifest_bytes = (frontend / 'public/models/manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest.get('environment') or any(v.get('url') for v in manifest['species'].values()):
        raise ValueError('External models need embedding before exporting this playtest.')

    sources = sorted((frontend / 'src').glob('*.js')) + sorted((frontend / 'vendor').rglob('*.js'))
    paths = {p.relative_to(frontend).as_posix() for p in sources}
    imports = {}
    hashes = {}
    for path in sources:
        relative = path.relative_to(frontend).as_posix()
        content = path.read_text()
        hashes[relative] = hashlib.sha256(path.read_bytes()).hexdigest()

        def resolve(match):
            specifier = match[3]
            if specifier.startswith('.'):
                target = posixpath.normpath(posixpath.join(posixpath.dirname(relative), specifier))
                if target not in paths:
                    raise ValueError(f'Missing module: {relative} -> {specifier}')
                specifier = module_name(target)
            elif specifier != 'three' and not specifier.startswith('three/addons/'):
                raise ValueError(f'Unsupported module: {specifier}')
            return f'{match[1]}{match[2]}{specifier}{match[2]}'

        content = re.sub(r'''(^import\s+[\s\S]*?\bfrom\s+)(['"])([^'"\n]+)\2''', resolve, content, flags=re.M)
        for fetch in re.finditer(r'''\bfetch\(\s*(['"])([^'"\n]+)\1''', content):
            if relative != 'src/assets.js' or fetch[2] != './public/models/manifest.json':
                raise ValueError(f'Additional resource needs embedding: {relative} -> {fetch[2]}')
        if relative == 'src/assets.js':
            original = "fetch('./public/models/manifest.json')"
            if content.count(original) != 1:
                raise ValueError('The asset manifest fetch has changed; review the exporter.')
            content = content.replace(original, 'fetch(' + json.dumps(data_url('application/json', manifest_bytes)) + ')')
        imports[module_name(relative)] = data_url('text/javascript', content.encode())

    html = (frontend / 'index.html').read_text()
    html = html.replace('<link rel="stylesheet" href="./src/style.css" />', '<style>\n' + (frontend / 'src/style.css').read_text() + '\n</style>')
    html = html.replace('href="./favicon.svg"', 'href="' + data_url('image/svg+xml', (frontend / 'favicon.svg').read_bytes()) + '"')
    html, count = re.subn(r'<script type="importmap">.*?</script>', '<script type="importmap">' + json.dumps({'imports': imports}, separators=(',', ':')) + '</script>', html, flags=re.S)
    if count != 1:
        raise ValueError('Expected one import map.')
    html = html.replace('<script type="module" src="./src/main.js"></script>', '<script type="module">import "between/src/main.js";</script>')
    license_text = (frontend / 'vendor/LICENSE.three').read_text()
    html = html.replace('<head>', '<head>\n<!--\nThree.js license:\n' + license_text.replace('--', '—') + '\n-->')

    destination.mkdir(parents=True, exist_ok=True)
    html_path = destination / '万物之间.html'
    html_path.write_text(html)
    instructions = '''万物之间 · 原型试玩包

1. 在电脑上解压这个 ZIP 文件。
2. 用 Chrome 或 Edge 浏览器打开「万物之间.html」。
3. 等待「进入旷野」按钮出现，点击开始。

无需安装 Python、Node 或其他开发工具，也不需要联网加载资源。
这是现有探索原型，包含十四种身体等实验内容；不是三种身体的新 Demo 完成版。
当前为程序化临时模型，尚未使用真实 Lux3D 产物。

操作：WASD 移动；鼠标或按住拖动环视；Shift 加速；
空格轻跃／上升；Ctrl 下降；R 化身；E 同行；Esc 暂停并查看完整操作。
暂停菜单可以重新开始。手机不支持完整键鼠操作，请在电脑上试玩。
本地文件的存档受浏览器设置和文件路径影响，换文件或浏览器可能不会保留。

若出现 WebGL 提示，请在支持 WebGL 2 的电脑浏览器中打开。
分享给朋友：直接发送整个 ZIP 文件，对方解压后打开 HTML 即可。
'''
    zip_path = destination / '万物之间_电脑试玩包.zip'
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.write(html_path, '万物之间/万物之间.html')
        archive.writestr('万物之间/打开说明.txt', instructions)
        archive.write(frontend / 'vendor/LICENSE.three', '万物之间/LICENSE.three')
        archive.write(frontend / 'THIRD_PARTY.md', '万物之间/THIRD_PARTY.md')

    result = {'source': str(frontend), 'html': str(html_path), 'zip': str(zip_path), 'html_bytes': html_path.stat().st_size,
              'zip_bytes': zip_path.stat().st_size, 'sha256': hashlib.sha256(html_path.read_bytes()).hexdigest(),
              'source_sha256': hashes}
    (destination / 'playtest-build.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=FRONTEND)
    parser.add_argument('--output', type=Path, default=ROOT / '输出/试玩分享')
    args = parser.parse_args()
    print(json.dumps(export(args.output.resolve(), args.source.resolve()), ensure_ascii=False, indent=2))
