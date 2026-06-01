import type { Card, Leader, LeaderSetupEntry, MatchState, PendingBattleChoice, PlayerBoard, RegisteredCard, Side } from '../types/game';

type RuntimeDeps = {
  log: (message: string) => void;
  onRoundWin: () => void;
};

type DamageResult = {
  targetId: string;
  targetName: string;
  downed: boolean;
  overkill: number;
  dealt: number;
};

type AttackContext = {
  attacker: Leader;
  targetId: string;
  targetName: string;
  targetColor?: string;
  damage: number;
  downed: boolean;
  overkill: number;
  postEffectDamageDealt: boolean;
};

type ResolveAttackOptions = {
  fromFreePlay?: boolean;
  bypassPreAttackChoice?: boolean;
  choiceBonusDamage?: number;
};

const normalizeText = (text: string) => text.replace(/\r/g, '').trim();
const getBoard = (state: MatchState, side: Side): PlayerBoard => (side === 'self' ? state.self : state.opponent);
const getOppositeSide = (side: Side): Side => (side === 'self' ? 'opponent' : 'self');
const parseIntSafe = (value?: string) => {
  if (!value) return undefined;
  const matched = value.match(/\d+/);
  return matched ? Number(matched[0]) : undefined;
};
const getCurrentLeaderAtk = (leader: Leader) => leader.baseAtk + (leader.awakened ? 10 : 0);

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
};

const getLeaderById = (leaders: Leader[], leaderId: string) => leaders.find((leader) => leader.id === leaderId);
const getLivingLeaders = (leaders: Leader[]) => leaders.filter((leader) => !leader.isDown);
const getOtherLivingLeaders = (leaders: Leader[], leaderId: string) => leaders.filter((leader) => !leader.isDown && leader.id !== leaderId);
const textIncludes = (text: string, needle: string) => normalizeText(text).includes(needle);

const getForcedTargetLeader = (state: MatchState) => state.opponent.leaders.find((leader) => !leader.isDown && textIncludes(leader.effectText ?? '', 'このリーダーにしかアタックできない'));

const resolveOpponentTarget = (state: MatchState, preferredId?: string) => {
  const forced = getForcedTargetLeader(state);
  if (forced) return forced;
  const preferred = state.opponent.leaders.find((leader) => leader.id === (preferredId ?? state.targetLeaderId) && !leader.isDown);
  if (preferred) return preferred;
  return state.opponent.leaders.find((leader) => !leader.isDown);
};

const getEquipmentCards = (board: PlayerBoard, leaderId?: string) => board.equipmentZone.filter((card) => !leaderId || card.equippedLeaderId === leaderId);

export const getEquipmentBuff = (board: PlayerBoard, leaderId?: string) => getEquipmentCards(board, leaderId).reduce((total, card) => total + (card.effectValue || 0), 0);

export const getLeaderHp = (leader: Leader) => leader.baseHp + (leader.awakened ? 30 : 0);

export const createLeaderFromCatalog = (entry: LeaderSetupEntry, cardCatalog: RegisteredCard[]): Leader => {
  const matchedLeader = cardCatalog.find((card) => card.type === 'leader' && card.name === entry.name.trim());
  return {
    id: entry.id,
    name: entry.name,
    baseAtk: parseIntSafe(matchedLeader?.baseAtk) ?? 30,
    baseHp: entry.baseHp,
    awakened: false,
    currentDamage: 0,
    isDown: false,
    sourceCardId: matchedLeader?.id,
    effectText: matchedLeader?.text,
    color: matchedLeader?.color,
    rarity: matchedLeader?.rarity,
  };
};

export const drawCards = (board: PlayerBoard, count: number, state: MatchState, deps: Pick<RuntimeDeps, 'log'>) => {
  for (let drawIndex = 0; drawIndex < count; drawIndex += 1) {
    if (board.mainDeck.length === 0) {
      if (board.trash.length === 0) {
        deps.log('山札もトラッシュも空のためドローできません');
        break;
      }
      board.mainDeck = shuffle(board.trash);
      board.trash = [];
      if (board.tacticsDeck.length > 0) {
        const discardIndex = Math.floor(Math.random() * board.tacticsDeck.length);
        const [discardedTactic] = board.tacticsDeck.splice(discardIndex, 1);
        board.trash.push(discardedTactic);
        deps.log(`山札再構築: 未選択タクティクス「${discardedTactic.name}」をトラッシュ`);
      } else {
        deps.log('山札再構築: トラッシュをシャッフルして山札に戻しました');
      }
    }
    const nextCard = board.mainDeck.shift();
    if (!nextCard) break;
    board.hand.push(nextCard);
  }
};

export const resetTurnDamage = (leaders: Leader[]) => {
  leaders.forEach((leader) => {
    if (!leader.isDown) leader.currentDamage = 0;
  });
};

const drawSelf = (state: MatchState, count: number, deps: RuntimeDeps) => {
  if (count <= 0) return;
  drawCards(state.self, count, state, deps);
  state.effectDrawCountThisTurn += count;
  deps.log(`カードを ${count} 枚引きました`);
};

const drawBothPlayers = (state: MatchState, count: number, deps: RuntimeDeps) => {
  drawCards(state.self, count, state, deps);
  drawCards(state.opponent, count, state, deps);
  state.effectDrawCountThisTurn += count;
  deps.log(`両プレイヤーが ${count} 枚引きました`);
};

const discardFromHand = (board: PlayerBoard, count: number, state: MatchState, deps: RuntimeDeps, mode: 'first' | 'random' | 'cost0' = 'first') => {
  let discarded = 0;
  for (let index = 0; index < count; index += 1) {
    if (board.hand.length === 0) break;
    let cardIndex = 0;
    if (mode === 'random') {
      cardIndex = Math.floor(Math.random() * board.hand.length);
    } else if (mode === 'cost0') {
      const foundIndex = board.hand.findIndex((card) => card.cost === 0);
      if (foundIndex >= 0) cardIndex = foundIndex;
    }
    const [discardedCard] = board.hand.splice(cardIndex, 1);
    board.trash.push(discardedCard);
    if (board === state.self) state.cardsDiscardedThisTurn += 1;
    deps.log(`${board.name} の手札から「${discardedCard.name}」を捨てました`);
    discarded += 1;
  }
  return discarded;
};

const healLeader = (leader: Leader, amount: number) => {
  if (leader.isDown || amount <= 0) return 0;
  const healed = Math.min(amount, leader.currentDamage);
  leader.currentDamage -= healed;
  return healed;
};

const healSelectedLeader = (state: MatchState, amount: number, deps: RuntimeDeps) => {
  const leader = getLeaderById(state.self.leaders, state.activeLeaderId) ?? state.self.leaders.find((item) => !item.isDown);
  if (!leader) return 0;
  const healed = healLeader(leader, amount);
  deps.log(`${leader.name} を ${healed} 回復`);
  return healed;
};

const healDistributed = (state: MatchState, totalAmount: number, deps: RuntimeDeps) => {
  let remaining = totalAmount;
  let healedTotal = 0;
  const candidates = [...state.self.leaders]
    .filter((leader) => !leader.isDown && leader.currentDamage > 0)
    .sort((a, b) => b.currentDamage - a.currentDamage);
  for (const leader of candidates) {
    if (remaining <= 0) break;
    const healed = healLeader(leader, remaining);
    if (healed > 0) deps.log(`${leader.name} を ${healed} 回復`);
    healedTotal += healed;
    remaining -= healed;
  }
  return healedTotal;
};

const recoverPp = (state: MatchState, amount: number, deps: RuntimeDeps) => {
  if (amount <= 0) return 0;
  const before = state.ppCurrent;
  state.ppCurrent = Math.min(state.ppMax, state.ppCurrent + amount);
  const gained = state.ppCurrent - before;
  if (gained > 0) deps.log(`PPを ${gained} 回復`);
  return gained;
};

const countFieldCards = (state: MatchState, predicate: (card: Card) => boolean, excludeId?: string) => state.fieldCards.filter((card) => card.id !== excludeId && predicate(card)).length;
const sumFieldMemoriaCost = (state: MatchState) => state.fieldCards.filter((card) => card.type === 'memoria').reduce((sum, card) => sum + card.cost, 0);

const applyDamageToLeader = (state: MatchState, side: Side, leaderId: string, damage: number, deps: RuntimeDeps, sourceLeaderId?: string): DamageResult | null => {
  const board = getBoard(state, side);
  const leader = board.leaders.find((item) => item.id === leaderId);
  if (!leader || leader.isDown || damage <= 0) return null;
  const remainingBefore = Math.max(getLeaderHp(leader) - leader.currentDamage, 0);
  leader.currentDamage += damage;
  deps.log(`${leader.name} に ${damage} ダメージ`);
  let downed = false;
  let overkill = 0;
  if (leader.currentDamage >= getLeaderHp(leader)) {
    downed = true;
    overkill = Math.max(0, damage - remainingBefore);
    leader.isDown = true;
    leader.currentDamage = getLeaderHp(leader);
    deps.log(`${leader.name} をダウン`);
    if (sourceLeaderId && side === 'opponent') {
      const attacker = state.self.leaders.find((item) => item.id === sourceLeaderId);
      if (attacker && !attacker.awakened) {
        attacker.awakened = true;
        deps.log(`${attacker.name} が覚醒: ATK +10 / HP +30`);
        resolveLeaderEffect(state, attacker, deps);
      }
    }
    if (side === 'opponent' && state.opponent.leaders.every((item) => item.isDown)) {
      deps.onRoundWin();
    }
  }
  return {
    targetId: leader.id,
    targetName: leader.name,
    downed,
    overkill,
    dealt: damage,
  };
};

const applyDamageToSelectedOpponent = (state: MatchState, damage: number, deps: RuntimeDeps, sourceLeaderId?: string, preferredId?: string) => {
  const target = resolveOpponentTarget(state, preferredId);
  if (!target) {
    deps.log('有効な攻撃対象が選択されていません');
    return null;
  }
  state.targetLeaderId = target.id;
  return applyDamageToLeader(state, 'opponent', target.id, damage, deps, sourceLeaderId);
};

const applyDamageToOtherOpponent = (state: MatchState, amount: number, deps: RuntimeDeps, excludedId?: string, onlyDamaged = false, sameColor?: string) => {
  const target = state.opponent.leaders.find((leader) => !leader.isDown && leader.id !== excludedId && (!onlyDamaged || leader.currentDamage > 0) && (!sameColor || leader.color === sameColor));
  return target ? applyDamageToLeader(state, 'opponent', target.id, amount, deps) : null;
};

const queuePostAttackOtherLeaderDamageChoice = (
  state: MatchState,
  card: Card,
  context: AttackContext,
  amount: number,
  deps: RuntimeDeps,
  onlyDamaged = false,
  sameColor?: string,
) => {
  void onlyDamaged;
  state.postAttackEffectQueue.push({
    kind: 'other_leader_damage',
    sourceCardName: card.name,
    sourceText: card.text,
    damageAmount: amount,
    attackerLeaderId: context.attacker.id,
    attackedLeaderId: context.targetId,
    targetColor: sameColor ?? context.targetColor,
  });
  deps.log(`${card.name}: アタック後のダメージ割り振り先を選択してください`);
  return true;
};

const flushQueuedPostAttackEffects = (state: MatchState, deps: RuntimeDeps) => {
  if (state.pendingChoice) return false;
  while (state.postAttackEffectQueue.length > 0) {
    const effect = state.postAttackEffectQueue.shift();
    if (!effect) return false;

    if (effect.kind === 'all_other_leader_damage') {
      const inflicted = applyDamageToAllOtherOpponents(
        state,
        effect.damageAmount,
        deps,
        effect.attackedLeaderId,
      );
      if (inflicted) {
        deps.log(`${effect.sourceCardName}: アタック後に相手の他のリーダーすべてへ ${effect.damageAmount} ダメージ`);
      } else {
        deps.log(`${effect.sourceCardName}: ダメージを与えられる他のリーダーがいません`);
      }
      continue;
    }

    if (effect.kind === 'other_leader_damage') {
      const selectableLeaderIds = state.opponent.leaders
        .filter((leader) => !leader.isDown && leader.id !== effect.attackedLeaderId)
        .map((leader) => leader.id);
      if (selectableLeaderIds.length === 0) {
        deps.log(`${effect.sourceCardName}: ダメージを割り振れる別リーダーがいません`);
        continue;
      }
      state.pendingChoice = {
        kind: 'post_attack_other_leader_damage',
        cardInstanceId: `queued-${effect.sourceCardName}`,
        sourceCardName: effect.sourceCardName,
        sourceText: effect.sourceText,
        prompt: `【アタック後】別のリーダー1体を選び、${effect.damageAmount}ダメージを与えてください。`,
        damageAmount: effect.damageAmount,
        selectableLeaderIds,
        selectableHandCardIds: [],
        attackerLeaderId: effect.attackerLeaderId,
        attackedLeaderId: effect.attackedLeaderId,
        targetDowned: false,
        targetColor: effect.targetColor,
      };
      return true;
    }
  }
  return false;
};

const applyDamageToAllOtherOpponents = (state: MatchState, amount: number, deps: RuntimeDeps, excludedId?: string, onlyDamaged = false, sameColor?: string) => {
  let inflicted = false;
  state.opponent.leaders
    .filter((leader) => !leader.isDown && leader.id !== excludedId && (!onlyDamaged || leader.currentDamage > 0) && (!sameColor || leader.color === sameColor))
    .forEach((leader) => {
      inflicted = true;
      applyDamageToLeader(state, 'opponent', leader.id, amount, deps);
    });
  return inflicted;
};

const canPlayWithoutCost = (state: MatchState, card: Card, forceCostPayment = false) => {
  if (forceCostPayment) return false;
  if (textIncludes(card.text, `プレイエリアに別の「${card.name}」が1枚あるなら、コストを支払わずにこのカードをプレイしてもよい`)) {
    const sameNameCount = state.fieldCards.filter((fieldCard) => fieldCard.name === card.name).length;
    return sameNameCount === 1;
  }
  return false;
};

const buildPreAttackChoice = (state: MatchState, card: Card): PendingBattleChoice | null => {
  const text = normalizeText(card.text);
  if (text.includes('手札を1枚捨ててもよい。そうしたならダメージ+20')) {
    const selectableHandCardIds = state.self.hand.map((handCard) => handCard.id).filter((handCardId) => handCardId !== card.id);
    if (selectableHandCardIds.length === 0) return null;
    return {
      kind: 'optional_discard_for_attack_bonus',
      cardInstanceId: card.id,
      sourceCardName: card.name,
      sourceText: card.text,
      prompt: '手札を1枚捨てると、このアタックのダメージが+20されます。',
      bonusDamage: 20,
      selectableHandCardIds,
    };
  }
  if (text.includes('自分の手札のコスト0のカード1枚を公開し、捨ててもよい')) {
    const selectableHandCardIds = state.self.hand
      .filter((handCard) => handCard.cost === 0 && handCard.id !== card.id)
      .map((handCard) => handCard.id);
    if (selectableHandCardIds.length === 0) return null;
    const bonusDamage = text.includes('ダメージ+40') ? 40 : 20;
    return {
      kind: 'optional_cost0_discard_for_attack_bonus',
      cardInstanceId: card.id,
      sourceCardName: card.name,
      sourceText: card.text,
      prompt: `手札のコスト0カード1枚を公開して捨てると、カードを1枚引き、このアタックのダメージが+${bonusDamage}されます。`,
      bonusDamage,
      drawCount: 1,
      selectableHandCardIds,
    };
  }
  return null;
};


const queueSelfDiscardAfterDraw = (state: MatchState, card: Card, discardCount: number, deps: RuntimeDeps) => {
  const discardCountRemaining = Math.min(discardCount, state.self.hand.length);
  if (discardCountRemaining <= 0) {
    deps.log(`${card.name}: 捨てる手札がないため追加ディスカードはありません`);
    return false;
  }
  state.pendingChoice = {
    kind: 'self_discard_after_draw',
    cardInstanceId: card.id,
    sourceCardName: card.name,
    sourceText: card.text,
    prompt: discardCountRemaining > 1
      ? `手札を${discardCountRemaining}枚、順に選んで捨ててください。`
      : '手札を1枚選んで捨ててください。',
    discardCountRemaining,
    selectableHandCardIds: state.self.hand.map((handCard) => handCard.id),
  };
  deps.log(`${card.name}: 手札を${discardCountRemaining}枚選んで捨ててください`);
  return true;
};

const queueTopDeckPeekChoice = (state: MatchState, card: Card, deps: RuntimeDeps) => {
  const revealedCard = state.self.mainDeck.shift();
  if (!revealedCard) {
    deps.log(`${card.name}: 山札がないため確認できません`);
    return false;
  }
  state.pendingChoice = {
    kind: 'optional_trash_topdeck_for_next_attack_buff',
    cardInstanceId: card.id,
    sourceCardName: card.name,
    sourceText: card.text,
    prompt: `山札の上を確認しました: ${revealedCard.name} をトラッシュに置いてもよい。`,
    revealedCard,
    selectableHandCardIds: [],
  };
  deps.log(`${card.name}: 山札の上を確認しました（${revealedCard.name}）`);
  return true;
};

const queueDrainRodHealChoice = (state: MatchState, card: Card, deps: RuntimeDeps, remainingHeal = 40, healedTotal = 0) => {
  const damageTargetIds = state.opponent.leaders.filter((leader) => !leader.isDown).map((leader) => leader.id);
  if (remainingHeal <= 0) {
    if (healedTotal > 0 && damageTargetIds.length > 0) {
      state.pendingChoice = {
        kind: 'drain_rod_damage_target',
        cardInstanceId: card.id,
        sourceCardName: card.name,
        sourceText: card.text,
        prompt: `回復した合計 ${healedTotal} をダメージとして与える相手リーダー1体を選んでください。`,
        damageAmount: healedTotal,
        selectableLeaderIds: damageTargetIds,
        selectableHandCardIds: [],
      };
      deps.log(`${card.name}: 回復量と同じダメージの対象を選択してください`);
      return true;
    }
    if (healedTotal > 0) deps.log(`${card.name}: 相手リーダーがいないため追加ダメージは発生しません`);
    return false;
  }
  const selectableLeaderIds = state.self.leaders
    .filter((leader) => !leader.isDown && leader.currentDamage > 0)
    .map((leader) => leader.id);
  if (selectableLeaderIds.length === 0) {
    if (healedTotal > 0) {
      if (damageTargetIds.length > 0) {
        state.pendingChoice = {
          kind: 'drain_rod_damage_target',
          cardInstanceId: card.id,
          sourceCardName: card.name,
          sourceText: card.text,
          prompt: `回復した合計 ${healedTotal} をダメージとして与える相手リーダー1体を選んでください。`,
          damageAmount: healedTotal,
          selectableLeaderIds: damageTargetIds,
          selectableHandCardIds: [],
        };
        deps.log(`${card.name}: 回復量と同じダメージの対象を選択してください`);
        return true;
      }
      deps.log(`${card.name}: 相手リーダーがいないため追加ダメージは発生しません`);
      return false;
    }
    deps.log(`${card.name}: 回復できる自分リーダーがいないためダメージも発生しません`);
    return false;
  }
  state.pendingChoice = {
    kind: 'drain_rod_heal_distribution',
    cardInstanceId: card.id,
    sourceCardName: card.name,
    sourceText: card.text,
    prompt: `自分のリーダーを合計40回復します。回復先を選んでください（残り ${remainingHeal} / 累計回復 ${healedTotal}）。`,
    remainingHeal,
    healedTotal,
    selectableLeaderIds,
    selectableHandCardIds: [],
  };
  deps.log(`${card.name}: 回復先の自分リーダーを選択してください`);
  return true;
};

const playEligibleHandMemoria = (state: MatchState, maxCostSum: number, deps: RuntimeDeps) => {
  const candidates = state.self.hand.filter((card) => card.type === 'memoria' && card.cost <= maxCostSum && !textIncludes(card.text, 'エース'));
  let totalCost = 0;
  const chosen: Card[] = [];
  for (const card of candidates.sort((a, b) => a.cost - b.cost)) {
    if (totalCost + card.cost > maxCostSum) continue;
    chosen.push(card);
    totalCost += card.cost;
  }
  chosen.forEach((card) => {
    const handIndex = state.self.hand.findIndex((item) => item.id === card.id);
    if (handIndex >= 0) {
      const [picked] = state.self.hand.splice(handIndex, 1);
      state.fieldCards.push(picked);
      deps.log(`【自動解決】${picked.name} を追加でプレイ`);
      resolveNonAttackCardEffect(state, picked, deps);
    }
  });
};

const playTopDeckCards = (state: MatchState, lookCount: number, deps: RuntimeDeps, mode: 'memoria-cost1' | 'memoria-attack-cost1' | 'trash-only') => {
  const viewed = state.self.mainDeck.splice(0, lookCount);
  if (viewed.length === 0) {
    deps.log('山札にカードがなく、追加解決できません');
    return;
  }
  deps.log(`山札の上から ${viewed.length} 枚を確認`);
  if (mode === 'trash-only') {
    state.self.trash.push(...viewed);
    deps.log('確認したカードをトラッシュに置きました');
    return;
  }
  const toPlay: Card[] = [];
  if (mode === 'memoria-cost1') {
    const candidate = viewed.find((card) => card.type === 'memoria' && card.cost <= 1);
    if (candidate) toPlay.push(candidate);
  } else if (mode === 'memoria-attack-cost1') {
    const memoria = viewed.find((card) => card.type === 'memoria' && card.cost <= 1);
    if (memoria) toPlay.push(memoria);
    const attack = viewed.find((card) => card.type === 'attack' && card.cost <= 1 && !toPlay.some((picked) => picked.id === card.id));
    if (attack) toPlay.push(attack);
  }
  viewed.forEach((card) => {
    if (toPlay.some((picked) => picked.id === card.id)) return;
    state.self.trash.push(card);
  });
  toPlay.forEach((card) => {
    deps.log(`【自動解決】${card.name} をコストなしでプレイ`);
    if (card.type === 'attack') {
      state.fieldCards.push(card);
      resolveAttackCard(state, card, deps, { fromFreePlay: true });
    } else {
      state.fieldCards.push(card);
      resolveNonAttackCardEffect(state, card, deps);
    }
  });
};

const replayFieldMemoria = (state: MatchState, maxCount: number, deps: RuntimeDeps) => {
  const targets = state.fieldCards.filter((card) => card.type === 'memoria' && card.cost === 0).slice(0, maxCount);
  targets.forEach((card) => {
    deps.log(`【再プレイ】${card.name} の効果を再実行`);
    resolveNonAttackCardEffect(state, card, deps);
  });
};

const runPostAttackEffects = (state: MatchState, card: Card, context: AttackContext, deps: RuntimeDeps) => {
  const text = normalizeText(card.text);
  const conditionTargetDown = text.includes('このアタックを受けたリーダーがダウンしているなら');
  if (conditionTargetDown && !context.downed) return;
  const round3Only = text.includes('このラウンドが3ラウンド目なら');
  if (round3Only && state.round !== 3) return;

  const overkillMatch = text.match(/オーバーキル(\d+)/);
  if (overkillMatch && context.overkill < Number(overkillMatch[1])) return;

  if (text.includes('プレイエリアにメモリアカードが2枚以上あるなら') && countFieldCards(state, (fieldCard) => fieldCard.type === 'memoria', card.id) < 2) return;
  if (text.includes('プレイエリアにメモリアカードが3枚以上あるなら') && countFieldCards(state, (fieldCard) => fieldCard.type === 'memoria', card.id) < 3) return;
  if (text.includes('自分の手札が2枚以下なら') && state.self.hand.length > 2) return;

  if (text.includes('カードを1枚引き、対戦相手は手札を1枚捨てる')) {
    drawSelf(state, 1, deps);
    discardFromHand(state.opponent, 1, state, deps);
  }
  if (/【アタック後】カードを2枚引く/.test(text)) drawSelf(state, 2, deps);
  else if (/【アタック後】カードを1枚引く/.test(text)) drawSelf(state, 1, deps);
  if (text.includes('カードを1枚引き、手札を1枚捨てる')) {
    drawSelf(state, 1, deps);
    discardFromHand(state.self, 1, state, deps);
  }
  if (text.includes('対戦相手は手札を1枚捨てる')) discardFromHand(state.opponent, 1, state, deps);
  if (text.includes('すべてのプレイヤーは手札を1枚捨てる')) {
    discardFromHand(state.opponent, 1, state, deps);
    const selectableHandCardIds = state.self.hand.map((handCard) => handCard.id);
    if (selectableHandCardIds.length > 0) {
      state.pendingChoice = {
        kind: 'post_attack_self_discard',
        cardInstanceId: card.id,
        sourceCardName: card.name,
        sourceText: card.text,
        prompt: '【アタック後】自分の手札を1枚選んで捨ててください。',
        selectableHandCardIds,
      };
      deps.log(`${card.name}: アタック後の手札1枚ディスカードを選択してください`);
    } else {
      deps.log(`${card.name}: 自分の手札がないため追加ディスカードはありません`);
    }
  }
  if (text.includes('PPを2回復')) recoverPp(state, 2, deps);
  else if (text.includes('PPを1回復')) recoverPp(state, 1, deps);
  if (text.includes('自分のリーダー1体を30回復')) healSelectedLeader(state, 30, deps);
  if (text.includes('対戦相手の他のリーダー1体に90ダメージ')) {
    queuePostAttackOtherLeaderDamageChoice(state, card, context, 90, deps);
  }
  if (text.includes('対戦相手の他のリーダー1体に50ダメージ')) {
    queuePostAttackOtherLeaderDamageChoice(state, card, context, 50, deps);
  }
  if (text.includes('対戦相手の他のリーダー1体に40ダメージ')) {
    queuePostAttackOtherLeaderDamageChoice(state, card, context, 40, deps);
  }
  if (text.includes('対戦相手の他のリーダー1体に30ダメージ')) {
    queuePostAttackOtherLeaderDamageChoice(state, card, context, 30, deps);
  }
  if (text.includes('対戦相手の他のリーダー1体に20ダメージ')) {
    queuePostAttackOtherLeaderDamageChoice(state, card, context, 20, deps);
  }
  if (text.includes('対戦相手の他のリーダー1体に10ダメージ')) {
    queuePostAttackOtherLeaderDamageChoice(state, card, context, 10, deps);
  }
  if (text.includes('対戦相手の他のリーダーすべてに20ダメージ')) {
    if (applyDamageToAllOtherOpponents(state, 20, deps, context.targetId)) context.postEffectDamageDealt = true;
  }
  if (text.includes('対戦相手の他のリーダーすべてに10ダメージ')) {
    if (applyDamageToAllOtherOpponents(state, 10, deps, context.targetId)) context.postEffectDamageDealt = true;
  }
  if (text.includes('対戦相手のダメージを受けている他のリーダーすべてに20ダメージ')) {
    if (applyDamageToAllOtherOpponents(state, 20, deps, context.targetId, true)) context.postEffectDamageDealt = true;
  }
  if (text.includes('同じ色を持つ対戦相手の他のリーダーすべてに40ダメージ')) {
    if (applyDamageToAllOtherOpponents(state, 40, deps, context.targetId, false, context.targetColor)) context.postEffectDamageDealt = true;
  }
  if (text.includes('自分の手札のエース以外のメモリアカードを、コストの合計が3以下になるように好きな枚数公開する')) {
    playEligibleHandMemoria(state, 3, deps);
  }
  if (text.includes('自分のデッキの上から3枚を見る。その中からコスト1以下のメモリアカード1枚を、コストを支払わずにプレイしてもよい')) {
    playTopDeckCards(state, 3, deps, 'memoria-cost1');
  }
  if (text.includes('プレイエリアのエース以外のコスト0のメモリアカードを最大2枚選び、プレイし直す')) {
    replayFieldMemoria(state, 2, deps);
  }
  if (text.includes('プレイエリアにあるメモリアカードのコストの合計と同じ数のカードを引く')) {
    drawSelf(state, sumFieldMemoriaCost(state), deps);
  }
  if (text.includes('【アタック強化】次のアタックのダメージ+20')) {
    state.nextAttackBuff += 20;
    deps.log(`${card.name}: 次のアタック +20`);
  }
};

const applyPostEffectDamageEquipmentTriggers = (
  state: MatchState,
  attackerLeaderId: string,
  attackedLeaderId: string,
  deps: RuntimeDeps,
) => {
  const equipped = getEquipmentCards(state.self, attackerLeaderId);
  equipped.forEach((equipment) => {
    const triggerKey = `${state.round}-${state.turn}`;
    const text = normalizeText(equipment.text);
    if (equipment.oncePerTurnUsedKey === triggerKey) return;
    if (text.includes('【アタック後】このアタックの【アタック後】効果でダメージを与えているなら')) {
      equipment.oncePerTurnUsedKey = triggerKey;
      applyDamageToAllOtherOpponents(state, 10, deps, attackedLeaderId);
      deps.log(`${equipment.name} の装備効果が発動`);
    }
  });
};

const applyEquipmentTriggeredEffects = (state: MatchState, context: AttackContext, deps: RuntimeDeps) => {
  const equipped = getEquipmentCards(state.self, context.attacker.id);
  equipped.forEach((equipment) => {
    const triggerKey = `${state.round}-${state.turn}`;
    const text = normalizeText(equipment.text);
    if (equipment.oncePerTurnUsedKey === triggerKey) return;
    if (text.includes('【アタック後】このアタックの【アタック後】効果でダメージを与えているなら') && context.postEffectDamageDealt) {
      equipment.oncePerTurnUsedKey = triggerKey;
      applyDamageToAllOtherOpponents(state, 10, deps, context.targetId);
      deps.log(`${equipment.name} の装備効果が発動`);
    }
    if (text.includes('【アタック後】このアタックを受けたリーダーがダウンしているなら、カードを1枚引く') && context.downed) {
      equipment.oncePerTurnUsedKey = triggerKey;
      drawSelf(state, 1, deps);
      deps.log(`${equipment.name} の装備効果が発動`);
    }
    if (text.includes('【アタック後】自分のリーダー1体を20回復する')) {
      equipment.oncePerTurnUsedKey = triggerKey;
      healSelectedLeader(state, 20, deps);
      deps.log(`${equipment.name} の装備効果が発動`);
    }
  });
};

const getAttackBonusFromText = (state: MatchState, card: Card, attacker: Leader, target: Leader) => {
  const text = normalizeText(card.text);
  let bonus = 0;
  const flatBonusMatches = [...text.matchAll(/ダメージ([+-]\d+)/g)];
  if (flatBonusMatches.length > 0) bonus += Number(flatBonusMatches[0][1]);
  if (text.includes('プレイエリアに他のアタックカードが2枚以上あるなら、ダメージ+40')) {
    const otherAttackCount = countFieldCards(state, (fieldCard) => fieldCard.type === 'attack', card.id);
    if (otherAttackCount >= 2) bonus += 40;
    if (otherAttackCount >= 4) bonus += 20;
  }
  if (text.includes('アタッカーが覚醒しているなら、ダメージ+10') && attacker.awakened) bonus += 10;
  if (text.includes('このラウンドが3ラウンド目なら、ダメージ+20') && state.round === 3) bonus += 20;
  if (text.includes('このターン、あなたが手札を1枚以上捨てているなら、ダメージ+10') && state.cardsDiscardedThisTurn > 0) bonus += 10;
  if (text.includes('アタッカーがカードを装備しているなら、ダメージ+10') && getEquipmentCards(state.self, attacker.id).length > 0) bonus += 10;
  if (text.includes('手札を1枚ランダムに捨ててもよい。そうしたならダメージ+30') && state.self.hand.length > 0) {
    discardFromHand(state.self, 1, state, { ...depsStub, log: () => undefined, onRoundWin: () => undefined }, 'random');
    bonus += 30;
  }
  if (text.includes('プレイエリアにメモリアカードが3枚以上あるなら、次のアタックのダメージ+30') && countFieldCards(state, (fieldCard) => fieldCard.type === 'memoria', card.id) >= 3) bonus += 30;
  if (text.includes('プレイエリアにメモリアカードが3枚以上あるなら、さらにダメージ+50') && countFieldCards(state, (fieldCard) => fieldCard.type === 'memoria', card.id) >= 3) bonus += 50;
  if (text.includes('アタッカーがカードを装備しているなら、さらにダメージ+20') && getEquipmentCards(state.self, attacker.id).length > 0) bonus += 20;
  if (text.includes('対戦相手のデッキの上から1枚を公開し、トラッシュに置く')) {
    const revealed = state.opponent.mainDeck.shift();
    if (revealed) {
      state.opponent.trash.push(revealed);
      if (text.includes('そのカードがアタックカードなら、ダメージ+20') && revealed.type === 'attack') bonus += 20;
      if (text.includes('そのカードがメモリアカードなら、ダメージ+20') && revealed.type === 'memoria') bonus += 20;
    }
  }
  void target;
  return bonus;
};

const depsStub: RuntimeDeps = { log: () => undefined, onRoundWin: () => undefined };

const resolveLeaderEffect = (state: MatchState, leader: Leader, deps: RuntimeDeps) => {
  const text = normalizeText(leader.effectText ?? '');
  if (!text) return;
  if (text.includes('カードを1枚引く')) drawSelf(state, 1, deps);
  if (text.includes('カードを2枚引き、手札を2枚捨てる')) {
    drawSelf(state, 2, deps);
    discardFromHand(state.self, 2, state, deps);
  }
  if (text.includes('自分のリーダー1体を20回復する')) healSelectedLeader(state, 20, deps);
  if (text.includes('対戦相手のリーダーすべてに10ダメージ')) {
    state.opponent.leaders.filter((item) => !item.isDown).forEach((opponentLeader) => applyDamageToLeader(state, 'opponent', opponentLeader.id, 10, deps));
  }
  if (text.includes('対戦相手のリーダー1体に20ダメージ')) applyDamageToSelectedOpponent(state, 20, deps);
  else if (text.includes('対戦相手のリーダー1体に10ダメージ')) applyDamageToSelectedOpponent(state, 10, deps);
};

const applyPlayRestrictions = (state: MatchState, card: Card, deps: RuntimeDeps) => {
  const text = normalizeText(card.text);
  if (text.includes('対戦相手よりダウンしているリーダーが多いなら、プレイできる')) {
    const selfDown = state.self.leaders.filter((leader) => leader.isDown).length;
    const opponentDown = state.opponent.leaders.filter((leader) => leader.isDown).length;
    if (selfDown <= opponentDown) {
      deps.log(`${card.name} は現在の盤面条件ではプレイできません`);
      return false;
    }
  }
  return true;
};

const resolveNonAttackCardEffect = (state: MatchState, card: Card, deps: RuntimeDeps) => {
  const text = normalizeText(card.text);
  if (!applyPlayRestrictions(state, card, deps)) return;

  const hasDrawTwoDiscardTwo = text.includes('カードを2枚引き、手札を2枚捨てる');
  const hasDrawOneDiscardOne = text.includes('カードを1枚引き、手札を1枚捨てる');

  if (text.includes('すべてのプレイヤーはカードを1枚引く')) drawBothPlayers(state, 1, deps);
  if (hasDrawTwoDiscardTwo) drawSelf(state, 2, deps);
  else if (text.includes('カードを3枚引く')) drawSelf(state, 3, deps);
  else if (hasDrawOneDiscardOne) drawSelf(state, 1, deps);
  else if (text.includes('カードを2枚引く')) drawSelf(state, 2, deps);
  else if (text.includes('カードを1枚引く')) drawSelf(state, 1, deps);

  if (hasDrawTwoDiscardTwo) {
    queueSelfDiscardAfterDraw(state, card, 2, deps);
  } else if (hasDrawOneDiscardOne) {
    queueSelfDiscardAfterDraw(state, card, 1, deps);
  }

  if (!hasDrawOneDiscardOne && text.includes('手札を1枚捨てる。')) discardFromHand(state.self, 1, state, deps);
  if (text.includes('対戦相手は手札を2枚捨てる')) discardFromHand(state.opponent, 2, state, deps);
  else if (text.includes('対戦相手は手札を1枚捨てる')) discardFromHand(state.opponent, 1, state, deps);

  if (text.includes('対戦相手のリーダーすべてに50ダメージ')) {
    state.opponent.leaders.filter((leader) => !leader.isDown).forEach((leader) => applyDamageToLeader(state, 'opponent', leader.id, 50, deps));
  } else if (text.includes('対戦相手のリーダーすべてに10ダメージ')) {
    state.opponent.leaders.filter((leader) => !leader.isDown).forEach((leader) => applyDamageToLeader(state, 'opponent', leader.id, 10, deps));
  }
  if (text.includes('対戦相手のリーダー1体に20ダメージ')) applyDamageToSelectedOpponent(state, 20, deps);
  if (text.includes('このカードの効果で回復した数値と同じダメージ')) {
    queueDrainRodHealChoice(state, card, deps);
  } else if (text.includes('自分のリーダーを合計80回復')) {
    healDistributed(state, 80, deps);
  } else if (text.includes('自分のリーダーを合計40回復')) {
    healDistributed(state, 40, deps);
  } else if (text.includes('自分のリーダー1体を60回復')) {
    healSelectedLeader(state, 60, deps);
  } else if (text.includes('自分のリーダー1体を40回復')) {
    healSelectedLeader(state, 40, deps);
  } else if (text.includes('自分のリーダー1体を30回復')) {
    healSelectedLeader(state, 30, deps);
  }

  if (text.includes('PPを1回復し、カードを1枚引く')) {
    recoverPp(state, 1, deps);
    drawSelf(state, 1, deps);
  } else if (text.includes('プレイエリアに他のカードがないなら、PPを1回復する')) {
    if (countFieldCards(state, () => true, card.id) === 0) recoverPp(state, 1, deps);
  } else if (text.includes('PPを1回復する')) {
    recoverPp(state, 1, deps);
  }

  if (text.includes('このターン、自分のリーダーすべての攻撃力を+30する')) {
    state.turnAttackBuff += 30;
    deps.log(`${card.name}: このターンのアタック +30`);
  }

  const nextAttackBuffMatches = [...text.matchAll(/次のアタックのダメージ\+(\d+)/g)];
if (nextAttackBuffMatches.length > 0) {
  nextAttackBuffMatches.forEach((matched) => {
    const amount = Number(matched[1]);
    if (!Number.isNaN(amount)) state.nextAttackBuff += amount;
  });

  const nextAttackSinglePostEffectMatch = text.match(
    /【アタック後】対戦相手の他のリーダー1体に(\d+)ダメージ/,
  );
  if (nextAttackSinglePostEffectMatch) {
    const damageAmount = Number(nextAttackSinglePostEffectMatch[1]);
    if (!Number.isNaN(damageAmount)) {
      state.nextAttackEffectQueue.push({
        kind: 'other_leader_damage',
        sourceCardName: card.name,
        sourceText: card.text,
        damageAmount,
      });
      deps.log(`${card.name}: アタック後に相手の他のリーダー1体へ ${damageAmount} ダメージを予約`);
    }
  }

  const nextAttackAllPostEffectMatch = text.match(
    /【アタック後】対戦相手の他のリーダーすべてに(\d+)ダメージ/,
  );
  if (nextAttackAllPostEffectMatch) {
    const damageAmount = Number(nextAttackAllPostEffectMatch[1]);
    if (!Number.isNaN(damageAmount)) {
      state.nextAttackEffectQueue.push({
        kind: 'all_other_leader_damage',
        sourceCardName: card.name,
        sourceText: card.text,
        damageAmount,
      });
      deps.log(`${card.name}: アタック後に相手の他のリーダーすべてへ ${damageAmount} ダメージを予約`);
    }
  }

  deps.log(`${card.name}: 次のアタック強化を適用`);
}
  if (text.includes('【ラウンド中】このラウンド、自分のリーダーすべての攻撃力を+10する')) {
    state.roundAttackBuff += 10;
    deps.log(`${card.name}: このラウンドのアタック +10`);
  }
  if (text.includes('メモリアカードとアタックカードの効果で引いたカード1枚につき20ダメージ')) {
    const totalDamage = Math.min(state.effectDrawCountThisTurn * 20, 100);
    if (totalDamage > 0) applyDamageToSelectedOpponent(state, totalDamage, deps);
  }
  if (text.includes('ダウンしている自分のリーダー1体を、ダウンしていない状態に戻す')) {
    const target = state.self.leaders.find((leader) => leader.isDown);
    if (target) {
      target.isDown = false;
      target.currentDamage = 0;
      deps.log(`${target.name} を復帰させました`);
      const attached = state.self.equipmentZone.filter((equipment) => equipment.equippedLeaderId === target.id);
      if (attached.length > 0) {
        state.self.equipmentZone = state.self.equipmentZone.filter((equipment) => equipment.equippedLeaderId !== target.id);
        state.self.trash.push(...attached);
        deps.log(`${target.name} の装備をトラッシュへ移動`);
      }
    }
  }
  if (text.includes('自分のリーダーが装備しているカード1枚を、別の自分のリーダーに装備し直してもよい')) {
    const equipment = state.self.equipmentZone[0];
    const nextLeader = state.self.leaders.find((leader) => !leader.isDown && leader.id !== equipment?.equippedLeaderId);
    if (equipment && nextLeader) {
      equipment.equippedLeaderId = nextLeader.id;
      deps.log(`${equipment.name} を ${nextLeader.name} に装備し直しました`);
    }
  }
  if (text.includes('自分のデッキの上から1枚を見る。そのカードをトラッシュに置いてもよい')) {
    queueTopDeckPeekChoice(state, card, deps);
  }
  if (text.includes('自分のデッキの上から5枚を見る。その中からコスト1以下のメモリアカード最大1枚と、コスト1以下のアタックカード最大1枚を')) {
    playTopDeckCards(state, 5, deps, 'memoria-attack-cost1');
  } else if (text.includes('自分のデッキの上から5枚を見る')) {
    playTopDeckCards(state, 5, deps, 'trash-only');
  } else if (text.includes('自分のデッキの上から3枚を見る。それらのカードをトラッシュに置く')) {
    playTopDeckCards(state, 3, deps, 'trash-only');
  }
  if (text.includes('メモリアカードかアタックカードのどちらかを宣言し')) {
    const topCard = state.self.mainDeck.shift();
    if (topCard) {
      const attackCount = state.self.mainDeck.filter((deckCard) => deckCard.type === 'attack').length;
      const memoriaCount = state.self.mainDeck.filter((deckCard) => deckCard.type === 'memoria').length;
      const declaredType = attackCount >= memoriaCount ? 'attack' : 'memoria';
      deps.log(`${declaredType === 'attack' ? 'アタックカード' : 'メモリアカード'} を宣言`);
      if (topCard.type === declaredType) {
        state.self.hand.push(topCard);
        drawSelf(state, 4, deps);
      } else {
        state.self.trash.push(topCard);
      }
    }
  }
};

const resolveAttackCard = (state: MatchState, card: Card, deps: RuntimeDeps, options: ResolveAttackOptions = {}) => {
  if (!options.bypassPreAttackChoice) {
    const pendingChoice = buildPreAttackChoice(state, card);
    if (pendingChoice) {
      state.pendingChoice = pendingChoice;
      deps.log(`${card.name}: 任意効果の選択待ち`);
      return true;
    }
  }
  const attacker = getLeaderById(state.self.leaders, state.activeLeaderId);
  if (!attacker || attacker.isDown) {
    deps.log('攻撃する自分リーダーを選択してください');
    return false;
  }
  const attackCount = Math.max((normalizeText(card.text).match(/【アタックする】/g) ?? []).length, 1);
  let consumedNextBuff = false;
  for (let attackIndex = 0; attackIndex < attackCount; attackIndex += 1) {
    const target = resolveOpponentTarget(state);
    if (!target) {
      deps.log('有効な攻撃対象が選択されていません');
      break;
    }
    const baseDamage = typeof card.power === 'number' ? card.power : getCurrentLeaderAtk(attacker);
    const nextBuff = consumedNextBuff ? 0 : state.nextAttackBuff;
    const queuedNextAttackEffects = consumedNextBuff ? [] : [...state.nextAttackEffectQueue];
    const extraBonus = getAttackBonusFromText(state, card, attacker, target) + (options.choiceBonusDamage ?? 0);
    const damage = Math.max(0, baseDamage + nextBuff + state.turnAttackBuff + state.roundAttackBuff + getEquipmentBuff(state.self, attacker.id) + extraBonus);
    deps.log(`${attacker.name} が ${card.name} を使用 (${damage}ダメージ)`);
    const result = applyDamageToSelectedOpponent(state, damage, deps, attacker.id, target.id);
    const context: AttackContext = {
      attacker,
      targetId: result?.targetId ?? target.id,
      targetName: result?.targetName ?? target.name,
      targetColor: target.color,
      damage,
      downed: Boolean(result?.downed),
      overkill: result?.overkill ?? 0,
      postEffectDamageDealt: false,
    };
    consumedNextBuff = true;
    state.nextAttackBuff = 0;
    state.nextAttackEffectQueue = [];
    runPostAttackEffects(state, card, context, deps);
    queuedNextAttackEffects.forEach((effect) => {
  if (effect.kind === 'other_leader_damage') {
    state.postAttackEffectQueue.push({
      kind: 'other_leader_damage',
      sourceCardName: effect.sourceCardName,
      sourceText: effect.sourceText,
      damageAmount: effect.damageAmount,
      attackerLeaderId: attacker.id,
      attackedLeaderId: context.targetId,
      targetColor: context.targetColor,
    });
  }

  if (effect.kind === 'all_other_leader_damage') {
    state.postAttackEffectQueue.push({
      kind: 'all_other_leader_damage',
      sourceCardName: effect.sourceCardName,
      sourceText: effect.sourceText,
      damageAmount: effect.damageAmount,
      attackerLeaderId: attacker.id,
      attackedLeaderId: context.targetId,
      targetColor: context.targetColor,
    });
  }
});
    applyEquipmentTriggeredEffects(state, context, deps);
    flushQueuedPostAttackEffects(state, deps);
  }
  void options.fromFreePlay;
  return true;
};

export const playHandCardRuntime = (state: MatchState, cardId: string, deps: RuntimeDeps, options: { forceCostPayment?: boolean } = {}) => {
  const cardIndex = state.self.hand.findIndex((card) => card.id === cardId);
  const card = state.self.hand[cardIndex];
  if (!card) return false;
  if (!applyPlayRestrictions(state, card, deps)) return false;
  const playedWithoutCost = canPlayWithoutCost(state, card, options.forceCostPayment ?? false);
  const playCost = playedWithoutCost ? 0 : card.cost;
  if (playCost > state.ppCurrent) {
    deps.log(`PP不足: ${card.name} のコストは ${playCost}`);
    return false;
  }
  if (playedWithoutCost && card.cost > 0) {
    deps.log(`${card.name}: 同名カード条件でコストを支払わずにプレイ`);
  }
  state.ppCurrent -= playCost;
  state.self.hand.splice(cardIndex, 1);
  state.fieldCards.push(card);
  if (card.type === 'attack') {
    return resolveAttackCard(state, card, deps);
  }
  resolveNonAttackCardEffect(state, card, deps);
  return true;
};

export const resolvePendingChoiceRuntime = (
  state: MatchState,
  payload: { accept: boolean; selectedCardId?: string; selectedLeaderId?: string },
  deps: RuntimeDeps,
) => {
  const pendingChoice = state.pendingChoice;
  if (!pendingChoice) return false;

  if (pendingChoice.kind === 'optional_discard_for_attack_bonus') {
    const sourceCard = state.fieldCards.find((card) => card.id === pendingChoice.cardInstanceId);
    if (!sourceCard) {
      state.pendingChoice = undefined;
      deps.log('保留中の攻撃カードが見つからないため、選択を終了しました');
      return false;
    }

    let choiceBonusDamage = 0;
    if (payload.accept) {
      const fallbackCardId = pendingChoice.selectableHandCardIds[0];
      const selectedCardId = payload.selectedCardId ?? fallbackCardId;
      const handIndex = state.self.hand.findIndex((card) => card.id === selectedCardId && pendingChoice.selectableHandCardIds.includes(card.id));
      if (handIndex < 0) {
        deps.log('捨てる手札を選択してください');
        return false;
      }
      const [discardedCard] = state.self.hand.splice(handIndex, 1);
      state.self.trash.push(discardedCard);
      state.cardsDiscardedThisTurn += 1;
      choiceBonusDamage = pendingChoice.bonusDamage;
      deps.log(`${sourceCard.name}: ${discardedCard.name} を捨ててダメージ+${choiceBonusDamage}`);
    } else {
      deps.log(`${sourceCard.name}: 任意ディスカードを行わず通常解決`);
    }

    state.pendingChoice = undefined;
    return resolveAttackCard(state, sourceCard, deps, {
      bypassPreAttackChoice: true,
      choiceBonusDamage,
    });
  }

  if (pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus') {
    const sourceCard = state.fieldCards.find((card) => card.id === pendingChoice.cardInstanceId);
    if (!sourceCard) {
      state.pendingChoice = undefined;
      deps.log('保留中の攻撃カードが見つからないため、選択を終了しました');
      return false;
    }

    let choiceBonusDamage = 0;
    if (payload.accept) {
      const fallbackCardId = pendingChoice.selectableHandCardIds[0];
      const selectedCardId = payload.selectedCardId ?? fallbackCardId;
      const handIndex = state.self.hand.findIndex((card) => card.id === selectedCardId && pendingChoice.selectableHandCardIds.includes(card.id));
      if (handIndex < 0) {
        deps.log('公開して捨てるコスト0カードを選択してください');
        return false;
      }
      const [discardedCard] = state.self.hand.splice(handIndex, 1);
      state.self.trash.push(discardedCard);
      state.cardsDiscardedThisTurn += 1;
      drawSelf(state, pendingChoice.drawCount, deps);
      choiceBonusDamage = pendingChoice.bonusDamage;
      deps.log(`${sourceCard.name}: ${discardedCard.name} を公開して捨て、カードを${pendingChoice.drawCount}枚引いてダメージ+${choiceBonusDamage}`);
    } else {
      deps.log(`${sourceCard.name}: コスト0カードを使わず通常解決`);
    }

    state.pendingChoice = undefined;
    return resolveAttackCard(state, sourceCard, deps, {
      bypassPreAttackChoice: true,
      choiceBonusDamage,
    });
  }

  if (pendingChoice.kind === 'post_attack_self_discard') {
    const fallbackCardId = pendingChoice.selectableHandCardIds[0];
    const selectedCardId = payload.selectedCardId ?? fallbackCardId;
    const handIndex = state.self.hand.findIndex((card) => card.id === selectedCardId && pendingChoice.selectableHandCardIds.includes(card.id));
    if (handIndex < 0) {
      deps.log('捨てる手札を選択してください');
      return false;
    }
    const [discardedCard] = state.self.hand.splice(handIndex, 1);
    state.self.trash.push(discardedCard);
    state.cardsDiscardedThisTurn += 1;
    state.pendingChoice = undefined;
    deps.log(`${pendingChoice.sourceCardName}: アタック後に ${discardedCard.name} を捨てました`);
    return true;
  }

  if (pendingChoice.kind === 'self_discard_after_draw') {
    if (!payload.accept) {
      deps.log('このディスカード処理はスキップできません');
      return false;
    }
    const fallbackCardId = pendingChoice.selectableHandCardIds[0];
    const selectedCardId = payload.selectedCardId ?? fallbackCardId;
    const handIndex = state.self.hand.findIndex((card) => card.id === selectedCardId && pendingChoice.selectableHandCardIds.includes(card.id));
    if (handIndex < 0) {
      deps.log('捨てる手札を選択してください');
      return false;
    }
    const [discardedCard] = state.self.hand.splice(handIndex, 1);
    state.self.trash.push(discardedCard);
    state.cardsDiscardedThisTurn += 1;

    const remainingSelectableHandCardIds = state.self.hand.map((card) => card.id);
    const remainingDiscardCount = Math.min(
      pendingChoice.discardCountRemaining - 1,
      remainingSelectableHandCardIds.length,
    );

    if (remainingDiscardCount > 0) {
      state.pendingChoice = {
        ...pendingChoice,
        prompt: remainingDiscardCount > 1
          ? `手札を${remainingDiscardCount}枚、順に選んで捨ててください。`
          : '手札を1枚選んで捨ててください。',
        discardCountRemaining: remainingDiscardCount,
        selectableHandCardIds: remainingSelectableHandCardIds,
      };
      deps.log(`${pendingChoice.sourceCardName}: ${discardedCard.name} を捨てました（残り ${remainingDiscardCount} 枚）`);
      return true;
    }

    state.pendingChoice = undefined;
    deps.log(`${pendingChoice.sourceCardName}: ${discardedCard.name} を捨てて追加処理を完了しました`);
    return true;
  }

  if (pendingChoice.kind === 'optional_trash_topdeck_for_next_attack_buff') {
    const revealedCard = pendingChoice.revealedCard;
    if (payload.accept) {
      state.self.trash.push(revealedCard);
      deps.log(`${pendingChoice.sourceCardName}: ${revealedCard.name} をトラッシュに置きました`);
    } else {
      state.self.mainDeck.unshift(revealedCard);
      deps.log(`${pendingChoice.sourceCardName}: ${revealedCard.name} を山札の上に戻しました`);
    }
    state.pendingChoice = undefined;
    return true;
  }

  if (pendingChoice.kind === 'post_attack_other_leader_damage') {
    if (!payload.accept) {
      deps.log('このダメージ割り振りはスキップできません');
      return false;
    }
    const fallbackLeaderId = pendingChoice.selectableLeaderIds[0];
    const selectedLeaderId = payload.selectedLeaderId ?? fallbackLeaderId;
    if (!pendingChoice.selectableLeaderIds.includes(selectedLeaderId)) {
      deps.log('ダメージを与える別のリーダーを選択してください');
      return false;
    }
    const result = applyDamageToLeader(state, 'opponent', selectedLeaderId, pendingChoice.damageAmount, deps, pendingChoice.attackerLeaderId);
    if (!result) {
      deps.log('選択したリーダーにダメージを与えられませんでした');
      return false;
    }
    state.pendingChoice = undefined;
    deps.log(`${pendingChoice.sourceCardName}: ${result.targetName} に ${pendingChoice.damageAmount} ダメージを与えました`);
    applyPostEffectDamageEquipmentTriggers(state, pendingChoice.attackerLeaderId, pendingChoice.attackedLeaderId, deps);
    flushQueuedPostAttackEffects(state, deps);
    return true;
  }

  if (pendingChoice.kind === 'drain_rod_heal_distribution') {
    if (!payload.accept) {
      deps.log('この回復処理はスキップできません');
      return false;
    }
    const fallbackLeaderId = pendingChoice.selectableLeaderIds[0];
    const selectedLeaderId = payload.selectedLeaderId ?? fallbackLeaderId;
    if (!pendingChoice.selectableLeaderIds.includes(selectedLeaderId)) {
      deps.log('回復する自分リーダーを選択してください');
      return false;
    }
    const leader = state.self.leaders.find((item) => item.id === selectedLeaderId);
    if (!leader) {
      deps.log('選択した自分リーダーが見つかりません');
      return false;
    }
    const healed = healLeader(leader, pendingChoice.remainingHeal);
    const healedTotal = pendingChoice.healedTotal + healed;
    const remainingHeal = Math.max(0, pendingChoice.remainingHeal - healed);
    deps.log(`${pendingChoice.sourceCardName}: ${leader.name} を ${healed} 回復しました`);
    state.pendingChoice = undefined;
    if (remainingHeal > 0) {
      return queueDrainRodHealChoice(state, {
        id: pendingChoice.cardInstanceId,
        name: pendingChoice.sourceCardName,
        text: pendingChoice.sourceText,
      } as Card, deps, remainingHeal, healedTotal);
    }
    return queueDrainRodHealChoice(state, {
      id: pendingChoice.cardInstanceId,
      name: pendingChoice.sourceCardName,
      text: pendingChoice.sourceText,
    } as Card, deps, 0, healedTotal) || true;
  }

  if (pendingChoice.kind === 'drain_rod_damage_target') {
    if (!payload.accept) {
      deps.log('このダメージ処理はスキップできません');
      return false;
    }
    const fallbackLeaderId = pendingChoice.selectableLeaderIds[0];
    const selectedLeaderId = payload.selectedLeaderId ?? fallbackLeaderId;
    if (!pendingChoice.selectableLeaderIds.includes(selectedLeaderId)) {
      deps.log('ダメージ対象の相手リーダーを選択してください');
      return false;
    }
    const result = applyDamageToLeader(state, 'opponent', selectedLeaderId, pendingChoice.damageAmount, deps);
    if (!result && pendingChoice.damageAmount > 0) {
      deps.log('選択した相手リーダーにダメージを与えられませんでした');
      return false;
    }
    state.pendingChoice = undefined;
    deps.log(`${pendingChoice.sourceCardName}: ${result?.targetName ?? '相手リーダー'} に ${pendingChoice.damageAmount} ダメージを与えました`);
    return true;
  }

  return false;
};

export const useSetTacticRuntime = (state: MatchState, cardId: string, deps: RuntimeDeps) => {
  const tacticIndex = state.self.tacticsSet.findIndex((card) => card.id === cardId);
  const tactic = state.self.tacticsSet[tacticIndex];
  if (!tactic) return false;
  state.tacticsUsedThisTurn = true;
  if (textIncludes(tactic.text, 'これを装備しているリーダーは以下の能力を持つ') || tactic.effectType === 'equipmentAttackBuff' || textIncludes(tactic.text, '攻撃力+10') || textIncludes(tactic.text, '体力+30') || textIncludes(tactic.text, '体力+40')) {
    const [equipment] = state.self.tacticsSet.splice(tacticIndex, 1);
    equipment.equippedLeaderId = state.activeLeaderId;
    state.self.equipmentZone.push(equipment);
    const equippedLeader = getLeaderById(state.self.leaders, state.activeLeaderId);
    if (equippedLeader && textIncludes(equipment.text, '基本の体力は140')) equippedLeader.baseHp = 140;
    deps.log(`装備セット: ${equipment.name}`);
    return true;
  }
  resolveNonAttackCardEffect(state, tactic, deps);
  const [usedTactic] = state.self.tacticsSet.splice(tacticIndex, 1);
  state.self.trash.push(usedTactic);
  if (usedTactic.type === 'pp') {
    state.self.ppTicket = false;
    deps.log('後攻PPカードを使用しました');
  }
  deps.log(`タクティクス使用: ${usedTactic.name}`);
  return true;
};

export const handleEndTurnFieldCards = (state: MatchState, deps: RuntimeDeps) => {
  const staying: Card[] = [];
  const trashing: Card[] = [];
  state.fieldCards.forEach((card) => {
    if (textIncludes(card.text, '代わりにタクティクスエリアに戻す')) {
      staying.push(card);
    } else {
      trashing.push(card);
    }
  });
  if (staying.length > 0) {
    state.self.tacticsSet.push(...staying);
    deps.log(`${staying.length} 枚のカードをタクティクスエリアへ戻しました`);
  }
  state.self.trash.push(...trashing);
  state.fieldCards = [];
};
