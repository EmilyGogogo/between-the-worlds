# 最新版完整工程与团队协作

日期：2026-11-01。基线：`0.4-review`。来源：创作者要求把最新版整个游戏交给同事，各人负责固定种类的 3D 资产、共同美化岛屿，最终通过 GitHub 合并测试（D-013）。

本工程包含可运行游戏与完整开发资料。旧单 HTML 试玩包只用于试玩，后续请从同一个 GitHub 主分支开发。项目目前尚无已关联的 GitHub 仓库；工作流文件已经准备，远端 Actions 结果要以实际运行记录为准。

## 第一次运行与版本确认

解压整个协作 ZIP，按 [根目录 README](../README.md) 启动。进入页后确认能使用 R 魂穿；从根目录运行：

```sh
python3 project/validate_docs.py
```

包内 `build-info.json` 记录构建时间、内容指纹和每个源文件的 SHA-256。首次进 GitHub 后，后续测试统一记录 commit SHA；从 ZIP 开始制作的同事，也要先 clone 正式仓库，再将自己的资产复制进新分支，避免整包覆盖最新主分支。

## 固定资产分工草案

每组先认领负责人，可以一人兼任多组；实际人数与姓名待团队填写。分工是生产建议，现有种类和玩法范围保持当前规范。

| 工作组 | 固定种类 / 槽 | 分支例子 | 负责人 |
| --- | --- | --- | --- |
| 植被 | `plant_grass_01`、`tree_broadleaf_01`、`tree_pine_01`；`slot.grass`、`slot.broadleaf`、`slot.pine` | `asset/vegetation-v001` | 待认领 |
| 人与狗 | `human_01`、`dog_01`；`slot.human`、`slot.dog` | `asset/characters-v001` | 待认领 |
| 鸟类 | `bird_gull_01`、`bird_tern_01`；`slot.gull`、`slot.tern` | `asset/birds-v001` | 待认领 |
| 鱼类 | `fish_silver_01`、`fish_butterfly_01`、`fish_river_01`；对应三种鱼的槽 | `asset/fish-v001` | 待认领 |
| 岩石与地形 | `rock_coast_01`、`rock_large_01`、`island_01`；`slot.rock`、`slot.boulder`、`slot.island`，整片主岛 `env.world` | `art/island-v001` | 待认领 |
| 环境布景 | `env.meadow`、`env.pebbles`，草地、林地、湖底、岸线的构图与密度 | `art/scenery-v001` | 待认领 |
| 程序与集成 | 共享数据、模型接入、布局整合、碰撞、CI 和版本回退 | `integration/asset-batch-001` | 待认领 |

开始前选同一张风格参考，先完成一个动物的小批样片：比例、材质、idle / move、魂穿后构图都通过再推广。资产预算与坐标约定沿用 [06](06-lux3d-asset-pipeline.md)，不另造一套标准。

## 每个人具体交什么

一个任务只处理认领的种类或环境部件，文件按版本新增，避免同时覆盖一个二进制模型。GLB 可用 `frontend/public/models/bird_gull_01-v001.glb` 这类命名，`url` 写 `./public/models/bird_gull_01-v001.glb`。

真实制作开始后建立 `assets/lux3d/<asset_id>/`：输入与参考来源放 `input/`，原始产物放 `raw/v001/`，Blender 与修改记录放 `edit/v001/`，导出记录放 `export/v001/`，游戏内截图与片段放 `evidence/`。其他来源按事实登记，不能标作 Lux3D。

提交说明应包含：种类与槽 ID、作者、版本、真实动作名、米制尺寸、面数、贴图、轴向、原点、碰撞建议、来源与授权、原文件位置、导入截图、已测与未测项目。动物必须提供 idle / move，不能用静态模型宣称已完成动作验收。GLB 贴图内嵌，当前不支持直接使用 Draco / Meshopt / KTX2 压缩文件。

当前包内都是实文件。后续大模型、Blender 原件和视频增加时，建议集成负责人统一配置 Git LFS，并确认团队仓库的实际配额；启用后同事需安装 Git LFS 并拉取真实对象。协作包导出器会拒绝未拉取的 LFS 指针，防止把几十字节的指针当作完整模型交付。参考 [Git LFS](https://github.com/git-lfs/git-lfs) 与[指针格式](https://github.com/git-lfs/git-lfs/blob/main/docs/spec.md)。

当前正式模型与来源链均未完成。本轮没有生成、绑骨或导入新的 3D 资产。

## 共享文件与冲突处理

模型作者可以独立提交自己的模型、制作记录和证据。以下共享文件由每个 PR 指定的一位集成负责人修改，其他人把所需字段写在 PR 说明里；集成负责人在该 PR 分支补齐，检查通过后才合入 main：

| 共享文件 | 改什么 |
| --- | --- |
| `data/entities.json` | 对应种类 `asset` 或环境槽的 url、动作、朝向、LOD、碰撞与状态 |
| `data/anchors.json` | 放置个体、区域与散布；岛屿美化和布景统一在这里协调 |
| `data/asset-ledger.csv` | 实际来源、版本、制作与游戏内证据 |
| `data/tuning.json` | 合同允许的数值调整，附旧值→新值与试玩记录 |
| `docs/09-decisions.md` | 新确认的规则修改与待评审建议 |
| `project/CHANGELOG.md`、`project/TASKS.md` | 变更、负责人、结果与未完成事项 |

`frontend/public/config/game.json` 与 `frontend/public/models/manifest.json` 由同步脚本生成。合并发生冲突时先处理 `data/` 的语义冲突，再运行 `python3 project/sync_runtime.py` 重建两份文件；不要用整文件“采用我的版本”覆盖其他人的修改。GLB / Blender 冲突保留两个版本，由负责人选定文件并更新槽路径。

## 岛屿美化顺序

1. 先替换树、草、岩石和卵石，围绕现有草地、林地、山湖、岩丘、岸线与近海做构图；每轮少量模型。
2. 再修改 `anchors.json` 和装饰槽的散布参数，保留起点首个目标、岸边辨认主岛的位置、邻岛巨岩→松树→草的返回路径。
3. 整岛地形替换单独开 PR。`env.world` 用于整片主岛，`slot.island` 用于岛屿身体；模型可加载不代表高度、碰撞、湖水、出生点与锚点自动适配。
4. 每轮测试小尺度行走、相机避障、动物活动区、成为整座岛、携带实体与返回，记录实际帧率。装饰 GLB 当前没有程序风动；不要把装饰升级成新的可魂穿类别。

美化涉及 MUST 修改时照原约定确认并记录；纯数值调整记录试玩证据；新增房屋、花、复杂生态等仍进入 DEFERRED。

## GitHub 首次建立

集成负责人新建团队仓库，建议先用私有仓库，邀请同事加入。创建空仓库，避免自动生成与本工程冲突的 README。以下命令只由初次导入的负责人运行；将 `仓库HTTPS地址` 换成真实地址：

```sh
git init -b main
git add .
git status
git commit -m "Import latest playable game and collaboration workflow"
git remote add origin 仓库HTTPS地址
git push -u origin main
```

推送前通过 GitHub Desktop 或 `git diff --cached --stat` 检查提交内容。根目录 `.gitignore` 排除了本地备份、输出包、缓存和环境密钥。项目整体许可尚未选定，保留第三方许可及资产来源。

每位同事 clone 同一个仓库，用 GitHub Desktop 或命令行创建自己的分支。一个任务一个 PR，先让共享数据、来源与验收资料齐全，再由另一位成员 review 合并。

```sh
git switch main
git pull --ff-only
git switch -c asset/birds-v001
# 制作模型并由本 PR 集成负责人接入数据后：
python3 project/sync_runtime.py
python3 project/check_all.py
git add .
git commit -m "Add first bird asset batch"
git push -u origin asset/birds-v001
```

在 GitHub 建立该分支到 main 的 Pull Request；遇到远端 main 已前进，先合并最新 main，解决数据冲突、重建配置并重新检查。不要多人直接推 main。

## 自动检查与合并门槛

`.github/workflows/check.yml` 在 PR、main 推送和手动触发时执行 `project/check_all.py`。它先校验设计数据与生成文件的一致性，然后在独立、一次性的无头 Chrome 中运行现有浏览器集成检查；日志上传为 `game-check-logs`。

首次推送后确认 Actions 实际通过。仓库管理员可在分支规则中要求 `game-checks` 成功与至少一人 review；该限制需要在仓库设置中启用，工作流本身不会自动启用分支保护。

PR 内明确关联 [08](08-qa-acceptance.md) 的实际验收项目：普通资产至少 QA-31～QA-34，变体 / LOD / 装饰还需 QA-40～QA-42，岛屿变更还需 QA-14～QA-16、QA-20～QA-26、QA-35。自动检查使用测试模型，不能替代新 GLB 的动作、碰撞、构图与性能验收。

合并后从 main 再测一遍，保留 commit SHA、测试环境、结果、截图和问题，日终打 tag 或导出带构建 ID 的包。至少一台同事电脑完成真实试玩后才能填写 QA-38；目前没有这项新证据。

GitHub 操作参考：[PR 协作](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests)、[工作流语法](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)。工作流所用依赖的实现见 [checkout v4](https://github.com/actions/checkout/tree/v4)、[setup-python v5](https://github.com/actions/setup-python/tree/v5) 与 [Ubuntu 24.04 镜像清单](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)。
