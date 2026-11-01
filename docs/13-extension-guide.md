# 扩展指南：加模型、加种类、加类别、加互动

版本：0.4-review · 2026-11-01。规则：G-08、W-08、L-04、L-07、X-01～X-04。

这份文档回答一个问题：**以后往世界里加东西，要改哪里。** 原则是能只改 `data/` 就只改数据；改完运行同步脚本，玩法代码不用动。

```text
改 data/ → python3 project/sync_runtime.py → python3 project/validate_docs.py → 刷新游戏
```

不要手改 `frontend/public/config/game.json` 和 `frontend/public/models/manifest.json`，这两个文件由脚本生成。

## 一览

| 想做的事 | 改哪里 | 要不要改代码 |
| --- | --- | --- |
| 给已有种类换一个更精细的模型 | `entities.json` → 该种类的 `asset.url` | 不用 |
| 同一种类挂多个模型，让个体各不相同 | `asset.variants` | 不用 |
| 远处用简化模型 | `asset.lod`（变体也可以各有各的 `lod`） | 不用 |
| 换成片草地、湖底卵石的模型 | `environmentSlots` → `env.meadow`／`env.pebbles` 的 `url`／`variants` | 不用 |
| 新增一种成片装饰（如灌木丛、落叶） | `environmentSlots` 加一个带 `scatter` 的槽 | 不用 |
| 在世界里多放几个个体、多一片树林 | `anchors.json` → `instances` 或 `scatter` | 不用 |
| 新增一个种类（苍鹭、柴犬、珊瑚鱼……） | `python3 project/new_species.py`，再调数值 | 不用 |
| 给新种类配一句哲学原句 | `dialogue.json` | 不用 |
| 新增一条互动（如狗靠近时鸟群飞起） | `interactions.json`，用已有效果 | 不用 |
| 新增一种互动效果（如花朵合拢） | `frontend/src/interactions.js` 的 `EFFECTS` 加一个函数 | 加一个函数 |
| 新增一种声音（如狗叫） | `frontend/src/audio.js` 的 `CUES` 加一个函数，类别的 `soundCue` 指向它 | 加一个函数 |
| 新增一个类别（房屋、花……） | `categories` 登记，09 写决策；需要新占位外形时注册生成器 | 可能加一个函数 |

## 1. 模型：一个、多个、远景

每个种类的资产槽在 `data/entities.json` → `entities[].asset`。字段说明见 [06](06-lux3d-asset-pipeline.md)。

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
- 每个个体按自己的 ID 分到一个模型，增删其他个体不会让它换模型；刷新后外形不变。
- `lod` 是远景简化模型：离镜头超过 `distance` 米时换上。动作只在近处模型上播放。
- 任何一个文件加载失败或超时，只有那一个回到占位，其他模型照常（L-03）。

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

**区域**（`regions`）：湖、湖岸等椭圆区域，供布景避开或限定（`avoidRegions`／`insideRegion`）。湖的水面高度也来自这里。

## 3. 新增种类

已有类别下的新种类，用脚本从一个相近的种类复制：

```sh
python3 project/new_species.py --from bird_gull_01 --id bird_heron_01 --name 苍鹭 --kind heron --count 3
```

脚本会：

- 复制种类配置，新建空的资产槽 `slot.heron`（占位外形沿用鸟类）；
- 保持尺度关系：苍鹭能进入海鸥能进入的存在，能进入海鸥的存在也能进入苍鹭；
- 在第一只海鸥旁边放 3 只苍鹭（一个 `scatter` 组）；
- 在资产台账加占位行与计划行。

然后按需调整：速度、身高、镜头、栖息地（改 `scatter` 的位置）、`placeholderStyle`、在 `dialogue.json` 加一句原句。同一类别的种类共享独特能力，区别在外形、动作、节奏和栖息地（G-01）。运行同步与校验脚本即可，不用改代码。

## 4. 新增类别

新类别（例如房屋、花）属于范围变更（G-04），步骤：

1. 在 09 写决策（D-xxx），说明独特能力、尺度层、魂穿关系、资产与验收成本。
2. 在 `entities.json` 的 `categories` 登记：`name`、`isAnimal`、`placeholder`（占位生成器名）、`soundCue`（可为空）、`release`（新版本号）、`decision`（D-xxx）。校验脚本会检查这个决策确实存在。
3. 加至少一个种类（第 3 节的脚本，`--from` 选一个最接近的），改 `category` 和尺度关系。
4. 占位外形：没有生成器时游戏会显示一个按身高、半径缩放的灰色胶囊，可以直接用；想要更像样的占位，在 `frontend/src/assets.js` 的 `PLACEHOLDERS` 加一个函数。最终会被 Lux3D 模型替换。
5. 如果是动物，写感知档案（B-04）。

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

互动遵守 X-01、X-02：没有文字和分数，回应结束后一切回到原处。

## 6. 新增声音

类别的 `soundCue` 决定这类存在发出什么声音：环境中最近的发声者会偶尔被听到（狗听得更远），`call` 效果也用它。新声音在 `frontend/src/audio.js` 的 `CUES` 加一个合成函数；以后换成录音时，同样在这里登记，并在资产台账记录来源与授权。

## 改完之后

1. `python3 project/sync_runtime.py`
2. `python3 project/validate_docs.py`：检查 ID、引用、尺度关系、布局、互动、资产文件是否存在。
3. `python3 frontend/tests/check_browser.py --port … --url http://127.0.0.1:4173/`：浏览器自动检查。
4. 进游戏看一看，并按 [08](08-qa-acceptance.md) 的对应条目验收。
5. 在 CHANGELOG 记录；资产按事实写进台账。
