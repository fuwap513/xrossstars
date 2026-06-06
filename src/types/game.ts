export type CardType = 'attack' | 'memoria' | 'tactics' | 'equipment' | 'leader' | 'pp';
export type EffectType = 'none' | 'nextAttackBuff' | 'turnAttackBuff' | 'heal' | 'directDamage' | 'equipmentAttackBuff';
export type Side = 'self' | 'opponent';
export type MatchRound = 1 | 2 | 3;
export type AppScreen = 'battle' | 'deck';
export type DeckGroup = 'main' | 'tactics' | 'leader' | 'other';

export type Card = {
  id: string;
  sourceCardId?: string;
  name: string;
  type: CardType;
  cost: number;
  power?: number;
  effectType: EffectType;
  effectValue: number;
  text: string;
  officialUrl?: string;
  officialImageUrl?: string;
  imageStatus?: 'ready' | 'missing' | 'error';
  officialSet?: string;
  officialCardNumber?: string;
  rawCardType?: string;
  color?: string;
  rarity?: string;
  buildRule?: string;
  illustrator?: string;
  baseAtk?: string;
  awakenedAtk?: string;
  baseHp?: string;
  awakenedHp?: string;
  equippedLeaderId?: string;
  oncePerTurnUsedKey?: string;
};

export type RegisteredCard = Card & {
  deckGroup: DeckGroup;
  maxCopies: number;
  expansion?: string;
  tags?: string[];
  sortOrder: number;
};

export type DeckEntry = {
  cardId: string;
  count: number;
};

export type DeckConfig = {
  main: DeckEntry[];
  tactics: DeckEntry[];
};

export type DeckPreset = {
  id: string;
  name: string;
  deckConfig: DeckConfig;
  createdAt: string;
};

export type DeckImportExportData = {
  version: 2;
  exportedAt: string;
  deckConfig: DeckConfig;
  savedPresets: DeckPreset[];
};

export type CardCatalogImportExportData = {
  version: 1;
  exportedAt: string;
  cards: RegisteredCard[];
};

export type OperationLogCategory = 'app' | 'deck' | 'preset' | 'battle' | 'system';

export type OperationLogEntry = {
  id: string;
  timestamp: string;
  category: OperationLogCategory;
  message: string;
};

export type AppUsageStats = {
  gamesStarted: number;
  gameResets: number;
  cardsPlayed: number;
  tacticsSet: number;
  tacticsUsed: number;
  discards: number;
  battleLogExports: number;
  operationLogExports: number;
};

export type LeaderSetupEntry = {
  id: string;
  name: string;
  baseHp: number;
  sourceCardId?: string;
};

export type LeaderSetup = {
  self: LeaderSetupEntry[];
  opponent: LeaderSetupEntry[];
};

export type AppBackupData = {
  version: 2;
  exportedAt: string;
  currentScreen: AppScreen;
  deckConfig: DeckConfig;
  cardCatalog: RegisteredCard[];
  leaderSetup: LeaderSetup;
  savedPresets: DeckPreset[];
  operationLogs: OperationLogEntry[];
  usageStats: AppUsageStats;
};

export type BattleHistoryEntry = {
  id: string;
  timestamp: string;
  round: MatchRound;
  turn: number;
  message: string;
};

export type RoundSummaryEntry = {
  id: string;
  round: MatchRound;
  turnReached: number;
  selfWins: number;
  selfLeadersDown: number;
  opponentLeadersDown: number;
  handCount: number;
  deckCount: number;
  trashCount: number;
  note: string;
};

export type PendingBattleChoice =
  | {
      kind: 'optional_discard_for_attack_bonus';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      bonusDamage: number;
      selectableHandCardIds: string[];
    }
  | {
      kind: 'optional_cost0_discard_for_attack_bonus';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      bonusDamage: number;
      drawCount: number;
      selectableHandCardIds: string[];
    }
  | {
      kind: 'post_attack_self_discard';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      selectableHandCardIds: string[];
    }
  | {
      kind: 'self_discard_after_draw';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      discardCountRemaining: number;
      selectableHandCardIds: string[];
    }
  | {
      kind: 'optional_trash_topdeck_for_next_attack_buff';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      revealedCard: Card;
      selectableHandCardIds: string[];
    }
  | {
      kind: 'post_attack_other_leader_damage';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      damageAmount: number;
      selectableLeaderIds: string[];
      selectableHandCardIds: string[];
      attackerLeaderId: string;
      attackedLeaderId: string;
      targetDowned: boolean;
      targetColor?: string;
    }
  | {
      kind: 'drain_rod_heal_distribution';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      remainingHeal: number;
      healedTotal: number;
      selectableLeaderIds: string[];
      selectableHandCardIds: string[];
    }
  | {
      kind: 'drain_rod_damage_target';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      damageAmount: number;
      selectableLeaderIds: string[];
      selectableHandCardIds: string[];
    };

export type QueuedNextAttackEffect =
  | {
      kind: 'other_leader_damage';
      sourceCardName: string;
      sourceText: string;
      damageAmount: number;
    }
  | {
      kind: 'all_other_leader_damage';
      sourceCardName: string;
      sourceText: string;
      damageAmount: number;
    };

export type QueuedPostAttackEffect =
  | {
      kind: 'other_leader_damage';
      sourceCardName: string;
      sourceText: string;
      damageAmount: number;
      attackerLeaderId: string;
      attackedLeaderId: string;
      targetColor?: string;
    }
  | {
      kind: 'all_other_leader_damage';
      sourceCardName: string;
      sourceText: string;
      damageAmount: number;
      attackerLeaderId: string;
      attackedLeaderId: string;
      targetColor?: string;
    };

export type Leader = {
  id: string;
  name: string;
  baseAtk: number;
  baseHp: number;
  awakened: boolean;
  currentDamage: number;
  isDown: boolean;
  sourceCardId?: string;
  effectText?: string;
  color?: string;
  rarity?: string;
};

export type PlayerBoard = {
  name: string;
  leaders: Leader[];
  hand: Card[];
  mainDeck: Card[];
  trash: Card[];
  tacticsDeck: Card[];
  tacticsSet: Card[];
  equipmentZone: Card[];
  ppTicket: boolean;
  wins: number;
};

export type MatchState = {
  round: MatchRound;
  turn: number;
  ppCurrent: number;
  ppMax: number;
  firstPlayer: Side;
  activeLeaderId: string;
  targetLeaderId: string;
  tacticsUsedThisTurn: boolean;
  roundTacticSelected: boolean;
  nextAttackBuff: number;
  nextAttackEffectQueue: QueuedNextAttackEffect[];
  postAttackEffectQueue: QueuedPostAttackEffect[];
  turnAttackBuff: number;
  roundAttackBuff: number;
  pendingDiscardCount: number;
  effectDrawCountThisTurn: number;
  cardsDiscardedThisTurn: number;
  pendingChoice?: PendingBattleChoice;
  winner?: Side;
  self: PlayerBoard;
  opponent: PlayerBoard;
  fieldCards: Card[];
  logs: string[];
  battleHistory: BattleHistoryEntry[];
  roundSummaries: RoundSummaryEntry[];
};

export type GameStore = {
  currentScreen: AppScreen;
  cardCatalog: RegisteredCard[];
  deckConfig: DeckConfig;
  leaderSetup: LeaderSetup;
  savedPresets: DeckPreset[];
  operationLogs: OperationLogEntry[];
  usageStats: AppUsageStats;
  battleUndoStack: MatchState[];
  state: MatchState;
  switchScreen: (screen: AppScreen) => void;
  startNewGame: (firstPlayer?: Side) => void;
  applyDeckAndStartGame: (firstPlayer?: Side) => void;
  resetGame: () => void;
  clearSavedGame: () => void;
  resetDeckConfig: () => void;
  saveDeckPreset: (name?: string) => void;
  overwriteDeckPreset: (presetId: string) => void;
  renameDeckPreset: (presetId: string, nextName: string) => boolean;
  moveDeckPreset: (presetId: string, direction: 'up' | 'down') => void;
  importDeckData: (payload: unknown) => boolean;
  importCardCatalog: (payload: unknown) => boolean;
  importAppBackup: (payload: unknown) => boolean;
  loadDeckPreset: (presetId: string) => void;
  deleteDeckPreset: (presetId: string) => void;
  addOperationLog: (message: string, category?: OperationLogCategory) => void;
  clearOperationLogs: () => void;
  incrementUsageStat: (key: keyof AppUsageStats, amount?: number) => void;
  resetUsageStats: () => void;
  undoBattleAction: () => void;
  updateLeaderSetup: (side: Side, leaderId: string, patch: Partial<Omit<LeaderSetupEntry, 'id'>>) => void;
  resetLeaderSetup: () => void;
  resetCardCatalog: () => void;
  upsertCardCatalogEntry: (payload: unknown) => boolean;
  deleteCardCatalogEntry: (cardId: string) => boolean;
  updateMainDeckCount: (cardId: string, delta: number) => void;
  updateTacticDeckCount: (cardId: string, delta: number) => void;
  selectActiveLeader: (leaderId: string) => void;
  selectTargetLeader: (leaderId: string) => void;
  playHandCard: (cardId: string, options?: { forceCostPayment?: boolean }) => void;
  setRoundTactic: (cardId: string) => void;
  useSetTactic: (cardId: string) => void;
  discardHandCard: (cardId: string) => void;
  resolvePendingChoice: (payload: { accept: boolean; selectedCardId?: string; selectedLeaderId?: string }) => void;
  cancelPendingChoice: () => void;
  endTurn: () => void;
};

