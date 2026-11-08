# 银斧鱼（LUX3D-fish_silver_01）游戏内证据

日期：2026-11-08。分支 `asset/fish-birds-v001` 提交前的工作区；macOS 14.8.7、Chrome 156 无头模式、SwiftShader 软件渲染，1600 × 900。通过调试接口（`?debug`）单次加载游戏并摆放身体与镜头，不是连续试玩录像。核对脚本：海鸥文件夹中的 `verify_ambient.py`；结果：`verify-ambient-result.json`（15 项全部通过）。

| 文件 | 内容 |
| --- | --- |
| `03-hatchetfish-school.jpg` | 以一条银斧鱼的视角看山湖：其余银斧鱼成群在水面下游动，远处有七彩神仙鱼 |

自动核对（与海鸥、七彩神仙鱼同一次加载）：12 条银斧鱼都使用 `fish_silver_01-v001.glb`；10 秒后全部离开出生点；60 秒内都在山湖水面与湖底之间；群体距中心最大 1.93 m；被玩家占据的那一条不再被航线带走。

未包含：完整 `check_browser.py` 回归（本机 Chrome 156 重新加载停住，见 CHANGELOG）；目标设备帧率；真人观感（QA-31～QA-34、QA-48 待人工验收）。
