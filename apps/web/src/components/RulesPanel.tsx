interface RulesPanelProps {
  open: boolean;
  onClose: () => void;
}

const rules = [
  ['目标牌', '每轮会公布一个目标牌，所有出牌声明都必须围绕这张牌。'],
  ['出牌', '轮到你时选择 1 至 3 张手牌，实际牌面可以与声明不同。'],
  ['质疑', '你可以质疑上一手。如果上一手有假牌，对方受罚；否则你受罚。'],
  ['Joker', 'Joker 可视为任意目标牌，质疑时不会被判为假牌。'],
  ['惩罚', '失败者触发轮盘惩罚，命中则淘汰，空枪则继续。'],
  ['胜利', '只剩最后一名存活玩家时，本局结束。'],
  ['扩展开关', '大厅中的道具、酒馆事件、角色能力默认关闭，由房主单独开启。'],
  ['道具', '第一批道具只提供风险提示、回合延时或私有界面干扰，不改变核心判定。'],
  ['酒馆事件', '每轮开始可能触发公开事件，快速夜会缩短回合，其他事件先只影响演出。'],
  ['角色能力', '每个角色有一个轻量能力，效果由服务端结算，只显示给相关玩家。'],
] as const;

export function RulesPanel({ open, onClose }: RulesPanelProps) {
  if (!open) return null;

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
        {rules.map(([title, body]) => <li key={title}>
          <strong>{title}</strong>
          <p>{body}</p>
        </li>)}
      </ol>
    </section>
  </div>;
}
