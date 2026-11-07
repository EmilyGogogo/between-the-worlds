# 变更记录

记录要求与模板见 [CONTRIBUTING](../CONTRIBUTING.md#每次实际修改的变更记录)。每次交付实际修改时更新对应任务条目；新条目置于记录区顶部，同一任务可持续补充，保留他人与历史记录。

## 2026-11-07 · 补丁更新保留游玩进度并采用新版布局

- 负责人：@EmilyGogogo；关联：分支 `codex/save-layout-patch-compat`，基于 `main`，[PR #5](https://github.com/EmilyGogogo/between-the-worlds/pull/5)。
- AI：Codex 负责原因分析、存档合并实现、文档与回归；人工复核待负责人完成。
- 变更与原因：存档增加对应实体的初始布局基线。补丁修改已有实体位置时，加载器把存档相对旧初始位置的差量叠加到新版位置，保留玩家自行移动的偏移，同时应用新版布局；新增实体使用新版配置，已删除实体忽略。无基线旧存档兼容读取并在下次保存时写入基线。更新规则记录为 D-025，补充 QA-30 和实现审计。
- 验证：首次 `python project/validate_docs.py` 通过（1659 项）；`python project/check_repository.py --javascript` 通过（59 个第一方文件、0 错误）；`python -m unittest discover -s project/tests -v` 通过（14 项）；`git diff --check` 通过。更正此前浏览器通过的记录：当时误读了遗留结果文件，不能作为最终修改的通过证据；[首次远端 CI](https://github.com/EmilyGogogo/between-the-worlds/actions/runs/42379122987) 在朝向差量断言处失败。
- CI 修复：Three.js `Euler.toArray()` 包含第四项旋转顺序，导致基线不符合恢复器的三项角度校验。改为显式记录三个角度，保留失败断言并补充所有存档基线均为三个有限角度的检查。修复后 `python project/check_all.py --output .work/save-layout-ci-fix-20261107-01` 通过（文档 1659 项、隔离 Chrome 131 项；Windows 11、Python 3.13.9、Chrome 157）。
- 未验证项 / 风险：线上托管缓存策略与已打开页面的更新体验未验证；已打开页面需刷新才会加载新版本。旧存档无布局基线，首次升级无法区分玩家改变量与历史布局差异，仍沿用旧行为一次。

## 2026-11-04 · 入场引导与紧凑常驻操作提示

- 负责人：@EmilyGogogo；关联：D-024，分支 `codex/onboarding-controls-plan`，PR 待关联。
- AI：Codex 负责策划、实现、文档与回归验证；人工复核：创作者已确认方案、要求缩小游玩提示，并实际尝试后确认每次可魂穿时显示目标提示；完整 diff 与正式新手 QA 待负责人复核。
- 变更与原因：进入前解释指针隐藏、移动与 Esc；右下三行速查常驻，鸟鱼补升降，完整说明置于暂停；状态文案随实际鼠标锁定／拖动、过渡、失焦变化。方向键与 WASD 等效，清理暂停／过渡输入，处理同方向多键释放和拖动取消。按创作者试玩后的追加要求，每次合法主目标均显示紧凑“R 成为［目标名］”，目标切换更新名称，失效、暂停或过渡时隐藏；取消首次成功后的隐藏限制，不受旧存档完成标记影响。目标提示不再使用旧 4 秒消失参数，新增指针说明时长 6 秒，属于 D-024 已授权规则修改，无虚构调参试玩。同步输入数据、生成配置、规则、QA、实现审计与浏览器检查。
- 验证：Windows 11、Python 3.13.9、Node 22.23.3、Chrome 157.0.8103.38：追加修改后运行 `python project/sync_runtime.py`、`python project/check_repository.py --javascript`（59 个文件、0 错误）及 `python project/check_all.py --output .work/onboarding-repeat-target-20261104`，通过 1658 项文档／数据检查及 126 项隔离 Chrome 浏览器检查（相对原基线新增 52 项）。覆盖真实点击入场与指针锁定、鼠标环视、全部移动键、Esc／失焦清理输入、锁定失败后的拖动与移动，以及成功魂穿后再次显示目标提示、名称切换、暂停恢复、旧完成标记不抑制提示；5 种视口的 DOM 几何检查通过。沙箱进程启动失败后在沙箱外完成隔离浏览器验证，日志仅存于本地 `.work/onboarding-repeat-target-20261104/`。软件渲染下续存档入场过渡用正常 `updateCamera` 步进验证状态收敛，不能据此声称实际过渡时长或性能达标；未做截图或真人试玩。
- PR 提交前补充验证：`python -m unittest discover -s project/tests -v` 通过 14 项工具单元测试；其中 `Chrome not found` 为预期负向测试输出。`git diff --check` 通过，确认 `.design/` 仍被本地忽略，不纳入提交。
- 未验证项 / 风险：至少 3 名新手无指导试玩、正式画面／声音 QA、目标设备性能、团队共同确认及远端 CI 未验证。回退时成组撤销本条关联的源码、数据、生成文件与规则修改；不涉及存档版本或世界布局迁移。

## 2026-11-03 · 修复 CI 浏览器消息长度解析

- 负责人：@EmilyGogogo；关联：[PR #2](https://github.com/EmilyGogogo/between-the-worlds/pull/2)，失败运行 `41646307925`。
- AI：Codex 读取 Actions 日志、复现 WebSocket 边界问题、修复并补充回归；人工复核：待负责人复核 diff。
- 变更与原因：`frontend/tests/cdp.py` 把两种扩展长度分支改为互斥的 `if`／`elif`。原实现遇到实际长度恰为 127 字节的消息时，会将正文误读为 64 位长度，导致 `socket.recv()` 请求巨量内存并抛出 `MemoryError`。新测试覆盖 125／126／127／128／65535／65536 字节、有无掩码、分段读取与连续消息；旧实现仅在 127 字节用例失败。日志中的 `Chrome not found` 来自预期负向单元测试，不是本次 CI 缺少浏览器。
- 验证：修复前新增测试复现两处 127 字节失败；修复后 Windows 11、Python 3.13.9 下 `python -m unittest discover -s project/tests -v` 通过 14 项测试（新增两个测试方法共 12 个边界子用例），`python project/check_repository.py --javascript` 检查 59 个文件、0 错误，`python project/check_all.py --output .work/ci-cdp-fix-20261103` 通过 1652 项文档／数据检查和 74 项隔离 Chrome 回归，`git diff --check` 通过。沙箱临时目录受限后在沙箱外完成测试，本地日志仅存于 `.work/ci-cdp-fix-20261103/`；推送后须另查 PR #2 最新 Actions 结果，不能把本地通过当作远端通过。
- 未验证项／风险：本次仅修改检查工具，不改变玩法；不将工具检查当作真人试玩、目标机性能或真实资产验收。

## 2026-11-03 · 修复分支审查的七项一致性问题

- 负责人：@EmilyGogogo；关联：D-023，PR 待关联（沿用 `codex/project-initiate` 的未提交工作区，保留原有修改）。
- AI：Codex 负责问题复现、代码与数据修复、文档整理、回归用例和检查；人工复核：待负责人复核 diff。
- 变更与原因：外部环境替换同步主岛视觉与碰撞引用并移除旧地形；目标遮挡检查不再能按渲染层关闭；空岛也必须满足 W-05；浏览器关系检查读取源数据中的例外并覆盖生成后的 allow／deny。碰撞皮肤接入唯一源 `collisionSkinM`（0.012 m 不变），水下低通保留身体档案的 360 Hz，删除未消费的全局 600 Hz；其余未消费参数标记未接入或仅规划。删除死行星模型、不可见星空、cosmic 样式和闲置相机变量，保留曲面海洋。修正 DF-02 与 QA-43，扩展 QA-05／QA-47；03 的实现状态改引用唯一索引 11。
- 验证：Windows 11、Python 3.13.9、Node 22.23.3、Chrome 156：`python project/validate_docs.py` 通过 1652 项检查；`python project/check_repository.py --javascript` 检查 58 个文件、0 错误；`python -m unittest discover -s project/tests -v` 通过 12 个测试（新增空岛与关系例外回归）；`python project/check_all.py --output .work/review-fixes-20261103` 通过文档检查及 74 项浏览器回归，覆盖岛屿遮挡、目标失效、碰撞调参、allow／deny 与外部地形多帧替换。`git diff --check` 无空白错误。本轮日志保留在本地 `.work/review-fixes-20261103/`，不纳入仓库。沙箱内首次运行因 Windows 临时目录权限失败，随后在沙箱外用隔离 Chrome 完整通过。
- 未验证项／风险：没有真人试玩、目标机性能或真实 Lux3D 模型验收；环境替换自动用例只使用仓库测试夹具，不计正式资产。已知的多点可见性、事务回滚、声音与其他数据绑定缺口仍以 11 为准。

## 2026-11-03 · 水体判定改为数据驱动

- 负责人：@EmilyGogogo；关联：PR 待关联（在 `codex/project-initiate` 的未提交工作区上修改，未提交）；无新的玩法决定。
- AI：Claude Code（Claude Opus 5.5）实施代码、数据、测试与文档修改并运行检查；人工复核：待负责人复核 diff。
- 变更与原因：创作者后续会新增实体与地点，要求水体也不写死。原先 `world.water()` 只认名为 `lake` 的区域，海平面 -0.1 m、最浅深度 0.4 m、湖面网格、镜头浸没判定、岛面拾取的海平面判断，以及程序地形中湖盆的位置和深度（`(x+83)`、`(z+65)`、19 m）都写死在代码里。现在 `anchors.json` 中带 `water` 字段的区域就是水体：`lake` 为 `enclosed`（`surfaceY` 5.8、`opacity` 0.88、`basin` 深 19 m，衰减换算后与原湖盆一致），`ocean` 为 `sea`（`levelM` -0.1、`minDepthM` 0.4），数值均与原来一致。`species.js` 导出 `WATERS`；`world.js` 的 `water()` 先查封闭水体再查海，按水体逐个生成水面网格，程序地形按 `basin` 挖湖盆，海面网格读海平面；`main.js` 的镜头浸没与 `groundUnderView()` 读数据。校验器检查只有一个海、封闭水体有椭圆形状与水面高度、湖盆参数合法；浏览器测试新增湖与海来自数据、每个封闭水体生成水面网格，以及运行时临时加入一个池塘能被识别。同步 data/README、05、11。
- 验证：Windows 11、Python 3.13、Node 22.23.3、Chrome 156：`python project/validate_docs.py` 通过 1650 项检查；`python project/check_repository.py --javascript` 57 个文件 0 错误；`python -m unittest discover -s project/tests` 通过 10 个测试；`python project/check_all.py` 浏览器回归 66 项通过（新增 3 项水体检查，原有出生无重叠、银色小鱼不出湖、巨岩→岛等均通过）。
- 未验证项／风险：未进游戏人工查看湖面与水下观感；没有在数据中真正新增第二个湖并试玩（只在测试中临时加入池塘验证识别）；湖盆衰减参数由原常数换算，地形高度差小于 0.001 m 量级，未逐点比对；鱼种的栖息水体（`habitat`）仍是说明字段，不限制鱼进入哪个水体。

## 2026-11-03 · 去除运行时代码中写死的尺度层、类别与空域数值

- 负责人：@EmilyGogogo；关联：PR 待关联（在 `codex/project-initiate` 的未提交工作区上修改，未提交）；无新的玩法决定。
- AI：Claude Code（Claude Opus 5.5）审查前端写死项并实施修改、运行检查；人工复核：待负责人复核 diff。
- 变更与原因：创作者后续会新增实体，要求代码整体可扩展。① `world.js` 中 `prune()`、`carrierOf()`、`water()` 各重复定义一次，后一个 `water()` 用写死的湖心、半径和水面高度覆盖了读取 `anchors.json` 的版本，删除重复段；② `main.js`／`world.js` 按 `stage===0/1/2/3` 写死的镜头前视、贴地、避障、雾浓度、太阳与阴影、焦点高度、遮挡检查、进入岛时的最小俯角，改为 `entities.json` 的 `scaleLayers` 字段（含 `scaleLayerFields` 说明），数值与原先一致；巨岩的“保持地形偏移”从 `stage===2` 改为按“固定高度放置”判断；③ 狗的四肢摆动 `category==='dog'?10:7` 改为 `body.limbSwingRate`（人 7、狗 10）；④ 飞行空域的水平半径 760 m 与离地 0.3 m 移入 `anchors.json` 的 `island_airspace`，种类用 `activityRegion` 指向空域；`tuning.json` 的 `birdMaxHeightM` 更名为 `flightCeilingM`（值仍为 180，范围不变）。校验器改为检查渲染层字段齐全、`stage` 指向已登记的层、飞行种类指向完整空域及空域上限与 `flightCeilingM` 一致；浏览器测试的限高断言改读 `flightCeilingM`。同步 data/README、02、04、05、11。
- 验证：Windows 11、Python 3.13、Node 22.23.3、Chrome 156：`python project/validate_docs.py` 通过 1643 项检查；临时删去空域引用时校验器报出对应错误，删去渲染层字段时校验以 `KeyError('fogDensity')` 终止，恢复后通过；`python project/check_repository.py --javascript` 57 个文件 0 错误；`python -m unittest discover -s project/tests` 通过 10 个测试；`python project/check_all.py` 浏览器回归 63 项通过；`git diff --check` 无空白错误。
- 未验证项／风险：数值保持原样，未进游戏人工比对各尺度的镜头、雾和阴影观感；游泳仍按名为 `lake` 的区域与海面判断水体，新增其他水体仍需改代码；按移动方式（地面／飞行／游泳／漂移）的分支保留，新增移动方式仍需实现。

## 2026-11-03 · 精简鱼和鸟的种类，浏览器测试不写死种类数量

- 负责人：@EmilyGogogo；关联：D-022，PR 待关联（在 `codex/project-initiate` 的未提交工作区上修改，未提交）。
- AI：Claude Code（Claude Opus 5.5）实施数据、测试与文档修改并运行检查；人工复核：待负责人复核 diff。
- 变更与原因：按创作者要求只保留银色小鱼（山湖）、蝴蝶鱼（近海）和海鸥，删除燕鸥、河鲈两个种类及其资产槽、台账行和两条 `target_focus` 回应；原有 4 只燕鸥、4 条河鲈改为同栖息地的海鸥 `gull-4`～`gull-7` 与银色小鱼 `silverfish-4`～`silverfish-7`，个体数与分布不变；A08 改名“湖面空域”。浏览器测试原先断言 `13` 种与 `8` 个类别，改为检查每个配置类别都有种类、每个种类都有个体；鱼的水域测试从 `perch-0` 改为 `silverfish-0`。同步 01、02、03、04、05、06、07、08、09、11、入口、README、术语、CONTRIBUTING、LICENSES 与群岛图，文档中尽量不再重复写死种类数量。
- 验证：Windows 11、Python 3.13、Node 22.23.3、Chrome 156：`python project/validate_docs.py` 通过 1590 项检查（11 种、8 类、27 条资产记录）；`python project/check_repository.py --javascript` 57 个文件 0 错误；`python -m unittest discover -s project/tests` 通过 10 个测试；`python project/check_all.py` 浏览器回归 63 项通过；`git diff --check` 无空白错误。
- 未验证项／风险：未进游戏人工查看湖面海鸥和湖里银色小鱼的密度与观感；被删去的两句引文未重新分配；`assets.js` 的 `tern`／`perch` 占位样式分支保留未删。

## 2026-11-03 · 按尺度档逐级魂穿与视点抬升

- 负责人：@EmilyGogogo；关联：D-021，PR 待关联（在 `codex/project-initiate` 的未提交工作区上修改，未单独建分支、未提交）。
- AI：Claude Code（Claude Opus 5.5）提出方案，经创作者同意后实施数据、代码、测试与文档修改并运行检查；人工复核：待负责人复核 diff 并试玩。
- 变更与原因：创作者认为草一步成为岛在体验上不成立，提出按高度分档、只在相邻档之间魂穿。新增 `scaleTiers`（S1 近地～S5 群岛）与每种身体的 `scaleTier`，删除手写 `allowedTargets`，关系由 `sync_runtime.py` 的 `scale_relations()` 推导；新增视点抬升（P-15，阈值 3／15／60 m 在 `scaleTiers`，缓冲 `viewLiftHysteresis` 0.1 在 `tuning.json`），`main.js` 的 `updateLift()` 计算，`canEmbody()` 只向上扩展；为保证梯子完整，在三座邻岛各加 4 块、主岛岩丘加 1 块海岸岩石；按 D-019 已批准的 P-04 改写目标排序为 `rankCandidates()`，否则巨岩在林地附近看不到所在的岛；`validate_docs.py` 改为检查档位、参考尺寸、相邻关系与每个承载体梯子不断档；`new_species.py` 改为沿用或用 `--tier` 指定档位；浏览器回归改为验证相邻档关系、逐级与高飞两条上岛路线、抬升缓冲及逐级返回草。同步 01（G-07、G-08、B-01、P-12、P-13、W-05，新增 P-15、P-16）、03、04、05、07、08（新增 QA-46、QA-47）、09、10、11、入口、术语、README、data/README、DEFERRED 与群岛图。
- 验证：Windows 11、Python 3.13、Node 22.23.3、Chrome 156：`python project/validate_docs.py` 通过 1700 项文档／数据检查；临时删去新加岩石时校验器对 `boulder-main`、`island-0`～`island-2` 报梯子断档，恢复后通过；`python project/check_repository.py --javascript` 检查 57 个文件、0 错误；`python -m unittest discover -s project/tests` 通过 10 个测试；`python project/check_all.py` 隔离 Chrome 浏览器回归 63 项通过；`git diff --check` 无空白错误，仅有现有工作区的 CRLF→LF 提示。
- 未验证项／风险：没有真人试玩，抬升阈值、高空构图、巨岩选岛的手感及玩家能否自然发现两条上岛路线都未验证（QA-14、QA-46）；`rankCandidates()` 改变了所有存在承载整体时的选择结果，仅由自动回归覆盖；`grove-pine-1` 在出生时因重叠被移除（本次之前已存在，测试改用 `grove-pine-0`）；团队共同确认待填写。

## 2026-11-03 · 统一首版八类别表述

- 负责人：@EmilyGogogo；关联：D-020，PR 待关联。
- AI：Codex 查找并修正文档中的类别重复与分类口径；人工复核：待负责人复核 diff。
- 变更与原因：按创作者要求，首版清单统一为草、树、人、狗、鸟、鱼、岩石、岛屿八类，删除“动物”作为上级类别的重复列举；同步入口、G-04、实体目录、术语、QA 与决策记录，保留感知和动作要求中的统称及历史记录。
- 验证：`python project/validate_docs.py` 通过 1637 项文档／数据检查；`git diff --check` 通过，仅提示现有工作区的 CRLF→LF 换行转换。
- 未验证项／风险：仅修改文档，未改游戏、数据或资产，未进行游戏试玩。

## 2026-11-03 · 初始化仓库配置与 CI 检查复核修正

- 负责人：@EmilyGogogo；关联：初始化分支 `codex/project-initiate`，PR 待关联。
- AI：Claude Code（Claude Opus 5.5）审查仓库文件、CI 与检查脚本，并实施修正；人工复核：待负责人复核 diff。
- 变更与原因：CI 的 checkout / setup-python / upload-artifact 从 v4.3.1 / v5.6.0 / v4.6.2 升至 v7.0.1 / v7.1.0 / v7.0.2（仍固定完整 SHA，已用 `git ls-remote` 核对 tag），避开即将淘汰的 Node 20 运行时；`check_repository.py --javascript` 打印实际 Node 版本，文档不再声称未强制的“Node 22+”，并注明 CI 只验证 Python 3.12。修正 `check_all.py` 合并 `result.json` 时沿用旧运行结果的问题：只在同一干净 commit 下合并另一模块结果，不再保留旧 `error`，任一模块失败时总状态为失败，并补回归测试。PR 模板改为引用 docs/11 而非已删除的 TASKS；`.gitignore` 精简为项目相关规则，删除重复的 `frontend/.gitignore`；新增 `.gitattributes` 固定换行（`.bat` / `.csv` 用 CRLF，其余 LF，GLB 为二进制）；删除重复且跳过配置同步的 `frontend/启动.command`，前端说明改指根目录启动脚本；CODEOWNERS 注明治理规则须留在文件末尾。
- 验证：本地 Windows、Python 3.13、Node 22.23.3、Chrome 156 上，`python project/check_repository.py --javascript` 检查 57 个文件，0 错误，并输出 Node 版本；`python -m unittest discover -s project/tests` 通过 10 个测试（新增 1 个旧结果不合并的回归）；`python project/check_all.py` 通过文档检查及 53 项浏览器回归；在当前文件的干净临时 Git 副本中依次执行 `--only docs`、`--only browser`，`result.json` 合并为 docs / browser 均 passed；`git diff --check` 通过。修复前已复现：旧的失败结果会在 docs-only 运行后残留 `browser: failed` 与 `error`。
- 未验证项／风险：新版 Actions 与 ubuntu-24.04 无头 Chrome 尚未在 GitHub 上实际运行，`game-checks` 仍需首次远端运行后才能设为必需状态；`.bat` 与 `asset-ledger.csv` 在索引中原为 CRLF，提交时需 `git add --renormalize .` 使其按新规则存储；项目许可证仍未确定。

## 2026-11-02 · 梳理核心体验和策划验收边界

- 负责人：@EmilyGogogo；关联：D-019，PR 待关联。
- AI：Codex 审阅策划文档、调整规则与 QA 并记录实现差距；人工复核：待负责人复核 diff。
- 变更与原因：按创作者授权明确目标排序、返回旧身体的尺度限制、相机避障构图和首次岛屿回应的冷却／排队合同；补充非线性体验参照、身体差异场景、返回路径检查及制作优先顺序；将无指导试玩与可完成时间分开，区分已确认合同与 R-04／R-13 待评审细节。保持人开局、任意身体看见岛可成为岛和岛先回巨岩，不扩大首版范围。
- 验证：`python project/validate_docs.py` 通过 1637 项文档／数据检查；`python project/check_repository.py` 检查 59 个文件、0 错误（未运行 JavaScript 语法检查）；`git diff --check` 通过，Git 提示现有工作区文件的换行符转换警告。
- 未验证项／风险：本轮仅修改文档，没有修改游戏、配置或自动测试；D-019 排序与首次岛屿回应等合同尚未完整实现，真实构图、自然引导、返回路径、互动手感和真人试玩待验证。

## 2026-11-02 · 删除项目历史 QA 日志

- 负责人：@EmilyGogogo；关联：PR 待关联。
- AI：Codex 删除历史文件并同步引用和校验器；人工复核：待负责人复核 diff。
- 变更与原因：按创作者要求删除 `project/qa/` 的全部历史检查日志及索引，移除失效链接和校验器的目录要求；保留游戏 QA 规范及历史变更记录。
- 验证：`python project/validate_docs.py` 通过 1635 项检查；`python project/check_repository.py --javascript` 检查 59 个源码文件且无错误；检查器 9 项单元测试通过；`python project/check_all.py` 在允许临时目录访问后通过文档检查和 53 项隔离浏览器回归；`git diff --check` 通过。
- 未验证项／风险：删除后无法从工作区查阅这些历史原始日志；历史记录不代表新构建通过验收。

## 2026-11-02 · 完成首次协作文档基线精简

- 负责人：@EmilyGogogo；关联：D-018，PR 待关联。
- AI：Codex 负责文档合并、链接迁移、残留清理与校验；人工复核：待负责人复核 diff。
- 变更与原因：按创作者授权，将文档作为团队首次写作的基准整理，`docs/` 从 25 个文件减为 13 个。项目简报并入根 README；扩展指南并入 `data/README.md`；资产协作与 CI 设置并入 `CONTRIBUTING.md`；真实验证记录索引当时移至 `project/qa/README.md`。删除旧原型分享说明、早期 ADR、旧地图和旧前端决策入口，沿用上一轮对重复工程入口、旧导出器及其证据的清理；当时保留 01–11 规范、现行群岛图、历史决策与真实 QA 日志，日志及索引随后按创作者要求删除。同步校验器文件清单和种类生成工具的指南引用；入口逐文件提供一句话说明，保持 D-017 的人开场及任意身体看见岛可切换规则。
- 验证：`python project/validate_docs.py` 通过 1659 项文档／数据检查；`python project/check_repository.py --javascript` 检查 70 个源码文件，0 错误；`python -m unittest discover -s project/tests -v` 在允许临时目录写入后通过全部 9 个测试；`python project/check_all.py --output .work/docs-baseline-checks` 通过文档校验及 53 项隔离浏览器回归，包含人开场、草直接成为可见岛、实心遮挡和按 R 再验证，日志保存在本地输出目录；`git diff --check` 通过。
- 未验证项／风险：真人试玩、远端 Actions、目标机性能和真实 Lux3D 资产未在本轮验收；53 项自动回归不替代完整 QA，文档精简不代表实现缺口已修复。本地 `.work/` 日志未纳入协作基线。

## 2026-11-01 · 精简初始化仓库入口与历史证据

- 负责人：@EmilyGogogo；关联：待关联 PR。
- AI：Codex 负责文档交叉引用、工具整理与检查；人工复核：待负责人复核 diff。
- 变更与原因：将当前实现状态集中到 `docs/11-prototype-audit.md`，根 README 与前端说明承担唯一运行入口；删除重复的 `project/README.md`、`project/TASKS.md`、未接入的 `.env.example`、旧单 HTML／源码 ZIP 导出器及旧 ZIP 检查证据；修正协作文档中对 CI job、验证记录和已删除文件的引用；修正 `check_all.py` 在 docs／browser 分步运行时覆盖 `result.json` 的问题。
- 验证：`python project/validate_docs.py` 通过 1660 项；`python project/check_repository.py --javascript` 通过 70 个源码文件；`python -m unittest discover -s project/tests -v` 在允许临时目录写入后通过，9 个测试全部通过；`python project/check_all.py --only docs --output .work/cleanup-checks` 通过。
- 未验证项／风险：未运行完整隔离浏览器回归；旧 ZIP 导出和历史解压检查不再可用，保留的初始化／文档审计证据不代表真人 QA 或发布验收。

## 2026-11-01 · 人开场、任意身体成为可见岛与文档冲突对齐

- 负责人：项目创作者（本次明确授权，人工复核待完成）；关联：D-017，PR 待关联。
- AI：Codex 核对规范、数据、目标选择和回归检查，修正文档冲突并评估归档／合并候选；人工复核：待负责人复核 diff。
- 变更与原因：干净开局固定为人；草等任意身体可以选中视野中可辨认的岛。移除靠岸／高度门槛及过时参数，岛的涟漪跟随当前地表视线，按 R 重新计算并检查实心遮挡；特殊回应不再限制来源为 L1。同步当前规范、QA、布局图、决策和任务状态；明确正式资产均为占位、历史自动检查不代替发布 QA、本地 Windows 不等于远端 CI，补齐历史索引。文档精简仅提出候选，未删文件。
- 验证：`python project/sync_runtime.py` 生成运行配置；`python project/validate_docs.py`、`python project/check_repository.py --javascript`、`git diff --check` 通过。`python project/check_all.py --output .work/island-rule-checks` 文档与 53 项浏览器回归通过（人开场、内陆草／巨岩上草／邻岛草→岛、当前视线与遮挡、原有返回路径）；沙箱首次因临时目录权限失败，授权后隔离无头 Chrome 运行通过。原始环境记录与日志后来按创作者要求删除。
- 未验证项 / 风险：真人新手体验、构图、音效、目标机性能、真实 Lux3D 资产及完整 QA-01～QA-45；引文译本和署名仍未定稿，未推送或合并。

## 2026-11-01 · 改为群内分工，不维护任务认领表

- 负责人：@EmilyGogogo（本次任务发起人，人工复核待完成）；关联：待关联 PR。
- AI：Codex 调整协作规范、模板与入口；人工复核：待负责人复核 diff。
- 变更与原因：按团队实际工作方式删除普通任务和资产任务 Issue 模板，保留 Bug 模板；当时的 `project/TASKS.md` 保留实现状态和缺口，但移除新任务模板并明确不作为认领表；将当前文档中的“通过 Issue 认领”“从 TASKS 选任务”改为群内确认分工后开工。PR、CHANGELOG、QA、决策、资产来源和最终审核流程继续保留。该任务表随后在初始化仓库精简中删除。
- 验证：待执行 `python project/validate_docs.py`、`python project/check_repository.py` 与 `git diff --check`。
- 未验证项 / 风险：尚未运行游戏；Bug Issue 模板仍保留，是否使用由团队需要决定。

## 2026-11-01 · 协作入口改为 Git clone 与初始化分支

- 负责人：@EmilyGogogo（本次任务发起人，人工复核待完成）；关联：初始化分支 `codex/project-initiate`，PR 待关联。
- AI：Codex 核对协作入口、运行说明和检查记录并修改文档；人工复核：待负责人复核 diff。
- 变更与原因：统一要求从 GitHub clone 仓库、创建短期分支并通过 PR 协作；明确 `main` 目前基本为空，完整工程只存在于初始化候选分支。将检查记录改为初始化候选分支的本地验证，不再声称存在历史 QA 或历史交接包。
- 验证：`python project/validate_docs.py` 通过 1688 项文档／数据检查；`git diff --check` 通过（仅 CRLF 提示）；已用 `rg` 复核当前入口文档统一采用 Git clone、分支和 PR 路径。
- 未验证项 / 风险：未运行游戏或浏览器检查；初始化分支尚未合入 `main`，远端 Actions 和真人验收仍待执行。

## 2026-11-01 · CI 检查按最小必要原则精简并对齐文档

- 负责人：@EmilyGogogo（本次任务发起人，人工复核待完成）；关联：初始化分支 `codex/project-initiate`，PR 待关联。
- AI：Codex 核对现有 workflow 实际结构、补充被遗漏的检查器单元测试步骤、修正与实际不符的文档描述并执行校验；人工复核：待负责人复核 diff。
- 变更与原因：`docs/16-ci-and-repository-settings.md` 原先描述成 4 个独立 job（含 Windows 矩阵），但 `.github/workflows/check.yml` 实际只有一个顺序执行的 `game-checks` job；按最小必要原则保留原有语法检查／数据契约／浏览器回归三类风险检查，不新增矩阵或与"代码能否跑通"无关的检查；新增此前已写在 `project/tests/test_checks.py` 却从未接入 CI 的检查器自身单元测试，防止检查脚本被改坏后仍放行。文档改为如实描述单 job 顺序执行。
- 验证：`python project/check_repository.py --javascript` 93 个文件 0 错误；`python project/validate_docs.py` 通过 1699 项检查；`python project/check_all.py --only browser` 42 项浏览器回归全部通过；`git diff --check` 通过（仅 CRLF 提示）。
- 未验证项 / 风险：`python -m unittest discover -s project/tests -v` 在本机沙箱因临时目录权限问题无法运行（与本次改动无关的环境限制），未在本地复现该步骤的实际结果，需在远端 Actions（Ubuntu runner）首次运行时核对；工作流 YAML 改动尚未推送验证远端 Actions 实际执行结果。

## 2026-11-01 · 补充团队 Windows / macOS 运行说明

- 负责人：@EmilyGogogo（本次任务发起人，人工复核待完成）；关联：初始化分支 `codex/project-initiate`，PR 待关联。
- AI：Codex 核对启动脚本与服务参数、编写运行说明并执行文档校验；人工复核：待负责人复核 diff。
- 变更与原因：在 project/README 为 Windows 与 macOS 分别说明环境准备、双击启动、终端备用命令、浏览器访问、操作与停止服务，补充端口占用、目录错误、配置同步与更新重启的处理；修正原说明中先启动阻塞服务再同步配置的顺序，团队协作专题链接到详细步骤。
- 验证：`python project/validate_docs.py` 通过 1699 项文档 / 数据检查；`git diff --check` 通过。
- 未验证项 / 风险：本次只改文档，命令已对照现有启动脚本与 serve.py 参数；未重新启动游戏，未在 macOS 实机执行。

## 2026-11-01 · README 改为游戏介绍入口

- 负责人：@EmilyGogogo（本次任务发起人，人工复核待完成）；关联：初始化分支 `codex/project-initiate`，PR 待关联。
- AI：Codex 核对设计与实现审计、修改文档并执行校验；人工复核：待负责人复核 diff。
- 变更与原因：根 README 原以协作交接为主，现按游戏介绍、核心玩法、操作、本地运行、功能模块、开发状态与资料入口组织；协作规范引用 CONTRIBUTING，打包说明移至 project/README，docs/README 同步入口描述。保留占位资产、实现缺口、候选分支与未设置项目级许可证的事实。
- 验证：`python project/validate_docs.py` 通过 1698 项文档 / 数据检查；`git diff --check` 通过。
- 未验证项 / 风险：本次仅修改文档，未重跑游戏或验收玩法；功能描述依据现有设计、配置与实现审计，不代表新增实现。

## 2026-11-01 · 明确每次实际修改的记录要求

- 负责人：@EmilyGogogo（本次任务发起人，人工复核待完成）；关联：初始化分支 `codex/project-initiate`，PR 待关联。
- AI：Codex 协助核对现有规则、修改文档并执行校验；人工复核：待负责人复核 diff。
- 变更与原因：原规则只要求功能变化同步 CHANGELOG，现覆盖每位贡献者交付的代码、文档、数据、资产、配置与 CI 修改；在 CONTRIBUTING 给出统一字段与模板，在 AGENTS 和 PR 模板明确提醒，说明同一任务可持续更新条目及当前无 CI 强制门禁。
- 验证：`python project/validate_docs.py` 通过 1676 项文档 / 数据检查；`git diff --check` 通过。
- 未验证项 / 风险：未运行游戏验收；本次仅修改协作说明与 PR 模板，未新增 CHANGELOG 的 CI 检查。

## initiate-doc-audit · 2026-11-01

- 按仓库实际修正 LICENSES：未设置项目级许可证，该文件仅为现状与来源记录；Three.js 自带 MIT 仅适用于对应第三方代码，不代表整个项目已授权。
- 按 D-015 复用当前设计和协作原文件，docs/README 明确全队必读、职责资料、证据与历史；统一当前文档版本，不改历史日志。
- 修正五类／八类别／十三种术语、规范／数据优先级、主岛与邻岛植被承载、已实现能力状态、存档 v4、海平面原点、变体／LOD 降级和导入／验收标记。
- 对齐 QA 的引文字数、声音偏好、水下滤波、扩展基线与巨岩携带；候选引文不再统称已核实原句，署名／译文与首次 L1→岛边界保留待评审。
- 审计记录魂穿排序／可见性／回滚、未消费数据字段、音景与配置请求超时的代码缺口，更新任务；本轮只改文档和能力实施状态元数据，运行代码、游戏数值与生成配置不变。原始验证日志后来按创作者要求删除。

## project-initiate · 2026-11-01

- 从现有完整工程创建 `codex/project-initiate`（D-014），沿用可运行游戏、数据合同、资产分工和浏览器回归；复用与修正清单见 [CI 与仓库设置](../CONTRIBUTING.md#ci-与仓库设置)。
- 新增 CONTRIBUTING，明确任务认领、短期分支、Emily 最终审核、AI 生成内容的人工复核与实测责任；通用 PR 模板及任务 / bug 模板补齐资产模板之外的工作。
- CI 拆分源码、Ubuntu / Windows 文档数据、浏览器与 `game-checks` 汇总；只读权限、禁用持久化凭据、固定 Actions SHA、显式日志上传、超时、取消过时 PR 运行和 Dependabot 更新 PR。
- 新增不修改文件的源码检查器与失败路径回归用例；检查启动器支持模块选择、UTF-8、环境和未提交修改记录；无 Git 的源码 ZIP 仍可检查。校验器与生成器显式使用 UTF-8，源码 ZIP 纳入贡献指南，校验器扩展到根目录入口链接。
- 修正“仓库尚未建立”、通用同事批准即可合并与 anchors 尚未接入等过时说明；游戏规则与正式模型未修改。原始验证日志后来按创作者要求删除。

## collaboration-handoff · 2026-11-01

- 按创作者要求交接最新版整个 Web 游戏，新增根目录运行入口、固定资产分工与岛屿美化协作指南（D-013），玩法和设计数据保持现状。
- 新增 `project/check_all.py`：隔离本地服务和 Chrome，复用文档校验与现有浏览器检查；新增 GitHub PR / 任务模板和检查工作流。
- 历史上曾新增 `project/export_collaboration.py`：包含完整源码、数据、规范、依赖与测试，排除备份、输出、缓存与环境文件，记录构建指纹和逐文件 SHA-256；该 ZIP 导出流程已在初始化仓库精简中删除。
- 修正历史分享文档中已丢失的 ZIP 链接；旧输出与本地备份不混入新包。原始验证日志后来按创作者要求删除。

## 0.4-review · 2026-11-01

- 声音：修复进入游戏后点不到声音按钮（暂停层盖住了它）；进入世界默认开启，暂停菜单加开关，记住偏好。
- 资产：一个槽可挂多个变体模型和远景模型；成片草地、湖底卵石成为装饰槽，可换 GLB 实例。
- 扩展：类别清单进入 `entities.json`；占位按类别注册，未知类别有通用占位；`anchors.json` 驱动世界布局；新增 `interactions.json` 与 `interactions.js`（鸟飞起、鱼四散、注视鸟叫）；新增 `project/new_species.py` 与 [数据与扩展指南](../data/README.md)。
- 规则：新增 W-08、X-01～X-04、L-07，修订 G-08、A-02、L-04；QA 增至 45 项；决策 D-012，待评审 R-13。
- 浏览器检查 42 项通过，文档校验通过；存档升到 v4。未做真人试玩与帧率测量，尚无真实 Lux3D 模型。

## runtime-0.3 · 2026-11-01

- 前端按 0.3 跑通：`main.js` 读取 `data/` 生成的运行配置；删除同行、E、Space／Ctrl、花与星球分支；鸟鱼随镜头俯仰升降。
- 魂穿：R 再验证、词典序选择、屏幕尺寸阈值、实心实体遮挡、过渡结束才交接、目标消失时回滚；人在岸边或鸟在高处可辨认并成为岛，涟漪落在所看的地面上。
- 感知：狗黑白、鸟饱和清晰、鱼青绿宽视野，过渡中连续混合；听觉档案驱动低通、听距、鸟叫方向与高度衰减。
- 碰撞：接通 `WorldCollision`，实心实体绕行、草弯折、活动区软边界、脱困；同一载体上的物体在载体坐标中比较。
- 布局修正：海鸥出生高度、邻岛松树与草移出巨岩、随机布景重叠移除；同步到 `anchors.json`。
- 修复“重新开始”被离开页面时的保存覆盖、存档升到 v3。世界回应按 D-011 显示原句，人第一次成为岛时出现福柯原句。
- 浏览器检查改写为 0.3 版 29 项并全部通过（开发机无头 Chrome，软件渲染）；4173 端口改为提供当前代码。未做真人试玩、帧率测量和非开发机运行。

## 0.3-review 修订 · 2026-11-01

- 创作者同意 R-07（鸟鱼感知参数）、R-08（各类别独特能力）、R-11（世界尺寸）；数据与文档的评审状态改为已确认。
- 世界回应全部替换为哲学家原句（D-011），14 句，含出处、外文原句与核对状态；U-03 对引文放宽到 18 字；撤回 R-12 的福柯改写句，改用《词与物》原句的中译。
- 校验脚本新增引文检查（作者、出处、核对状态、字数上限）。没有修改游戏代码。

## 0.3-review · 2026-11-01

- 按创作者四项修订重写规范基线：
  - 删除跳跃与升降键（原 I-02），飞行与游泳随视线俯仰升降（D-007）；
  - 新增禁止穿模、大型实体必须绕行、草可经过但弯折、同层大身体不重叠（D-008）；
  - 首版范围改为主岛＋三座邻岛＋海，可魂穿类别为草、树、动物（人、狗、鸟、鱼）、岩石、岛屿，共 13 种；新增“人看见岛成为岛”的核心时刻与尺度关系规则（D-006）；
  - 动物感知档案，狗为黑白世界（D-009）；
  - 所有可魂穿种类与环境部件预留 3D 资产槽，替换只改数据（D-010）。
- `data/entities.json` 升级为 schema 3；重写 `anchors.json`（审计群岛布局）、`dialogue.json`（14 条回应，含一条改写福柯意象的待核对文本）、`asset-ledger.csv`（31 行）；更新 `input-map.json`、`tuning.json`。
- `project/sync_runtime.py` 改为读取新字段，生成文件的运行时键名保持不变；`project/validate_docs.py` 改为按 0.3 基线校验。
- 新增群岛布局图，0.2 的两张图移入 `docs/diagrams/archive/`；0.2 文档备份在 `.work/migrate/docs-0.2/`。
- 审计发现：当前工作区前端无法启动（`main.js` 未迁移，引用已删除的导出）；4173 端口提供的是旧快照。本轮没有修改游戏代码。

## prototype-share · 2026-10-31

- 按创作者要求为此前网页原型增加单 HTML 导出脚本，生成可微信转发的 ZIP；接收者解压后可在电脑浏览器直接打开，无需开发工具。
- 在隔离的开发机 Chrome 会话验证本地文件启动、WASD 移动和 Esc 暂停，未发现 JavaScript／着色器错误，页面没有外部 HTTP 资源请求。
- 尝试临时公网分享，当前访问方式、实测与限制记录于 旧原型分享说明（已按 D-018 删除）。未修改原型玩法或接入 `data/`，未把新 Demo、非开发机或 Lux3D 验收标为完成。

## 0.2-review · 2026-10-31

- 根据创作者新规则建立 MUST／TUNABLE／DEFERRED 分类，首版改为单岛、约三种身体、一个主要发现与 3–5 分钟切片。
- 创建 00–10 规范、现有原型审计、当前／提案地图、设计 JSON、资产台账、团队任务与提交清单。
- 明确新旧范围差距，提出潮汐花园及三种能力方案，保留待评审状态。
- 补充魂穿再验证与回滚合同、合理脱困条件、鱼升降配置冲突和旧存档隔离要求。
- 本轮只修改文档与设计数据；没有把现有游戏缩成三种身体，没有导入真实 Lux3D 模型，没有部署或提交。

## prototype-v1 · 历史原型

已存在 Three.js 浏览器探索原型、十四种程序化身体、完整尺度链、同行、模型／骨架入口和本地保存。过去的检查结果只适用于对应原型，不代表新 Demo 已通过验收。
