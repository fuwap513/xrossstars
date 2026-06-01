import type { Card } from '../types/game';

type Props = {
  cards: Card[];
  disabled: boolean;
  onUseCard: (cardId: string) => void;
  onPreviewCard: (card: Card) => void;
};

const effectLabelMap: Record<Card['effectType'], string> = {
  none: '通常効果なし',
  nextAttackBuff: '次回攻撃強化',
  turnAttackBuff: 'ターン中強化',
  heal: '回復',
  directDamage: '直接ダメージ',
  equipmentAttackBuff: '装備強化',
};

function getImageStatusLabel(card: Card) {
  if (card.imageStatus === 'error') return '画像エラー';
  if (card.officialImageUrl) return '公式イラスト';
  return '画像未設定';
}

export default function HandPanel({ cards, disabled, onUseCard, onPreviewCard }: Props) {
  return (
    <section className="panel">
      <div className="section-header">
        <h2>手札</h2>
        <span>{cards.length} / 12</span>
      </div>
      <div className="hand-scroll">
        {cards.map((card) => (
          <article className="hand-card" key={card.id}>
            <button className="hand-card-preview" type="button" onClick={() => onPreviewCard(card)}>
              <div className="hand-card-art-shell">
                {card.officialImageUrl ? (
                  <img
                    className="hand-card-art-image"
                    src={card.officialImageUrl}
                    alt={`${card.name} のカードイラスト`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="hand-card-art-placeholder">
                    <strong>{card.name}</strong>
                    <span>{getImageStatusLabel(card)}</span>
                  </div>
                )}
                <div className="hand-card-overlay-row">
                  <span className={`hand-card-status-chip ${card.officialImageUrl ? 'hand-card-status-chip-ready' : 'hand-card-status-chip-muted'}`}>
                    {getImageStatusLabel(card)}
                  </span>
                  {card.officialCardNumber && <span className="hand-card-status-chip">{card.officialCardNumber}</span>}
                </div>
              </div>

              <div className="hand-card-body">
                <div className="hand-card-chip-row">
                  <span className="detail-chip">{card.type.toUpperCase()}</span>
                  <span className="detail-chip">Cost {card.cost}</span>
                  <span className="detail-chip">{effectLabelMap[card.effectType]}</span>
                </div>
                <div className="card-name">{card.name}</div>
                <div className="hand-card-stats-row">
                  <span className="card-power">{typeof card.power === 'number' ? `Power ${card.power}` : `Effect ${card.effectValue}`}</span>
                  {card.officialSet && <span className="hand-card-submeta">{card.officialSet}</span>}
                </div>
                <div className="card-text">{card.text}</div>
              </div>
            </button>
            <button className="card-action-button" type="button" disabled={disabled} onClick={() => onUseCard(card.id)}>
              使用する
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
