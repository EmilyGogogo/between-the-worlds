# 万物之间 · 浏览器前端

> 现行规范：0.3-review（主岛＋群岛；草、树、动物、岩石、岛屿共 13 种），见 [规范入口](../docs/README.md)。现状与剩余差距见 [原型审计](../docs/11-prototype-audit.md)。

Three.js r170 浏览器前端，所有模型目前是代码生成的占位。这不是 Unity Web 导出；正式引擎见 R-05。

## 运行

在工作区执行：

```sh
python3 frontend/serve.py
```

打开 http://127.0.0.1:4173 。请使用电脑浏览器、键鼠；点击画面进入鼠标环视，按住拖动也可以环视。macOS 也可以双击 `启动.command`。若 4173 已被其他服务占用，用 `--port` 换一个端口。

Three.js 已放在 `vendor/`，无需 npm、CDN、API key 或联网。须通过 HTTP 服务打开，不能直接双击 HTML。

## 配置从哪里来

不要手改 `public/config/game.json` 和 `public/models/manifest.json`。它们由 `data/` 生成：

```sh
python3 project/sync_runtime.py
```

身体、感知档案、碰撞、资产槽在 `data/entities.json`；键位在 `data/input-map.json`；数值在 `data/tuning.json`；回应文字在 `data/dialogue.json`。

## 把 Lux3D 资产放进资产槽

完整合同见 [06 资产槽与 Lux3D 替换](../docs/06-lux3d-asset-pipeline.md)。最短流程：

1. Lux3D 生成，Blender 检查比例、轴向（+Y 向上、-Z 朝前、底部中心为原点）、法线、贴图，按需减面、绑骨、做动作。
2. 导出 GLB（贴图内嵌，不用 Draco、Meshopt、KTX2），放进 `frontend/public/models/`。
3. 在 `data/entities.json` 找到对应种类的 `asset`，改 `url`、`height`、`rotation`、`animations`、`rigSource`，`status` 改为 `integrated`：

   ```json
   "asset": {
     "slotId": "slot.gull",
     "status": "integrated",
     "url": "./public/models/gull-v2.glb",
     "height": 0.65,
     "rotation": [0, 0, 0],
     "animations": { "idle": "Glide", "move": "Flap" },
     "rigSource": "aholo"
   }
   ```

4. 运行 `python3 project/sync_runtime.py`，刷新页面。该种类的所有个体都会替换；碰撞默认按新模型包围盒；`url` 为空或加载失败（10 秒超时）时退回占位。
5. 在 `data/asset-ledger.csv` 记录来源与证据，按 QA-31～QA-34 验收。

`animations` 必须对应 GLB 中真实的动作名；缺少映射时播放第一个动作。没有动作的文件只显示静态模型，不会被自动赋予骨骼。每个带骨骼的实例单独克隆骨架。Aholo 绑骨的鸟、鱼、狗需要逐件验证，不能把数字人绑骨直接等同于动物绑骨。

整片主岛可以放进环境槽 `env.world`（`url`、`scale`、`position`、`rotation`、`useAsTerrain`）。它通过向下射线查询落地高度；洞穴、崖壁、水域、出生点和锚点不会从模型自动推断。

## 发给朋友试玩（历史）

`输出/试玩分享/万物之间_电脑试玩包.zip` 是 2026-10-31 导出的十四种身体旧原型，解压后用 Chrome 或 Edge 打开 `万物之间.html`。重新导出该快照：`python3 project/export_playtest.py --source .work/share/site`。直接导出当前 `frontend/` 时，若有未内嵌的配置请求或外部模型，导出器会拒绝生成。记录见 [原型分享](../docs/12-playtest-sharing.md)。

## 验证

`tests/check_browser.py` 是 0.4 的浏览器检查（42 项）：范围、键位、尺度往返、人成为岛、狗的黑白、碰撞绕行、草弯折、鸟限高、鱼不出水、感知过渡、岛的携带、互动、模型变体与远景、装饰槽、新种类占位、数据布局、声音开关。它证明逻辑可达，不代替真人试玩。测试会清除所连接浏览器中本站的存档，只连接测试用 Chrome：

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9223 --user-data-dir=/tmp/between-all-things-test about:blank
python3 frontend/tests/check_browser.py --port 9223 --url http://127.0.0.1:4173/
```

加 `?debug` 才会暴露调试对象；正常页面没有实体选择菜单、参数面板或开发文字。
