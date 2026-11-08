# 海鸥修整记录 v001

日期：2026-11-07。工具：Blender 4.5.15 LTS（macOS arm64，官方 DMG，SHA-256 已核对）。执行：Claude Code，后台命令：

```sh
blender -b -P rig_gull.py -- ../../raw/v001/textured.glb <out_dir>
```

`rig_gull.py` 一次完成以下步骤，数值见 `report.json`：

1. 朝向：绕竖直轴旋转 180°，头朝 glTF -Z（L-05）。
2. 放平：取身体中线（排除翅膀和下垂的脚）的主方向，绕左右轴修正 17.48°。
3. 减面：Decimate（Collapse）从 355,008 降到 24,000 三角面（L-06 动物 ≤ 3 万）；贴图保持 2048。
4. 定标：等比缩放到身高 0.65 m（`body.height`），原点在底部中心。结果翼展 2.84 m、体长 1.96 m（见下方“已知问题”）。
5. 骨架（rigSource=blender，非 Aholo 绑骨）：body、neck、head、tail，左右各 wing1/wing2/wing3，共 10 根；关节位置按网格实测（肩部按翅膀厚度突变处定位）。
6. 权重：按顶点位置计算的平滑权重（身体 → 翅根渐变、翅膀三段沿翼展渐变、头颈尾沿体长渐变），未使用自动热扩散权重。
7. 动作（24 fps，循环）：
   - `Glide`（idle，48 帧 / 2.0 s）：翅膀 ±3° 起伏，尾与头轻摆。
   - `Flap`（move，16 帧 / 0.67 s）：肩 +38° ~ -34° 扇动，前臂与翼尖延迟弯折，下扑时身体微升。
8. 导出 GLB：`export_animation_mode=NLA_TRACKS`，蒙皮与动画导出，贴图转 JPEG（质量 88）内嵌，未用 Draco／Meshopt／KTX2。

文件：`bird_gull_01-v001.blend` 已于 2026-11-08 从仓库移除（v001 未被采用；可用 `rig_gull.py` 从 `../../raw/v001/textured.glb` 重新生成）、`rig_gull.py`、`render_anim.py`（静止与动作帧渲染）、`report.json`、`previews/rig-and-animation-frames.png`。

已知问题：
- 体型偏大：按现有 `body.height` 0.65 m 定标后翼展约 2.84 m，与现有占位碰撞盒（宽 2.8 m）一致，但约为真实海鸥（约 1.3–1.5 m）的两倍，也与 `scaleTierReason`“翼展略超 1 m”不符。是否调小 `body.height` 属 TUNABLE 数值调整，需试玩记录，待负责人决定。
- 原件姿态为扇翅中段，翅膀略上扬；静止姿态保留该翼型，未手工重塑。
- 权重为程序计算，翅根与身体交界在大幅扇动时可能有轻微拉伸，需近距离真人查看。
