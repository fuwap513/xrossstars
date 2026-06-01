import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  buildCardCatalogMap,
  createBattleCard,
  createDefaultDeckConfig,
  createEmptyDeckConfig,
  defaultCardCatalog,
  getDeckEntryCount,
  getDeckTotal,
  sanitizeImportedCardCatalog,
  sanitizeRegisteredCardEntry,
  setDeckEntryCount,
  sortCardCatalog,
} from '../data/cards';
import type {
  AppUsageStats,
  BattleHistoryEntry,
  Card,
  DeckConfig,
  DeckEntry,
  DeckGroup,
  DeckPreset,
  GameStore,
  Leader,
  LeaderSetup,
  LeaderSetupEntry,
  MatchRound,
  MatchState,
  OperationLogCategory,
  OperationLogEntry,
  PlayerBoard,
  RegisteredCard,
  RoundSummaryEntry,
  Side,
} from '../types/game';
import {
  createLeaderFromCatalog,
  drawCards,
  getEquipmentBuff,
  getLeaderHp,
  handleEndTurnFieldCards,
  playHandCardRuntime,
  resetTurnDamage,
  resolvePendingChoiceRuntime,
  useSetTacticRuntime,
} from './battleEffects';

const STORAGE_KEY = 'xrossstars-react-mvp-store-v2';
const MAX_OPERATION_LOGS = 80;
const MAX_BATTLE_UNDO = 20;
const MAX_BATTLE_HISTORY = 200;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const createInitialUsageStats = (): AppUsageStats => ({
  gamesStarted: 0,
  gameResets: 0,
  cardsPlayed: 0,
  tacticsSet: 0,
  tacticsUsed: 0,
  discards: 0,
  battleLogExports: 0,
  operationLogExports: 0,
});

const isOperationLogCategory = (value: unknown): value is OperationLogCategory => (
  value === 'app' || value === 'deck' || value === 'preset' || value === 'battle' || value === 'system'
);

const sanitizeOperationLogs = (value: unknown): OperationLogEntry[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      if (!isRecord(entry) || typeof entry.message !== 'string' || !entry.message.trim() || !isOperationLogCategory(entry.category)) return null;
      const timestamp = typeof entry.timestamp === 'string' && entry.timestamp.trim() ? entry.timestamp : new Date().toISOString();
      const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id : `op-import-${Date.now()}-${index}`;
      return {
        id,
        timestamp,
        category: entry.category,
        message: entry.message.trim(),
      } as OperationLogEntry;
    })
    .filter((entry): entry is OperationLogEntry => Boolean(entry))
    .slice(0, MAX_OPERATION_LOGS);
};

const isAppUsageStatsShape = (value: unknown): value is AppUsageStats => {
  if (!isRecord(value)) return false;

  return ['gamesStarted', 'gameResets', 'cardsPlayed', 'tacticsSet', 'tacticsUsed', 'discards', 'battleLogExports', 'operationLogExports']
    .every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && Number(value[key]) >= 0);
};

const sanitizeUsageStats = (value: unknown): AppUsageStats => (
  isAppUsageStatsShape(value)
    ? {
      gamesStarted: value.gamesStarted,
      gameResets: value.gameResets,
      cardsPlayed: value.cardsPlayed,
      tacticsSet: value.tacticsSet,
      tacticsUsed: value.tacticsUsed,
      discards: value.discards,
      battleLogExports: value.battleLogExports,
      operationLogExports: value.operationLogExports,
    }
    : createInitialUsageStats()
);

const DEFAULT_LEADER_SETUP: LeaderSetup = {
  self: [
    { id: 's1', name: 'Leader 1', baseHp: 110 },
    { id: 's2', name: 'Leader 2', baseHp: 110 },
    { id: 's3', name: 'Leader 3', baseHp: 100 },
    { id: 's4', name: 'Leader 4', baseHp: 110 },
  ],
  opponent: [
    { id: 'o1', name: 'Enemy 1', baseHp: 110 },
    { id: 'o2', name: 'Enemy 2', baseHp: 110 },
    { id: 'o3', name: 'Enemy 3', baseHp: 110 },
    { id: 'o4', name: 'Enemy 4', baseHp: 110 },
  ],
};

const createOperationLogEntry = (message: string, category: OperationLogCategory = 'app'): OperationLogEntry => ({
  id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: new Date().toISOString(),
  category,
  message,
});

const appendOperationLog = (logs: OperationLogEntry[], message: string, category: OperationLogCategory = 'app') => [
  createOperationLogEntry(message, category),
  ...logs,
].slice(0, MAX_OPERATION_LOGS);

const pushBattleUndo = (stack: MatchState[], state: MatchState) => [clone(state), ...stack].slice(0, MAX_BATTLE_UNDO);

const isLeaderSetupEntryShape = (value: unknown): value is LeaderSetupEntry => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
  && typeof value.baseHp === 'number'
  && Number.isFinite(value.baseHp)
);

const sanitizeLeaderSetup = (value: unknown): LeaderSetup => {
  if (!isRecord(value) || !Array.isArray(value.self) || !Array.isArray(value.opponent)) return clone(DEFAULT_LEADER_SETUP);

  const sanitizeSide = (entries: unknown[], defaults: LeaderSetupEntry[]) => defaults.map((defaultEntry, index) => {
    const candidate = entries.find((entry) => isLeaderSetupEntryShape(entry) && entry.id === defaultEntry.id);
    if (!candidate || !isLeaderSetupEntryShape(candidate)) return { ...defaultEntry };

    const safeName = candidate.name.trim() || defaultEntry.name;
    const safeHp = Math.min(200, Math.max(50, Math.round(candidate.baseHp / 10) * 10));

    return {
      id: defaultEntry.id,
      name: safeName.slice(0, 24),
      baseHp: safeHp || defaults[index].baseHp,
    };
  });

  return {
    self: sanitizeSide(value.self, DEFAULT_LEADER_SETUP.self),
    opponent: sanitizeSide(value.opponent, DEFAULT_LEADER_SETUP.opponent),
  };
};

const isDeckEntryShape = (value: unknown): value is DeckEntry => (
  isRecord(value)
  && typeof value.cardId === 'string'
  && Boolean(value.cardId.trim())
  && typeof value.count === 'number'
  && Number.isInteger(value.count)
  && value.count >= 0
);

const isDeckConfigShape = (value: unknown): value is DeckConfig => (
  isRecord(value)
  && Array.isArray(value.main)
  && Array.isArray(value.tactics)
  && value.main.every(isDeckEntryShape)
  && value.tactics.every(isDeckEntryShape)
);

const mergeCardCatalog = (baseCards: RegisteredCard[], importedCards: RegisteredCard[]) => {
  const nextMap = buildCardCatalogMap(baseCards);
  importedCards.forEach((card) => {
    nextMap[card.id] = card;
  });
  return sortCardCatalog(Object.values(nextMap));
};

const normalizeDeckEntries = (entries: DeckEntry[], group: 'main' | 'tactics', catalogMap: Record<string, RegisteredCard>): DeckEntry[] => {
  const nextEntries = new Map<string, number>();

  entries.forEach((entry) => {
    const card = catalogMap[entry.cardId];
    if (!card || card.deckGroup !== group) return;
    const nextCount = Math.min(card.maxCopies, Math.max(0, Math.floor(entry.count)));
    if (nextCount <= 0) return;
    nextEntries.set(entry.cardId, nextCount);
  });

  return [...nextEntries.entries()].map(([cardId, count]) => ({ cardId, count }));
};

const normalizeDeckConfig = (config: DeckConfig, cardCatalog: RegisteredCard[]): DeckConfig => {
  const cardMap = buildCardCatalogMap(cardCatalog);
  return {
    main: normalizeDeckEntries(config.main, 'main', cardMap),
    tactics: normalizeDeckEntries(config.tactics, 'tactics', cardMap),
  };
};

const getCardNameById = (cardCatalog: RegisteredCard[], cardId: string) => cardCatalog.find((card) => card.id === cardId)?.name ?? cardId;
const getMainDeckTotal = (config: DeckConfig) => getDeckTotal(config.main);
const getTacticsDeckTotal = (config: DeckConfig) => getDeckTotal(config.tactics);

const isDeckConfigValid = (config: DeckConfig, cardCatalog: RegisteredCard[]) => {
  const normalized = normalizeDeckConfig(config, cardCatalog);
  return getMainDeckTotal(normalized) === 50 && getTacticsDeckTotal(normalized) === 5;
};

const createLeader = (id: string, name: string, baseHp: number, cardCatalog: RegisteredCard[]): Leader => createLeaderFromCatalog({
  id,
  name,
  baseHp,
}, cardCatalog);

const createPpTicketCard = (cardCatalog: RegisteredCard[], serial: number): Card => {
  const ppCardDefinition = cardCatalog.find((card) => card.type === 'pp' && card.name === 'PPカード');
  const ppTicketRuleDefinition = cardCatalog.find((card) => card.name === 'PPチケット');
  const ruleText = ppTicketRuleDefinition?.text
    || 'このカードをタクティクスデッキに入れることはできない。\n1ラウンド目のタクティクスカードを選択した後、後攻のプレイヤーはこのカードをタクティクスエリアに置く。\n【プレイ時】PPを1回復する。';

  if (ppCardDefinition) {
    const baseCard = createBattleCard(ppCardDefinition, `${ppCardDefinition.id}-ticket-${serial}`);
    return {
      ...baseCard,
      name: 'PPカード',
      type: 'pp',
      cost: 0,
      power: 0,
      effectType: 'none',
      effectValue: 0,
      text: ruleText,
    };
  }

  if (ppTicketRuleDefinition) {
    const baseCard = createBattleCard(ppTicketRuleDefinition, `${ppTicketRuleDefinition.id}-ticket-${serial}`);
    return {
      ...baseCard,
      name: 'PPカード',
      type: 'pp',
      cost: 0,
      power: 0,
      effectType: 'none',
      effectValue: 0,
      text: ruleText,
    };
  }

  return {
    id: `pp-ticket-${serial}`,
    name: 'PPカード',
    type: 'pp',
    cost: 0,
    power: 0,
    effectType: 'none',
    effectValue: 0,
    text: ruleText,
  };
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
};

const roundToPp = (round: MatchRound) => (round === 1 ? 3 : round === 2 ? 4 : 5);

const log = (state: MatchState, message: string) => {
  const entry: BattleHistoryEntry = {
    id: `battle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    round: state.round,
    turn: state.turn,
    message,
  };
  state.logs = [message, ...state.logs].slice(0, 12);
  state.battleHistory = [entry, ...state.battleHistory].slice(0, MAX_BATTLE_HISTORY);
};

const buildDeckFromEntries = (entries: DeckEntry[], group: 'main' | 'tactics', cardCatalog: RegisteredCard[]) => {
  const cardMap = buildCardCatalogMap(cardCatalog);
  const cards: Card[] = [];
  let serial = 1;

  entries.forEach((entry) => {
    const definition = cardMap[entry.cardId];
    if (!definition || definition.deckGroup !== group) return;
    const safeCount = Math.min(definition.maxCopies, Math.max(0, entry.count));
    for (let index = 0; index < safeCount; index += 1) {
      cards.push(createBattleCard(definition, `${definition.id}-${serial}`));
      serial += 1;
    }
  });

  return shuffle(cards);
};


const countDownLeaders = (leaders: Leader[]) => leaders.filter((leader) => leader.isDown).length;

const createRoundSummary = (state: MatchState, note: string): RoundSummaryEntry => ({
  id: `round-${state.round}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  round: state.round,
  turnReached: state.turn,
  selfWins: state.self.wins,
  selfLeadersDown: countDownLeaders(state.self.leaders),
  opponentLeadersDown: countDownLeaders(state.opponent.leaders),
  handCount: state.self.hand.length,
  deckCount: state.self.mainDeck.length,
  trashCount: state.self.trash.length,
  note,
});

const recordRoundSummary = (state: MatchState, note: string) => {
  state.roundSummaries = [createRoundSummary(state, note), ...state.roundSummaries];
};

const ensureRoundTacticSelected = (state: MatchState) => {
  if (!state.roundTacticSelected && state.self.tacticsDeck.length > 0) {
    log(state, 'ラウンド開始時にタクティクスを1枚セットしてください');
    return false;
  }
  return true;
};

const beginNextTurn = (state: MatchState) => {
  state.turn += 1;
  state.ppCurrent = state.ppMax;
  state.pendingChoice = undefined;
  state.tacticsUsedThisTurn = false;
  state.nextAttackBuff = 0;
  state.nextAttackEffectQueue = [];
  state.postAttackEffectQueue = [];
  state.turnAttackBuff = 0;
  state.effectDrawCountThisTurn = 0;
  state.cardsDiscardedThisTurn = 0;
  drawCards(state.self, 1, state, { log: (message) => log(state, message) });
  log(state, `ターン ${state.turn} 開始: 1枚ドロー / PP ${state.ppCurrent} に回復`);
};

const prepareNextRound = (state: MatchState) => {
  if (state.self.wins >= 2 || state.round === 3) {
    state.winner = 'self';
    log(state, '試合終了: 2ラウンド先取で勝利');
    return;
  }
  state.round = (state.round + 1) as MatchRound;
  state.turn = 1;
  state.pendingChoice = undefined;
  state.ppMax = roundToPp(state.round);
  state.ppCurrent = state.ppMax;
  state.tacticsUsedThisTurn = false;
  state.roundTacticSelected = false;
  state.nextAttackBuff = 0;
  state.nextAttackEffectQueue = [];
  state.postAttackEffectQueue = [];
  state.turnAttackBuff = 0;
  state.roundAttackBuff = 0;
  state.effectDrawCountThisTurn = 0;
  state.cardsDiscardedThisTurn = 0;
  state.fieldCards.forEach((card) => state.self.trash.push(card));
  state.fieldCards = [];
  state.opponent.leaders = state.opponent.leaders.map((leader) => ({
    ...leader,
    awakened: false,
    currentDamage: 0,
    isDown: false,
  }));
  state.self.leaders = state.self.leaders.map((leader) => ({
    ...leader,
    awakened: false,
    currentDamage: 0,
    isDown: false,
  }));
  drawCards(state.self, 1, state, { log: (message) => log(state, message) });
  log(state, `Round ${state.round} 開始: PP ${state.ppMax} / タクティクスを1枚セットしてください`);
};

const checkRoundWin = (state: MatchState) => {
  if (state.opponent.leaders.every((leader) => leader.isDown)) {
    state.self.wins += 1;
    log(state, `Round ${state.round} 勝利 (${state.self.wins}勝)`);
    recordRoundSummary(state, '相手リーダーを全てダウンしてラウンド勝利');
    prepareNextRound(state);
  }
};

const applyDamageToOpponent = (state: MatchState, damage: number, sourceLeaderId?: string) => {
  const target = state.opponent.leaders.find((leader) => leader.id === state.targetLeaderId);
  if (!target || target.isDown) {
    log(state, '有効な攻撃対象が選択されていません');
    return;
  }
  target.currentDamage += damage;
  log(state, `${target.name} に ${damage} ダメージ`);
  if (target.currentDamage >= getLeaderHp(target)) {
    target.isDown = true;
    target.currentDamage = getLeaderHp(target);
    log(state, `${target.name} をダウン`);
    if (sourceLeaderId) {
      const attacker = state.self.leaders.find((leader) => leader.id === sourceLeaderId);
      if (attacker && !attacker.awakened) {
        attacker.awakened = true;
        log(state, `${attacker.name} が覚醒: ATK +10 / HP +30`);
      }
    }
    checkRoundWin(state);
  }
};

const createInitialState = (config: DeckConfig, cardCatalog: RegisteredCard[], firstPlayer: Side = 'self', leaderSetup: LeaderSetup = DEFAULT_LEADER_SETUP): MatchState => {
  const normalizedConfig = normalizeDeckConfig(config, cardCatalog);
  const mainDeck = buildDeckFromEntries(normalizedConfig.main, 'main', cardCatalog);
  const hand = mainDeck.splice(0, 4);
  const isSelfSecond = firstPlayer === 'opponent';
  const state: MatchState = {
    round: 1,
    turn: 1,
    ppCurrent: 3,
    ppMax: 3,
    firstPlayer,
    activeLeaderId: 's1',
    targetLeaderId: 'o1',
    tacticsUsedThisTurn: false,
    roundTacticSelected: false,
    nextAttackBuff: 0,
    nextAttackEffectQueue: [],
    postAttackEffectQueue: [],
    turnAttackBuff: 0,
    roundAttackBuff: 0,
    pendingDiscardCount: 0,
    effectDrawCountThisTurn: 0,
    cardsDiscardedThisTurn: 0,
    pendingChoice: undefined,
    self: {
      name: '自分',
      leaders: leaderSetup.self.map((leader) => createLeader(leader.id, leader.name, leader.baseHp, cardCatalog)),
      hand,
      mainDeck,
      trash: [],
      tacticsDeck: buildDeckFromEntries(normalizedConfig.tactics, 'tactics', cardCatalog),
      tacticsSet: [],
      equipmentZone: [],
      ppTicket: isSelfSecond,
      wins: 0,
    },
    opponent: {
      name: '相手',
      leaders: leaderSetup.opponent.map((leader) => createLeader(leader.id, leader.name, leader.baseHp, cardCatalog)),
      hand: [],
      mainDeck: [],
      trash: [],
      tacticsDeck: [],
      tacticsSet: [],
      equipmentZone: [],
      ppTicket: false,
      wins: 0,
    },
    fieldCards: [],
    logs: [],
    battleHistory: [],
    roundSummaries: [],
  };

  log(state, `ゲーム開始: 初期手札4枚 / ${isSelfSecond ? '後攻想定' : '先攻想定'}`);
  log(state, 'Round 1 / PP 3 で開始');
  log(state, isSelfSecond ? '後攻1ターン目からタクティクス使用可能 / PPカード配置対象' : '先攻1ターン目はタクティクス使用不可');
  return state;
};

const updateDeckCount = (config: DeckConfig, cardCatalog: RegisteredCard[], group: 'main' | 'tactics', cardId: string, delta: number) => {
  const card = cardCatalog.find((item) => item.id === cardId && item.deckGroup === group);
  if (!card) return config;
  const currentEntries = config[group];
  const currentCount = getDeckEntryCount(currentEntries, cardId);
  const nextCount = Math.min(card.maxCopies, Math.max(0, currentCount + delta));
  return {
    ...config,
    [group]: setDeckEntryCount(currentEntries, cardId, nextCount),
  } as DeckConfig;
};

const createPreset = (name: string | undefined, deckConfig: DeckConfig, currentCount: number): DeckPreset => ({
  id: `preset-${Date.now()}`,
  name: name?.trim() || `プリセット ${currentCount + 1}`,
  deckConfig: clone(deckConfig),
  createdAt: new Date().toISOString(),
});

const replacePreset = (preset: DeckPreset, deckConfig: DeckConfig, name?: string): DeckPreset => ({
  ...preset,
  name: name?.trim() || preset.name,
  deckConfig: clone(deckConfig),
  createdAt: new Date().toISOString(),
});

const movePresetToFront = (presets: DeckPreset[], nextPreset: DeckPreset) => [
  nextPreset,
  ...presets.filter((preset) => preset.id !== nextPreset.id),
].slice(0, 10);

const movePreset = (presets: DeckPreset[], presetId: string, direction: 'up' | 'down') => {
  const currentIndex = presets.findIndex((preset) => preset.id === presetId);
  if (currentIndex < 0) return presets;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= presets.length) return presets;

  const next = [...presets];
  [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
  return next;
};

const sanitizeImportedPresets = (value: unknown, cardCatalog: RegisteredCard[]): DeckPreset[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((preset, index) => {
      if (!isRecord(preset) || !isDeckConfigShape(preset.deckConfig)) return null;
      const id = typeof preset.id === 'string' && preset.id.trim() ? preset.id : `preset-import-${Date.now()}-${index}`;
      const name = typeof preset.name === 'string' && preset.name.trim() ? preset.name.trim() : `インポート ${index + 1}`;
      const createdAt = typeof preset.createdAt === 'string' && preset.createdAt.trim() ? preset.createdAt : new Date().toISOString();
      return {
        id,
        name,
        deckConfig: normalizeDeckConfig(clone(preset.deckConfig), cardCatalog),
        createdAt,
      } as DeckPreset;
    })
    .filter((preset): preset is DeckPreset => Boolean(preset))
    .slice(0, 10);
};

const defaultDeckConfig = createDefaultDeckConfig();

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      currentScreen: 'battle',
      cardCatalog: clone(defaultCardCatalog),
      deckConfig: clone(defaultDeckConfig),
      leaderSetup: clone(DEFAULT_LEADER_SETUP),
      savedPresets: [],
      operationLogs: [createOperationLogEntry('アプリを初期化しました', 'system')],
      usageStats: createInitialUsageStats(),
      battleUndoStack: [],
      state: createInitialState(defaultDeckConfig, defaultCardCatalog, 'self', DEFAULT_LEADER_SETUP),
      switchScreen: (screen) => set((store) => ({
        currentScreen: screen,
        operationLogs: appendOperationLog(store.operationLogs, `画面切替: ${screen === 'battle' ? 'バトル' : 'デッキ編集'}`, 'app'),
      })),
      startNewGame: (firstPlayer = 'self') => {
        const { deckConfig, leaderSetup, cardCatalog } = get();
        set((store) => ({
          state: createInitialState(deckConfig, cardCatalog, firstPlayer, leaderSetup),
          currentScreen: 'battle',
          battleUndoStack: [],
          operationLogs: appendOperationLog(store.operationLogs, `新規ゲーム開始: ${firstPlayer === 'self' ? '先攻' : '後攻'}想定`, 'battle'),
          usageStats: { ...store.usageStats, gamesStarted: store.usageStats.gamesStarted + 1 },
        }));
      },
      applyDeckAndStartGame: (firstPlayer = 'self') => {
        const { deckConfig, leaderSetup, state, cardCatalog } = get();
        if (!isDeckConfigValid(deckConfig, cardCatalog)) {
          const nextState = clone(state);
          log(nextState, 'デッキ編集画面で 50枚 / 5枚 に調整してください');
          set((store) => ({
            state: nextState,
            currentScreen: 'deck',
            battleUndoStack: [],
            operationLogs: appendOperationLog(store.operationLogs, '対戦開始失敗: デッキ構成が 50枚 / 5枚 を満たしていません', 'system'),
          }));
          return;
        }
        set((store) => ({
          state: createInitialState(deckConfig, cardCatalog, firstPlayer, leaderSetup),
          currentScreen: 'battle',
          battleUndoStack: [],
          operationLogs: appendOperationLog(store.operationLogs, `現在の構成で対戦開始: ${firstPlayer === 'self' ? '先攻' : '後攻'}`, 'battle'),
          usageStats: { ...store.usageStats, gamesStarted: store.usageStats.gamesStarted + 1 },
        }));
      },
      resetGame: () => {
        const { deckConfig, leaderSetup, state, cardCatalog } = get();
        set((store) => ({
          state: createInitialState(deckConfig, cardCatalog, state.firstPlayer, leaderSetup),
          battleUndoStack: [],
          operationLogs: appendOperationLog(store.operationLogs, '対戦状態をリセットしました', 'battle'),
          usageStats: { ...store.usageStats, gameResets: store.usageStats.gameResets + 1 },
        }));
      },
      clearSavedGame: () => {
        localStorage.removeItem(STORAGE_KEY);
        set({
          currentScreen: 'battle',
          cardCatalog: clone(defaultCardCatalog),
          deckConfig: clone(defaultDeckConfig),
          leaderSetup: clone(DEFAULT_LEADER_SETUP),
          savedPresets: [],
          operationLogs: [createOperationLogEntry('保存データを削除して初期化しました', 'system')],
          usageStats: createInitialUsageStats(),
          battleUndoStack: [],
          state: createInitialState(defaultDeckConfig, defaultCardCatalog, 'self', DEFAULT_LEADER_SETUP),
        });
      },
      resetDeckConfig: () => set((store) => ({
        deckConfig: clone(defaultDeckConfig),
        operationLogs: appendOperationLog(store.operationLogs, 'デッキ構成を推奨初期構成に戻しました', 'deck'),
      })),
      saveDeckPreset: (name) =>
        set((store) => {
          const trimmedName = name?.trim();
          const matchedPreset = trimmedName
            ? store.savedPresets.find((preset) => preset.name === trimmedName)
            : undefined;

          if (matchedPreset) {
            const nextPreset = replacePreset(matchedPreset, store.deckConfig, trimmedName);
            return {
              savedPresets: movePresetToFront(store.savedPresets, nextPreset),
              operationLogs: appendOperationLog(store.operationLogs, `プリセットを上書き保存しました: ${matchedPreset.name}`, 'preset'),
            };
          }

          const createdPreset = createPreset(trimmedName, store.deckConfig, store.savedPresets.length);
          return {
            savedPresets: [createdPreset, ...store.savedPresets].slice(0, 10),
            operationLogs: appendOperationLog(store.operationLogs, `プリセットを保存しました: ${createdPreset.name}`, 'preset'),
          };
        }),
      overwriteDeckPreset: (presetId) =>
        set((store) => {
          const currentPreset = store.savedPresets.find((preset) => preset.id === presetId);
          if (!currentPreset) return { savedPresets: store.savedPresets };
          const nextPreset = replacePreset(currentPreset, store.deckConfig);
          return {
            savedPresets: movePresetToFront(store.savedPresets, nextPreset),
            operationLogs: appendOperationLog(store.operationLogs, `プリセットを明示的に上書き保存しました: ${currentPreset.name}`, 'preset'),
          };
        }),
      renameDeckPreset: (presetId, nextName) => {
        const trimmedName = nextName.trim();
        if (!trimmedName) return false;

        const { savedPresets } = get();
        const targetPreset = savedPresets.find((preset) => preset.id === presetId);
        if (!targetPreset) return false;

        const duplicatedPreset = savedPresets.find((preset) => preset.id !== presetId && preset.name === trimmedName);
        if (duplicatedPreset) return false;

        set((store) => ({
          savedPresets: store.savedPresets.map((preset) => (preset.id === presetId ? { ...preset, name: trimmedName } : preset)),
          operationLogs: appendOperationLog(store.operationLogs, `プリセット名を変更しました: ${targetPreset.name} → ${trimmedName}`, 'preset'),
        }));
        return true;
      },
      moveDeckPreset: (presetId, direction) =>
        set((store) => {
          const targetPreset = store.savedPresets.find((preset) => preset.id === presetId);
          return {
            savedPresets: movePreset(store.savedPresets, presetId, direction),
            operationLogs: targetPreset
              ? appendOperationLog(store.operationLogs, `プリセットを${direction === 'up' ? '上へ' : '下へ'}移動しました: ${targetPreset.name}`, 'preset')
              : store.operationLogs,
          };
        }),
      importDeckData: (payload) => {
        const { cardCatalog } = get();
        if (isDeckConfigShape(payload)) {
          set((store) => ({
            deckConfig: normalizeDeckConfig(clone(payload), cardCatalog),
            currentScreen: 'deck',
            operationLogs: appendOperationLog(store.operationLogs, 'JSONからデッキ構成を読み込みました', 'deck'),
          }));
          return true;
        }
        if (!isRecord(payload) || !isDeckConfigShape(payload.deckConfig)) {
          set((store) => ({
            operationLogs: appendOperationLog(store.operationLogs, 'JSON読込に失敗しました: 形式が不正です', 'system'),
          }));
          return false;
        }

        const nextDeckConfig = normalizeDeckConfig(clone(payload.deckConfig as DeckConfig), cardCatalog);
        const hasPresetList = Array.isArray(payload.savedPresets);
        const nextPresets = hasPresetList ? sanitizeImportedPresets(payload.savedPresets, cardCatalog) : null;
        set((store) => ({
          deckConfig: nextDeckConfig,
          savedPresets: nextPresets ?? store.savedPresets,
          currentScreen: 'deck',
          operationLogs: appendOperationLog(store.operationLogs, `JSONからデータを読み込みました${nextPresets ? `（プリセット ${nextPresets.length} 件）` : ''}`, 'deck'),
        }));
        return true;
      },
      importCardCatalog: (payload) => {
        const importedCards = sanitizeImportedCardCatalog(payload);
        if (!importedCards) {
          set((store) => ({
            operationLogs: appendOperationLog(store.operationLogs, 'カードマスタ読込に失敗しました: 形式が不正です', 'system'),
          }));
          return false;
        }

        set((store) => {
          const nextCatalog = mergeCardCatalog(store.cardCatalog, importedCards);
          const nextDeckConfig = normalizeDeckConfig(store.deckConfig, nextCatalog);
          const nextPresets = store.savedPresets.map((preset) => ({
            ...preset,
            deckConfig: normalizeDeckConfig(preset.deckConfig, nextCatalog),
          }));
          return {
            cardCatalog: nextCatalog,
            deckConfig: nextDeckConfig,
            savedPresets: nextPresets,
            currentScreen: 'deck',
            operationLogs: appendOperationLog(store.operationLogs, `カードマスタを更新しました（追加 / 上書き ${importedCards.length} 件）`, 'deck'),
          };
        });
        return true;
      },
      importAppBackup: (payload) => {
        if (!isRecord(payload) || !isDeckConfigShape(payload.deckConfig)) {
          set((store) => ({
            operationLogs: appendOperationLog(store.operationLogs, 'アプリバックアップ読込に失敗しました: 形式が不正です', 'system'),
          }));
          return false;
        }

        const nextCardCatalog = sanitizeImportedCardCatalog(payload.cardCatalog) ?? clone(defaultCardCatalog);
        const nextDeckConfig = normalizeDeckConfig(clone(payload.deckConfig as DeckConfig), nextCardCatalog);
        const nextPresets = Array.isArray(payload.savedPresets) ? sanitizeImportedPresets(payload.savedPresets, nextCardCatalog) : [];
        const importedLogs = sanitizeOperationLogs(payload.operationLogs);
        const nextUsageStats = sanitizeUsageStats(payload.usageStats);
        const nextLeaderSetup = sanitizeLeaderSetup(payload.leaderSetup);
        const nextScreen = payload.currentScreen === 'battle' || payload.currentScreen === 'deck' ? payload.currentScreen : 'battle';

        set(() => ({
          currentScreen: nextScreen,
          cardCatalog: nextCardCatalog,
          deckConfig: nextDeckConfig,
          leaderSetup: nextLeaderSetup,
          savedPresets: nextPresets,
          battleUndoStack: [],
          operationLogs: appendOperationLog(importedLogs, `バックアップを読み込みました（プリセット ${nextPresets.length} 件 / カード ${nextCardCatalog.length} 件）`, 'system'),
          usageStats: nextUsageStats,
        }));
        return true;
      },
      loadDeckPreset: (presetId) => {
        const { savedPresets, cardCatalog } = get();
        const preset = savedPresets.find((item) => item.id === presetId);
        if (!preset) return;
        set((store) => ({
          deckConfig: normalizeDeckConfig(clone(preset.deckConfig), cardCatalog),
          currentScreen: 'deck',
          operationLogs: appendOperationLog(store.operationLogs, `プリセットを読み込みました: ${preset.name}`, 'preset'),
        }));
      },
      deleteDeckPreset: (presetId) =>
        set((store) => {
          const preset = store.savedPresets.find((item) => item.id === presetId);
          return {
            savedPresets: store.savedPresets.filter((item) => item.id !== presetId),
            operationLogs: preset
              ? appendOperationLog(store.operationLogs, `プリセットを削除しました: ${preset.name}`, 'preset')
              : store.operationLogs,
          };
        }),
      addOperationLog: (message, category = 'app') =>
        set((store) => ({ operationLogs: appendOperationLog(store.operationLogs, message, category) })),
      clearOperationLogs: () =>
        set({ operationLogs: [createOperationLogEntry('操作ログをクリアしました', 'system')] }),
      incrementUsageStat: (key, amount = 1) =>
        set((store) => ({
          usageStats: {
            ...store.usageStats,
            [key]: store.usageStats[key] + amount,
          },
        })),
      resetUsageStats: () =>
        set((store) => ({
          usageStats: createInitialUsageStats(),
          operationLogs: appendOperationLog(store.operationLogs, '利用統計をリセットしました', 'system'),
        })),
      undoBattleAction: () => set((store) => {
        const [previousState, ...restStack] = store.battleUndoStack;
        if (!previousState) return { battleUndoStack: store.battleUndoStack };
        const restoredState = clone(previousState);
        log(restoredState, '1手戻しました');
        return {
          state: restoredState,
          battleUndoStack: restStack,
          operationLogs: appendOperationLog(store.operationLogs, `対戦操作を1手戻しました（残り ${restStack.length} 件）`, 'battle'),
        };
      }),
      updateLeaderSetup: (side, leaderId, patch) => set((store) => {
        const nextLeaderSetup = clone(store.leaderSetup);
        const leaderIndex = nextLeaderSetup[side].findIndex((leader) => leader.id === leaderId);
        if (leaderIndex < 0) return { leaderSetup: store.leaderSetup };

        const currentLeader = nextLeaderSetup[side][leaderIndex];
        const nextName = typeof patch.name === 'string' ? patch.name.trim().slice(0, 24) || currentLeader.name : currentLeader.name;
        const nextHp = typeof patch.baseHp === 'number' && Number.isFinite(patch.baseHp)
          ? Math.min(200, Math.max(50, Math.round(patch.baseHp / 10) * 10))
          : currentLeader.baseHp;

        if (currentLeader.name === nextName && currentLeader.baseHp === nextHp) {
          return { leaderSetup: store.leaderSetup };
        }

        nextLeaderSetup[side][leaderIndex] = { ...currentLeader, name: nextName, baseHp: nextHp };
        const sideLabel = side === 'self' ? '自分側' : '相手側';
        return {
          leaderSetup: nextLeaderSetup,
          operationLogs: appendOperationLog(store.operationLogs, `${sideLabel}リーダー設定を更新しました: ${currentLeader.name} → ${nextName} / HP ${nextHp}`, 'deck'),
        };
      }),
      resetLeaderSetup: () => set((store) => ({
        leaderSetup: clone(DEFAULT_LEADER_SETUP),
        operationLogs: appendOperationLog(store.operationLogs, 'リーダー設定を推奨初期値に戻しました', 'deck'),
      })),
      resetCardCatalog: () => set((store) => ({
        cardCatalog: clone(defaultCardCatalog),
        deckConfig: clone(defaultDeckConfig),
        savedPresets: store.savedPresets.map((preset) => ({ ...preset, deckConfig: normalizeDeckConfig(preset.deckConfig, defaultCardCatalog) })),
        operationLogs: appendOperationLog(store.operationLogs, 'カードマスタを初期状態に戻しました', 'deck'),
      })),
      upsertCardCatalogEntry: (payload) => {
        const { cardCatalog } = get();
        const sanitizedCard = sanitizeRegisteredCardEntry(payload, cardCatalog.length + 1);
        if (!sanitizedCard) {
          set((store) => ({
            operationLogs: appendOperationLog(store.operationLogs, 'カード登録に失敗しました: 入力内容が不正です', 'system'),
          }));
          return false;
        }

        set((store) => {
          const existingCard = store.cardCatalog.find((card) => card.id === sanitizedCard.id);
          const nextCatalog = mergeCardCatalog(store.cardCatalog, [sanitizedCard]);
          return {
            cardCatalog: nextCatalog,
            deckConfig: normalizeDeckConfig(store.deckConfig, nextCatalog),
            savedPresets: store.savedPresets.map((preset) => ({
              ...preset,
              deckConfig: normalizeDeckConfig(preset.deckConfig, nextCatalog),
            })),
            currentScreen: 'deck',
            operationLogs: appendOperationLog(
              store.operationLogs,
              existingCard ? `カードマスタを更新しました: ${sanitizedCard.name}` : `カードを新規登録しました: ${sanitizedCard.name}`,
              'deck',
            ),
          };
        });
        return true;
      },
      deleteCardCatalogEntry: (cardId) => {
        const { cardCatalog } = get();
        const targetCard = cardCatalog.find((card) => card.id === cardId);
        if (!targetCard) {
          set((store) => ({
            operationLogs: appendOperationLog(store.operationLogs, `カード削除に失敗しました: ${cardId}`, 'system'),
          }));
          return false;
        }

        const nextCatalog = cardCatalog.filter((card) => card.id !== cardId);
        if (nextCatalog.length === 0) {
          set((store) => ({
            operationLogs: appendOperationLog(store.operationLogs, 'カード削除に失敗しました: カードマスタが空になります', 'system'),
          }));
          return false;
        }

        set((store) => ({
          cardCatalog: nextCatalog,
          deckConfig: normalizeDeckConfig(store.deckConfig, nextCatalog),
          savedPresets: store.savedPresets.map((preset) => ({
            ...preset,
            deckConfig: normalizeDeckConfig(preset.deckConfig, nextCatalog),
          })),
          currentScreen: 'deck',
          operationLogs: appendOperationLog(store.operationLogs, `カードを削除しました: ${targetCard.name}`, 'deck'),
        }));
        return true;
      },
      updateMainDeckCount: (cardId, delta) => set((store) => {
        const before = getDeckEntryCount(store.deckConfig.main, cardId);
        const nextDeckConfig = updateDeckCount(store.deckConfig, store.cardCatalog, 'main', cardId, delta);
        const after = getDeckEntryCount(nextDeckConfig.main, cardId);
        const cardName = getCardNameById(store.cardCatalog, cardId);
        return {
          deckConfig: nextDeckConfig,
          operationLogs: before !== after
            ? appendOperationLog(store.operationLogs, `メインデッキ調整: ${cardName} を ${after} 枚に変更`, 'deck')
            : store.operationLogs,
        };
      }),
      updateTacticDeckCount: (cardId, delta) => set((store) => {
        const before = getDeckEntryCount(store.deckConfig.tactics, cardId);
        const nextDeckConfig = updateDeckCount(store.deckConfig, store.cardCatalog, 'tactics', cardId, delta);
        const after = getDeckEntryCount(nextDeckConfig.tactics, cardId);
        const cardName = getCardNameById(store.cardCatalog, cardId);
        return {
          deckConfig: nextDeckConfig,
          operationLogs: before !== after
            ? appendOperationLog(store.operationLogs, `タクティクス調整: ${cardName} を ${after} 枚に変更`, 'deck')
            : store.operationLogs,
        };
      }),
      selectActiveLeader: (leaderId) => set((store) => {
        const leader = store.state.self.leaders.find((item) => item.id === leaderId);
        return {
          state: { ...store.state, activeLeaderId: leaderId },
          operationLogs: leader && store.state.activeLeaderId !== leaderId
            ? appendOperationLog(store.operationLogs, `自分リーダーを選択しました: ${leader.name}`, 'battle')
            : store.operationLogs,
        };
      }),
      selectTargetLeader: (leaderId) => set((store) => {
        const leader = store.state.opponent.leaders.find((item) => item.id === leaderId);
        return {
          state: { ...store.state, targetLeaderId: leaderId },
          operationLogs: leader && store.state.targetLeaderId !== leaderId
            ? appendOperationLog(store.operationLogs, `相手リーダーを選択しました: ${leader.name}`, 'battle')
            : store.operationLogs,
        };
      }),
      playHandCard: (cardId, options) =>
        set((store) => {
          const previousState = clone(store.state);
          const state = clone(store.state);
          if (state.winner) return { state };
          if (!ensureRoundTacticSelected(state)) return { state };
          if (state.pendingChoice) {
            log(state, '先に保留中のカード効果を解決してください');
            return { state };
          }
          if (state.pendingDiscardCount > 0) {
            log(state, '先に手札を7枚まで捨ててください');
            return { state };
          }
          const card = state.self.hand.find((item) => item.id === cardId);
          if (!card) return { state };
          const nextOperationLogs = appendOperationLog(
            store.operationLogs,
            options?.forceCostPayment
              ? `手札カードを通常コストで使用しました: ${card.name}`
              : `手札カードを使用しました: ${card.name}`,
            'battle',
          );
          const didPlay = playHandCardRuntime(state, cardId, {
            log: (message) => log(state, message),
            onRoundWin: () => checkRoundWin(state),
          }, options);

          if (!didPlay) return { state, operationLogs: nextOperationLogs };
          return {
            state,
            battleUndoStack: pushBattleUndo(store.battleUndoStack, previousState),
            operationLogs: nextOperationLogs,
            usageStats: { ...store.usageStats, cardsPlayed: store.usageStats.cardsPlayed + 1 },
          };
        }),
      setRoundTactic: (cardId) =>
        set((store) => {
          const previousState = clone(store.state);
          const state = clone(store.state);
          if (state.pendingChoice) {
            log(state, '先に保留中のカード効果を解決してください');
            return { state };
          }
          if (state.roundTacticSelected) {
            log(state, 'このラウンドではすでにタクティクスをセット済みです');
            return { state };
          }
          const cardIndex = state.self.tacticsDeck.findIndex((card) => card.id === cardId);
          const card = state.self.tacticsDeck[cardIndex];
          if (!card) return { state };
          state.self.tacticsDeck.splice(cardIndex, 1);
          state.self.tacticsSet.push(card);
          state.roundTacticSelected = true;
          log(state, `タクティクスセット: ${card.name}`);
          if (state.round === 1 && state.self.ppTicket && !state.self.tacticsSet.some((setCard) => setCard.type === 'pp')) {
            const ppTicketCard = createPpTicketCard(store.cardCatalog, Date.now());
            state.self.tacticsSet.push(ppTicketCard);
            log(state, '後攻PPカードをタクティクスエリアに配置しました');
          }
          return {
            state,
            battleUndoStack: pushBattleUndo(store.battleUndoStack, previousState),
            operationLogs: appendOperationLog(store.operationLogs, `ラウンド用タクティクスをセットしました: ${card.name}`, 'battle'),
            usageStats: { ...store.usageStats, tacticsSet: store.usageStats.tacticsSet + 1 },
          };
        }),
      useSetTactic: (cardId) =>
        set((store) => {
          const previousState = clone(store.state);
          const state = clone(store.state);
          if (state.winner) return { state };
          if (!ensureRoundTacticSelected(state)) return { state };
          if (state.pendingChoice) {
            log(state, '先に保留中のカード効果を解決してください');
            return { state };
          }
          if (state.tacticsUsedThisTurn) {
            log(state, '同一ターンにタクティクスカードを2枚使えません');
            return { state };
          }
          if (state.firstPlayer === 'self' && state.round === 1 && state.turn === 1) {
            log(state, '先攻1ターン目はタクティクスを使えません');
            return { state };
          }
          const tactic = state.self.tacticsSet.find((item) => item.id === cardId);
          if (!tactic) return { state };
          const nextOperationLogs = appendOperationLog(store.operationLogs, `セット済みタクティクスを使用しました: ${tactic.name}`, 'battle');
          const didUse = useSetTacticRuntime(state, cardId, {
            log: (message) => log(state, message),
            onRoundWin: () => checkRoundWin(state),
          });
          if (!didUse) return { state, operationLogs: nextOperationLogs };
          return {
            state,
            battleUndoStack: pushBattleUndo(store.battleUndoStack, previousState),
            operationLogs: nextOperationLogs,
            usageStats: { ...store.usageStats, tacticsUsed: store.usageStats.tacticsUsed + 1 },
          };
        }),
      discardHandCard: (cardId) =>
        set((store) => {
          const previousState = clone(store.state);
          const state = clone(store.state);
          if (state.pendingChoice) {
            log(state, '先に保留中のカード効果を解決してください');
            return { state };
          }
          if (state.pendingDiscardCount <= 0) return { state };
          const cardIndex = state.self.hand.findIndex((card) => card.id === cardId);
          const card = state.self.hand[cardIndex];
          if (!card) return { state };
          state.self.hand.splice(cardIndex, 1);
          state.self.trash.push(card);
          state.pendingDiscardCount -= 1;
          log(state, `手札調整: ${card.name} を捨てました`);
          if (state.pendingDiscardCount <= 0) {
            beginNextTurn(state);
          }
          return {
            state,
            battleUndoStack: pushBattleUndo(store.battleUndoStack, previousState),
            operationLogs: appendOperationLog(store.operationLogs, `手札調整でカードを捨てました: ${card.name}`, 'battle'),
            usageStats: { ...store.usageStats, discards: store.usageStats.discards + 1 },
          };
        }),
      resolvePendingChoice: (payload) =>
        set((store) => {
          const previousState = clone(store.state);
          const state = clone(store.state);
          if (!state.pendingChoice) return { state };
          const cardsDiscardedBefore = previousState.cardsDiscardedThisTurn;
          const didResolve = resolvePendingChoiceRuntime(state, payload, {
            log: (message) => log(state, message),
            onRoundWin: () => checkRoundWin(state),
          });
          if (!didResolve) return { state };
          const discardDelta = Math.max(0, state.cardsDiscardedThisTurn - cardsDiscardedBefore);
          const resolutionMessage = previousState.pendingChoice?.kind === 'post_attack_self_discard'
            ? '保留中のアタック後ディスカードを解決しました'
            : previousState.pendingChoice?.kind === 'self_discard_after_draw'
              ? '保留中のプレイ時ディスカードを解決しました'
              : previousState.pendingChoice?.kind === 'post_attack_other_leader_damage'
                ? '保留中のアタック後ダメージ割り振りを解決しました'
                : previousState.pendingChoice?.kind === 'optional_trash_topdeck_for_next_attack_buff'
                  ? payload.accept
                    ? '山札確認後の任意トラッシュを解決しました'
                    : '山札確認後の任意トラッシュを行わず解決しました'
                  : payload.accept
                    ? '保留中の任意効果を解決しました'
                    : '保留中の任意効果をスキップして解決しました';
          return {
            state,
            battleUndoStack: pushBattleUndo(store.battleUndoStack, previousState),
            operationLogs: appendOperationLog(
              store.operationLogs,
              resolutionMessage,
              'battle',
            ),
            usageStats: { ...store.usageStats, discards: store.usageStats.discards + discardDelta },
          };
        }),
      cancelPendingChoice: () =>
        get().resolvePendingChoice({ accept: false }),
      endTurn: () =>
        set((store) => {
          const previousState = clone(store.state);
          const state = clone(store.state);
          if (state.winner) return { state };
          if (!ensureRoundTacticSelected(state)) return { state };
          if (state.pendingChoice) {
            log(state, '先に保留中のカード効果を解決してください');
            return { state };
          }
          if (state.pendingDiscardCount > 0) {
            log(state, '先にディスカードを完了してください');
            return { state };
          }
          const nextOperationLogs = appendOperationLog(store.operationLogs, `ターン終了を実行しました: Round ${state.round} / Turn ${state.turn}`, 'battle');
          const nextUndoStack = pushBattleUndo(store.battleUndoStack, previousState);
          const leftoverPp = state.ppCurrent;
          handleEndTurnFieldCards(state, { log: (message) => log(state, message), onRoundWin: () => checkRoundWin(state) });
          resetTurnDamage(state.self.leaders);
          resetTurnDamage(state.opponent.leaders);
          if (leftoverPp > 0) {
            drawCards(state.self, leftoverPp, state, { log: (message) => log(state, message) });
            log(state, `ターン終了: 余りPP ${leftoverPp} 分ドロー`);
          } else {
            log(state, 'ターン終了');
          }
          if (state.self.hand.length > 7) {
            state.pendingDiscardCount = state.self.hand.length - 7;
            log(state, `手札調整: ${state.pendingDiscardCount} 枚捨てて7枚にしてください`);
            state.ppCurrent = 0;
            state.nextAttackBuff = 0;
            state.nextAttackEffectQueue = [];
            state.postAttackEffectQueue = [];
            state.turnAttackBuff = 0;
            state.effectDrawCountThisTurn = 0;
            return { state, battleUndoStack: nextUndoStack, operationLogs: nextOperationLogs };
          }
          beginNextTurn(state);
          return { state, battleUndoStack: nextUndoStack, operationLogs: nextOperationLogs };
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (store) => ({
        currentScreen: store.currentScreen,
        cardCatalog: store.cardCatalog,
        deckConfig: store.deckConfig,
        leaderSetup: store.leaderSetup,
        savedPresets: store.savedPresets,
        operationLogs: store.operationLogs,
        usageStats: store.usageStats,
        battleUndoStack: store.battleUndoStack,
        state: store.state,
      }),
    },
  ),
);
