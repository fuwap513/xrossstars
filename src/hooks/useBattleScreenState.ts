import { useMemo } from 'react';
import type { MatchState, PendingBattleChoice, RegisteredCard } from '../types/game';

export const getLeaderMaxHp = (leader?: { baseHp: number; awakened: boolean }) => (
  leader ? leader.baseHp + (leader.awakened ? 30 : 0) : 0
);

type Params = {
  state: MatchState;
  battleUndoCount: number;
  cardCatalog: RegisteredCard[];
};

const needsLeaderSelection = (pendingChoice?: PendingBattleChoice) => (
  pendingChoice?.kind === 'post_attack_other_leader_damage'
  || pendingChoice?.kind === 'drain_rod_heal_distribution'
  || pendingChoice?.kind === 'drain_rod_damage_target'
);

export default function useBattleScreenState({
  state,
  battleUndoCount,
  cardCatalog,
}: Params) {
  const isSelfSecond = state.firstPlayer === 'opponent';
  const setupRequired = !state.roundTacticSelected && state.self.tacticsDeck.length > 0 && !state.winner;
  const canUndoBattle = battleUndoCount > 0;
  const pendingChoice = state.pendingChoice;

  const activeLeader = state.self.leaders.find((leader) => leader.id == state.activeLeaderId) ?? state.self.leaders[0];
  const targetLeader = state.opponent.leaders.find((leader) => leader.id == state.targetLeaderId) ?? state.opponent.leaders[0];
  const activeLeaderMaxHp = getLeaderMaxHp(activeLeader);
  const targetLeaderMaxHp = getLeaderMaxHp(targetLeader);
  const activeLeaderRemainingHp = Math.max(activeLeaderMaxHp - (activeLeader?.currentDamage ?? 0), 0);
  const targetLeaderRemainingHp = Math.max(targetLeaderMaxHp - (targetLeader?.currentDamage ?? 0), 0);
  const remainingOpponentLeaders = state.opponent.leaders.filter((leader) => !leader.isDown).length;
  const recentBattleHistory = state.battleHistory.slice(0, 30);
  const roundSummaries = useMemo(() => [...state.roundSummaries].reverse(), [state.roundSummaries]);
  const pendingChoiceSelectableCards = pendingChoice
    ? state.self.hand.filter((card) => pendingChoice.selectableHandCardIds.includes(card.id))
    : [];
  const cardCatalogById = useMemo(() => new Map(cardCatalog.map((card) => [card.id, card])), [cardCatalog]);
  const pendingChoiceSelectableLeaders = pendingChoice?.kind === 'post_attack_other_leader_damage' || pendingChoice?.kind === 'drain_rod_damage_target'
    ? state.opponent.leaders.filter((leader) => pendingChoice.selectableLeaderIds.includes(leader.id))
    : pendingChoice?.kind === 'drain_rod_heal_distribution'
      ? state.self.leaders.filter((leader) => pendingChoice.selectableLeaderIds.includes(leader.id))
      : [];
  const pendingChoiceNeedsCardSelection = Boolean(
    pendingChoice
    && pendingChoice.kind !== 'optional_trash_topdeck_for_next_attack_buff'
    && !needsLeaderSelection(pendingChoice),
  );
  const pendingChoiceNeedsLeaderSelection = needsLeaderSelection(pendingChoice);

  const nextActionHints = useMemo(() => {
    const hints: string[] = [];

    if (state.winner) {
      hints.push('試合終了です。再試行かデッキ編集に戻って次の検証を進められます。');
      if (canUndoBattle) hints.push(`直前操作を ${battleUndoCount} 件分まで巻き戻せます。`);
      return hints;
    }

    if (pendingChoice) {
      hints.push(`${pendingChoice.sourceCardName} の任意効果を解決してください。`);
      return hints;
    }

    if (setupRequired) {
      hints.push(`ラウンド開始処理として、セット可能タクティクスから1枚選んでください。残り候補は ${state.self.tacticsDeck.length} 枚です。`);
    }

    if (state.pendingDiscardCount > 0) {
      hints.push(`手札調整中です。あと ${state.pendingDiscardCount} 枚捨てるとターン進行を再開できます。`);
    }

    if (!setupRequired && state.pendingDiscardCount === 0) {
      if (state.ppCurrent <= 0) {
        hints.push('PPを使い切っています。ターン終了で次のドローとPP回復に進めます。');
      } else if (state.self.hand.length > 0) {
        hints.push(`手札は ${state.self.hand.length} 枚あります。PP ${state.ppCurrent} の範囲でカード使用を進められます。`);
      } else {
        hints.push('手札がないため、ターン終了で次のドローを待つ流れです。');
      }
    }

    if (!state.tacticsUsedThisTurn && state.self.tacticsSet.length > 0 && !setupRequired) {
      hints.push(`セット済みタクティクスが ${state.self.tacticsSet.length} 枚あります。このターン中に1枚使えます。`);
    }

    if (remainingOpponentLeaders === 1) {
      hints.push('相手リーダーは残り1体です。高打点か直撃効果で詰めを狙いやすい状況です。');
    }

    if (state.self.ppTicket && state.round === 1) {
      hints.push('後攻補助のPP回復タクティクスを使える前提です。序盤のテンポ確保を意識できます。');
    }

    if (canUndoBattle) {
      hints.push(`直前操作を ${battleUndoCount} 件分まで1手戻すで巻き戻せます。`);
    }

    return hints.slice(0, 3);
  }, [battleUndoCount, canUndoBattle, pendingChoice, remainingOpponentLeaders, setupRequired, state.pendingDiscardCount, state.ppCurrent, state.round, state.self.hand.length, state.self.ppTicket, state.self.tacticsDeck.length, state.self.tacticsSet.length, state.tacticsUsedThisTurn, state.winner]);

  return {
    isSelfSecond,
    setupRequired,
    canUndoBattle,
    pendingChoice,
    activeLeader,
    targetLeader,
    activeLeaderMaxHp,
    targetLeaderMaxHp,
    activeLeaderRemainingHp,
    targetLeaderRemainingHp,
    remainingOpponentLeaders,
    recentBattleHistory,
    roundSummaries,
    pendingChoiceSelectableCards,
    cardCatalogById,
    pendingChoiceSelectableLeaders,
    pendingChoiceNeedsCardSelection,
    pendingChoiceNeedsLeaderSelection,
    nextActionHints,
  };
}
