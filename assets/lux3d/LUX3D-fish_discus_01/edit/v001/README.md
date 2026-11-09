# 七彩神仙鱼修整记录 v001

日期：2026-11-08。工具：Blender 4.5.15 LTS。执行：Claude Code，后台命令：

```sh
blender -b -P rig_fish.py -- ../../raw/v001/textured.glb <out_dir> fish_discus_01-v001 29000 0.45
```

`rig_fish.py`（鱼类通用）步骤，数值见 `report.json`：

1. 转向：俯视主方向（体长）对齐前后轴；尾端（尾鳍）比头端薄，以此判定前后，使头朝 glTF -Z。本件转向 269.87°。
2. 减面：273990 → 29000 三角面。减面到 8,000 与 15,000 时腹部出现贴图白斑（坍缩减面破坏 UV 接缝），30,000 消失，选 29,000（不超过 L-06 动物 3 万）。
3. 定标：身高 0.45 m（`body.height`），原点底部中心；结果 长 0.495 × 高 0.450 × 宽 0.208 m。
4. 骨骼（rigSource=blender）：head → spine1 → spine2 → tail 4 根，沿体长中线；权重按体长平滑过渡。
5. 动作（24 fps，循环）：`Swim`（idle，40 帧 / 1.67 s，幅度 0.55 倍）与 `SwimFast`（move，16 帧 / 0.67 s），由头到尾递增、相位后移的左右摆动（头 3°、躯干 5°／9°、尾 16°）。
6. 导出 GLB：NLA 轨道动画、蒙皮，贴图 JPEG 内嵌，无 Draco／Meshopt／KTX2。

文件：`fish_discus_01-v001.blend`（压缩保存）、`rig_fish.py`、`render_fish.py`、`report.json`、`previews/`（静止侧视、快游俯视两帧）。
已知问题：鳍没有单独骨骼，随所在躯干段摆动；摆动为程序动作，观感待真人查看。
