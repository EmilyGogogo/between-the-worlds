# 项目协作约定

先阅读 `docs/README.md`，再阅读本次改动涉及的规范。优先文件为 `docs/01-global-rules.md`、`docs/03-possession-spec.md`、`docs/04-entity-catalog.md`、`docs/08-qa-acceptance.md`。

- 后续迭代以当前规范及创作者最新明确指示为准。旧十四种实体原型的行为不是 Demo 范围依据。
- MUST 的修改遵循用户要求的团队共同确认，并在 `docs/09-decisions.md` 留记录；未确认的建议标为待评审，不静默实施。用户在会话中明确授权的修改照常推进并记录，不重复索要同一授权。
- TUNABLE 调整同步其唯一源配置、范围内的试玩证据与变更记录；改变能力开关或扩大范围不算单纯调参。
- DEFERRED 内容不进入本次提交路径；新想法登记到 `DEFERRED.md`。
- 改功能时同步对应数据、文档、QA 和任务状态。只做文档 review 时，不擅自重构游戏。
- 根目录 `data/` 经 `project/sync_runtime.py` 生成前端配置，除 `anchors.json` 外已接入运行时（见 `docs/11-prototype-audit.md`）；改动仍需进游戏验证后才能声称已改变游戏。代码变更后运行 `frontend/tests/check_browser.py`。不要手改生成的 `frontend/public/config/game.json` 与 `frontend/public/models/manifest.json`。
- Lux3D 来源、生成过程、许可和验收必须按事实记录，不把计划、占位模型或历史测试当作真实产物与新验收。
- 文档／设计数据变更后运行 `python3 project/validate_docs.py`；代码变更另运行与影响范围相符的测试。
