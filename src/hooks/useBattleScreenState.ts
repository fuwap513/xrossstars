import { useMemo } from 'react';
import type { MatchState, PendingBattleChoice, RegisteredCard } from '../types/game';

type Params = {
  state: MatchState;
  battleUndoCount: number;
  cardCatalog: RegisteredCard[];
};

export const getLeaderMaxHp = (leader?: { baseHp: number; awakened: boolean }) =>
  leader ? leader.baseHp + (leader.awakened ? 30 : 0) : 0;

const needsLeaderSelection = (pendingChoice?: PendingBattleChoice) =>
  pendingChoice?.kind === 'post_attack_other_leader_damage' ||
  pendingChoice?.kind === 'drain_rod_heal_distribution' ||
  pendingChoice?.kind === 'drain_rod_damage_target';

export default function useBattleScreenState({
  state,
  battleUndoCount,
  cardCatalog,
}: Params) {
  const isSelfSecond = state.firstPlayer === 'opponent';

  const setupRequired =
    !state.roundTacticSelected &&
    state.self.tacticsDeck.length > 0 &&
    !state.winner;

  const canUndoBattle = battleUndoCount > 0;
  const pendingChoice = state.pendingChoice;

  const activeLeader =
    state.self.leaders.find((leader) => leader.id === state.activeLeaderId) ??
    state.self.leaders[0];

  const targetLeader =
    state.opponent.leaders.find((leader) => leader.id === state.targetLeaderId) ??
    state.opponent.leaders[0];

  const activeLeaderMaxHp = getLeaderMaxHp(activeLeader);
  const targetLeaderMaxHp = getLeaderMaxHp(targetLeader);

  const activeLeaderRemainingHp = Math.max(
    activeLeaderMaxHp - (activeLeader?.currentDamage ?? 0),
    0,
  );

  const targetLeaderRemainingHp = Math.max(
    targetLeaderMaxHp - (targetLeader?.currentDamage ?? 0),
    0,
  );

  const remainingOpponentLeaders = state.opponent.leaders.filter(
    (leader) => !leader.isDown,
  ).length;

  const recentBattleHistory = state.battleHistory.slice(0, 30);

  const roundSummaries = useMemo(
    () => [...state.roundSummaries].reverse(),
    [state.roundSummaries],
  );

  const pendingChoiceSelectableCards = pendingChoice
    ? state.self.hand.filter((card) =>
        pendingChoice.selectableHandCardIds.includes(card.id),
      )
    : [];

  const cardCatalogById = useMemo(
    () => new Map(cardCatalog.map((card) => [card.id, card])),
    [cardCatalog],
  );

  const pendingChoiceSelectableLeaders =
    pendingChoice?.kind === 'post_attack_other_leader_damage' ||
    pendingChoice?.kind === 'drain_rod_damage_target'
      ? state.opponent.leaders.filter((leader) =>
          pendingChoice.selectableLeaderIds.includes(leader.id),
        )
      : pendingChoice?.kind === 'drain_rod_heal_distribution'
        ? state.self.leaders.filter((leader) =>
            pendingChoice.selectableLeaderIds.includes(leader.id),
          )
        : [];

  const pendingChoiceNeedsCardSelection = Boolean(
    pendingChoice &&
      pendingChoice.kind !== 'optional_trash_topdeck_for_next_attack_buff' &&
      !needsLeaderSelection(pendingChoice),
  );

  const pendingChoiceNeedsLeaderSelection = needsLeaderSelection(pendingChoice);

  const nextActionHints = useMemo(() => {
    const hints: string[] = [];

    if (state.winner) {
      hints.push(
  state.winner === 'self'
    ? '対戦終了：自分側の勝利です。'
    : '対戦終了：相手側の勝利です。',
);
      if (canUndoBattle) {
        hints.push(`直前の操作を取り消せます（${battleUndoCount} 件）。`);
      }
      return hints;
    }

    if (pendingChoice) {
      hints.push(`${pendingChoice.sourceCardName} の処理を選択してください。`);
      return hints;
    }

    if (setupRequired) {
      hints.push(
  `ラウンド開始前にタクティクスをセットしてください（残り ${state.self.tacticsDeck.length} 枚）。`,
);
    }

    if (state.pendingDiscardCount > 0) {
      hints.push(`手札をあと ${state.pendingDiscardCount} 枚捨ててください。`);
    }

    if (!setupRequired && state.pendingDiscardCount === 0) {
      if (state.ppCurrent <= 0) {
        hints.push('PP が足りません。ターン終了または軽い行動を検討してください。');
      } else if (state.self.hand.length > 0) {
        hints.push(
          `手札 ${state.self.hand.length} 枚。PP ${state.ppCurrent} を使って行動できます。`,
        );
      } else {
        hints.push('手札がありません。ターン終了を検討してください。');
      }
    }

    if (
      !state.tacticsUsedThisTurn &&
      state.self.tacticsSet.length > 0 &&
      !setupRequired
    ) {
      hints.push(
  `セット済みタクティクスが ${state.self.tacticsSet.length} 枚あります。1枚使用できます。`,
);
    }

    if (remainingOpponentLeaders === 1) {
      hints.push('相手リーダーは残り1体です。');
    }

    if (state.self.ppTicket && state.round === 1) {
      hints.push('PPチケットを使える状況です。');
    }

    if (canUndoBattle) {
      hints.push(`直前の操作を取り消せます（${battleUndoCount} 件）。`);
    }

    return hints.slice(0, 3);
  }, [
    battleUndoCount,
    canUndoBattle,
    pendingChoice,
    remainingOpponentLeaders,
    setupRequired,
    state.pendingDiscardCount,
    state.ppCurrent,
    state.round,
    state.self.hand.length,
    state.self.ppTicket,
    state.self.tacticsDeck.length,
    state.self.tacticsSet.length,
    state.tacticsUsedThisTurn,
    state.winner,
  ]);

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

    // 追加 alias（将来 BattleScreen 側を更新するとき用）
    recentRoundSummaries: roundSummaries,
    selectableCards: pendingChoiceSelectableCards,
    selectableLeaders: pendingChoiceSelectableLeaders,
    requiresCardSelection: pendingChoiceNeedsCardSelection,
    requiresLeaderSelection: pendingChoiceNeedsLeaderSelection,
    cardCatalogMap: Object.fromEntries(cardCatalog.map((card) => [card.id, card])),
    latestLogMessage: state.logs.at(-1) ?? '操作を選択してください。',
    logStatusText: state.winner
  ? state.winner === 'self'
    ? '勝利'
    : '敗北'
  : pendingChoice
    ? '選択待ち'
    : setupRequired
      ? '準備中'
      : '進行中',
  };
}
