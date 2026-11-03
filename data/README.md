# 设计数据说明

版本：0.4-review · 2026-11-01。规则源为 `docs/01-global-rules.md`；方案的评审状态见 `docs/09-decisions.md`。

| 文件 | 权威内容 | 运行时接入 |
| --- | --- | --- |
| entities.json | 全部身体种类：尺度层、尺度档（推导魂穿关系）、移动、能力、感知档案、碰撞、镜头、资产槽；另有尺度档表与环境资产槽 | integrated |
| input-map.json | 键位、保留的 E、已删除的 Space／Ctrl、过渡中的输入规则 | integrated |
| tuning.json | 可调初值、范围、单位、对应规则与硬约束 | integrated |
| dialogue.json | 世界回应正文、来源、触发与冷却 | integrated |
| anchors.json | 世界布局：72 个具名个体、10 组成片布景、区域与锚点 | integrated |
| interactions.json | 互动规则：触发、过滤、效果 | integrated |
| asset-ledger.csv | 每个资产槽的占位行与计划行；真实产物的来源证据 | 文档台账，不是加载清单 |

## 怎么改

1. 改 `data/` 中的唯一来源。
2. 运行 `python3 project/sync_runtime.py`，生成 `frontend/public/config/game.json` 与 `frontend/public/models/manifest.json`。**不要手改这两个生成文件。**
3. 运行 `python3 project/validate_docs.py` 检查引用、关系、范围与证据。
4. 运行 `python3 project/check_all.py` 并进游戏执行受影响 QA；校验通过不等于玩法通过。

## 字段原则

- 稳定 ID 不随中文名或模型版本改变。`entities[].id` 是种类，`anchors.instances[].id` 是个体，`asset.slotId` 是资产槽。
- `stage` 是渲染尺度层（0 近地、1 身体、2 地貌、3 岛屿），只管镜头、雾、光照和细节隐藏。每层的具体设置在 `scaleLayers`（镜头前视比例、是否贴地与避障、雾浓度、太阳与阴影、焦点高度、进入时的最小俯角），字段含义写在 `scaleLayerFields`；运行时代码不按层号写死数值，新增一层只加数据。目标遮挡检查按 P-02 对所有尺度强制执行，不属于可关闭的渲染设置。
- `body.limbSwingRate`：有四肢的占位模型（人、狗）走动时的摆动速率（弧度／秒）；没有时不摆动。
- `activityRegion`：飞行身体所在的空域，指向 `anchors.json` 中带 `center`、`radius`、`maxY`、`minClearanceM` 的区域；高度上限与 `tuning.json` 的 `flightCeilingM` 一致。新增会飞的种类只需指向一个空域。
- `scaleTier` 是魂穿尺度档（`scaleTiers` 中的 S1～S5），魂穿关系由它推导：只能进入本档与相邻档（P-12，D-021），不再手写 `allowedTargets`。`scaleTiers[].referenceSizeM` 是归档参考（身高与体长／翼展取大），超出时写 `scaleTierReason`；`viewLiftEyeHeightM` 是视点抬升阈值（P-15、P-16）。个别例外写 `relationOverrides: {"allow": [...], "deny": [...], "decision": "D-xxx"}`。运行时仍要检查可见、距离、遮挡和准备状态。
- `verticalControl`：`none` 或 `view_direction`（随镜头俯仰升降）。没有跳跃和升降键字段。
- `collision.solid` 与 `collision.passPolicy`：`go_around`（必须绕行）或 `yield_with_bend`（可以经过但弯折）。
- `perception.vision` 与 `perception.hearing` 是感知档案；`basis` 写明是参照、艺术表达还是尺度音景，`reviewState` 写明是创作者指定还是方案。
- `asset.status`：`placeholder` → `generated` → `edited` → `integrated` → `accepted`。`asset.lux3dUsed` 只有在真实产物进入槽后才改为 `true`，并且台账要有证据。
- `_meta.reviewState` 与 `ruleClass`、`implementationStatus` 互相独立；`MUST` 不等于已实现。
- 数值用 JSON 数字，距离米、时间秒；角度按字段合同填写，FOV／转向速度使用度，资产 `rotation` 使用弧度。

`runtimeBinding: integrated` 表示这个文件有运行时入口，不表示每个字段均已执行。`uniqueAbility.text`、评审与实现状态是文档元数据；`acceleration`、`turnSpeedDegPerSec`、`observationRange` 当前未导出到运行配置；部分回应阈值仍有硬编码。修改这些字段不能声称已经改变游戏，绑定缺口见 [11](../docs/11-prototype-audit.md)。

`tuning.parameters` 中 `runtimeBinding: not_integrated` 的参数是待接入目标，`planning_only` 是排期／性能目标，都不能作为已生效的调参入口。`collisionSkinM` 已同时接入世界与承载体坐标的碰撞盒。水下低通唯一来源为各身体的 `perception.hearing.underwaterLowpassHz`（当前均为 360 Hz）；已删除未生效的全局 600 Hz 重复项，实际声音数值未改变。

CSV 为 UTF-8 BOM。计划行中的生成日期、原文件、输入、授权与证据为空，表示尚未发生，不是可以事后补造的遗漏。

## 扩展入口

| 想做的事 | 改哪里 | 要不要改代码 |
| --- | --- | --- |
| 给已有种类换一个更精细的模型 | `entities.json` → 该种类的 `asset.url` | 不用 |
| 同一种类挂多个模型，让个体各不相同 | `asset.variants` | 不用 |
| 远处用简化模型 | `asset.lod`（变体也可以各有各的 `lod`） | 不用 |
| 换成片草地、湖底卵石的模型 | `environmentSlots` → `env.meadow`／`env.pebbles` 的 `url`／`variants` | 不用 |
| 新增一种成片装饰（如灌木丛、落叶） | `environmentSlots` 加一个带 `scatter` 的槽 | 不用 |
| 在世界里多放几个个体、多一片树林 | `anchors.json` → `instances` 或 `scatter` | 不用 |
| 新增一个种类（苍鹭、柴犬、珊瑚鱼……） | `python3 project/new_species.py`（可用 `--tier` 指定尺度档），再调数值 | 不用 |
| 新增一个尺度档（更小的微观档、比岛更大的档） | `entities.json` → `scaleTiers` 按大小顺序插入；09 写决策 | 不用 |
| 给新种类配一句哲学原句 | `dialogue.json` | 不用 |
| 新增一条互动（如狗靠近时鸟群飞起） | `interactions.json`，用已有效果 | 不用 |
| 新增一种互动效果（如新的避让动作） | `frontend/src/interactions.js` 的 `EFFECTS` 登记，数据声明并验证边界 | 需要实现与测试 |
| 新增一种声音（如狗叫） | `frontend/src/audio.js` 的 `CUES` 加一个函数，类别的 `soundCue` 指向它 | 加一个函数 |
| 新增一个类别（房屋、花……） | `categories` 登记，09 写决策；需要新占位外形时注册生成器 | 可能加一个函数 |

## 1. 模型：一个、多个、远景

每个种类的资产槽在 `data/entities.json` → `entities[].asset`。字段说明见 [06](../docs/06-lux3d-asset-pipeline.md)。

```json
"asset": {
  "slotId": "slot.gull",
  "status": "integrated",
  "url": "./public/models/gull-a.glb",
  "height": 0.65,
  "animations": { "idle": "Glide", "move": "Flap" },
  "variants": [
    "./public/models/gull-b.glb",
    { "url": "./public/models/gull-young.glb", "height": 0.5, "weight": 0.5 }
  ],
  "lod": [
    { "url": "./public/models/gull-far.glb", "distance": 60 }
  ]
}
```

- `url` 是第一个模型，`variants` 是更多模型。变体可以只写路径，也可以写成对象，单独覆盖 `height`、`rotation`、`animations`、`collisionBoxes`、`lod`，`weight` 是出现的相对比例（默认 1）。
- 模型列表、权重、加载成功集合和实例 ID 不变时分配稳定；增删其他个体不会让它换模型。改列表／权重或发生加载失败会重新分配，不能保证仍是同一外形。
- `lod` 是远景简化模型：离镜头超过 `distance` 米时换上。动作只在近处模型上播放。
- 当前降级以变体为单位：其主文件或任一 LOD 加载失败／超时，整个变体从候选集合移除；个体从剩余成功变体重新分配，全部失败才用程序占位。不会只把失败的 LOD 局部换成占位。该行为与理想的独立 LOD 降级有差距，见 TASK-ASSET-SLOTS。

## 2. 布局：个体与成片布景

`data/anchors.json` 是世界布局的唯一来源，游戏启动时读取。

**个体**（`instances`）：有名字、会被特别安排的存在，例如起点的草、第一只狗、邻岛。

```json
{ "id": "dog-shore", "type": "dog_01", "carrier": "island-main", "position": [290, 0, 118], "placement": "surface" }
```

- `carrier`：站在谁身上。主岛 `island-main`、邻岛 `island-0`、巨岩 `boulder-main`，或 `ocean`（只用于岛）。承载者必须写在它前面。
- `placement`：`surface` 贴在承载者表面，`position[1]` 是离表面的高度（鸟可以写 16）；`fixed` 用 `position[1]` 作为固定高度（水里的鱼）；`sea` 浮在海面（岛）。
- 岛或巨岩移动时，站在上面的一切跟着移动（W-06）。

**成片布景**（`scatter`）：一片树林、一群石头。随机生成的个体如果与实心物体重叠，会在出生时被移除（M-01）。

```json
{ "id": "birch-grove", "type": "tree_birch_01", "carrier": "island-main", "placement": "surface",
  "seed": 3001, "count": 15, "area": { "center": [60, -20], "size": [80, 60] },
  "surfaceMin": 8, "avoidRegions": ["lake_shore"] }
```

也可以用 `points` 直接列坐标：`[x, z]` 贴表面，`[x, y, z]` 带高度。生成的个体 ID 是 `组名-序号`。

**区域**（`regions`）：湖、湖岸、空域等区域，供布景避开或限定（`avoidRegions`／`insideRegion`），也定义活动区。

**水体**：带 `water` 字段的区域就是水体，代码不按名字认湖。两种类型：

- `"type": "enclosed"`（湖、池塘）：椭圆区域（`shape`、`center`、`radii`）内的平静水面，`surfaceY` 是水面高度（岛的局部坐标），`opacity` 是水面不透明度；可选 `basin: {"depthM", "falloffM": [x, z]}` 让程序占位地形在此挖出湖盆（换成 GLB 地形后湖盆由模型提供）。
- `"type": "sea"`：全局只能有一个，`levelM` 是海平面高度，`minDepthM` 是算作水体的最浅深度；海面随星球曲率弯曲。

游泳身体的活动区、水面渲染、镜头是否在水下、岛面拾取都读这些数据。新增一个湖只需在 `regions` 加一个带 `water` 的区域；之后仍要验证鱼的活动边界、出生点、布景和湖盆深度是否让鱼游得开（鱼需要水深超过身高 1.2 倍）。

## 3. 新增种类

已有类别下的新种类，用脚本从一个相近的种类复制：

```sh
python3 project/new_species.py --from bird_gull_01 --id bird_heron_01 --name 苍鹭 --kind heron --count 3
```

脚本会：

- 复制种类配置，新建空的资产槽 `slot.heron`（占位外形沿用鸟类）；
- 沿用海鸥的尺度档（或用 `--tier S2` 指定），魂穿关系随档位自动得到，不改其他种类；
- 在第一只海鸥旁边放 3 只苍鹭（一个 `scatter` 组）；
- 在资产台账加占位行与计划行。

先用相同命令加 `--dry-run` 查看草案；实际执行会写三个共享数据文件，按 [共享文件集成约定](../CONTRIBUTING.md#共享文件与集成) 协调负责人。然后调整速度、身高、镜头、栖息地、`placeholderStyle`，在 `dialogue.json` 添加经核对的候选。同类别种类复用独特能力（G-01），无需新增玩法代码，但仍需同步 04、05／数据说明、QA-01 等处列出的种类名单；浏览器测试不写死种类数量，而是检查每个配置的类别都有种类、每个种类都有个体，不能把原有覆盖删掉来通过 CI。仅新增种类不会自动实现新的独特能力。

## 4. 新增类别

新类别（例如房屋、花）属于范围变更（G-04），步骤：

1. 先按 01 和 DEFERRED 完成范围变更确认，再在 09 写已批准的决定（D-xxx），说明独特能力、尺度层、尺度档、资产与验收成本。仅新增一个待评审编号不构成授权。
2. 在 `entities.json` 的 `categories` 登记：`name`、`isAnimal`、`placeholder`（占位生成器名）、`soundCue`（可为空）、`release`（新版本号）、`decision`（D-xxx）。校验脚本会检查这个决策确实存在。
3. 加至少一个种类（第 3 节的脚本，`--from` 选一个最接近的，`--tier` 选尺度档），改 `category`。魂穿关系由尺度档推导；若该类别放进新的尺度档，`validate_docs.py` 会要求每座岛在该档也有落脚点（W-05）。
4. 占位外形：没有生成器时游戏会显示一个按身高、半径缩放的灰色胶囊，可以直接用；想要更像样的占位，在 `frontend/src/assets.js` 的 `PLACEHOLDERS` 加一个函数。最终会被 Lux3D 模型替换。
5. 所有类别都配置感知参数；动物还须满足 B-04 的视觉／听觉差异与 idle／move 动作要求。`isAnimal` 不决定是否存在感知档案。

## 5. 新增互动

互动写在 `data/interactions.json`。每条是“谁做了什么 → 谁怎样回应”：

```json
{ "id": "IX-DOG-BIRDS", "description": "狗跑近时鸟群飞起",
  "trigger": { "type": "proximity", "radius": 9 },
  "subject": { "categories": ["dog"] },
  "target": { "categories": ["bird"] },
  "effect": { "type": "flee", "speed": 8, "rise": 0.8, "duration": 2.5, "returnAfter": 12 },
  "cooldownSec": 20, "reviewState": "proposed", "rules": ["X-01", "X-02"] }
```

- **触发** `trigger.type`：`proximity`（玩家的身体靠近）、`focus`（看着它、出现涟漪一段时间）、`possess`（刚成为它）。
- **过滤** `subject`／`target`：按 `categories`、`types`（种类 ID）、`modes`（ground／fly／swim／island）、`solid`；省略表示不限。
- **效果**：`bend`（弯折让开）、`flee`（避开再回来）、`call`（发出声音，从它的方向传来）。
- 新效果：在 `interactions.js` 的 `EFFECTS` 加一项（`apply` 每帧连续生效，`start` 触发时执行，`update` 持续到返回 `false`），再在 `interactions.json` 的 `effects` 写说明。校验脚本会检查二者一致。

互动遵守 X-01、X-02：没有文字和分数，遵守碰撞与活动区且回应后返回。`reviewState: proposed` 仅是评审元数据，生成器不会据此禁用规则；上面的 JSON 是说明示例，不可直接把未批准玩法写入可交付数据。

## 6. 新增声音

类别的 `soundCue` 决定这类存在发出什么声音：环境中最近的发声者会偶尔被听到（狗听得更远），`call` 效果也用它。新声音在 `frontend/src/audio.js` 的 `CUES` 加一个合成函数；以后换成录音时，同样在这里登记，并在资产台账记录来源与授权。

扩展后执行上面的“怎么改”流程，并按 [QA 清单](../docs/08-qa-acceptance.md) 验证受影响项目；资产来源按事实写入台账，每次修改同步 [CHANGELOG](../project/CHANGELOG.md)。
