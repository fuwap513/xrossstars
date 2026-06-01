import type { Card } from '../types/game';

type Props = {
  card: Card | null;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
};

const effectLabelMap: Record<Card['effectType'], string> = {
  none: '通常効果なし',
  nextAttackBuff: '次回攻撃強化',
  turnAttackBuff: 'ターン中強化',
  heal: '回復',
  directDamage: '直接ダメージ',
  equipmentAttackBuff: '装備強化',
};

export default function CardDetailModal({ card, title, actionLabel, onAction, onClose }: Props) {
  if (!card) return null;

  const imageStatusLabel = card.imageStatus === 'ready'
    ? '正規イラスト表示対応'
    : card.imageStatus === 'error'
      ? '画像読込エラー'
      : '正規イラスト未設定';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="section-header">
          <h2>{title ?? 'カード詳細'}</h2>
          <button type="button" className="modal-close-button" onClick={onClose}>×</button>
        </div>

        <div className="detail-art-panel">
          {card.officialImageUrl ? (
            <img
              className="detail-art-image"
              src={card.officialImageUrl}
              alt={`${card.name} のカードイラスト`}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="detail-art-placeholder">
              <strong>{card.name}</strong>
              <span>{imageStatusLabel}</span>
            </div>
          )}
          <div className="detail-art-meta">
            <span className={`detail-chip ${card.officialImageUrl ? 'detail-chip-success' : 'detail-chip-muted'}`}>{imageStatusLabel}</span>
            {card.officialCardNumber && <span className="detail-chip">{card.officialCardNumber}</span>}
            {card.officialUrl && (
              <a className="detail-link" href={card.officialUrl} target="_blank" rel="noreferrer">公式カードページを開く</a>
            )}
          </div>
        </div>

        <div className="detail-chip-row">
          <span className="detail-chip">{card.type.toUpperCase()}</span>
          <span className="detail-chip">Cost {card.cost}</span>
          <span className="detail-chip">{effectLabelMap[card.effectType]}</span>
        </div>

        <div className="detail-title">{card.name}</div>

        <div className="detail-grid">
          <div className="detail-box">
            <div className="detail-label">Power</div>
            <strong>{typeof card.power === 'number' ? card.power : '-'}</strong>
          </div>
          <div className="detail-box">
            <div className="detail-label">Effect</div>
            <strong>{card.effectValue}</strong>
          </div>
        </div>

        <div className="detail-description">
          <div className="detail-label">効果説明</div>
          <p>{card.text}</p>
        </div>

        {(card.illustrator || card.officialSet || card.rarity) && (
          <div className="detail-description">
            <div className="detail-label">公式情報</div>
            <p>
              {card.officialSet ? `収録: ${card.officialSet}` : ''}
              {card.officialSet && card.rarity ? ' / ' : ''}
              {card.rarity ? `レアリティ: ${card.rarity}` : ''}
              {(card.officialSet || card.rarity) && card.illustrator ? ' / ' : ''}
              {card.illustrator ? `イラスト: ${card.illustrator}` : ''}
            </p>
          </div>
        )}

        <div className="action-row top-gap">
          {onAction && actionLabel && (
            <button type="button" onClick={onAction}>{actionLabel}</button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>閉じる</button>
        </div>
      </section>
    </div>
  );
}
