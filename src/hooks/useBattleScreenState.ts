import { useMemo } from 'react';
import type {
  Card,
  Leader,
  MatchState,
  PendingBattleChoice,
  RegisteredCard,
} from '../types/game';

type Params = {
  state: MatchState;
  battleUndoCount: number;
  cardCatalog: RegisteredCard[];
};

const CARD_SELECTION_KINDS: PendingBattleChoice['kind'][] = [
  'optional_discard_for_attack_bonus',
  'optional_cost0_discard_for_attack_bonus',
  'post_attack_self_discard',
  'self_discard_after_draw',
];

const LEADER_SELECTION_KINDS: PendingBattleChoice['kind'][] = [
  'post_attack_other_leader_damage',
  'drain_rod_heal_distribution',
  'drain_rod_damage_target',
];

export const getLeaderMaxHp = (leader: Leader) =>
  leader.baseHp + (leader.awakened ? 30 : 0);

export const getLeaderRemainingHp = (leader: Leader) =>
  Math.max(0, getLeaderMaxHp(leader) - leader.currentDamage);

const needsLeaderSelection = (pendingChoice?: PendingBattleChoice) =>
  Boolean(
    pendingChoice &&
      LEADER_SELECTION_KINDS.includes(pendingChoice.kind),
  );

const needsCardSelection = (pendingChoice?: PendingBattleChoice) =>
  Boolean(
    pendingChoice &&
      CARD_SELECTION_KINDS.includes(pendingChoice.kind),
  );

export default function useBattleScreenState({
  state,
  battleUndoCount,
  cardCatalog,
}: Params) {
  const isSelfSecond = state.firstPlayer === 'opponent';

  const setupRequired = useMemo(() => {
    const selfLeaderReady = state.self.leaders.length === 4;
    const opponentLeaderReady = state.opponent.leaders.length === 4;

    return !selfLeaderReady || !opponentLeaderReady;
  }, [state.self.leaders.length, state.opponent.leaders.length]);

  const canUndoBattle = battleUndoCount > 0;

  const activeLeader = useMemo(
    () =>
      state.self.leaders.find((leader) => leader.id === state.activeLeaderId) ??
      state.self.leaders[0] ??
      null,
    [state.activeLeaderId, state.self.leaders],
  );

  const targetLeader = useMemo(
    () =>
      state.opponent.leaders.find(
        (leader) => leader.id === state.targetLeaderId,
      ) ??
      state.opponent.leaders[0] ??
      null,
    [state.opponent.leaders, state.targetLeaderId],
  );

  const activeLeaderMaxHp = activeLeader ? getLeaderMaxHp(activeLeader) : 0;
  const targetLeaderMaxHp = targetLeader ? getLeaderMaxHp(targetLeader) : 0;

  const activeLeaderRemainingHp = activeLeader
    ? getLeaderRemainingHp(activeLeader)
    : 0;
  const targetLeaderRemainingHp = targetLeader
    ? getLeaderRemainingHp(targetLeader)
    : 0;

  const remainingOpponentLeaders = useMemo(
    () => state.opponent.leaders.filter((leader) => !leader.isDown).length,
    [state.opponent.leaders],
  );

  const recentBattleHistory = useMemo(
    () => [...state.battleHistory].slice(-8).reverse(),
    [state.battleHistory],
  );

  const recentRoundSummaries = useMemo(
    () => [...state.roundSummaries].reverse(),
    [state.roundSummaries],
  );

  const selectableCards = useMemo(() => {
    const pendingChoice = state.pendingChoice;
    if (!pendingChoice) return [];

    const selectableIds = new Set(pendingChoice.selectableHandCardIds ?? []);

    return state.self.hand.filter((card) => selectableIds.has(card.id));
  }, [state.pendingChoice, state.self.hand]);

  const selectableLeaders = useMemo(() => {
    const pendingChoice = state.pendingChoice;
    if (!pendingChoice || !needsLeaderSelection(pendingChoice)) return [];

    const selectableIds = new Set(pendingChoice.selectableLeaderIds);
    return [...state.self.leaders, ...state.opponent.leaders].filter((leader) =>
      selectableIds.has(leader.id),
    );
  }, [state.pendingChoice, state.self.leaders, state.opponent.leaders]);

  const requiresCardSelection = needsCardSelection(state.pendingChoice);
  const requiresLeaderSelection = needsLeaderSelection(state.pendingChoice);

  const cardCatalogMap = useMemo(
    () =>
      Object.fromEntries(cardCatalog.map((card) => [card.id, card])),
    [cardCatalog],
  );

  const latestLogMessage = state.logs.at(-1) ?? '操作を選択してください';

  const logStatusText = useMemo(() => {
    if (state.winner) {
      return state.winner === 'self' ? '勝利' : '敗北';
    }
    if (state.pendingChoice) {
      return '選択待ち';
    }
    if (setupRequired) {
      return '準備不足';
    }
    return '進行中';
  }, [state.pendingChoice, state.winner, setupRequired]);

  const nextActionHints = useMemo(() => {
    const hints: string[] = [];

    if (state.winner) {
      hints.push(
        state.winner === 'self'
          ? '対戦は終了しました。勝利結果を確認してください。'
          : '対戦は終了しました。敗北結果を確認してください。',
      );
      return hints;
    }

    if (state.pendingChoice) {
      hints.push(state.pendingChoice.prompt);
    }

    if (setupRequired) {
      hints.push('対戦前に自分側・相手側の4リーダー設定を確認してください。');
    }

    if (!state.roundTacticSelected) {
      hints.push('このラウンドのタクティクスをセットしてください。');
    }

    if (state.pendingDiscardCount > 0) {
      hints.push(`手札をあと ${state.pendingDiscardCount} 枚捨ててください。`);
    }

    if (
      !state.tacticsUsedThisTurn &&
      state.self.tacticsSet.length > 0 &&
      !state.pendingChoice
    ) {
      hints.push('セット済みタクティクスを使用できます。');
    }

    if (state.ppCurrent <= 0) {
      hints.push('PP が足りません。ターン終了または軽い行動を検討してください。');
    }

    if (remainingOpponentLeaders <= 1) {
      hints.push('相手リーダーは残りわずかです。フィニッシュを狙えます。');
    }

    if (
      isSelfSecond &&
      state.turn <= 1 &&
      state.self.ppTicket &&
      !state.pendingChoice
    ) {
      hints.push('後攻なので PP チケットの使いどころを確認してください。');
    }

    if (canUndoBattle) {
      hints.push('直前の操作はやり直しできます。');
    }

    if (!hints.length) {
      hints.push('アクティブリーダーと対象リーダーを確認して行動してください。');
    }

    return hints.slice(0, 3);
  }, [
    canUndoBattle,
    isSelfSecond,
    remainingOpponentLeaders,
    setupRequired,
    state.pendingChoice,
    state.pendingDiscardCount,
    state.ppCurrent,
    state.roundTacticSelected,
    state.self.ppTicket,
    state.self.tacticsSet.length,
    state.tacticsUsedThisTurn,
    state.turn,
    state.winner,
  ]);

  return {
    isSelfSecond,
    setupRequired,
    canUndoBattle,
    activeLeader,
    targetLeader,
    activeLeaderMaxHp,
    targetLeaderMaxHp,
    activeLeaderRemainingHp,
    targetLeaderRemainingHp,
    remainingOpponentLeaders,
    recentBattleHistory,
    recentRoundSummaries,
    selectableCards,
    selectableLeaders,
    requiresCardSelection,
    requiresLeaderSelection,
    nextActionHints,
    cardCatalogMap,
    latestLogMessage,
    logStatusText,
  };
}

