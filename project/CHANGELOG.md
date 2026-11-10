# 变更记录

## 2026-11-10 · 蓝闪蝶纳入正式实体

- 负责人：待团队认领；关联：PR #9 后续，待关联提交。
- AI：Codex 负责数据、程序、文档和自动检查；人工复核待负责人完成。
- 变更与原因：按创作者要求新增昆虫类别和蓝闪蝶正式种类（D-030），六只进入主岛普通布局与存档，复用环境航线和碰撞；保留 8 米限高及程序翅膀动画，补充模型缺失占位。旧 `?morpho` 试玩存档不自动迁移。同步数据、生成配置、资产台账、范围与 QA。
- 验证（2026-11-10，本地 macOS）：`python3 project/sync_runtime.py` 已生成运行配置与清单；`python3 project/validate_docs.py` 1879 项通过；`python3 project/check_repository.py` 检查 155 文件、0 错误；`python3 -m unittest discover -s project/tests -v` 15 项通过；`git diff --check` 通过。本机没有 Node.js，未执行独立 JavaScript 语法检查。`python3 project/check_all.py --output .work/morpho-formal-final` 在普通入口蓝闪蝶专项及部分后续检查后，于页面重新加载等待处超时，完整浏览器回归未通过；此前两次尝试中 Chrome 断连，日志保留在本地 `.work/`。
- 未验证项 / 风险：团队共同确认、模型许可、程序动画与画面、音景、碰撞和真人试玩待完成；模型无自带动画片段，不声称完成资产验收。蓝闪蝶靠近超出 8 米限高的障碍物时的自主归航仍需验证。

记录要求与模板见 [CONTRIBUTING](../CONTRIBUTING.md#每次实际修改的变更记录)。每次交付实际修改时更新对应任务条目；新条目置于记录区顶部，同一任务可持续补充，保留他人与历史记录。

## 2026-11-10 · PR #9 主线冲突整合与审查

- 负责人：待团队确认；关联：PR #9。
- AI：Codex 处理冲突、审查及验证；人工复核：待负责人复核。
- 变更与原因：合入主线并保留双方记录；移动和镜头冲突采用 D-029 的统一控制，蝴蝶试玩保留模型、入口和飞行高度限制。蝴蝶原有专用背后转向行为因此改变。
- 验证：`python3 project/validate_docs.py` 通过 1791 项；`git diff --check` 通过。`python3 project/check_repository.py --javascript` 因环境缺少 Node.js 未运行；`python3 project/check_all.py` 沙箱内启动被拒，沙箱外运行在页面重载等待处超时，完整浏览器回归未通过。
- 未验证项 / 风险：真人试玩、资产许可及正式验收待完成；试玩目标选择和飞行状态问题待审查处理。
- 后续修复：蝴蝶使用与其他身体一致的目标角度、稳定时间和排序；过渡期间保持占用，离开后等待约 4 秒，再按限速与碰撞规则追随航线，避免停飞和跳回。新增隔离浏览器专项回归并补充试玩 QA 和实现审计；不扩大正式种类范围。
- 后续验证：专项浏览器检查已执行通过；完整 `python3 project/check_all.py --output .work/pr9-review-fixes-final` 在专项检查后加载普通页面时超时，重试 `--output .work/pr9-review-fixes-recheck` 仍在后续普通页面重载时超时，完整回归未通过。`python3 project/check_repository.py` 检查 156 个文件、0 错误（未含 JavaScript 语法，环境缺少 Node.js）；真人试玩、复杂避障及目标设备性能待验证。此前两次专项回归失败用于定位等待时间跨帧计算问题，修复后重跑通过。

## 2026-11-08 · 最新主线的蓝闪蝶试玩

- 负责人：待团队认领；本地分支 `asset/blue-morpho-main`，已同步主线 `53b1599`。
- AI：Codex 将蓝闪蝶玩法移植到新版人类角色的主线。通过 `?morpho` 开启六只蝴蝶、近距离 R 交互与背后飞行镜头。
- 验证：1664 项文档与数据检查、69 个文件的仓库检查通过；隔离 Chrome 实际加载主线人类 GLB，并验证六只蝴蝶、R 魂穿和背后转向。同步主线后，1748 项文档与数据检查及 156 个文件的语法检查通过；在 Chrome 复验新人类模型、鱼鸟环境移动接入、六只蓝闪蝶、R 魂穿、抬头上升与低头下降。完整浏览器回归未运行。
- 范围：只移植蝴蝶，保留主线的人类操控、动作与地形。
## 2026-11-09 · 统一第三人称转身移动并新增实体第一人称

- 负责人：@EmilyGogogo；关联：D-029，分支 `codex/perspective-movement`，PR 待关联。
- AI：Codex 参与规则梳理、代码与数据、文档、回归测试及验证；人工复核：待负责人复核。
- 变更与原因：修正第三人称后键直接倒退，所有身体改为相对镜头转向行进，后键转身约 180°，左右移动并转身；接入已有 180°/s 转速，岛漂移不旋转整座地形。第三人称统一人类全彩与基准 FOV；新增 V 第一人称，使用身体眼位、视觉与 FOV（狗黑白、鸟增强远景、鱼青绿宽视野），隐藏自身视觉模型并保留碰撞、承载物与岛的地形。第一人称眼位逐层检查承载面，避免进入斜岛或多层承载物的内部。两种视角听觉均随身体，魂穿和 v4 存档保留视角、旧存档默认第三人称。`perceptionCrossfadeSec` 原值 1.2 秒不变，接入 V 视觉混合。同步输入提示、数据与生成器、规范、决策、QA-49、审计与浏览器回归。
- 验证（2026-11-09，Windows 11、Python 3.13.9、Chrome 157.0.8103.38、Node 22.23.3）：`python project/sync_runtime.py` 生成运行配置；`python project/check_repository.py --javascript` 检查 154 个文件、0 错误；`python -m unittest discover -s project/tests -v` 15 项通过；`python project/check_all.py --output .work/perspective-20261109/complete-fixed` 标准完整入口退出 0，1789 项文档／数据检查及 331 项隔离浏览器检查通过，结果 JSON 的 docs/browser/status 均为 passed；`git diff --check` 通过。浏览器覆盖全部 11 种身体的后键转身、转速限制与起步不倒退、双视角视觉／FOV／眼位／模型恢复、相邻斜岛与多层承载眼位、魂穿视觉过渡、视角存档，以及真实 WASD／方向键／V 输入与五种视口 HUD。
- 回归诊断：首次完整运行在真实后键位移等待处超时；软件渲染下 10 秒墙钟仅推进约 0.3 秒游戏时间，身体仍在按规则转身。真实按键检查改为每个方向先面向行进方向，保留实际按键、位移阈值与原等待时限；转身时序另用固定步长验证，未修改游戏来迎合超时。重跑完整入口通过；原始诊断与最终日志仅保留于本地 `.work/perspective-20261109/`。
- 同日追加：按创作者反馈补齐第三人称左右及后键转身时的镜头跟随，所有身体统一使用实际转角驱动镜头，沿用原有平滑与转速；同次方向输入固定移动参考，避免镜头跟转让长按变成持续绕圈，鼠标环视仍能改变方向。岛仅跟随漂移朝向，不额外旋转地形及居民；第一人称平移与视线保持原行为。同步 D-029、规则、QA、实现审计与配置。
- 跟随追加验证（同日、同上环境）：重新运行 `python project/sync_runtime.py`；`python project/check_repository.py --javascript` 154 个文件、0 错误；`python -m unittest discover -s project/tests -v` 15 项通过；`python project/check_all.py --output .work/perspective-20261109/follow-camera-fixed` 完整入口退出 0，1790 项文档／数据检查及 456 项隔离浏览器检查通过，结果 JSON 的 docs/browser/status 均为 passed；`git diff --check` 通过。覆盖全部 11 种身体左右及后键的转速、实际相机环绕、长按转角收敛、鼠标环视、重按参考及第一人称平移不改变视线。首次新增第一人称平移检查改变位置后干扰了后续地面移动检查，恢复场景位置后完整重跑通过；沙箱临时目录权限失败后在沙箱外完成工具及浏览器检查。原始失败与通过日志仅留于本地 `.work/perspective-20261109/follow-camera*`，镜头跟随手感与真人画面尚未验收。
- 同日短按跟转修复：创作者再次反馈左右转身时画面也要动。新回归复现旧实现的短按跟转延迟：0.05 秒内身体已转身，实际镜头仍落后；此前长按到位检查没有覆盖这一时段。将受转速限制的身体转角同帧应用到实际镜头环绕与注视方向，位移、鼠标环视保留缓动，实际相机位置再次执行地形与实体避障。新增全部 11 种身体的 A/D、左右方向键短按与松键回归，同步 D-029、镜头规范、QA-49、数据说明和审计；未改调参数值。
- 短按修复验证（同日、同上环境）：修复前 `python project/check_all.py --output .work/perspective-20261109/immediate-turn-before` 在新增短按实际镜头断言处失败，日志留于本地；沙箱临时目录拒绝访问后在沙箱外复现。修复后首次完整运行通过新增短按检查，后续在双视角检查前的页面重载等待处超时；未放宽加载时限。重跑 `python project/check_all.py --output .work/perspective-20261109/immediate-turn-complete` 退出 0，1790 项文档／数据检查、589 项隔离浏览器检查全部通过，结果 JSON 的 docs/browser/status 均为 passed；新增覆盖全部 11 种身体的四个左右键短按实际环绕与注视方向、松键无追转及即时跟转时的实际相机避障。`python project/check_repository.py --javascript` 154 个文件、0 错误；`python project/validate_docs.py` 与 `git diff --check` 通过。失败与通过日志仅留本地 `.work/perspective-20261109/immediate-turn*`；真人画面与手感仍待验收。
- 推送前复验（2026-11-09）：Codex 按创作者要求提交并推送本分支；`python project/check_repository.py --javascript` 检查 154 个文件、0 错误；`python -m unittest discover -s project/tests -v` 15 项通过；`python project/validate_docs.py` 1790 项通过；`python project/check_all.py --output .work/perspective-20261109/pre-push` 退出 0，1790 项文档／数据检查与 589 项隔离浏览器检查通过；日志仅留本地，人工复核仍待负责人完成。
- 未验证项 / 风险：真人移动与转向手感、双视角眼位和画面、正常像素密度下的视觉质量、目标设备性能及远端 CI 待验证；正式 QA 未验收。回退时成组撤销本任务代码、数据、生成文件与规范修改。

## 2026-11-09 · PR #5 与最新 main 的冲突处理

- 负责人：@EmilyGogogo；关联：[PR #5](https://github.com/EmilyGogogo/between-the-worlds/pull/5)，分支 `codex/save-layout-patch-compat`。
- AI：Codex 负责冲突分析、语义合并、回归与文档；人工复核：待负责人复核。
- 变更与原因：合入 main 的 PR #7 鸟鱼资产、主体迁移及 PR #10 浏览器回归修复；恢复入口同时执行旧主体别名迁移与布局差量恢复，不把已移除身体的坐标赋给替代身体。保留双方决策与历史变更，将本 PR 布局补丁决策从 D-027 顺延为 D-028，更新 QA-30 与实现审计。增加旧主体迁移、布局补丁同时生效与再次保存不重复叠加的浏览器回归。
- 验证（2026-11-09，Windows 11、Python 3.13.9、Chrome 157.0.8103.38、Node 22.23.3）：`python project/sync_runtime.py` 重新生成两份运行配置；`python project/check_repository.py --javascript` 检查 154 个文件、0 错误；`python -m unittest discover -s project/tests -v` 15 项通过；`python project/check_all.py --output .work/pr5-conflict-20261109/complete-fixed` 完整入口退出 0，1747 项文档／数据检查及 203 项隔离浏览器检查通过，结果 JSON 的 docs/browser/status 均为 passed；`git diff --check` 通过。首次新增回归误把自主移动海鸥的位置预期为出生点，修正为保留它已保存的位置后重跑完整入口通过；未修改游戏实现来迎合测试。原始日志仅保留于本地 `.work/pr5-conflict-20261109/`，远端 CI 以本次提交的新运行结果为准。
- 未验证项 / 风险：真人升级体验、线上缓存策略、正常像素密度画面与目标设备性能未验证；原有未提交的移动诊断修改已独立保存在 Git stash 和本地 `.work/pr5-conflict-20261109/`，不混入本次提交。

## 2026-11-07 · 补丁更新保留游玩进度并采用新版布局

- 负责人：@EmilyGogogo；关联：分支 `codex/save-layout-patch-compat`，基于 `main`，[PR #5](https://github.com/EmilyGogogo/between-the-worlds/pull/5)。
- AI：Codex 负责原因分析、存档合并实现、文档与回归；人工复核待负责人完成。
- 变更与原因：存档增加对应实体的初始布局基线。补丁修改已有实体位置时，加载器把存档相对旧初始位置的差量叠加到新版位置，保留玩家自行移动的偏移，同时应用新版布局；新增实体使用新版配置，已删除实体忽略。无基线旧存档兼容读取并在下次保存时写入基线。更新规则记录为 D-028，补充 QA-30 和实现审计。
- 验证：首次 `python project/validate_docs.py` 通过（1659 项）；`python project/check_repository.py --javascript` 通过（59 个第一方文件、0 错误）；`python -m unittest discover -s project/tests -v` 通过（14 项）；`git diff --check` 通过。更正此前浏览器通过的记录：当时误读了遗留结果文件，不能作为最终修改的通过证据；[首次远端 CI](https://github.com/EmilyGogogo/between-the-worlds/actions/runs/42379122987) 在朝向差量断言处失败。
- CI 修复：Three.js `Euler.toArray()` 包含第四项旋转顺序，导致基线不符合恢复器的三项角度校验。改为显式记录三个角度，保留失败断言并补充所有存档基线均为三个有限角度的检查。修复后 `python project/check_all.py --output .work/save-layout-ci-fix-20261107-01` 通过（文档 1659 项、隔离 Chrome 131 项；Windows 11、Python 3.13.9、Chrome 157）。
- PR 冲突处理与合并验证：为解决 PR #5 与 `main` 上 PR #6 的冲突，将布局补丁决策编号顺延至 D-027，保留双方 CHANGELOG 和文档更新；人物模型、转向与游泳更新由 Git 自动合并。合并后文档数据校验通过（1664 项）、源码检查通过（67 个第一方文件、0 错误）、工具单元测试通过（14 项）、部分隔离 Chrome 检查通过（95 项）。完整隔离浏览器回归在真实按键移动检查处超时，尚未确认这是本机输入模拟限制还是行为问题；因此不记录完整浏览器回归通过，等待推送后的 GitHub CI 验证。
- 未验证项 / 风险：线上托管缓存策略与已打开页面的更新体验未验证；已打开页面需刷新才会加载新版本。旧存档无布局基线，首次升级无法区分玩家改变量与历史布局差异，仍沿用旧行为一次。

## 2026-11-08～11-09 · 修复完整浏览器回归的恢复状态与操作栏宽度

- 负责人：@EmilyGogogo；关联：PR #6 合入后的 CI 第 11 次运行及 PR #7 浏览器回归；修复分支 `codex/fix-browser-regression`，[PR #10](https://github.com/EmilyGogogo/between-the-worlds/pull/10)。
- AI：Codex 负责定位、CSS 与测试修复、文档与验证；人工复核：待负责人复核。
- 变更与原因：当前分支中补齐失焦测试后显式点击 resume、等待解除暂停及指针锁定，再检查真实移动／转向／同向多键。HUD 测量发现人的拖动环视文案使操作栏宽约 308.9 px，超过既有 300 px 限制；为 `.control-guide` 加 300 px 最大宽度，保留视口约束并允许自然换行。五种视口分别检查真实锁定与未锁定状态，断言栏体可见、无横向溢出且不遮挡其他提示，防止隐藏元素的零尺寸被当作通过。
- 检查执行：诊断中记录到软件渲染响应约 9 秒、反复加载真实模型触及 300 秒总时限；测试设备像素比设为 0.25，保留 CSS 视口、真实模型、指针锁定与移动断言，降低光栅化开销。`check_all.py` 完整浏览器子进程预算改为 600 秒，单项等待条件和阈值保持原样；HTTP 缓存仍禁用。临时缓存对比没有单独解决问题，未纳入交付。
- 验证（2026-11-09，Windows 11、Python 3.13.9、Chrome 157.0.8103.38、Node 22.23.3）：`python project/check_all.py --output .work/ci-hud-regression/complete` 标准完整入口退出 0，1747 项文档／数据检查、195 项浏览器检查通过；结果 JSON 的 docs/browser/status 均为 passed，日志仅在本地 `.work/ci-hud-regression/complete/`。`python project/check_repository.py --javascript` 检查 154 个文件、0 错误；`python -m unittest discover -s project/tests -v` 15 项通过；`git diff --check` 通过。早期重载等待超时与 300 秒总时限失败如实保留于本地诊断记录，20 次连续空场景重载未复现；最终标准运行未发生这些失败。
- 未验证项／风险：远端 CI、真人画面、正常像素密度下的视觉质量与目标设备性能尚未验证；本地完整回归通过不作为正式 QA 或性能验收。按用户要求提交修复 PR，人工审核与合并待负责人完成。

## 2026-11-08 · 修复 PR #7 的存档迁移与自主移动穿模

- 负责人：@EmilyGogogo；关联：PR #7，修复分支 `codex/fix-pr7-motion-save`。
- AI：Codex 参与 review、复现、代码与数据修复、回归测试及文档；人工复核待负责人完成。
- 变更与原因：旧当前主体被删除会使整个 v4 存档失效并被新进度覆盖；新增布局数据 `savePlayerAliases` 转移旧蝴蝶鱼与已移除海鸥的控制权，保留仍存在的身体、提示与回应状态，未知已移除主体退到初始身体。已移除身体的旧坐标不应用到替代身体，避免把山湖鱼放回近海。环境移动复用玩家的地形、碰撞和活动区处理，逐体更新碰撞记录，转向或贴地造成重叠时恢复上一位置；修复海鸥归队钻入山坡、鸟鱼穿过玩家的问题。同步运行配置、数据指南、D-027、QA-30／QA-48 与实现审计。
- 验证（Windows 11、Python 3.13.9、Chrome 157.0.8103.38、Node 22.23.3）：修复前在隔离 Chrome 中复现旧主体存档被丢弃、归队海鸥进入地表下约 20.5 米、自主鸟鱼穿过玩家；修复后同场景均未复现。永久回归已接入 `frontend/tests/check_browser.py`，单次加载独立运行 36 项通过。`python project/sync_runtime.py` 已同步两份生成文件；`python project/validate_docs.py` 1747 项通过；`python project/check_repository.py --javascript` 154 个文件、0 错误；`python -m unittest discover -s project/tests -v` 15 项通过；`git diff --check` 通过。`python project/check_all.py` 在新增回归通过后仍于真实键盘移动检查超时（与修复前相同断言）；随后 `python project/check_all.py --no-pointer-lock --output .work/pr7-gameplay-checks` 的 138 项部分浏览器检查通过，真实鼠标锁定及后续检查未计入部分通过。原始结果仅保留于本地 `.work/collaboration-checks/`、`.work/pr7-gameplay-checks/`，不作为远端 CI 或真人验收证据。
- 未验证项／风险：本次完整真实输入回归未通过，远端 CI 待本次提交运行；正式真人 QA、目标设备性能及模型来源许可未验证，不使用历史 CI 代替本次结果。

## 2026-11-07～11-08 · 鱼和鸟：七彩神仙鱼、银斧鱼、海鸥 v003 与鸟鱼环境移动（D-027）

- 负责人：zora-alt111；分支 `asset/fish-birds-v001`（已合并 `origin/main` 197f216，04／06／11／CHANGELOG 的文字冲突已解决，两边内容都保留），PR 见分支；同一任务的连续调整合并为本条记录。
- AI：Claude Code（Claude Opus 5.5）负责选种参考、Blender 脚本化修整／绑骨／动作、数据与代码、文档、检查与游戏内核对；人工：负责人在 Lux3D 国内版网页生成全部模型，确定种类、数量、山湖位置、卡通风格与归队方式，并在游戏内试玩后提出体型、扇翅与斑块三项修改。
- 种类与数量（D-027，会话授权，待团队确认）：七彩神仙鱼 `fish_discus_01`（`slot.discus`）取代蝴蝶鱼 `fish_butterfly_01`，引文 ID 改为 `TXT-FISH-DISCUS`（内容不变）；`fish_silver_01` 定为银斧鱼。两种鱼都放在山湖，近海暂无鱼。海鸥 8 → 4 只，银斧鱼 8 → 12 条（一群），七彩神仙鱼 6 条。能力与感知未改。
- 资产：三件 Lux3D GLB 用 Blender 4.5.15 脚本处理，包括自动转向、放平、减面、定标、绑骨，以及 idle／move 动作，JPEG 内嵌、无 Draco。
  - 海鸥 v003：137,378 → 30,000 面；原件双翅高举成 V 形，在肩部压平后设为静止姿态；动作 `Glide`／`Flap` 为连续曲线，关节过渡加宽，避免“折翅”。
  - 银斧鱼：8,000 面；七彩神仙鱼：29,000 面。面数更低时贴图出现白斑，两种鱼都是按游戏内近景对比选定。动作均为 `Swim`／`SwimFast`。
  - 迭代过程：写实版 v001（参考图为 Commons 照片，PierreSelim，CC BY 3.0）未采用，只保留原件与记录，运行时文件与 `.blend` 已移除；卡通版 v002 保留作回退。海鸥 v003 曾在“翅膀平滑”中对肩部做顶点放松，导致层叠羽毛互相穿插、游戏中出现斑块，已去掉该步骤并改为平滑着色。
  - 来源链在 `assets/lux3d/LUX3D-bird_gull_01`（raw／edit／export 分 v001～v003）、`LUX3D-fish_silver_01`、`LUX3D-fish_discus_01`；台账新增对应行，v001、v002 标为 `superseded`。
- 环境移动（D-027）：新增 `frontend/src/ambient.js`，按 `anchors.json` 新增的 `ambient` 航线驱动未被占据的海鸥与鱼。航线是按时间重复的环线或“8”字形；海鸥在低飞段减速，并按模型实际尺寸抬过实心身体；鱼不离开所属水体；银斧鱼保持队形。玩家占据或正在进入的身体不受航线驱动，离开后先停约 4 秒再归队；惊飞／四散期间交给互动。`world.js`、`main.js` 小改，`sync_runtime.py` 输出 `ambient`。
- 开局可选中海鸥：原有问题是地面身体不能仰视，海鸥又都在 15～17 米高空，从人出生点选不中任何海鸥（干净的 main 同样复现）。现在 `gull-0` 约每 32 秒在人出生点前方减速低飞经过（锚点 A14），人平视即可选中。
- TUNABLE（试玩反馈“从某些角度看非常大”）：海鸥 `body.height`／`asset.height` 0.65 → 0.32、`collisionRadius` 0.65 → 0.5、占位碰撞盒等比缩小、镜头距离 5.0 → 3.5。v003 在游戏内翼展约 0.89 m。
- 测试与文档：`check_browser.py` 改为“低飞时可选中 gull-0”，惊飞测试期间暂停航线，并新增环境移动回归（数量来自数据）。同步 01、03、04、05、06、07、08（QA-15、QA-18、新增 QA-48）、09（D-027）、10、11、GLOSSARY、CONTRIBUTING、README、数据指南、THIRD_PARTY、LICENSES。
- 验证（macOS 14.8.7、Python 3.9.6、Chrome 156.0.8078.80、Blender 4.5.15）：
  - `python3 project/sync_runtime.py`；`python3 project/validate_docs.py` PASS（1726 项）。
  - `python3 project/check_repository.py` 0 错误（本机无 Node.js，未运行 `--javascript`；新 JS 已在游戏中执行）；`python3 -m unittest discover -s project/tests` OK；`git diff --check` 通过。
  - 游戏内单次加载核对 15 项全部通过：模型加载、全部移动、60 秒鱼不出水、鱼群不散、海鸥不穿实心体、低飞时人可选中并成为海鸥、占据与释放。`check_browser.py` 新增与修改的片段单独运行 9 项通过。
  - 海鸥大小、扇翅、斑块问题都做了游戏内近景对照与逐帧渲染；截图在各资产的 `evidence/` 与 `edit/*/previews/`。
- 未完成的检查：完整的 `check_all.py --only browser` 在本机 Chrome 156 下重新加载会停住（高频轮询所致，干净的 main 同样），以 PR 的 Actions 结果为准。
- PR #7 的 CI 修复（2026-11-08）：PR 的 game-checks 在浏览器检查步骤失败。main（197f216）在同一步骤也失败，日志需要管理员权限，本机无法查看。本机把 `check_browser.py` 的各段测试分别在新页面上运行（慢轮询）：干净的 main 各段全部通过，本分支有 2 处真实失败，均已修复：
  - 出生时 5 条银斧鱼互相重叠：队形间距 0.8 m 加上漂移 0.3 m，相邻两条最近只有 0.2 m，小于鱼长 0.47 m。改为间距 1.0 m、漂移 0.15 m，出生点按新队形重算。
  - “从海鸥成为岛也触发首次回应”失败：前面的测试在搜索目标时可能注视到低飞的海鸥，触发其聚焦回应，进入 90 秒冷却；游戏行为本身符合 D-019。测试在成为岛前清空冷却，只检查回应与来源身体无关。
  - 另外，“低飞时人在出生点可选中 gull-0”这条回归受前面人物游泳测试影响：人被留在原点，离海鸥太近而触发惊飞。改为先把人放回出生点，并在海鸥接近最低点（离地 3 m 以下）时再选，避免下降途中被身后的树抢走目标。
  - 修复后各段在本机通过（第 0 段 35 项、第 1～7 段均通过；个别段遇到本机加载卡住后重跑通过）。依赖鼠标锁定、点击与 DOM 几何的 Python 段本机未运行，main 的 CI 失败可能就在这部分，待 Actions 结果。
- 未验证项／风险：
  - 三件 GLB 的生成方式、任务 ID、版本与积分待生成人补充（台账与 `task.json` 已标“待补”）；Lux3D 用户协议未查阅。
  - D-027 与 DF-03 的关系待团队确认。
  - 旧存档中的 `gull-4`～`gull-7` 会被跳过（可能与 PR #5 相关）。
  - 海鸥翅根在扇翅时有轻微鼓起、双脚下垂；新手能否发现低飞海鸥、目标设备帧率、QA-31～QA-34、QA-48 待真人验收。
- 回退：删除 `ambient` 段即恢复静止的鸟鱼；槽 `url` 改回 v002 或 `null` 并重跑同步即回退模型；种类与数量按本条恢复，或直接 revert 本 PR。

## 2026-11-07 · 接入人物模型

- 负责人：@EmilyGogogo；关联：分支 `codex/character-a-standard-v001`，PR 待关联。
- AI：Codex 负责检查资产、接入、文档与验证；人工复核待负责人完成。
- 游泳追加（D-026）：接入用户提供的游泳 GLB；人物进入游戏识别的水域时切换游泳并保持水面附近，出水恢复陆地动作。同步规则、资产说明和 QA；游泳动作、岸边过渡、目标机性能与真人试玩待验收，游泳素材来源及公开发布授权待核实。
- 游泳验证：`python project/sync_runtime.py`、`python project/check_all.py --no-pointer-lock --output .work/character-swim-safe`（1663 项文档数据检查、95 项部分浏览器检查）、`python project/check_repository.py --javascript`（67 个文件）及 `git diff --check` 通过；浏览器以模拟水域验证入水、静止游泳、出水与动作轨道，真实鼠标锁定及其后回归未运行，实际湖海岸边与画面未试玩。游泳和步行的 23 条骨骼轨道名称匹配。
- 变更与原因：将用户提供的静态、步行 A 及冲刺 GLB 接入人槽，保留原文件和程序占位回退。静止显示静态模型，移动和 Shift 移动分别播放步行与冲刺动作；人物模型旋转 180 度，纠正面部朝向。用户确认资产可用于本游戏；生成来源及公开发布授权待核实，不宣称 Lux3D 证据链完成。
- 行走体验追加调整：克隆步行和冲刺动作并固定骨盆水平轨道，保留垂直起伏，避免动作自身与游戏位移叠加；根据碰撞后的实际移动控制人物动作及速度，受阻时停止播放。新增可跳过真实指针锁定的部分浏览器检查模式，不将其视为完整回归。
- 转向追加调整（D-025）：按创作者要求，人使用左右键原地转向，第三人称镜头随之转动，前后键沿当前视线移动；其他身体保留原操作。同步游戏提示、规则、决策与验收要求。骨盆中心实测距离旋转轴约 0.05 米；转向响应采用原有朝向追随系数作为初值，手感待试玩确认。
- 转向验证：`python project/check_all.py --no-pointer-lock --output .work/character-turn-safe` 通过 1662 项文档数据检查和 89 项部分浏览器检查，包含左右原地转向与镜头方向同步；真实指针锁定及其后检查未运行。`python project/check_repository.py --javascript` 通过 65 个文件，`git diff --check` 通过；实际镜头观感、转向速度及真人试玩未验证。
- 资产目录整理：用户将人物源文件移入 `assets/lux3d/character/` 并重命名静态与冲刺文件；更新台账路径及源文件与运行时副本的对应说明。SHA-256 核对确认三个源文件与现有运行时副本分别一致，无需替换游戏文件或变更运行时路径；运行 `python project/sync_runtime.py`、`python project/validate_docs.py`（1662 项）、`python project/check_repository.py --javascript`（65 个文件）及 `git diff --check` 均通过。本次未进行真人试玩或完整浏览器回归。
- 追加验证：`python project/check_all.py --no-pointer-lock --output .work/character-motion-safe` 通过 1662 项文档数据检查及 87 项部分浏览器检查，覆盖动作水平轨道、受阻停止与部分位移；跳过真实指针锁定及其后的检查。`python project/check_repository.py --javascript` 通过 65 个文件；工具单元测试 14 项通过。首次沙箱运行因临时目录权限失败，随后在沙箱外完成。未进行真人试玩或目标设备帧率测量。
- 验证：冲刺及朝向调整后 `python project/sync_runtime.py`、文档数据校验（1662 项）、`python project/check_repository.py --javascript`（65 个文件、0 错误）及工具单元测试（14 项）通过；静态检查确认步行与冲刺文件骨骼和动作轨道名称一致。此前 `python project/check_all.py` 两次未完成：第一次在多次加载后等待页面超时，第二次在真实按键移动的 5 秒等待处超时。本轮为避免再次限制用户鼠标，未运行会真实请求指针锁定的隔离浏览器回归；新增冲刺断言尚未执行，不能宣称浏览器验收通过。
- 未验证项 / 风险：模型 217488 三角面，高于 L1 动物 30000 预算；动作切换、轴向、碰撞、真人试玩、目标机性能及 QA-31～34 待验收；回退可撤销本任务提交并恢复人槽占位。
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
