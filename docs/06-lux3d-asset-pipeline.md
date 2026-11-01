# 资产槽与 Lux3D 替换

版本：0.4-review · 2026-11-01。规则：L-01～L-07。扩展方法汇总见 [13 扩展指南](13-extension-guide.md)。资产台账：[asset-ledger.csv](../data/asset-ledger.csv)。

**当前事实：所有资产槽都装着程序化占位，没有任何真实的 Lux3D 产物导入游戏。** 下文是替换合同，不代表替换已经发生。

## 思路

游戏先用代码生成的占位模型把玩法跑通，每个可魂穿种类和环境部件都预留一个**资产槽**。Lux3D 生成、Blender 修整好的模型放进槽里，就能替换占位；替换越来越精细的版本，同样只换槽里的文件。

```text
Lux3D 生成（文字／图片）→ 下载原始文件 → Blender 修整：比例、轴向、减面、材质、绑骨与动作
→ 导出 GLB → 放进 frontend/public/models/ → 改 data/entities.json 的槽字段
→ python3 project/sync_runtime.py → 进游戏验收（QA-31～QA-34）
```

玩法代码不需要改动（L-04）。修改 `frontend/public/models/manifest.json` 无效，它由同步脚本生成，会被覆盖。

## 槽的种类

| 槽 | 数量 | 内容 | 运行时是否读取 |
| --- | --- | --- | --- |
| 身体槽 `slot.<种类>` | 每个可魂穿种类一个，现有 13 个 | 该种类所有个体共用的模型和动作 | 是（`url` 字段） |
| 世界槽 `env.world` | 1 | 可选：整片主岛的 GLB，替代程序地表 | 是 |
| 装饰槽 `env.meadow`、`env.pebbles` | 2，可增加 | 成片草地、湖底卵石等不可魂穿的装饰；按 `scatter` 散布，GLB 以实例方式绘制 | 是 |
| `env.sky_water` | 1 | 天空和水面目前是着色器，不是模型槽 | 不适用 |

岛屿种类的身体槽 `slot.island` 同时用于主岛与邻岛的地形。主岛地形如果用 `env.world` 整体替换，邻岛仍使用 `slot.island`。

## 身体槽字段

位置：`data/entities.json` → `entities[].asset`。

| 字段 | 含义 | 示例 |
| --- | --- | --- |
| `slotId` | 稳定的槽 ID，不随文件版本变化 | `slot.gull` |
| `status` | `placeholder` → `generated` → `edited` → `integrated` → `accepted` | `placeholder` |
| `url` | 运行时加载的 GLB；`null` 时使用占位 | `./public/models/gull-v1.glb` |
| `variants` | 更多模型：路径，或可覆盖 `height`／`rotation`／`animations`／`collisionBoxes`／`lod`／`weight` 的对象；按个体 ID 固定分配 | `["./public/models/gull-b.glb"]` |
| `height` | 目标高度（米）；导入器按此等比缩放 | `0.65` |
| `rotation` | 轴向纠正，XYZ 弧度 | `[0, 0, 0]` |
| `pivot`／`upAxis`／`forwardAxis` | 原点、向上、朝前约定 | `bottom_center`、`+Y`、`-Z` |
| `animations` | 动作角色 → GLB 内真实动作名 | `{"idle": "Glide", "move": "Flap"}` |
| `requiredAnimationRoles` | 该种类必须提供的动作角色 | `["idle", "move"]` |
| `rigSource` | 骨骼来源：`aholo`、`blender` 或 `null` | `aholo` |
| `colliderMode` | `auto_bounds`（按包围盒）或 `custom_boxes` | `auto_bounds` |
| `collisionBoxes` | 自定义碰撞盒，局部米制 `[minX,minY,minZ,maxX,maxY,maxZ]` 列表 | `null` |
| `lod` | 远景简化模型列表，超过 `distance` 米时换上 | `[{"url": "./public/models/gull-far.glb", "distance": 60}]` |
| `placeholderStyle` | 占位外形的样式（同一类别的生成器内区分，如 `pine`、`tern`） | `gull` |
| `placeholder` | 当前占位的来源 | `procedural:gull` |
| `lux3dUsed` | 只有真实产物进入槽后才改为 `true` | `false` |
| `ledgerId`／`fallbackLedgerId` | 对应台账中的计划行与占位行 | `PLAN-bird_gull_01` |

## 装饰槽字段

位置：`data/entities.json` → `environmentSlots` 中带 `scatter` 的项。

| 字段 | 含义 |
| --- | --- |
| `url`／`variants` | 装饰模型（例如一丛草、一块卵石）；为空时用 `placeholder` 指定的程序装饰 |
| `height`、`scaleRange` | 单个装饰的目标高度与随机缩放范围 |
| `scatter` | 散布方式：`carrier`（放在哪个承载体上）、`seed`、`areas`（中心、尺寸、数量）、`surfaceMin`／`surfaceMax`、`avoidRegions`／`insideRegion` |
| `visibleUpToStage` | 当前身体在哪个尺度层以下时显示（成片草地只在近地层与身体层显示） |

占位草地的 `count` 是草叶数；换成草丛模型后，`count` 是草丛数，应相应调小。GLB 装饰目前没有风动，可以在模型里做好姿态，或以后在代码中加风动材质。新增一种装饰（灌木丛、落叶）只需加一个装饰槽。

## 统一约定（L-05）

- **单位与方向**：1 单位 = 1 米；+Y 向上；模型正面朝 -Z。
- **原点**：底部中心，鱼和鸟也一样，悬浮高度由游戏控制。岛屿以海平面中心为原点，水下部分在原点以下；现有导入器一律按底部落地，尚不支持这条约定，见 [11 原型审计](11-prototype-audit.md)。
- **文件**：GLB，贴图内嵌。当前前端没有 Draco、Meshopt、KTX2 解码器，导出时不要用这些压缩；如需使用，先加解码器并测试。
- **动作**：动物至少有 `idle` 与 `move`，可以另加 `turn`、`boost`。没有动作的模型只能静止显示，不会被自动赋予骨骼。植物的风动和摇曳可以由程序完成。
- **绑骨**：Aholo 绑骨或 Blender 均可。“数字人绑骨可用”不能直接当作鸟、鱼、狗的绑骨已验证，每种动物都要实际导入检查。
- **碰撞**：默认按模型包围盒；树（树干与树冠分开）、岛屿、巨岩这类形状不规则的实体，应该提供自定义碰撞盒或碰撞网格，否则 M-01 无法通过。
- **比例**：按 `entities.json` 的 `body.height`；资产不能悄悄改变实体的真实比例（C-03）。

## 预算初值（L-06，TUNABLE）

| 尺度层 | 单个模型三角面 | 贴图 |
| --- | --- | --- |
| L0 草 | ≤ 2 千（会有大量个体） | ≤ 512 |
| L1 动物 | ≤ 3 万 | ≤ 2048 |
| L1 树、岩石 | ≤ 6 万 | ≤ 2048 |
| L2 巨岩 | ≤ 10 万 | ≤ 2048 |
| L3 岛屿地形 | ≤ 30 万，需要远景 LOD | ≤ 4096 |

以 F-01 的帧率为最终约束，实际测量后调整。

## 替换步骤

1. 在台账的计划行记录输入：实际提示词、参考图及其来源、生成日期、任务 ID（若有）。
2. Lux3D 原始文件保存在 `assets/lux3d/<asset_id>/raw/v001/`，不覆盖原件。
3. Blender 修整：比例、轴向、原点、法线、减面、材质、绑骨与动作命名；保存 `.blend` 和修改说明到 `edit/v001/`。
4. 导出 GLB 到 `frontend/public/models/<种类>-v<版本>.glb`。
5. 修改 `entities.json` 中该种类的 `asset`：`url`、`height`、`rotation`、`animations`、`rigSource`、碰撞字段，`status` 改为 `integrated`。
6. 运行 `python3 project/sync_runtime.py`，打开游戏检查：所有该种类个体都已替换；碰撞随新模型更新；动作切换正常；魂穿与镜头构图仍成立。
7. 通过 QA-31～QA-34 后，`status` 改为 `accepted`，台账 `lux3d_used` 改为 `true` 并填写证据路径。
8. 保留上一版文件作为回退。

加载失败或 10 秒超时时，游戏自动退回占位模型（L-03）；这只保证游玩不中断，**不能代替 L-01 的真实 Lux3D 证据**。

## 目录约定（产生实际资产时再建立）

```text
assets/lux3d/<asset_id>/
  input/       实际提示词、参考图与来源
  raw/v001/    原始下载文件、任务信息、生成截图
  edit/v001/   Blender 文件、修改记录
  export/v001/ 导出模型、碰撞说明、动作名称
  evidence/    游戏内截图、运行片段、版本对应说明
```

以上目录现在不存在。台账中没有证据的字段留空，不填写虚构的日期、任务 ID 或 `lux3d_used=true`。

## 整片世界替换

`env.world` 填入 GLB 后，主岛地表改用该模型，落地高度通过向下射线查询。洞穴、悬空层、垂直崖壁、水域范围、出生点和实例锚点不会从模型自动推断，仍需在 `anchors.json` 和代码中配置。3DGS 等非网格产物需要单独验证渲染与碰撞，不能只改扩展名导入。

## 首个证据链的建议

建议先做一条动物（例如狗或海鸥）的完整链路：Lux3D 生成 → Aholo 或 Blender 绑骨 → 导入 → 玩家魂穿并使用其感知档案。这条链同时证明资产槽、动作、碰撞和 L-01。具体先做哪种，待团队按 Lux3D 实际效果决定。

活动对 Lux3D 的具体要求、可用额度和素材使用条款，以主办方原文为准，团队尚未补充原文链接。
