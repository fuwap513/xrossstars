import type { Card } from '../types/game';

type Props = {
  card: Card;
  title?: string;
  subtitle?: string;
  accent?: 'default' | 'equipment' | 'warning';
  selected?: boolean;
  actionLabel?: string;
  actionTone?: 'default' | 'warning';
  onClick: () => void;
  onAction?: () => void;
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

export default function FieldCardTile({
  card,
  title,
  subtitle,
  accent = 'default',
  selected = false,
  actionLabel,
  actionTone = 'default',
  onClick,
  onAction,
}: Props) {
  return (
    <article
      className={`field-card field-card-${accent} ${
        selected ? 'field-card-selected' : ''
      }`}
    >
      <button className="field-card-button" type="button" onClick={onClick}>
        <div className="field-card-art-shell">
          {card.officialImageUrl ? (
            <img
              className="field-card-art-image"
              src={card.officialImageUrl}
              alt={`${card.name} のカードイラスト`}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="field-card-art-placeholder">
              <strong>{card.name}</strong>
              <span>{getImageStatusLabel(card)}</span>
            </div>
          )}

          <div className="field-card-overlay-row">
            <span
              className={`field-card-status-chip ${
                card.officialImageUrl
                  ? 'field-card-status-chip-ready'
                  : 'field-card-status-chip-muted'
              }`}
            >
              {getImageStatusLabel(card)}
            </span>

            {card.officialCardNumber && (
              <span className="field-card-status-chip">
                {card.officialCardNumber}
              </span>
            )}
          </div>
        </div>

        <div className="field-card-body">
          {title && <div className="field-card-title">{title}</div>}

          <div className="hand-card-chip-row">
            <span className="detail-chip">{card.type.toUpperCase()}</span>
            <span className="detail-chip">Cost {card.cost}</span>
            <span className="detail-chip">
              {effectLabelMap[card.effectType]}
            </span>
            {card.color && <span className="detail-chip">{card.color}</span>}
          </div>

          <strong className="field-card-name">{card.name}</strong>

          {subtitle && <div className="field-card-subtitle">{subtitle}</div>}

          <div className="field-card-meta-row">
            <span>
              {typeof card.power === 'number'
                ? `Power ${card.power}`
                : `Effect ${card.effectValue}`}
            </span>
            {card.officialSet && <span>{card.officialSet}</span>}
          </div>

          <p className="field-card-text">{card.text}</p>
        </div>
      </button>

      {onAction && actionLabel && (
        <button
          className={`field-card-action-button ${
            actionTone === 'warning'
              ? 'field-card-action-button-warning'
              : ''
          }`}
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </article>
  );
}

