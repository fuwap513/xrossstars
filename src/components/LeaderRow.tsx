import type { Card, Leader } from '../types/game';

type Props = {
  title: string;
  leaders: Leader[];
  selectedId?: string;
  onSelect?: (leaderId: string) => void;
  cardLookup?: Map<string, Card>;
};

const getCurrentAtk = (leader: Leader) => leader.baseAtk + (leader.awakened ? 10 : 0);
const getCurrentHp = (leader: Leader) => leader.baseHp + (leader.awakened ? 30 : 0);

export default function LeaderRow({ title, leaders, selectedId, onSelect, cardLookup }: Props) {
  return (
    <section className="panel">
      <div className="section-header">
        <h2>{title}</h2>
        <span>{leaders.length}体</span>
      </div>
      <div className="leader-grid">
        {leaders.map((leader) => {
          const currentHp = getCurrentHp(leader);
          const currentAtk = getCurrentAtk(leader);
          const remainingHp = Math.max(currentHp - leader.currentDamage, 0);
          const isSelected = selectedId === leader.id;
          const leaderCard = leader.sourceCardId ? cardLookup?.get(leader.sourceCardId) : undefined;
          const imageStatusLabel = leaderCard?.officialImageUrl ? '公式イラスト' : '画像未設定';

          return (
            <button
              type="button"
              className={`leader-card ${isSelected ? 'selected' : ''} ${leader.isDown ? 'state-down' : leader.awakened ? 'state-awakened' : 'state-normal'}`}
              key={leader.id}
              onClick={() => onSelect?.(leader.id)}
            >
              <div className="leader-art-shell">
                {leaderCard?.officialImageUrl ? (
                  <img
                    className="leader-art-image"
                    src={leaderCard.officialImageUrl}
                    alt={`${leader.name} のリーダーイラスト`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="leader-art-placeholder">
                    <strong>{leader.name}</strong>
                    <span>{imageStatusLabel}</span>
                  </div>
                )}
                <div className="leader-overlay-row">
                  <span className={`leader-status-chip ${leaderCard?.officialImageUrl ? 'leader-status-chip-ready' : 'leader-status-chip-muted'}`}>
                    {imageStatusLabel}
                  </span>
                  {leaderCard?.officialCardNumber && <span className="leader-status-chip">{leaderCard.officialCardNumber}</span>}
                </div>
              </div>

              <div className="leader-body">
                <div className="leader-name-row">
                  <div className="leader-name">{leader.name}</div>
                  <div className="leader-badge">{leader.isDown ? 'DOWN' : leader.awakened ? '覚醒' : '通常'}</div>
                </div>
                <div className="leader-chip-row">
                  <span className="detail-chip">ATK {currentAtk}</span>
                  <span className="detail-chip">HP {remainingHp}/{currentHp}</span>
                  {leader.color && <span className="detail-chip">{leader.color}</span>}
                </div>
                <div className="leader-stats">基礎 ATK {leader.baseAtk} / HP {leader.baseHp}</div>
                <div className="leader-awaken">現在ダメージ {leader.currentDamage} / 残りHP {remainingHp}</div>
                {leader.effectText && <div className="leader-damage">{leader.effectText}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
