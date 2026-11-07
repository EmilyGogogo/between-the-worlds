# 海鸥（LUX3D-bird_gull_01）游戏内证据

## v002 与环境移动（2026-11-08）

日期：2026-11-08。macOS 14.8.7、Chrome 156 无头、SwiftShader，1600 × 900；调试接口单次加载。脚本 `verify_ambient.py`，结果 `verify-ambient-result.json`（15 项全部通过）。

| 文件 | 内容 |
| --- | --- |
| `01-gull-low-pass-from-start.jpg` | 人在出生点，`gull-0` 正在低飞经过（右侧岩石后方） |
| `02-gull-flying-high.jpg` | 海鸥 v002 在草地上空飞行 |

自动核对：4 只海鸥都使用 `bird_gull_01-v002.glb` 且沿航线移动；60 秒内不低于地面 1.5 m、不与实心身体重叠；有扇翅（爬升）也有滑翔；`gull-0` 最低降到离地 2.50 m，低飞时人在出生点可选中并按 R 成为它；被占据时不被航线带走，离开后静止约 4 秒再归队。

## v001（2026-11-07）

日期：2026-11-07。分支 `asset/fish-birds-v001` 提交前的工作区；macOS 14.8.7、Chrome 156 无头模式、SwiftShader 软件渲染，1600 × 900。通过调试接口（`?debug`）摆放身体与镜头，不是连续试玩录像。脚本：`verify_gull.py`；结果：`verify-result.json`（14 项全部通过，游戏加载约 8–25 s）。

| 文件 | 内容 |
| --- | --- |
| `01-gull-glide-idle.jpg` | 成为海鸥后静止：滑翔姿态（idle=Glide） |
| `02-gull-flap-move.jpg` | 海鸥向前飞：扇翅动作上扬段（move=Flap） |
| `03-human-targets-gull.jpg` | 人看向海鸥，出现“成为海鸥”提示；可见海鸥与人的体型对比 |
| `04-gull-high-over-island.jpg` | 海鸥飞高后俯看主岛，提示“成为岛屿”（P-15） |

自动核对（`verify-result.json`）：8 只海鸥全部使用新模型；定标身高 0.65 m；idle／move 映射到 Glide／Flap 且随移动切换；碰撞盒随模型包围盒；抬头爬升、180 m 限高；高飞选中并成为岛；人选中并成为海鸥。

未包含：完整 `check_browser.py` 回归（本机 Chrome 156 在测试脚本 0.2 s 高频轮询下重新加载会停住，干净的 main 同样失败，见 CHANGELOG）；目标设备帧率；连续试玩录像；真人观感评审（QA-31～QA-34 仍待人工验收）。
