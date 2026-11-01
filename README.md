# 万物之间 · 完整游戏协作工程

当前基线：`0.4-review`，2026-11-01，Web / Three.js。包含完整源码、13 种身体、主岛与邻岛、设计数据、本地 Three.js 依赖和测试。所有正式模型目前仍为程序占位，没有真实 Lux3D 资产；本包用于共同开发。

## 同事第一次打开

电脑安装 Python 3.9 或更高版本，以及 Chrome 或 Edge。游戏本身不需要 Node、npm、API key 或联网下载资源。

1. 将整个 ZIP 解压到一个文件夹。
2. Windows 双击根目录的 `启动游戏.bat`；macOS 双击 `启动游戏.command`。保持弹出的终端窗口开启。
3. 浏览器会打开 `http://127.0.0.1:4173/`。WASD 移动，鼠标环视，Shift 加速，R 魂穿，Esc 暂停。

如果系统不允许双击脚本，在终端进入解压后的根目录，执行：

```sh
python3 project/sync_runtime.py
python3 frontend/serve.py --open
```

Windows 终端可将 `python3` 换为 `py -3`。端口占用时给服务命令加 `--port 4174`。须通过 HTTP 启动，不能直接双击 `frontend/index.html`。每个同事在自己的电脑运行，不需要原作者的电脑在线。

## 一起制作

先读 [规范入口](docs/README.md)，再读 [协作与 GitHub 合并指南](docs/14-team-collaboration.md)。种类分工表和岛屿美化职责在该指南中；成员姓名待认领。

- `frontend/src/`：游戏代码；`frontend/vendor/`：随包分发的 Three.js。
- `data/`：模型槽、身体、布局、感知与数值的唯一来源。
- `frontend/public/models/`：游戏实际使用的 GLB。
- `docs/`、`project/`：规则、资产合同、任务、来源、校验与构建脚本。
- `.github/`：任务模板、PR 模板、自动检查。

模型按米制、+Y 向上、-Z 朝前导出 GLB，贴图内嵌；动物提供 idle / move。完整要求见 [资产合同](docs/06-lux3d-asset-pipeline.md)。先做一个种类跑通导入，再批量生产。

## 合并前检查

```sh
python3 project/validate_docs.py
python3 project/check_all.py
```

第一条校验设计、数据和生成配置是否一致；第二条在独立 Chrome 配置中运行同一校验和现有浏览器检查。需要本机安装 Chrome，日志写入 `.work/collaboration-checks/`。改过数据先运行同步脚本；检查不会替你覆盖生成文件。自动检查不能代替真人试玩、真实模型验收或目标设备帧率测试。

## 再次打包最新版

```sh
python3 project/export_collaboration.py
```

输出到 `输出/协作分享/`，每次带时间戳和内容指纹；包含文件逐项 SHA-256。导出前必须通过文档校验，浏览器检查结果应另附到 PR 或 [检查记录](docs/15-collaboration-validation.md)。旧的单 HTML 试玩包属于历史版本，后续开发以本工程和 GitHub 主分支为准。
