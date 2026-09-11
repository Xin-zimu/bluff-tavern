# Generated Asset Manifest

本清单记录依据根目录 `ART_ASSETS_PLAN.md` 生成、整理并通过验收的正式美术资产。

## 完成范围

- 计划中的正式资产集合已完成：105 / 105（首批核心 24 项、角色补充状态 56 项、第二批非角色 25 项；角色默认状态只计一次）。
- `images/` 中的原始参考图保持不变。
- 狼人已有表情图已复制到规范目录，未移动、未覆盖原图。
- 角色、道具、UI、特效均使用真实透明 Alpha；背景、桌面纹理、卡牌和应用图标按不透明成图保留。
- `*_final.png` 与下表路径是当前选定版本；目录里的 `v2`、`v3` 等文件是非破坏式生成过程中保留的草稿。

## 已选定资产

| ID | 用途 | 当前文件 |
| --- | --- | --- |
| BG01 | 游戏主场景 | `backgrounds/bg_01_tavern_v1.png` |
| BG02 | 大厅背景 | `backgrounds/bg_lobby.png` |
| TEX01 | 深胡桃木桌面纹理 | `textures/dark_walnut_table.png` |
| CARD01 | 卡背 | `cards/card_back.png` |
| CARD05 | Joker 牌面 | `cards/joker.png` |
| CHAR-WOLF | 狼人默认状态 | `characters/wolf/idle_final.png` |
| CHAR-FOX | 狐狸默认状态 | `characters/fox/idle_final.png` |
| CHAR-RABBIT | 兔子默认状态 | `characters/rabbit/idle_final.png` |
| CHAR-BEAR | 熊默认状态 | `characters/bear/idle_final.png` |
| CHAR-CAT | 猫默认状态 | `characters/cat/idle_final.png` |
| CHAR-FROG | 青蛙默认状态 | `characters/frog/idle_final.png` |
| CHAR-PANDA | 熊猫默认状态 | `characters/panda/idle_final.png` |
| CHAR-RACCOON | 浣熊默认状态 | `characters/raccoon/idle_final.png` |
| PROP01 | 左轮手枪 | `props/revolver-v3.png` |
| PROP02 | 左轮弹巢 | `props/revolver_cylinder_final.png` |
| PROP03 | 黄铜子弹 | `props/cartridge.png` |
| UI01 | 游戏徽章 | `ui/game_emblem.png` |
| UI03 | 默认头像框 | `ui/portrait_frame_final.png` |
| UI04 | 行动中头像框 | `ui/portrait_frame_active.png` |
| UI05 | 淘汰头像框 | `ui/portrait_frame_eliminated.png` |
| FX01 | 枪口火焰 | `effects/muzzle_flash_final.png` |
| FX02 | 空枪烟雾 | `effects/empty_shot_smoke.png` |
| FX03 | 翻牌星光 | `effects/card_reveal_sparkle.png` |
| APP01 | 应用图标 | `icons/app_icon.png` |

狼人已整理的完整八状态位于 `characters/wolf/`：`idle_final`、`suspicious`、`bluff`、`nervous`、`shocked`、`laugh`、`victory`、`eliminated`。

## 第二批非角色资产

| ID | 用途 | 当前文件 |
| --- | --- | --- |
| BG03 | 胜利结算场景 | `backgrounds/bg_victory.png` |
| TEX02 | 酒红呢绒纹理 | `textures/burgundy_felt.png` |
| CARD02 | A 牌面母版 | `cards/card_a_base.png` |
| CARD03 | K 牌面母版 | `cards/card_k_base.png` |
| CARD04 | Q 牌面母版 | `cards/card_q_base.png` |
| ITEM01 | 偷窥镜 | `items/spyglass.png` |
| ITEM02 | 换牌手套 | `items/swap_glove.png` |
| ITEM03 | 封口蜡印 | `items/wax_seal.png` |
| ITEM04 | 酒馆木杯 | `items/wooden_mug.png` |
| ITEM05 | 旧怀表 | `items/pocket_watch.png` |
| ITEM06 | 烟雾瓶 | `items/smoke_bottle.png` |
| EMOTE01 | 质疑 | `emotes/suspicious_eye.png` |
| EMOTE02 | 大笑 | `emotes/laugh_mask.png` |
| EMOTE03 | 冷汗 | `emotes/nervous_token.png` |
| EMOTE04 | 愤怒 | `emotes/angry_eyes.png` |
| EMOTE05 | 得意 | `emotes/smug_mask.png` |
| EMOTE06 | 震惊 | `emotes/shocked_mask.png` |
| EMOTE07 | 鼓掌 | `emotes/clap_paws.png` |
| EMOTE08 | 敬酒 / GG | `emotes/toast_mugs.png` |
| UI02 | 房间码铭牌 | `ui/room_code_plaque.png` |
| UI06 | 质疑按钮底板 | `ui/challenge_button_plate.png` |
| UI07 | 开始 / 主操作按钮底板 | `ui/play_button_plate.png` |
| FX04 | 质疑爆发光效 | `effects/challenge_burst.png` |
| FX05 | 胜利粒子 | `effects/victory_particles.png` |
| LOADING01 | Loading 场景 | `backgrounds/loading_screen.png` |

## 生成提示词组

全局美术约束：

> Dark whimsical tavern world populated by anthropomorphic animal characters, warm candlelight, deep walnut wood, burgundy leather, antique brass, premium painterly 2.5D indie game art, cinematic but readable, cohesive material rendering, no photorealism, no anime, no chibi, no copyrighted characters, no watermarks, no unintended text.

资产级约束：

- 背景：宽屏酒馆构图、中心舞台/桌面可读、边缘更暗、暖色实用光源、留出 UI 叠加空间。
- 角色：半身至胸像、三分之四视角、同一光源方向、鲜明轮廓和物种识别、深色酒馆服装、真实透明背景。
- 卡牌：竖向赌场卡牌比例、黄铜花丝与酒红/深木配色；Joker 使用原创动物小丑插画，不包含文字。
- 道具：古董黄铜与深钢材质、游戏道具可读性、单体构图、真实透明背景。
- UI：黄铜、暗红珐琅、木纹和柔和暖光；无文字；透明背景。
- 特效：短时、高对比、适合叠加在深色场景；火花、烟雾和星光均为真实透明背景。
- 图标：方形、中心化、缩小后仍清晰的酒馆徽章构图，不含文字。

参考图角色：

- `source/wolf_suspicious_reference.png`：狼人脸型、服装、材质和暖色侧光。
- `source/fox_expression_reference.png`：狐狸形象与整组角色的表情语言、笔触和造型密度。
- `backgrounds/bg_01_tavern_v1.png`：世界配色、木材、黄铜、酒红与环境照明。

## 验收记录

- 正式文件存在性：105 / 105 通过。
- 最终角色图：64 / 64 使用 32 位 RGBA，透明背景通过。
- 正式透明资产总数：93；全部为 32 位 RGBA 且背景采样 Alpha 为 0。其中 91 张四角全透明；`characters/bear/laugh.png` 与 `characters/panda/victory.png` 的主体服装占据右下角，已人工复核为有效前景而非背景残留。
- 母版保留为 PNG；Web 端只复制当前页面实际使用的资源，卡牌 A/K/Q、烟雾瓶、表情、酒红呢绒与 Loading 暂不进入运行时包。

## Web 端接入

- 首页：正式游戏徽章与酒馆主场景。
- 大厅：大厅背景、8 名角色选择、头像框、房间码铭牌和主操作按钮底板。
- 游戏：木桌纹理、Joker、角色默认/淘汰/胜利立绘、行动/淘汰头像框、5 种道具图标、质疑按钮及爆发光效。
- 结算：胜利场景、胜利粒子与获胜角色立绘。
- `apps/web/public/assets/` 当前包含 44 张实际运行时图片；高分辨率母版完整保留在 `assets/`。

## 第二阶段开发进度

风格已由用户确认，第二阶段角色工作已完成：

- 灰狼、赤狐、白兔、棕熊、黑猫、青蛙、熊猫、浣熊：每名角色 8 个状态全部完成，共 64 张最终角色图。
- 七名非狼人角色共新生成 49 张情绪差分，均使用各自 `idle_final.png` 作为身份参考。
- 每套状态统一为 `idle_final`、`suspicious`、`bluff`、`shocked`、`laugh`、`nervous`、`eliminated`、`victory`。
- 64 / 64 张最终角色图通过 32 位 RGBA 与角点 Alpha 验收；生图过程中出现的伪棋盘格版本只作为 `*-v1.png`、`*-magenta.png`、`*-black.png` 中间稿保留。
- Web 首页已使用正式游戏徽章；大厅已接入大厅背景、角色缩略图和头像框。
- 游戏牌桌已接入木桌纹理、角色头像、当前回合/淘汰头像框和 Joker 牌面。
- 八名角色都会在游戏淘汰和胜利状态自动切换对应立绘；发布目录中的 `idle`、`eliminated`、`victory` 共 24 / 24 张运行时角色图齐全。

第二阶段剩余场景、卡牌、道具、表情、UI、特效与 Loading 已全部完成；后续工作转为按功能开发节奏接入表情系统、牌面母版和 Loading 状态，并在发布前统一制作轻量 Web 导出。
