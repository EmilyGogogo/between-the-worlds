# 许可现状与来源记录

核对日期：2026-11-01。**当前仓库根目录没有项目级 `LICENSE`／`LICENSE.md`／`COPYING` 文件，尚未声明本项目的整体使用与分发许可。** 本文件仅记录许可现状、第三方依赖及素材来源，不是许可证，也不授予本项目代码、文档或资产的使用、修改、再分发或商业使用权限。

仓库中已有的 `frontend/vendor/LICENSE.three` 是 Three.js 的第三方 MIT 许可证，仅适用于其覆盖的第三方代码，不能据此将整个项目标为 MIT 或已开源授权。项目级许可证是否添加、采用何种条款，尚待项目权利人决定。

| 项目 | 当前事实 | 待办 |
| --- | --- | --- |
| 本项目代码、文档与项目自有资产 | 未设置项目级许可证；本文件不替代授权声明 | 项目权利人决定是否及如何授权；未确定前不填写 MIT 等项目许可标识 |
| Three.js 0.170.0（第三方依赖） | 自带 MIT 许可证；原文见 [LICENSE.three](../frontend/vendor/LICENSE.three)，不覆盖整个项目 | 分发相关第三方代码时保留其版权声明和许可文本 |
| 原型几何／纹理／环境声 | 由项目程序生成；来源见 `frontend/src/assets.js`、`frontend/src/world.js`、`frontend/src/audio.js`；尚未声明对外使用许可 | 随项目自有内容一并明确授权范围；程序生成不等于自动获得对外授权 |
| 世界回应文本 | 12 条拟用引文；古籍版本、外文中译与转述尚待逐字核对，当前出处见 [dialogue.json](../data/dialogue.json) | 逐条记录原著／译文版本、译者、出版信息与使用依据，核对活动条款；不以“单句引用”推定可发布；署名方案尚待确认 |
| 界面字体 | 使用系统字体栈；未随项目分发字体文件 | 若新增字体文件，记录授权 |
| Lux3D 模型 | 雨林植被（D-029）：吉贝木棉、林冠阔叶树、阿萨伊棕榈丛、林下灌丛，Lux3D 国内版 text-to-3d G1 生成（2026-11-08，纯文本提示词，无参考图），原件与记录在 `assets/lux3d/LUX3D-vegetation-rainforest/`，经 `project/vegetation/build_vegetation.py` 减面并烘焙替身后存于 `frontend/public/models/vegetation/` | 待核实 Lux3D 国内版用户协议与活动素材条款；任务号未留存，需按生成时间在 Lux3D 记录中核对 |
| 地表贴图（Poly Haven，CC0） | coast_sand_01、brown_mud_02、leafy_grass、mud_cracked_dry_03、forest_leaves_04 的 1K diffuse 与 OpenGL normal，取自 polyhaven.com（API 文件 2026-11-06），以 JPEG 质量 78 重新压缩，存于 `frontend/public/textures/ground/`；Poly Haven 资产以 CC0 发布 | 分发时保留来源记录；CC0 不要求署名 |
| 主岛地形高度场 | 由 `project/terrain/river_island.py` 程序生成，无外部输入素材 | 随项目自有内容一并明确授权范围 |
| 后续模型／纹理／录音／音乐 | 尚无新外部素材记录 | 每项入库前登记来源与许可，不以下载成功代表授权 |

资产事实见 [asset-ledger.csv](../data/asset-ledger.csv)，原型依赖说明见 [THIRD_PARTY.md](../frontend/THIRD_PARTY.md)。
