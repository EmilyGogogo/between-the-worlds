# 万物之间 · 规则与机制评审入口

版本：`0.4-review` · 日期：2026-11-01 · 面向：程序、美术、策划与演示负责人。

**本版按创作者 2026-11-01 的四项修订重写：群岛与五类实体（草、树、动物、岩石、岛屿，共 13 种）、删除跳跃与升降键、禁止穿模、动物感知档案、所有实体预留 3D 资产槽。** 规则等级、评审状态、实现状态是三个不同字段；写成 MUST 不等于已经实现，也不等于全队已经签字。

## 先读这四份

| 文件 | 解决什么问题 |
| --- | --- |
| [01 全局规则](01-global-rules.md) | 全队遵循什么，什么可以调，什么本次不做 |
| [03 魂穿规格](03-possession-spec.md) | 目标选择、尺度关系、“人看见岛”、连续过渡与回滚 |
| [04 实体目录](04-entity-catalog.md) | 13 种身体、尺度层、独特能力、感知档案、资产槽 |
| [08 验收清单](08-qa-acceptance.md) | 什么能被验证，什么才算完成 |

## 完整目录

| 文件 | 内容 |
| --- | --- |
| [00 项目简报](00-project-brief.md) | 一页目标、范围、平台与交付 |
| [02 操作与镜头](02-controls-and-camera.md) | 键位、随视线升降、各尺度镜头、边界与脱困 |
| [05 世界布局](05-world-layout.md) | 主岛与群岛、核心时刻怎样发生、标注图 |
| [06 资产槽与 Lux3D 替换](06-lux3d-asset-pipeline.md) | 资产槽字段、统一约定、替换步骤、预算 |
| [07 内容与声音](07-content-and-audio.md) | 世界回应（哲学家原句）、出处与音景 |
| [09 决策与待评审项](09-decisions.md) | D-006～D-011 与剩余待评审项 |
| [10 提交清单](10-submission-checklist.md) | 比赛产物、发布链接、授权和备用包 |
| [11 原型审计](11-prototype-audit.md) | 代码现状、自动检查结果与剩余差距 |
| [12 原型分享](12-playtest-sharing.md) | 2026-10-31 的微信试玩包（历史） |
| [13 扩展指南](13-extension-guide.md) | 加模型、加种类、加类别、加互动、加声音，各改哪里 |
| [14 团队协作](14-team-collaboration.md) | 最新完整源码、固定种类分工、岛屿美化、GitHub 分支与合并检查 |
| [15 协作版检查](15-collaboration-validation.md) | 本轮交接包的实测、未验证项与远端状态 |
| [DEFERRED](../DEFERRED.md) | 本次不做的功能 |
| [项目任务](../project/TASKS.md) | 按依赖排序的实施计划 |
| [数据说明](../data/README.md) | 实体、输入、锚点、文字、参数和资产台账 |
| [术语表](../GLOSSARY.md) | 尺度层、感知档案、资产槽等用语 |

## 唯一来源

| 内容 | 唯一来源 | 生成或引用 |
| --- | --- | --- |
| 身体、能力、感知、碰撞、资产槽 | `data/entities.json` | `project/sync_runtime.py` 生成 `frontend/public/config/game.json` 与 `frontend/public/models/manifest.json`，不要手改这两个文件 |
| 键位 | `data/input-map.json` | 同上写入 `game.json` |
| 可调数值 | `data/tuning.json` | 同上写入 `game.json` |
| 世界回应 | `data/dialogue.json` | 同上写入 `game.json` |
| 布局与实例 | `data/anchors.json` | 同上写入 `game.json`，游戏启动时生成世界 |
| 互动 | `data/interactions.json` | 同上写入 `game.json` |
| 资产来源 | `data/asset-ledger.csv` | 文档台账 |

数据全部接入运行时：改 `data/` → 运行同步脚本 → 刷新页面即生效。前端可在 `http://127.0.0.1:4173` 运行，现状见 [11](11-prototype-audit.md)。

## 怎么一起 review

评论用编号，例如“P-13：涟漪改为出现在岸线上”“B-04：鸟的饱和度再高一点”“W-07：主岛缩小一半”。先改规则，再改数据和验收条目。

变更优先级：创作者／团队新确认的决定 → 本目录规范 → `data/` → 实现与测试。代码现状用于审计，不能反过来扩大范围。旧 `frontend/DECISIONS.md` 和 `docs/adr/` 保留为历史背景；0.2 版文档备份在 `.work/migrate/docs-0.2/`。
