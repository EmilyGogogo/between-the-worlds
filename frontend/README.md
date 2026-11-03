# 万物之间 · 浏览器前端

> 现行规范：0.4-review（主岛＋群岛；八个类别，当前 11 种，以 `data/entities.json` 为准），见 [规范入口](../docs/README.md)。现状与剩余差距见 [原型审计](../docs/11-prototype-audit.md)。

Three.js r170 浏览器前端，所有模型目前是代码生成的占位。这不是 Unity Web 导出；正式引擎见 R-05。

## 运行

在工作区执行：

```sh
python3 frontend/serve.py
```

打开 http://127.0.0.1:4173 。请使用电脑浏览器、键鼠；点击画面进入鼠标环视，按住拖动也可以环视。也可以双击仓库根目录的 `启动游戏.bat`（Windows）或 `启动游戏.command`（macOS），它们会先同步配置再启动。若 4173 已被其他服务占用，用 `--port` 换一个端口。

Three.js 已放在 `vendor/`，无需 npm、CDN、API key 或联网。须通过 HTTP 服务打开，不能直接双击 HTML。

## 配置从哪里来

不要手改 `public/config/game.json` 和 `public/models/manifest.json`。它们由 `data/` 生成：

```sh
python3 project/sync_runtime.py
```

身体、感知档案、碰撞、资产槽在 `data/entities.json`；键位在 `data/input-map.json`；数值在 `data/tuning.json`；回应文字在 `data/dialogue.json`；布局在 `data/anchors.json`；互动在 `data/interactions.json`。数据接入不代表所有说明字段都影响运行，已知差距见原型审计。

## 把 Lux3D 资产放进资产槽

完整合同见 [06 资产槽与 Lux3D 替换](../docs/06-lux3d-asset-pipeline.md)。最短流程：

1. Lux3D 生成，Blender 检查比例、轴向（+Y 向上、-Z 朝前、普通身体底部中心／岛屿海平面中心为原点）、法线、贴图，按需减面、绑骨、做动作。
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

4. 运行 `python3 project/sync_runtime.py`，刷新页面。该种类的个体使用成功加载的模型；碰撞默认按新模型包围盒。无主模型且无变体时使用占位；配置变体时按成功集合分配，全部失败才回占位，每个 GLB 请求默认 10 秒超时。完整降级说明见 [资产合同](../docs/06-lux3d-asset-pipeline.md)与[数据与扩展指南](../data/README.md)。
5. 在 `data/asset-ledger.csv` 记录来源与证据；真实 Lux3D 导入时同步槽与台账的使用标记，按 QA-31～QA-34 验收后再标记 `accepted`，详见 06。

`animations` 必须对应 GLB 中真实的动作名；缺少映射时播放第一个动作。没有动作的文件只显示静态模型，不会被自动赋予骨骼。每个带骨骼的实例单独克隆骨架。Aholo 绑骨的鸟、鱼、狗需要逐件验证，不能把数字人绑骨直接等同于动物绑骨。

整片主岛可以放进环境槽 `env.world`（`url`、`scale`、`position`、`rotation`、`useAsTerrain`）。它通过向下射线查询落地高度；洞穴、崖壁、水域、出生点和锚点不会从模型自动推断。

## 验证

`tests/check_browser.py` 覆盖当前浏览器回归：人开场、范围、键位、尺度档关系与视点抬升、逐级与高飞两条上岛路线及逐级返回、狗的黑白、碰撞绕行、草弯折、鸟限高、鱼不出水、感知过渡、岛的携带、互动、模型变体与远景、装饰槽、新种类占位、数据布局、声音开关。它证明逻辑可达，不代替真人试玩。推荐从根目录运行隔离入口，自动创建测试服务与 Chrome 配置：

```sh
python3 project/check_all.py
```

测试会清除测试配置中本站的存档，不要把底层 `check_browser.py` 接到个人浏览器。加 `?debug` 才会暴露调试对象；正常页面没有实体选择菜单、参数面板或开发文字。
