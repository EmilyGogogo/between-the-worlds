# 设计数据说明

版本：0.4-review · 2026-11-01。规则源为 `docs/01-global-rules.md`；方案的评审状态见 `docs/09-decisions.md`。

| 文件 | 权威内容 | 运行时接入 |
| --- | --- | --- |
| entities.json | 13 种身体：尺度层、移动、能力、感知档案、碰撞、镜头、魂穿关系、资产槽；另有环境资产槽 | integrated |
| input-map.json | 键位、保留的 E、已删除的 Space／Ctrl、过渡中的输入规则 | integrated |
| tuning.json | 可调初值、范围、单位、对应规则与硬约束 | integrated |
| dialogue.json | 世界回应正文、来源、触发与冷却 | integrated |
| anchors.json | 世界布局：71 个具名个体、7 组成片布景、区域与锚点 | integrated |
| interactions.json | 互动规则：触发、过滤、效果 | integrated |
| asset-ledger.csv | 每个资产槽的占位行与计划行；真实产物的来源证据 | 文档台账，不是加载清单 |

## 怎么改

1. 改 `data/` 中的唯一来源。
2. 运行 `python3 project/sync_runtime.py`，生成 `frontend/public/config/game.json` 与 `frontend/public/models/manifest.json`。**不要手改这两个生成文件。**
3. 运行 `python3 project/validate_docs.py` 检查引用、关系、范围与证据。
4. 进游戏验收；校验通过不等于玩法通过。

## 字段原则

- 稳定 ID 不随中文名或模型版本改变。`entities[].id` 是种类，`anchors.instances[].id` 是个体，`asset.slotId` 是资产槽。
- `stage` 是尺度层（0 近地、1 身体、2 地貌、3 岛屿）。`allowedTargets` 是魂穿关系矩阵；运行时仍要检查可见、距离、遮挡和准备状态。
- `verticalControl`：`none` 或 `view_direction`（随镜头俯仰升降）。没有跳跃和升降键字段。
- `collision.solid` 与 `collision.passPolicy`：`go_around`（必须绕行）或 `yield_with_bend`（可以经过但弯折）。
- `perception.vision` 与 `perception.hearing` 是感知档案；`basis` 写明是参照、艺术表达还是尺度音景，`reviewState` 写明是创作者指定还是方案。
- `asset.status`：`placeholder` → `generated` → `edited` → `integrated` → `accepted`。`asset.lux3dUsed` 只有在真实产物进入槽后才改为 `true`，并且台账要有证据。
- `_meta.reviewState` 与 `ruleClass`、`implementationStatus` 互相独立；`MUST` 不等于已实现。
- 数值用 JSON 数字，距离米、时间秒、角度度。

CSV 为 UTF-8 BOM。计划行中的生成日期、原文件、输入、授权与证据为空，表示尚未发生，不是可以事后补造的遗漏。
