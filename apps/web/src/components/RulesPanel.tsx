import type { GameView } from '@bluff-tavern/shared';

interface RulesPanelProps {
  open: boolean;
  game: GameView;
  onClose: () => void;
}

const baseRules: Array<[string, string]> = [
  ['目标牌', '每轮会公布一个目标牌，所有出牌声明都围绕这张牌结算。'],
  ['出牌', '轮到你时选择 1 至 3 张手牌，实际牌面可以与声明不同。'],
  ['质疑', '质疑成功则上一手出牌者受罚；质疑失败则质疑者受罚。'],
  ['Joker', '通常 Joker 视为当前目标牌；若本轮事件明确禁用 Joker，则按事件规则结算。'],
  ['惩罚', '失败者触发左轮惩罚，命中淘汰，空枪继续。'],
  ['胜利', '只剩最后一名存活玩家时，本局结束。'],
];

export function RulesPanel({ open, game, onClose }: RulesPanelProps) {
  if (!open) return null;
  const rules = [...baseRules, ...modeRules(game), ...eventRules(game)];

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rules-title">
    <section className="rules-panel">
      <div className="rules-panel__header">
        <div>
          <p className="eyebrow">游戏规则</p>
          <h2 id="rules-title">诡牌酒馆规则</h2>
        </div>
        <button type="button" className="icon-close" onClick={onClose} aria-label="关闭规则">×</button>
      </div>
      <ol className="rules-grid">
        {rules.map(([title, body]) => <li key={`${title}:${body}`}>
          <strong>{title}</strong>
          <p>{body}</p>
        </li>)}
      </ol>
    </section>
  </div>;
}

function modeRules(game: GameView): Array<[string, string]> {
  switch (game.gameMode) {
    case 'QUICK':
      return [['快速模式', '每名玩家只有 7 秒行动时间，超时由服务器自动执行合法操作。']];
    case 'ESCALATION':
      return [['加注模式', '本次出牌数量不能少于上一手；手牌不足以跟上时必须质疑。']];
    case 'SHARED_REVOLVER':
      return [['死亡左轮', '全桌共用一把左轮，空膛进度会保留；命中淘汰后重新装填并旋转。']];
    case 'FREE_CHALLENGE':
      return [['全民质疑', '出牌后开启 3 秒质疑窗口，除出牌者外的存活玩家都能抢先质疑；窗口结束后下一名玩家只能继续出牌。']];
    case 'PARTY':
      return [['酒馆乱斗', '每轮开始抽取一个公开事件，事件只影响当前轮，下一轮重新抽取。']];
    case 'CLASSIC':
      return [['经典模式', '只有下一名玩家可以在自己的回合质疑上一手。']];
  }
}

function eventRules(game: GameView): Array<[string, string]> {
  switch (game.tavernEvent?.type) {
    case 'HIDDEN_BET':
      return [['暗注夜', '本轮玩家出牌时，其他玩家暂时不知道本次出了几张牌；只有质疑并翻牌后才公开真实数量。']];
    case 'DRUNKEN':
      return [['醉酒之夜', '本轮出牌方向反转，下一玩家、强制质疑和下一轮起手都按反方向计算。']];
    case 'RAPID_NIGHT':
      return [['快速夜', '本轮所有玩家行动时间缩短。']];
    case 'DOUBLE_DANGER':
      return [['双倍危机', '本轮受罚者最多连续接受两次左轮判定；第一枪命中时第二枪取消。']];
    case 'NO_JOKER':
      return [['禁忌小丑', '本轮 Joker 不再视为目标牌；仍可打出，但质疑时会被判为假牌。']];
    case 'FORCED_BET':
      return [['强制豪赌', '本轮首手可出 1 至 3 张；从第二手开始每次至少出 2 张，手牌不足时必须质疑。']];
    case 'ONE_CARD_ONLY':
      return [['单张夜', '本轮每次只能出 1 张牌，超时也只会自动出 1 张。']];
    case 'MATCH_BET':
      return [['跟注夜', '本轮第一手决定张数，之后所有玩家必须出相同张数；手牌不足时必须质疑。']];
    case 'HEAVY_HAND':
      return [['豪饮之夜', '本轮从第一手开始每次至少出 2 张牌，最多仍为 3 张。']];
    case 'LAST_CALL':
      return [['最后点单', '本轮每完成一次出牌，下一位玩家行动时间缩短，最低为 6 秒。']];
    case 'CANDLE_FLICKER':
      return [['烛火摇曳', '本轮揭牌演出更紧张，核心判定不变。']];
    default:
      return [];
  }
}
