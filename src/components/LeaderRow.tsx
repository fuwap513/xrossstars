import type { Leader, RegisteredCard } from '../types/game';

type CardLookup =
  | Map<string, RegisteredCard>
  | Record<string, RegisteredCard | undefined>;

type Props = {
  title: string;
  leaders: Leader[];
  selectedId?: string;
  onSelect?: (leaderId: string) => void;
  cardLookup?: CardLookup;
};

const getCurrentAtk = (leader: Leader) => leader.baseAtk + (leader.awakened ? 10 : 0);
const getCurrentHp = (leader: Leader) => leader.baseHp + (leader.awakened ? 30 : 0);
const getRemainingHp = (leader: Leader) =>
  Math.max(0, getCurrentHp(leader) - leader.currentDamage);
const getAwakenedAtk = (leader: Leader) => leader.baseAtk + 10;
const getAwakenedHp = (leader: Leader) => leader.baseHp + 30;

const getCardFromLookup = (
  lookup: CardLookup | undefined,
  sourceCardId?: string,
): RegisteredCard | undefined => {
  if (!lookup || !sourceCardId) return undefined;

  if (lookup instanceof Map) {
    return lookup.get(sourceCardId);
  }

  return lookup[sourceCardId];
};

const getImageStatusLabel = (card?: RegisteredCard) => {
  if (!card) return '画像未設定';
  if (card.imageStatus === 'error') return '画像エラー';
  if (card.officialImageUrl) return '公式画像';
  return '画像未設定';
};

const buildVisibleLeaders = (leaders: Leader[]) => {
  const normalized = [...leaders];
  while (normalized.length < 4) {
    normalized.push({
      id: `empty-${normalized.length + 1}`,
      name: '未設定',
      baseAtk: 0,
      baseHp: 0,
      awakened: false,
      currentDamage: 0,
      isDown: false,
    });
  }
  return normalized.slice(0, 4);
};

export default function LeaderRow({
  title,
  leaders,
  selectedId,
  onSelect,
  cardLookup,
}: Props) {
  const visibleLeaders = buildVisibleLeaders(leaders);

  return (
    <section className="panel">
      <div className="section-header">
        <h2>{title}</h2>
        <span>{leaders.length} / 4 リーダー</span>
      </div>

      <div className="leader-grid top-gap">
        {visibleLeaders.map((leader, index) => {
          const isEmpty = leader.name === '未設定' && leader.baseHp === 0;
          const matchedCard = getCardFromLookup(cardLookup, leader.sourceCardId);
          const isSelected = !isEmpty && selectedId === leader.id;
          const currentAtk = getCurrentAtk(leader);
          const currentHp = getCurrentHp(leader);
          const remainingHp = getRemainingHp(leader);
          const awakenedAtk = getAwakenedAtk(leader);
          const awakenedHp = getAwakenedHp(leader);

          return (
            <button
              key={leader.id || `leader-slot-${index}`}
              type="button"
              className={[
                'leader-card',
                isSelected ? 'selected' : '',
                leader.awakened ? 'state-awakened' : '',
                leader.isDown ? 'state-down' : '',
                isEmpty ? 'leader-card-empty' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                if (!isEmpty && onSelect) onSelect(leader.id);
              }}
              disabled={isEmpty || !onSelect}
            >
              <div className="leader-art-wrap">
                {matchedCard?.officialImageUrl ? (
                  <img
                    src={matchedCard.officialImageUrl}
                    alt={leader.name}
                    className="leader-art"
                  />
                ) : (
                  <div className="leader-art leader-art-placeholder">
                    <strong>{isEmpty ? `SLOT ${index + 1}` : leader.name}</strong>
                    <span>{isEmpty ? 'リーダー未設定' : getImageStatusLabel(matchedCard)}</span>
                  </div>
                )}
              </div>

              <div className="detail-chip-row top-gap">
                <span className={`detail-chip ${isEmpty ? 'detail-chip-muted' : ''}`}>
                  {isEmpty
                    ? '未設定'
                    : leader.isDown
                      ? 'DOWN'
                      : leader.awakened
                        ? '覚醒'
                        : '通常'}
                </span>

                {!isEmpty && matchedCard?.officialCardNumber ? (
                  <span className="detail-chip detail-chip-muted">
                    {matchedCard.officialCardNumber}
                  </span>
                ) : null}

                {!isEmpty && (leader.color ?? matchedCard?.color) ? (
                  <span className="detail-chip detail-chip-success">
                    {leader.color ?? matchedCard?.color}
                  </span>
                ) : null}
              </div>

              <div className="leader-card-header top-gap">
                <strong>{leader.name}</strong>
              </div>

              {!isEmpty ? (
                <>
                  <div className="leader-stat-grid top-gap">
                    <div className="detail-box">
                      <div className="eyebrow">現在値</div>
                      <div className="detail-description">
                        ATK {currentAtk} / HP {remainingHp} / {currentHp}
                      </div>
                    </div>

                    <div className="detail-box">
                      <div className="eyebrow">通常</div>
                      <div className="detail-description">
                        ATK {leader.baseAtk} / HP {leader.baseHp}
                      </div>
                    </div>

                    <div className="detail-box">
                      <div className="eyebrow">覚醒</div>
                      <div className="detail-description">
                        ATK {awakenedAtk} / HP {awakenedHp}
                      </div>
                    </div>
                  </div>

                  <div className="detail-chip-row top-gap">
                    <span className="detail-chip">ダメージ {leader.currentDamage}</span>
                    {leader.sourceCardId ? (
                      <span className="detail-chip detail-chip-muted">
                        CARD {leader.sourceCardId}
                      </span>
                    ) : null}
                  </div>

                  {leader.effectText ? (
                    <div className="detail-box top-gap">
                      <div className="eyebrow">効果</div>
                      <div className="detail-description">{leader.effectText}</div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="detail-box top-gap">
                  <div className="eyebrow">状態</div>
                  <div className="detail-description">
                    このスロットにはまだリーダーが設定されていません
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
