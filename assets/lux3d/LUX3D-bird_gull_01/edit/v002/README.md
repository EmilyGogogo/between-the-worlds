# 海鸥修整记录 v002（卡通版）

日期：2026-11-08。工具：Blender 4.5.15 LTS。执行：Claude Code，后台命令：

```sh
blender -b -P rig_gull_v2.py -- ../../raw/v002/textured.glb <out_dir> bird_gull_01-v002 20000
```

`rig_gull_v2.py` 在 v001 脚本基础上新增“自动转向”：取俯视主方向（翼展）对齐左右轴，再以“头窄、尾扇宽”判定前后，使头朝 glTF -Z。用 v001 原件复跑得到 188.76°，与 v001 的 180° 手工转向一致（差值为同一步的细调），以此检验该判定。其余步骤同 v001（放平、减面、定标、10 根骨骼、位置权重、Glide／Flap 动作、JPEG 内嵌导出），数值见 `report.json`：

- 转向 228.88°，放平 22.77°；146,242 → 20,000 三角面（L-06 ≤ 3 万）。
- 定标身高 0.65 m：翼展 2.20 m、体长 1.67 m（v001 为 2.84 m 翼展；体型偏大的问题同 v001，见 CHANGELOG）。
- 动作：`Glide`（idle，2.0 s）、`Flap`（move，0.67 s）。

文件：`bird_gull_01-v002.blend`（压缩保存）、`rig_gull_v2.py`、`render_anim.py`、`report.json`、`previews/rig-and-animation-frames.png`。
已知问题：权重为程序计算，翅根大幅扇动处可能拉伸；原件为扇翅中段姿态，静止姿态保留该翼型。
