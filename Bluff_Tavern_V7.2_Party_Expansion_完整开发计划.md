# 《诡牌酒馆 / Bluff Tavern》V7.2 Party Expansion 完整开发计划

> 基线版本：V7.1.6  
> 目标版本：V7.2.x  
> 版本主题：**Party Expansion / 酒馆乱斗扩展**  
> 开发原则：**先稳定、后扩展；服务器权威；一轮一个事件；一句话能讲清；不增加复杂角色技能；不破坏 V7.1.6 已稳定的翻牌与电影化流程。**

---

# 0. 文档目的

V7.1.6 已完成并稳定：

- Classic / Quick / Escalation / Shared Revolver / Free Challenge / Party
- V7 道具、酒馆事件、角色能力开关
- 服务端权威状态机
- 断线重连
- PWA
- V7.1.6 Reveal 稳定结构：
  - `REVEAL` 使用 3D 动画牌
  - `VERDICT / PUNISHMENT_* / ROUND_END` 使用静态正面牌

V7.2 不增加新的主模式。唯一主线目标是：

> **把 Party 从“每轮随机一个事件”提升为真正具有重复游玩价值、适合朋友聚会、规则变化明显但学习成本仍然很低的完整模式。**

同时在新增事件前，对模式规则代码做一次受控的小型整理，为 V7.3 Custom Rules 做准备。

---

# 1. V7.2 核心体验

标准流程：

```text
新一轮开始
↓
服务器抽取本轮 Party Event
↓
ROUND_START 显示约 2～3 秒事件开场卡
↓
玩家立即知道“这一轮有什么不同”
↓
进入正常 TURN
↓
事件规则只作用于当前轮
↓
本轮结束
↓
下一轮重新抽取事件
```

核心约束：

```text
一轮
=
一个 Party Event
=
一个核心规则变化
=
一句话可以解释
```

---

# 2. 明确不做

V7.2 不做：

- 新的第七种主模式
- 新角色
- 复杂主动技能
- 技能 CD / 连锁 / 反制 / 资源条
- 正式开放 Custom Rules
- 自由组合特殊模式
- 好友 / 匹配 / 账号 / 排行榜 / 商店 / 货币 / 赛季
- 自由文字聊天
- 重做 Lobby
- 重写 GameService
- 重写 Reveal / Cinematic

特别禁止重新破坏：

```text
REVEAL = 3D 动画牌
VERDICT / PUNISHMENT / ROUND_END = 静态正面牌
```

---

# 3. 版本拆分

```text
V7.2.0  Rule Foundation
        ModeRules 小型整理
        Party Event Registry
        maximumPlayCount

V7.2.1  Party Event Intro
        回合事件开场卡
        当前事件 HUD

V7.2.2  Party Expansion A
        ONE_CARD_ONLY
        MATCH_BET

V7.2.3  Party Expansion B
        HEAVY_HAND
        LAST_CALL
        权重随机
        最近事件防重复

V7.2.4  Party UX Polish
        事件历史
        Lobby Party 详情
        规则提示
        Mobile / Desktop 收口

V7.2.5  Release Candidate
        Compatibility
        Reconnect
        Regression
        Manual Playtest
        Release
```

---

# 4. Git 策略

V7.1.6 正式合并 `main`、打 tag、完成部署后再开始 V7.2。

新分支：

```text
codex/v7.2-party-expansion
```

```bash
git checkout main
git pull --ff-only origin main
git checkout -b codex/v7.2-party-expansion
```

不要继续复用 `codex/v7-extension-foundation`。

---

# 5. V7.2.0：ModeRules 小型整理

目标：减少 `GameService` 中不断增长的模式条件判断，但不拆状态机。

建议新增：

```text
apps/server/src/game/mode-rules.ts
```

只负责回答规则，不保存状态、不推进 Phase、不广播 Socket。

推荐接口：

```ts
export interface EffectivePlayRange {
  min: number;
  max: number;
}

export type ChallengePolicy = 'NEXT_PLAYER' | 'FREE_WINDOW';
export type RevolverPolicy = 'PERSONAL' | 'SHARED';

export function getEffectivePlayRange(...): EffectivePlayRange;
export function getEffectiveTurnSeconds(...): number;
export function isJokerWild(...): boolean;
export function getPunishmentShotLimit(...): number;
export function getChallengePolicy(...): ChallengePolicy;
export function getRevolverPolicy(...): RevolverPolicy;
```

必须保持：

```text
GameService
    ↓
唯一状态机

ModeRules
    ↓
规则参数

Party Event Rules
    ↓
当前事件修饰
```

禁止拆成多套 `*GameService`。

---

# 6. `maximumPlayCount`

当前已有：

```text
minimumPlayCount
```

V7.2 新增：

```ts
maximumPlayCount: number;
```

进入 `GameSnapshot`。

默认：

```text
min = 1
max = 3
```

客户端只用于 UI 限制和提示，服务端必须再次校验。

---

# 7. Party Event Registry

建议集中 Party Event 公共元数据：

```ts
interface PartyEventMeta {
  type: PartyEventType;
  title: string;
  shortDescription: string;
  category: PartyEventCategory;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
}
```

Category：

```text
INFORMATION
TURN_ORDER
TEMPO
CARD_RULE
PUNISHMENT
```

映射：

```text
HIDDEN_BET      INFORMATION
DRUNKEN         TURN_ORDER
RAPID_NIGHT     TEMPO
DOUBLE_DANGER   PUNISHMENT
NO_JOKER        CARD_RULE
FORCED_BET      CARD_RULE
ONE_CARD_ONLY   CARD_RULE
MATCH_BET       CARD_RULE
HEAVY_HAND      CARD_RULE
LAST_CALL       TEMPO
```

---

# 8. Party 事件池

V7.1 已有：

```text
HIDDEN_BET
DRUNKEN
RAPID_NIGHT
DOUBLE_DANGER
NO_JOKER
FORCED_BET
```

V7.2 新增：

```text
ONE_CARD_ONLY
MATCH_BET
HEAVY_HAND
LAST_CALL
```

最终 Party Event Pool：10 个。

`CANDLE_FLICKER` 继续作为 Classic / Quick legacy event，不进入 Party Pool。

---

# 9. 现有事件最终规则

## HIDDEN_BET / 暗注夜

> 本轮玩家出牌时，其他玩家暂时不知道本次出了几张牌；翻牌后公开真实数量。

```text
出牌本人 lastPlay.count = 真实数量
其他玩家 Reveal 前 lastPlay.count = null
所有玩家 handCount / cardCount = 正常公开
```

## DRUNKEN / 醉酒之夜

> 本轮行动方向反转。

所有“下一名玩家”逻辑统一使用反向顺序。

## RAPID_NIGHT / 快速夜

> 本轮每名玩家只有 5 秒行动时间。

Party 中固定：

```text
5 seconds
```

## DOUBLE_DANGER / 双倍危机

> 本轮受罚者最多连续开两枪；第一枪命中时第二枪取消。

必须保持：

```text
枪 1 → 结果 → 枪 2 → 结果
```

不能预先一次性计算两枪后直接展示最终结果。

## NO_JOKER / 禁忌小丑

> 本轮 Joker 不再是万能牌。

所有判断统一复用同一真假牌逻辑。

## FORCED_BET / 强制豪赌

> 第一手正常，从第二手开始每次至少出 2 张。

```text
第一手：1～3
后续：2～3
```

手牌不足则 `mustChallenge = true`。

---

# 10. 新事件：ONE_CARD_ONLY / 单张夜

一句话：

> 本轮每次只能出 1 张牌。

规则：

```text
minimumPlayCount = 1
maximumPlayCount = 1
```

超时只能自动出 1 张。

UI：

```text
单张夜
本轮每次只能出 1 张牌
```

---

# 11. 新事件：MATCH_BET / 跟注夜

一句话：

> 第一手决定张数，之后所有人必须出相同数量。

第一手：

```text
min = 1
max = 3
requiredPlayCount = null
```

第一手若出 2 张：

```text
requiredPlayCount = 2
```

之后：

```text
min = 2
max = 2
```

若：

```text
handCount < requiredPlayCount
```

则：

```text
mustChallenge = true
```

建议新增内部状态：

```ts
partyRequiredPlayCount: number | null;
```

每轮开始重置。

---

# 12. 新事件：HEAVY_HAND / 豪饮之夜

一句话：

> 本轮每次至少出 2 张牌。

```text
minimumPlayCount = 2
maximumPlayCount = 3
```

从第一手开始生效。

与 FORCED_BET 区别：

```text
FORCED_BET：第一手 1～3，后续 2～3
HEAVY_HAND：从第一手开始 2～3
```

如果真实试玩认为两者过于相似，RC 允许删除 HEAVY_HAND。

---

# 13. 新事件：LAST_CALL / 最后点单

一句话：

> 每完成一次出牌，下一位玩家的行动时间都会缩短。

时间：

```text
0 次成功出牌：15 秒
1 次：12 秒
2 次：9 秒
3 次及以后：6 秒
```

公式：

```ts
Math.max(6, 15 - successfulPlayCountThisRound * 3)
```

建议新增：

```ts
successfulPlayCountThisRound: number;
```

只有服务端正式接受 `playCards()` 后才 `+1`。

Challenge / Reveal / Punishment / Item 不计数。

---

# 14. Party 规则优先级

统一为：

```text
1. Base Mode Rules
2. Party Event Rules
3. Character Ability 时间修饰
4. Item 时间修饰
```

例如：

```text
LAST_CALL base = 9 秒
Rabbit +3
Pocket Watch +7
最终 phaseEndsAt 对应 19 秒
```

---

# 15. Character Ability Compatibility

V7.2 不新增角色能力，但必须验证：

- WOLF：安全牌继续使用统一真假牌逻辑
- FOX：不能给出当前事件下非法的具体出牌建议
- BEAR / RABBIT：在 Party 时间规则后叠加
- CAT：DOUBLE_DANGER 下提示必须表述为“下一枪风险”
- PANDA：NO_JOKER 下 Joker 仍记为假牌

---

# 16. Item Compatibility

## SPYGLASS

DOUBLE_DANGER 下只描述：

> 下一枪风险高 / 低。

## POCKET_WATCH

必须在当前 Party 规则计算出的时间基础上 `+7`。

例如 LAST_CALL 当前 9 秒：

```text
9 + 7 = 16
```

不能重置为 `15 + 7`。

## TAVERN_MUG

继续只影响表现层，不改变规则。

---

# 17. V7.2.1：Party Event Intro

不新增服务器 Phase。

继续使用：

```text
ROUND_START
```

推荐新增：

```text
PartyEventIntro.tsx
```

或者在 `CinematicLayer` 的 ROUND_START 分支内使用独立组件，但禁止修改 Reveal / Punishment DOM。

Intro 示例：

```text
酒馆乱斗

跟注夜

第一手决定张数，
之后所有人必须跟相同数量。

第 4 轮
```

时间建议：

```text
0ms      背景出现
150ms    标题出现
350ms    规则出现
1800ms   淡出
2300ms   基本结束
2700ms   ROUND_START → TURN
```

不增加服务器 ROUND_START 时长。

---

# 18. Reduce Motion / Low Power

Reduce Motion：

```text
只允许 opacity fade
```

Low Power：

- 禁用粒子
- 禁用复杂 blur
- 禁用持续 filter animation
- 保留静态卡片 + 简单淡入淡出

---

# 19. Party Event HUD

ROUND_START 后当前事件必须继续可见。

建议组件：

```text
PartyEventBadge
```

例如：

```text
跟注夜
必须出 2 张
```

默认保持紧凑，点击可展开详细规则。

TURN 动态文案：

```text
ONE_CARD_ONLY：请选择 1 张
MATCH_BET：必须出 2 张
HEAVY_HAND：至少出 2 张
LAST_CALL：本回合 9 秒
```

---

# 20. Event History

V7.2.4 增加最近最多 3 条公开历史：

```ts
interface PublicPartyEventHistoryEntry {
  roundNumber: number;
  type: PartyEventType;
  title: string;
}
```

`GameSnapshot`：

```ts
partyEventHistory: PublicPartyEventHistoryEntry[];
```

非 Party：

```text
[]
```

Desktop 默认显示当前 + 上一轮；Mobile 默认只显示当前。

---

# 21. Weighted Random

初始权重建议：

| Event | Weight |
|---|---:|
| HIDDEN_BET | 12 |
| DRUNKEN | 10 |
| RAPID_NIGHT | 8 |
| DOUBLE_DANGER | 5 |
| NO_JOKER | 8 |
| FORCED_BET | 9 |
| ONE_CARD_ONLY | 11 |
| MATCH_BET | 9 |
| HEAVY_HAND | 7 |
| LAST_CALL | 7 |

权重不是百分比，后续按试玩调整。

---

# 22. 防重复

将：

```text
previousPartyEventType
```

升级为：

```ts
recentPartyEventTypes: PartyEventType[];
```

最多 2 个。

算法：

```text
排除最近 2 个
↓
若有候选：加权抽取
↓
否则只排除上一轮
↓
仍为空：使用完整事件池
```

不能死循环。

---

# 23. Public Snapshot

建议继续使用：

```text
GameSnapshot.minimumPlayCount
GameSnapshot.maximumPlayCount
GameSnapshot.turnDurationSeconds
GameSnapshot.phaseEndsAt
```

MATCH_BET 不必额外向客户端暴露另一套重复规则字段；当：

```text
minimumPlayCount === maximumPlayCount
```

UI 即可显示“必须出 N 张”。

---

# 24. Lobby Party Detail

V7.1 的模式详情弹窗继续保留。

Party 详情追加：

```text
每轮随机抽取一个公开事件。
每轮只启用一个事件。
```

显示 10 个事件名称即可，不展开全部长说明。

---

# 25. Party 开关语义

必须保持：

```text
PARTY = 每轮随机事件固定启用
```

`tavernEventsEnabled` 只控制 Classic / Quick legacy events。

Party 下显示：

```text
每轮随机事件
Party 固定启用
```

---

# 26. RulesPanel

对局中只显示：

```text
基础规则
+
当前模式
+
当前事件
```

不要一次塞入 10 个 Party Event 的完整规则。

---

# 27. Reveal 保护

V7.2 Party CSS 禁止重新给：

```css
.reveal-card
```

增加：

```text
filter
animation
额外 transform
```

Party Intro 动画只能作用自己的 `.party-event-intro*` 选择器。

---

# 28. Server Tests：现有事件

必须继续覆盖：

- HIDDEN_BET：Reveal 前隐藏其他玩家本次出牌数量但保留手牌数
- DRUNKEN：方向反转
- RAPID_NIGHT：Party 固定 5 秒
- DOUBLE_DANGER：最多两枪
- NO_JOKER：核心判定 + WOLF / FOX / PANDA
- FORCED_BET：第一手正常、后续至少 2

---

# 29. Server Tests：ONE_CARD_ONLY

至少：

```text
1 张成功
2 张失败
3 张失败
min = 1
max = 1
timeout 自动 1 张
```

---

# 30. Server Tests：MATCH_BET

至少：

```text
第一手 1～3
第一手 2 张后 required = 2
下一手 1 张 reject
下一手 3 张 reject
下一手 2 张 success
手牌不足 required → mustChallenge
timeout 严格出 required 张
新一轮 required 重置
```

---

# 31. Server Tests：HEAVY_HAND

至少：

```text
第一手 1 张 reject
2 张 success
3 张 success
手牌不足 2 → mustChallenge
```

---

# 32. Server Tests：LAST_CALL

至少：

```text
Round Start = 15 秒
第一手后 = 12
第二手后 = 9
第三手后 = 6
之后保持 6
Challenge 不增加 play count
新一轮恢复 15
```

---

# 33. 时间叠加测试

必须增加：

```text
LAST_CALL + BEAR
LAST_CALL + RABBIT
LAST_CALL + POCKET_WATCH
```

确认顺序：

```text
Party base
→ Ability
→ Item
```

---

# 34. Socket.IO Tests

至少新增：

```text
Party Event 对所有客户端一致
MATCH_BET min/max 一致
LAST_CALL phaseEndsAt 一致
Reconnect 后 Event / Rule 一致
```

不要求每个 Party Event 都写真实多客户端测试。

---

# 35. Reconnect

必须恢复：

```text
event
event roundNumber
minimumPlayCount
maximumPlayCount
MATCH_BET required state
LAST_CALL effective time
turnDirection
phase
phaseEndsAt
punishment
```

Reconnect 不得重新抽事件。

---

# 36. Browser QA

至少：

```text
1920×1080
390×844
430×932
```

检查：

- Event Intro 不溢出
- Event Badge 不挡牌
- min/max 提示清楚
- Challenge 按钮正常
- Reduce Motion 正常
- Low Power 正常
- Mobile 可点击

---

# 37. Manual Party Playtest

RC 前至少实际玩：

```text
10 局 Party
```

记录：

- 哪些事件最容易理解
- 哪些需要额外解释
- 哪些过于相似
- 哪些太慢
- 哪些太频繁
- 哪些最有节目效果
- Mobile 是否拥挤
- Intro 是否太长

如果 `HEAVY_HAND` 和 `FORCED_BET` 实际体验过于重复，允许删除 HEAVY_HAND。

---

# 38. Telemetry

开发期 Server Log 增加：

```text
party_event_selected
```

字段：

```text
roomCode
roundNumber
eventType
```

禁止记录：

- 手牌内容
- bulletPosition
- sessionToken
- 私有 Ability / Item 数据

---

# 39. V7.2 Acceptance

新增：

```text
docs/V7.2-acceptance.md
```

覆盖：

- Party Intro
- Event HUD
- 全部最终事件
- Weighted Random
- Anti-repeat
- min/max play count
- Item Compatibility
- Ability Compatibility
- Reconnect
- Socket consistency
- Desktop
- Mobile
- Reduce Motion
- Low Power
- PWA
- Version
- V7.1 Regression

---

# 40. 文档更新

RC 更新：

```text
README.md
CHANGELOG.md
docs/V7_PLAN.md
docs/architecture.md
docs/V7.2-acceptance.md
```

保留本文件：

```text
Bluff_Tavern_V7.2_Party_Expansion_完整开发计划.md
```

---

# 41. Version / PWA

最终正式版统一为：

```text
7.2.0
```

同步：

```text
APP_VERSION
root package.json
apps/server/package.json
apps/web/package.json
packages/shared/package.json
/health
App footer
Service Worker cache
README
CHANGELOG
```

Service Worker 示例：

```text
bluff-tavern-v7.2.0-party-expansion
```

---

# 42. 每阶段质量门禁

每个里程碑必须：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

全部 PASS。

禁止使用：

```text
.skip
.only
@ts-ignore
删除失败测试
降低关键断言
```

来伪造通过。

---

# 43. V7.1 Regression Gate

每个主要阶段至少确认：

```text
Classic
Quick
Escalation
Shared Revolver
Free Challenge
```

核心流程没有行为变化。

重点：

```text
Play
Challenge
Reveal
Verdict
Punishment
Round End
Reconnect
```

---

# 44. 里程碑完成条件

## V7.2.0

```text
ModeRules 小整理完成
GameService 仍唯一状态机
maximumPlayCount 接入
Party 元数据集中
现有行为不改变
测试全部 PASS
```

## V7.2.1

```text
Party Intro 完成
Event Badge 完成
Reduce Motion 完成
Low Power 完成
Desktop / Mobile 无溢出
Reveal 结构未改变
```

## V7.2.2

```text
ONE_CARD_ONLY 完成
MATCH_BET 完成
Server rules 完成
UI 提示完成
AutoAct 完成
Reconnect 完成
Tests 完成
```

## V7.2.3

```text
HEAVY_HAND 完成或经试玩删除
LAST_CALL 完成
Weighted Random 完成
Recent-2 Anti-repeat 完成
History state 完成
Compatibility Tests 完成
```

## V7.2.4

```text
Party Lobby Detail 完整
Event History UI 完整
当前事件规则始终清楚
Mobile 收口
Desktop 收口
文案统一
```

## V7.2.5

```text
完整回归
10 局 Party 实玩
Acceptance 完成
版本同步
lint PASS
typecheck PASS
test PASS
build PASS
```

---

# 45. 推荐 Commit 顺序

```text
refactor: isolate effective mode rules

feat: add party event round intro

feat: add one-card-only party event

feat: add match-bet party event

feat: add heavy-hand party event

feat: add last-call party event

feat: add weighted party event rotation

feat: add party event history ui

test: expand party event compatibility coverage

chore: prepare v7.2 release candidate
```

---

# 46. 最终 PR

```text
codex/v7.2-party-expansion
→
main
```

建议标题：

```text
Release V7.2: Party Expansion
```

PR 创建后：

```text
不要自动 merge
不要自动 tag
不要自动部署
```

先进行最终人工审查。

---

# 47. V7.2 最终完成标准

正式发布前必须满足：

```text
所有最终保留 Party Events 正常
Party Intro 正常
Event HUD 正常
Weighted Random 正常
Anti-repeat 正常
minimumPlayCount 正确
maximumPlayCount 正确
Items 不绕过 Event Rules
Abilities 不产生非法或矛盾提示
Reconnect 完整
多客户端一致
Classic PASS
Quick PASS
Escalation PASS
Shared Revolver PASS
Free Challenge PASS
Party PASS
Desktop PASS
Mobile PASS
Reduce Motion PASS
Low Power PASS
lint PASS
typecheck PASS
test PASS
build PASS
至少 10 局真实 Party 试玩完成
```

---

# 48. V7.2 之后

下一版本：

```text
V7.3 Custom Rules
```

V7.3 复用：

```text
ModeRules
minimumPlayCount
maximumPlayCount
Challenge Policy
Revolver Policy
Joker Policy
Timer Policy
Party Event Metadata
```

避免重新堆叠大量散落的 `if / else`。

---

# 49. V7.2 最终定义

V7.2 的成功标准不是：

> “Party 多了几个事件。”

而是：

> **Party 已经成为《诡牌酒馆》真正有重复游玩价值的聚会模式：每轮都有清晰变化，但玩家仍然不需要学习复杂系统。**

最终路线：

```text
V7.1.6
Multi-Mode Stable
        ↓
V7.2.0
Rule Foundation
        ↓
V7.2.1
Party Event Intro
        ↓
V7.2.2
ONE_CARD_ONLY
MATCH_BET
        ↓
V7.2.3
HEAVY_HAND
LAST_CALL
Weighted Random
Anti-repeat
        ↓
V7.2.4
Party UX Polish
        ↓
V7.2.5
RC / Stable
        ↓
V7.3
Custom Rules
```
