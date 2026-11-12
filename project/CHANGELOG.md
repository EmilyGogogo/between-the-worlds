# 变更记录

记录要求与模板见 [CONTRIBUTING](../CONTRIBUTING.md#每次实际修改的变更记录)。每次交付实际修改时更新对应任务条目；新条目置于记录区顶部，同一任务可持续补充，保留他人与历史记录。

## 2026-11-12 · 修复所有实体第三人称方向偏移

- 负责人：@EmilyGogogo（待人工复核）；关联：`codex/fix-possession-forward-camera`，PR 待关联。
- AI：Codex 负责诊断共享移动／镜头逻辑、实现修复、补充逐种回归和文档；人工复核待完成。
- 变更与原因：鱼之外的身体也会因自动路线留下的旧朝向，使按下前进后镜头跟随错误转角，出现向左或侧向移动。第三人称按键现在读取实际显示镜头方向，身体与镜头都按当前种类转速限速对齐，旧路线朝向不计入镜头转角；持续按键锁定方向。自动路线继续在当前主体和魂穿过渡两端暂停。新增 13 种实体以及巨岩、邻岛承载体的方向回归。
- 验证：`python3 project/check_all.py --only docs --output .work/possession-forward-docs` 通过（1990 项）；`python3 project/check_repository.py --javascript` 通过（209 个文件）；`python3 project/validate_docs.py` 通过；`git diff --check` 通过。独立隔离 Chrome 移动回归通过 1345 项（13 种实体、四种初始朝向、四方向输入、承载体和路线暂停）；全量检查首次运行通过逐种初始化和移动检查，但第二次页面重载在 90 秒等待阶段超时（Chrome 157，和既有重载限制一致）。提交前重跑 `python3 project/check_all.py`，文档检查通过，浏览器检查仍在页面重载等待 90 秒后超时。
- 未验证项 / 风险：真实浏览器第二次重载、真人操作手感、目标设备性能和视觉资产验收仍待人工复核；移动回归通过不代表边界滑动、障碍物绕行和完整手感已由真人验收；新增用例保留真实镜头与身体移动，方向测试中解除实心阻挡并缩短岛漂移距离以排除河岸滑动。证据：本地 `.work/possession-movement-focused/browser.log`；全量日志 `.work/possession-forward-checks/browser.log`。

## 2026-11-12 · 合入蓝闪蝶与主线鸟鱼

- 负责人：Codex；关联：D-035、PR #9，最终 PR 待关联，人工复核待完成。
- AI：Codex 负责选择性移植模型、翅膀与活动路线，适配河心岛、整合主线鸟鱼并验证。
- 变更与原因：创作者要求纳入蓝闪蝶；从 #9 引入 Hyper3D Rodin 模型和程序翅膀，六只个体在初遇圈低飞，离地限高 8 m。当前河心岛环境与已确认水色保留；蝴蝶鱼由七彩神仙鱼替换，海鸥与银斧鱼采用 main 模型和动作，增加旧鱼存档映射。
- 验证：生成运行配置；文档与数据校验 1990 项通过，源码语法检查 207 个文件通过，工具单元测试 15 项通过；隔离浏览器首轮检查通过，包括六只蓝闪蝶、模型和翅膀动画，但后续页面重载超时，完整回归未通过。
- 未验证项 / 风险：模型公开发布许可、真人试玩、动作与目标设备性能待确认。

## 2026-11-11 · 核对双视角操作并修正第一人称合并遗漏

- 负责人：@EmilyGogogo（待人工复核）；关联：`codex/river-island-review`、D-035，PR 待关联。
- AI：Codex 负责源码对比、修复与回归验证。
- 变更与原因：按创作者再次确认的合同，保留第三人称按键起始画面方向锁定、转身后前进与镜头跟转；第一人称身体朝向视线，A/D 横移、S 后退时不朝移动方向掉头，鸟鱼按第一人称真实俯仰角升降，鼠标俯仰上限使用当前视角配置；岛第一人称不旋转整座地形。补充第一人称横移／后退朝向断言，并将视角存档检查修正为当前 v5。
- 验证：`python3 project/check_repository.py --javascript` 检查 206 个 first-party 文件、0 错误；`python3 -m unittest discover -s project/tests -v` 15 项通过；`python3 project/validate_docs.py` 通过 1888 项；`git diff --check` 通过。`python3 project/check_all.py` 的文档模块通过，但隔离浏览器在重载等待阶段超时，浏览器行为回归未完成。
- 未验证项 / 风险：浏览器回归未完成，第一人称后退及鸟鱼上下移动尚无浏览器运行证据；鸟鱼模型整合尚未包含在本条修复内；真人操作手感待试玩。

## 2026-11-11 · 水体调浅并加强水面存在感

- 负责人：@EmilyGogogo（人工复核待完成）；关联：`codex/river-island-review`，PR 待关联。
- AI：Codex 负责定位水色、调整源数据、同步运行配置与验证；用户在会话中明确要求调浅水色并将透明度调到最透明。
- 变更与原因：此前主河道深／浅水不透明度为 0.24／0.10，牛轭湖及两片水塘仍为 0.52／0.22，可能遮住水下内容；上一轮改为 0 后水面又完全不可感知。用户反馈 0.28／0.14 仍像没有水，本轮四处水体深／浅水不透明度统一提高到 0.46／0.30，保留当前不透明度，水色由浅青色改为更偏蓝的浅蓝色 #9bc9ed／#d4eaff，在能感知水面的同时降低对水下内容的遮挡。水域位置、深度、游泳与鱼的活动区不变。
- 验证：`python3 project/sync_runtime.py` 完成；`python3 project/validate_docs.py` 通过 1888 项；`git diff --check` 通过；实际请求 4173 服务的运行配置，上一轮确认四处水体深／浅水不透明度均为 0.28／0.14；本轮蓝色色值同步及文档校验待执行。本轮仅调整数据，未重跑代码回归；此前浏览器回归在页面重载阶段超时，本轮视觉效果尚未验收。
- 未验证项 / 风险：实际清澈度仍需在浏览器中从岸边和水下试玩确认；真人试玩与目标设备性能未验证。

## 2026-11-11 · 统一所有实体的第三人称正方向操作

- 负责人：Codex；关联：D-035；当前 worktree 仍为 detached HEAD，未推送或合并受保护的 `main`。
- AI：Codex 负责按创作者追加要求调整移动、镜头跟转、规则、验收与回归；人工复核尚未完成。
- 变更与原因：第三人称下所有实体依据按键开始时的画面方向移动：W 向画面前方前进，A/D 转向画面左／右并沿该方向前进，S 先转身约 180° 后前进；持续按键锁定目标方向，镜头跟随实际转角。第一人称保留 W 前进、A/D 横移、S 后退及鼠标视线控制。
- 验证：`python3 project/sync_runtime.py`；`python3 project/validate_docs.py` 通过 1888 项；`python3 project/check_repository.py --javascript` 检查 206 个 first-party 文件、0 错误；`python3 -m unittest discover -s project/tests -v` 15 项通过；`git diff --check` 通过。隔离浏览器回归未能启动，本机服务端口绑定返回 `PermissionError: [Errno 1] Operation not permitted`，浏览器连接被拒绝。
- 未验证项 / 风险：未在真实浏览器确认不同实体的转身手感、岛屿朝向、水中人物动作及河水视觉效果；真人试玩未做。

## 2026-11-11 · 提高河流水体通透度并校正河鱼可见性

- 负责人：Codex；关联：D-035；当前 worktree 仍为 detached HEAD，未推送或合并受保护的 `main`。
- AI：Codex 负责水体外观参数、河鱼位置检查、运行配置同步与验证；人工复核尚未完成。
- 变更与原因：按创作者要求让河水更清澈，将主河道深／浅水不透明度调整为 `0.24`／`0.10`，颜色调整为浅青绿色，清晰度从 `3.4` 提高到 `5.2`；蝴蝶鱼保持在主岛南岸外的河水中，并将其高度从约 `-0.9 m` 抬到 `-0.62 m` 以靠近水面、提高可见性。银色小鱼仍位于牛轭湖，不移动到主河道。
- 验证：`python3 project/sync_runtime.py`；`python3 project/validate_docs.py` 通过 1888 项；`python3 project/check_repository.py --javascript` 检查 206 个 first-party 文件、0 错误；`python3 -m unittest discover -s project/tests -v` 15 项通过；`git diff --check` 通过。隔离浏览器回归未能启动，本机服务端口绑定返回 `PermissionError: [Errno 1] Operation not permitted`，浏览器连接被拒绝。
- 未验证项 / 风险：仍需在实际浏览器从岸边和水下分别确认鱼、河底卵石和浅色水体的遮挡关系；牛轭湖保持较深的黑水外观，银色小鱼可见性需单独试玩。

## 2026-11-11 · 河心岛 PR 审查与 Main 合并收口

- 负责人：Codex；关联：D-035，当前 worktree 的本地合并提交 `28d82c6`；最终是否合并受保护的 `main` 仍由 @EmilyGogogo 审核。
- AI：Codex 负责 PR diff 审查、冲突解决、双视角与布局存档实现、河流水体和游泳表现调整、数据同步与检查；人工复核尚未完成。
- 变更与原因：河心岛是一次特殊的大环境替换，存档新增 `layoutId=river_island_v1` 与布局基线；旧海岛存档和缺少基线的旧记录失效。以后普通布局更新仍可按保存的基线映射位移、旋转和高度偏移。保留当前 12 个实体、鱼种、实例 ID 和引用，不引入 Main 的 `fish_discus_01` 替换蝴蝶鱼；双视角决策重新编号为 D-035，补齐所有实体第一人称眼位、V 键和第三人称跟转。河流与封闭水体改为浅色、低不透明度、高透明度；水底卵石装饰槽现在分别在牛轭湖与南岸河床按实际水体判定生成。人物入水时保持游泳动作并在出水后恢复陆地动作。
- 验证：`python3 project/sync_runtime.py`；`python3 project/validate_docs.py` 通过 1888 项文档／数据检查；`python3 -m unittest discover -s project/tests -v` 15 项通过；`python3 project/check_repository.py` 检查 206 个文件、0 错误；`git diff --check` 通过。隔离 Chrome 浏览器回归已运行，但未完成：运行过程中发现并修正人类第三人称转向及转向后镜头避障，随后 Chrome 在重载场景时超时；Node.js 缺失，仓库 JS 语法专项检查未运行。
- 未验证项 / 风险：本轮尚未在真实浏览器逐帧确认清澈河水下鱼、`env.pebbles` 礁石和人物游泳姿态的遮挡效果；游泳 GLB 的动作轨道和不同水深岸边过渡仍需 QA-23；需要补跑浏览器回归后再声称游戏内视觉验收通过。

## 2026-11-08 · 疏林、草地空地与林中水塘

- 负责人：@yidi0522；关联：D-032，分支 `feat/amazon-river-island`，PR 待关联。
- AI：Claude（Claude Code）负责地形脚本修改与重新生成（本机 Blender 5.2.3 后台）、数据调整、截图核对、测试与文档；人工复核：创作者在会话中提出要求，尚未试玩本轮结果；完整 diff 待负责人复核。
- 变更与原因：创作者认可 Aholo 树的样子，但要求树木至少砍半、保留探索感，并留出纯草地和纯水域。布景林约 7,200 → 3,200 棵（`env.forest` 各层 `spacingM` 放大、`clumping.clearingBelow` 0.18 → 0.34）；`anchors.json` 中 `forest-broadleaf` 70 → 35、`forest-palm` 60 → 30、`forest-kapok` 14 → 7。`project/terrain/river_island.py` 新增 `GLADES`（三块草地空地）与 `PONDS`（岛首水塘扩大加深、岛中部南侧新增水塘），重新生成 `frontend/public/terrain/`；`anchors.json` 新增 `glade_west`、`glade_north`、`glade_east` 与封闭黑水水体 `pond_west`、`pond_south`，三组可魂穿树木避开它们；`env.meadow` 新增三块空地的草叶区域，`env.understory` 50,000 → 16,000 次尝试。
- 验证：`python3 project/sync_runtime.py`；`python3 project/validate_docs.py` 通过 1811 项；`python3 project/check_all.py` 连续三次运行，第一次 1 项界面检查（未锁定指针时左键拖动转镜头）失败，后两次 140 项全部通过，判断为偶发，与本次改动无关；GPU 无头 Chrome 截图核对俯瞰、空地、水塘与林内：开局约 81 万、林内约 124 万三角面（含阴影）。
- 未验证项 / 风险：真人试玩未做，林子是否“好走”需要实际走一圈；目标设备帧率未测；水塘是否需要鱼或其他生物未定；重新生成地形后出生点高度变化约 1 cm。团队共同确认待填写。回退时撤销本条的地形脚本、地形文件、数据与文档。

## 2026-11-08 · 雨林树木改用 Aholo 模型

- 负责人：@yidi0522；关联：D-031，分支 `feat/amazon-river-island`（与下两条同一分支、未提交），PR 待关联。
- AI：Claude（Claude Code）负责 Lux3D 生成（创作者确认提示词与参数后提交）、Blender 处理脚本、前端按距离分档绘制、碰撞调整、测试、数据与文档；人工复核：创作者在会话中确认了提示词与生成结果，尚未试玩本轮结果；完整 diff 待负责人复核。
- 变更与原因：创作者试玩 D-030 后反馈扫描树晕、不高清，魂穿的树几乎走不动，走路时树会随机消失，要求改用 Aholo 文生 3D 的树，并区分装饰树与可魂穿的树。用 Lux3D 国内版 G1 文生 3D 生成吉贝木棉、林冠阔叶树、阿萨伊棕榈丛、林下灌丛 4 个模型（原件与记录在 `assets/lux3d/LUX3D-vegetation-rainforest/`）。`project/vegetation/build_vegetation.py` 改为把原件处理成同一文件内的三档网格（lod0～lod2）与 16×3 视角替身，另做一个树干拉长的林冠变体；输出 `frontend/public/models/vegetation/`（约 15 MB，旧的 Poly Haven 植被文件移除）。`frontend/src/vegetation.js` 新增 `LodField`：每棵布景树按与视点的距离只放进一档（12／30／75 m，逐株略有伸缩，视点每移动 3 m 重选），替身不再在着色器里按距离丢弃。三个树槽改为加载 Aholo 模型（`pivot: file_origin`、文件内 `lod` 节点、按新模型实测的自定义碰撞盒）；`assets.js` 支持 `lod[].node` 与 `file_origin`，移除扫描树占位。布景树干只挡 3 m 以下的身体（`blocksBodiesUpToM`），魂穿的树可穿过布景林。两岸林线改用 Aholo 替身。林下灌丛改为单一 Aholo 模型两档网格。草上露珠去掉透射：透射让整个场景在有草的画面里每帧多画一遍（同一林内视角实测从约 370 万降到约 177 万三角面）。
- 验证：macOS（Apple Silicon）、Python 3.9.6、Chrome 156、Blender 5.2.3：`python3 project/sync_runtime.py`；`python3 project/validate_docs.py` 通过 1797 项；`python3 project/check_all.py` 通过文档检查与 140 项隔离 Chrome 浏览器检查（新增 5 项：Aholo 模型加载、三个树槽带三档 LOD、魂穿的树穿过布景树干、近处与大尺度时每棵布景树只画一档）；`python3 -m unittest discover -s project/tests` 14 项通过；`git diff --check` 通过。GPU 无头 Chrome 截图见 `assets/lux3d/LUX3D-vegetation-rainforest/evidence/`：开局约 170 万、林内 157–177 万三角面（含阴影），其中布景林约 54 万。
- 未验证项 / 风险：目标设备帧率未测；没有连续行走与魂穿移动的录像，“树不再消失”由机制与检查保证，未经真人试玩确认；Lux3D 任务号未留存，积分只核对了前两个任务（各 20）；Lux3D 用户协议与活动素材条款未查阅；中、低两档减面后叶片边缘较尖，只在 12 m 外使用；能魂穿的树穿过布景林是 AI 提出的做法，待创作者确认。团队共同确认待填写。回退时成组撤销本条的源码、数据、植被文件与文档，并从 stash 或上一条的文件恢复 Poly Haven 植被。

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

## 2026-11-06 · 实拍扫描雨林、树木错落分布与收窄河道

- 负责人：@yidi0522；关联：D-030，分支 `feat/amazon-river-island`（与下一条同一分支、未提交），PR 待关联。
- AI：Claude（Claude Code）负责植被处理脚本（在本机 Blender 5.2.3 后台运行）、前端替身着色器与分布算法、两岸林线、性能与测试工具调整、数据与文档；人工复核：创作者在会话中给出两张参考图（河心岛旁的大片森林；岛内精细的林间水景），尚未试玩本轮结果；完整 diff 待负责人复核。
- 变更与原因：创作者要求岛上树木“错落有致，类似真实雨林”，成为岛时看出是河心岛、旁边是更大的森林。新增 `project/vegetation/build_vegetation.py`：读取 8 个 Poly Haven CC0 扫描（3 种阔叶树、5 种林下植物），树干减面、去掉被叶子遮住的细枝，叶子换成从扫描本身渲染的叶簇卡片，并烘焙 8 方向 × 3 仰角的颜色与法线替身；两种树拉长主干作林冠树；输出到 `frontend/public/models/vegetation/`（约 11 MB）。新增 `frontend/src/vegetation.js`（加载、叶片透光、替身着色器、按距离交接）。`env.forest` 改为四层：噪声场成林与林窗、每层间距、小树多大树少、逐株倾斜胖瘦色差；50 m 内完整树每移动 5 m 重选，外侧替身，交接距离逐株不同；全岛替身每种树一次绘制。`env.understory` 改为扫描植物成片生长；`env.meadow` 加密、草叶更细。两岸改为替身树林线（河岸密、内陆疏、零星露生树），林冠面延伸约 2.6 km，按 300 m 分段、`bankTreeDistanceM`（2600 m）外不画。河道半宽 1150 → 640 m，三座邻岛横向坐标移入河道（150、-170、-120）。可魂穿雨林阔叶树的占位外形改用扫描林冠树，70 m 外换替身。林地落叶层降低饱和度。修正布景避让半径：碰撞盒是方的，避让圆改到盒角，否则加密后随机吉贝木棉全部在出生时被移除。浏览器检查改为 `?debug&render=0`（游戏照常运行、不绘制画面）：软件渲染下这片森林每帧需数秒，检查只读状态不读像素。
- 验证：macOS（Apple Silicon）、Python 3.9.6、Chrome 156：`python3 project/sync_runtime.py`；`python3 project/validate_docs.py` 通过 1767 项；`python3 project/check_all.py --output /tmp/btw-veg/checks` 通过文档检查与 135 项隔离 Chrome 浏览器检查；`python3 -m unittest discover -s project/tests` 14 项通过；`git diff --check` 通过。另用 GPU 无头 Chrome 截取鸟瞰、低空、林内、牛轭湖、河面与开局画面核对外观（仅本地 /tmp，未入库）；本机 GPU 开局画面约 150 万三角面、千余次绘制，其中地形约 38 万、可魂穿实体约 66 万、布景约 52 万。
- 未验证项 / 风险：目标设备（集成显卡笔记本）帧率未测；浏览器检查不再覆盖实际绘制，着色器编译错误只能靠截图或真人发现；软件渲染下单帧仍需数秒。扫描树原型是较矮的滨海树种，拉长主干后接近但不等于亚马逊林冠树；吉贝木棉与棕榈仍是程序占位；水面倒影、林间光束等参考图 2 的效果未做；岩丘占位巨岩仍突兀。团队共同确认待填写。回退时成组撤销本条的源码、数据、植被文件与文档，河道半宽回到 1150 m、邻岛回到原坐标。

## 2026-11-06 · 亚马逊河心岛、雨林三层树与昼夜季节

- 负责人：@yidi0522；关联：D-027、D-028、D-029，分支 `feat/amazon-river-island`，PR 待关联；取代未合并的 PR #4（上一版海岛地形）。
- AI：Claude（Claude Code）负责地形生成脚本（在本机 Blender 5.2.3 中经 MCP for Blender 运行）、前端地形／水／天空／雨林实现、数据迁移、文档与回归检查；人工复核：创作者在会话中试玩上一轮半成品，要求删去 V 键视角切换、夜晚变亮变短、昼夜与季节放慢、去掉松树改做雨林三层树；完整 diff 与真人试玩待负责人复核。
- 变更与原因：创作者要求主岛做成逼真的亚马逊河心岛，成为岛时看见大河与两岸雨林，而非星球与围成一圈的邻岛。主岛改由 `project/terrain/river_island.py` 程序生成 1 m 高度场与地表分层权重图（种子 20261106，含水力侵蚀；未描图、未调用付费生成），`terrain.js` 分块按距离降细节，五层 Poly Haven CC0 地表贴图按权重与明度混合；`water.js` 读取高度场画深浅、岸边泡沫与雨点涟漪；`banks.js` 生成两岸雨林；`sky.js` 实现昼夜（20 分钟、夜晚 20%、月光夜色）、雨季／旱季（80 分钟）、阵雨、河雾与萤火虫。海改为 `river` 水体与河道，邻岛沿河排列，岛只在河道内漂移；山湖改为牛轭湖（椭圆内仅湖床低于湖面处有水），鱼、鸟、林地与观察点按新地形重新摆放，海鸥抬高到林冠之上。松树改为阿萨伊棕榈，阔叶树改为 20 m 雨林阔叶树，新增 42 m 吉贝木棉；`env.forest` 布景树（树干为静态障碍）、`env.understory`、`env.reeds`、`env.fireflies` 新增为装饰槽。存档版本升到 5，避免旧海岛存档让实体悬空。验证器改为要求唯一 `river` 与河道，新增 W-09／W-10 与 QA-48～QA-50。移除松柏引文（不再适合棕榈）。新增地表贴图约 6.3 MB、高度场 2.5 MB、权重图 1.3 MB。
- 验证：macOS（Apple Silicon）、Python 3.9、Chrome（SwiftShader 软件渲染）：`python3 project/sync_runtime.py`；`python3 project/validate_docs.py` 通过 1762 项文档／数据检查；`python3 project/check_all.py` 结果见 PR 说明。另用无头 Chrome 截取开局、林地、吉贝木棉视角、岛屿视角、夜晚与雨天画面核对外观（仅本地，未入库）。
- 未验证项 / 风险：目标设备（普通笔记本）帧率未测，布景树与地表混合在集成显卡上的开销是主要风险，可调 `env.forest` 的 `drawDistanceM`、数量与 `env.understory` 数量；完整 20 分钟昼夜与 80 分钟季节未真人连续试玩；岩丘 70 m 占位巨岩在低平河心岛上显得突兀，未改；三种树均为程序占位；JS 语法检查需 Node，本机未安装；团队共同确认待填写。回退时成组撤销本条关联的源码、数据、生成文件、贴图与规则修改，存档版本回到 4。

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
