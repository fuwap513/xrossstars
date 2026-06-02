import FieldCardTile from './FieldCardTile';
import { getLeaderMaxHp } from '../hooks/useBattleScreenState';
import type { Card, Leader, PendingBattleChoice, RegisteredCard } from '../types/game';

type ResolvePendingChoice = (payload: { accept: boolean; selectedCardId?: string; selectedLeaderId?: string }) => void;

type Props = {
  pendingChoice: PendingBattleChoice | undefined;
  pendingChoiceSelectableCards: Card[];
  pendingChoiceSelectableLeaders: Leader[];
  pendingChoiceNeedsCardSelection: boolean;
  pendingChoiceNeedsLeaderSelection: boolean;
  selectedPendingChoiceCardId: string;
  setSelectedPendingChoiceCardId: (value: string) => void;
  selectedPendingChoiceLeaderId: string;
  setSelectedPendingChoiceLeaderId: (value: string) => void;
  resolvePendingChoice: ResolvePendingChoice;
  cancelPendingChoice: () => void;
  cardCatalogById: Map<string, RegisteredCard>;
};

export default function PendingChoiceModal({
  pendingChoice,
  pendingChoiceSelectableCards,
  pendingChoiceSelectableLeaders,
  pendingChoiceNeedsCardSelection,
  pendingChoiceNeedsLeaderSelection,
  selectedPendingChoiceCardId,
  setSelectedPendingChoiceCardId,
  selectedPendingChoiceLeaderId,
  setSelectedPendingChoiceLeaderId,
  resolvePendingChoice,
  cancelPendingChoice,
  cardCatalogById,
}: Props) {
  if (!pendingChoice) return null;

  return (
    <div className="modal-backdrop">
      <section className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="section-header">
          <h2>{pendingChoice.sourceCardName} の{pendingChoice.kind === 'self_discard_after_draw' || pendingChoice.kind === 'post_attack_self_discard' || pendingChoice.kind === 'post_attack_other_leader_damage' || pendingChoice.kind === 'drain_rod_heal_distribution' || pendingChoice.kind === 'drain_rod_damage_target' ? '追加処理' : '任意効果'}</h2>
        </div>
        <p>{pendingChoice.prompt}</p>
        {pendingChoice.kind === 'optional_trash_topdeck_for_next_attack_buff' ? (
          <div className="mini-card-grid field-card-grid pending-choice-grid top-gap">
            <FieldCardTile
              card={pendingChoice.revealedCard}
              title="公開されたカード"
              subtitle="このカードをトラッシュに置くか、山札の上に戻します"
              accent="warning"
              onClick={() => setSelectedPendingChoiceCardId(pendingChoice.revealedCard.id)}
            />
          </div>
        ) : pendingChoice.kind === 'post_attack_other_leader_damage' || pendingChoice.kind === 'drain_rod_heal_distribution' || pendingChoice.kind === 'drain_rod_damage_target' ? (
          <div className="guide-step-list pending-choice-grid">
            {pendingChoiceSelectableLeaders.map((leader) => {
              const maxHp = getLeaderMaxHp(leader);
              const remainingHp = Math.max(maxHp - leader.currentDamage, 0);
              const leaderCard = leader.sourceCardId ? cardCatalogById.get(leader.sourceCardId) : undefined;
              return (
                <button
                  key={leader.id}
                  type="button"
                  className={`pending-choice-leader-card ${selectedPendingChoiceLeaderId === leader.id ? 'pending-choice-leader-card-selected' : ''}`}
                  onClick={() => setSelectedPendingChoiceLeaderId(leader.id)}
                >
                  <div className="pending-choice-leader-art-shell">
                    {leaderCard?.officialImageUrl ? (
                      <img
                        className="pending-choice-leader-art-image"
                        src={leaderCard.officialImageUrl}
                        alt={`${leader.name} のリーダーイラスト`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="pending-choice-leader-art-placeholder">
                        <strong>{leader.name}</strong>
                        <span>リーダー画像未設定</span>
                      </div>
                    )}
                  </div>
                  <div className="pending-choice-leader-body">
                    <div className="hand-card-chip-row">
                      <span className="detail-chip">{pendingChoice.kind === 'drain_rod_heal_distribution' ? '回復先' : '対象'}</span>
                      <span className="detail-chip">HP {remainingHp}/{maxHp}</span>
                      {leader.isDown && <span className="detail-chip">DOWN</span>}
                    </div>
                    <strong className="field-card-name">{leader.name}</strong>
                    <div className="field-card-meta-row">
                      <span>ATK {leader.baseAtk + (leader.awakened ? 10 : 0)}</span>
                      <span>ダメージ {leader.currentDamage}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mini-card-grid field-card-grid pending-choice-grid">
            {pendingChoiceSelectableCards.map((card) => (
              <FieldCardTile
                key={card.id}
                card={card}
                title={pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus' ? '公開して捨てる候補' : '捨てる候補'}
                subtitle={pendingChoice.kind === 'self_discard_after_draw'
                  ? `残り ${pendingChoice.discardCountRemaining} 枚の手札調整`
                  : pendingChoice.kind === 'optional_discard_for_attack_bonus' || pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus'
                    ? '選択すると任意効果の解決対象になります'
                    : '選択すると追加処理の解決対象になります'}
                accent="warning"
                selected={selectedPendingChoiceCardId === card.id}
                onClick={() => setSelectedPendingChoiceCardId(card.id)}
              />
            ))}
          </div>
        )}
        <div className="action-row">
          <button
            type="button"
            onClick={() => resolvePendingChoice({
              accept: true,
              selectedCardId: selectedPendingChoiceCardId,
              selectedLeaderId: selectedPendingChoiceLeaderId,
            })}
            disabled={(pendingChoiceNeedsCardSelection && !selectedPendingChoiceCardId) || (pendingChoiceNeedsLeaderSelection && !selectedPendingChoiceLeaderId)}
          >
            {pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus'
              ? `選んだカードを公開して捨て、1枚引いて +${pendingChoice.bonusDamage}`
              : pendingChoice.kind === 'optional_trash_topdeck_for_next_attack_buff'
                ? 'このカードをトラッシュに置く'
                : pendingChoice.kind === 'post_attack_other_leader_damage' || pendingChoice.kind === 'drain_rod_damage_target'
                  ? `選んだリーダーに ${pendingChoice.damageAmount} ダメージ`
                  : pendingChoice.kind === 'drain_rod_heal_distribution'
                    ? `選んだリーダーを回復する（残り ${pendingChoice.remainingHeal}）`
                    : pendingChoice.kind === 'post_attack_self_discard' || pendingChoice.kind === 'self_discard_after_draw'
                      ? pendingChoice.kind === 'self_discard_after_draw'
                        ? `選んだカードを捨てる（残り ${pendingChoice.discardCountRemaining} 枚）`
                        : '選んだカードを捨てる'
                      : `選んだカードを捨てて +${pendingChoice.bonusDamage}`}
          </button>
          {pendingChoice.kind === 'optional_trash_topdeck_for_next_attack_buff' ? (
            <button type="button" onClick={cancelPendingChoice}>山札の上に戻す</button>
          ) : pendingChoice.kind !== 'post_attack_self_discard' && pendingChoice.kind !== 'self_discard_after_draw' && pendingChoice.kind !== 'post_attack_other_leader_damage' && pendingChoice.kind !== 'drain_rod_heal_distribution' && pendingChoice.kind !== 'drain_rod_damage_target' && (
            <button type="button" onClick={cancelPendingChoice}>通常解決</button>
          )}
        </div>
      </section>
    </div>
  );
}
