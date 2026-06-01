import type { Card, CardCatalogImportExportData, DeckConfig, DeckEntry, DeckGroup, RegisteredCard } from '../types/game';

const createRegisteredCard = (card: Omit<RegisteredCard, 'tags'> & { tags?: string[] }): RegisteredCard => ({
  ...card,
  tags: card.tags ? [...card.tags] : [],
});

export const defaultCardCatalog: RegisteredCard[] = [
  createRegisteredCard({
    id: 'core-main-attack-30',
    name: 'アタック 30',
    type: 'attack',
    deckGroup: 'main',
    cost: 1,
    power: 30,
    effectType: 'none',
    effectValue: 0,
    text: '対象に 30 ダメージ',
    maxCopies: 50,
    expansion: 'CORE',
    sortOrder: 10,
    tags: ['starter', 'attack'],
  }),
  createRegisteredCard({
    id: 'core-main-attack-40',
    name: 'アタック 40',
    type: 'attack',
    deckGroup: 'main',
    cost: 2,
    power: 40,
    effectType: 'none',
    effectValue: 0,
    text: '対象に 40 ダメージ',
    maxCopies: 50,
    expansion: 'CORE',
    sortOrder: 20,
    tags: ['starter', 'attack'],
  }),
  createRegisteredCard({
    id: 'core-main-memoria-next-20',
    name: 'メモリア +20',
    type: 'memoria',
    deckGroup: 'main',
    cost: 1,
    effectType: 'nextAttackBuff',
    effectValue: 20,
    text: '次の1回のアタックを +20',
    maxCopies: 50,
    expansion: 'CORE',
    sortOrder: 30,
    tags: ['starter', 'buff'],
  }),
  createRegisteredCard({
    id: 'core-main-memoria-turn-10',
    name: 'メモリア 全体+10',
    type: 'memoria',
    deckGroup: 'main',
    cost: 2,
    effectType: 'turnAttackBuff',
    effectValue: 10,
    text: 'このターンのアタックを +10',
    maxCopies: 50,
    expansion: 'CORE',
    sortOrder: 40,
    tags: ['starter', 'buff'],
  }),
  createRegisteredCard({
    id: 'core-main-memoria-heal-20',
    name: 'メモリア 回復20',
    type: 'memoria',
    deckGroup: 'main',
    cost: 1,
    effectType: 'heal',
    effectValue: 20,
    text: '選択中の自分リーダーを 20 回復',
    maxCopies: 50,
    expansion: 'CORE',
    sortOrder: 50,
    tags: ['starter', 'heal'],
  }),
  createRegisteredCard({
    id: 'core-main-memoria-direct-20',
    name: 'メモリア 直撃20',
    type: 'memoria',
    deckGroup: 'main',
    cost: 2,
    effectType: 'directDamage',
    effectValue: 20,
    text: '相手リーダーに 20 ダメージ',
    maxCopies: 50,
    expansion: 'CORE',
    sortOrder: 60,
    tags: ['starter', 'direct'],
  }),
  createRegisteredCard({
    id: 'core-tactic-next-30',
    name: 'タクティクス +30',
    type: 'tactics',
    deckGroup: 'tactics',
    cost: 0,
    effectType: 'nextAttackBuff',
    effectValue: 30,
    text: '次の1回のアタックを +30',
    maxCopies: 5,
    expansion: 'CORE',
    sortOrder: 110,
    tags: ['starter', 'buff'],
  }),
  createRegisteredCard({
    id: 'core-tactic-turn-10',
    name: 'タクティクス 全体+10',
    type: 'tactics',
    deckGroup: 'tactics',
    cost: 0,
    effectType: 'turnAttackBuff',
    effectValue: 10,
    text: 'このターンのアタックを +10',
    maxCopies: 5,
    expansion: 'CORE',
    sortOrder: 120,
    tags: ['starter', 'buff'],
  }),
  createRegisteredCard({
    id: 'core-tactic-heal-30',
    name: 'タクティクス 回復30',
    type: 'tactics',
    deckGroup: 'tactics',
    cost: 0,
    effectType: 'heal',
    effectValue: 30,
    text: '選択中の自分リーダーを 30 回復',
    maxCopies: 5,
    expansion: 'CORE',
    sortOrder: 130,
    tags: ['starter', 'heal'],
  }),
  createRegisteredCard({
    id: 'core-tactic-direct-30',
    name: 'タクティクス 直撃30',
    type: 'tactics',
    deckGroup: 'tactics',
    cost: 0,
    effectType: 'directDamage',
    effectValue: 30,
    text: '相手リーダーに 30 ダメージ',
    maxCopies: 5,
    expansion: 'CORE',
    sortOrder: 140,
    tags: ['starter', 'direct'],
  }),
  createRegisteredCard({
    id: 'core-tactic-equipment-10',
    name: '装備タクティクス',
    type: 'equipment',
    deckGroup: 'tactics',
    cost: 0,
    effectType: 'equipmentAttackBuff',
    effectValue: 10,
    text: '装備中、アタックを +10',
    maxCopies: 5,
    expansion: 'CORE',
    sortOrder: 150,
    tags: ['starter', 'equipment'],
  }),
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const sortCardCatalog = (cards: RegisteredCard[]) => (
  [...cards].sort((a, b) => {
    if (a.deckGroup !== b.deckGroup) return a.deckGroup === 'main' ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, 'ja-JP');
  })
);

export const getMainCardCatalog = (cards: RegisteredCard[]) => sortCardCatalog(cards).filter((card) => card.deckGroup === 'main');
export const getTacticCardCatalog = (cards: RegisteredCard[]) => sortCardCatalog(cards).filter((card) => card.deckGroup === 'tactics');

export const buildCardCatalogMap = (cards: RegisteredCard[]) => Object.fromEntries(cards.map((card) => [card.id, card])) as Record<string, RegisteredCard>;

export const getDeckEntryCount = (entries: DeckEntry[], cardId: string) => entries.find((entry) => entry.cardId === cardId)?.count ?? 0;

export const setDeckEntryCount = (entries: DeckEntry[], cardId: string, count: number): DeckEntry[] => {
  const normalizedCount = Math.max(0, Math.floor(count));
  const filtered = entries.filter((entry) => entry.cardId !== cardId);
  if (normalizedCount <= 0) return filtered;
  return [...filtered, { cardId, count: normalizedCount }];
};

export const getDeckTotal = (entries: DeckEntry[]) => entries.reduce((sum, entry) => sum + entry.count, 0);

export const createDefaultDeckConfig = (): DeckConfig => ({
  main: [
    { cardId: 'core-main-attack-30', count: 18 },
    { cardId: 'core-main-attack-40', count: 12 },
    { cardId: 'core-main-memoria-next-20', count: 8 },
    { cardId: 'core-main-memoria-turn-10', count: 5 },
    { cardId: 'core-main-memoria-heal-20', count: 4 },
    { cardId: 'core-main-memoria-direct-20', count: 3 },
  ],
  tactics: [
    { cardId: 'core-tactic-next-30', count: 1 },
    { cardId: 'core-tactic-turn-10', count: 1 },
    { cardId: 'core-tactic-heal-30', count: 1 },
    { cardId: 'core-tactic-direct-30', count: 1 },
    { cardId: 'core-tactic-equipment-10', count: 1 },
  ],
});

export const createEmptyDeckConfig = (): DeckConfig => ({ main: [], tactics: [] });

export const exportCardCatalogData = (cards: RegisteredCard[]): CardCatalogImportExportData => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  cards: clone(sortCardCatalog(cards)),
});

export const createBattleCard = (card: RegisteredCard, instanceId: string): Card => ({
  id: instanceId,
  sourceCardId: card.id,
  name: card.name,
  type: card.type,
  cost: card.cost,
  power: card.power,
  effectType: card.effectType,
  effectValue: card.effectValue,
  text: card.text,
  officialUrl: card.officialUrl,
  officialImageUrl: card.officialImageUrl,
  imageStatus: card.imageStatus,
  officialSet: card.officialSet,
  officialCardNumber: card.officialCardNumber,
  rawCardType: card.rawCardType,
  color: card.color,
  rarity: card.rarity,
  buildRule: card.buildRule,
  illustrator: card.illustrator,
  baseAtk: card.baseAtk,
  awakenedAtk: card.awakenedAtk,
  baseHp: card.baseHp,
  awakenedHp: card.awakenedHp,
});

const isCardType = (value: unknown) => value === 'attack' || value === 'memoria' || value === 'tactics' || value === 'equipment' || value === 'leader' || value === 'pp';
const isEffectType = (value: unknown) => value === 'none' || value === 'nextAttackBuff' || value === 'turnAttackBuff' || value === 'heal' || value === 'directDamage' || value === 'equipmentAttackBuff';
const isDeckGroup = (value: unknown): value is DeckGroup => value === 'main' || value === 'tactics' || value === 'leader' || value === 'other';

export const sanitizeRegisteredCardEntry = (value: unknown, index: number): RegisteredCard | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || !value.id.trim()) return null;
  if (typeof value.name !== 'string' || !value.name.trim()) return null;
  if (!isCardType(value.type) || !isEffectType(value.effectType) || !isDeckGroup(value.deckGroup)) return null;
  if (typeof value.cost !== 'number' || !Number.isFinite(value.cost) || value.cost < 0) return null;
  if (typeof value.effectValue !== 'number' || !Number.isFinite(value.effectValue)) return null;
  if (typeof value.text !== 'string') return null;

  const maxCopies = typeof value.maxCopies === 'number' && Number.isFinite(value.maxCopies)
    ? Math.min(50, Math.max(1, Math.floor(value.maxCopies)))
    : value.deckGroup === 'tactics' ? 5 : 4;

  const power = typeof value.power === 'number' && Number.isFinite(value.power) ? value.power : undefined;
  const expansion = typeof value.expansion === 'string' && value.expansion.trim() ? value.expansion.trim() : undefined;
  const sortOrder = typeof value.sortOrder === 'number' && Number.isFinite(value.sortOrder) ? value.sortOrder : index * 10;
  const tags = Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map((tag) => tag.trim()) : [];
  const officialUrl = typeof value.officialUrl === 'string' && value.officialUrl.trim() ? value.officialUrl.trim() : undefined;
  const officialImageUrl = typeof value.officialImageUrl === 'string' && value.officialImageUrl.trim() ? value.officialImageUrl.trim() : undefined;
  const imageStatus = value.imageStatus === 'ready' || value.imageStatus === 'missing' || value.imageStatus === 'error'
    ? value.imageStatus
    : officialImageUrl ? 'ready' : 'missing';
  const officialSet = typeof value.officialSet === 'string' && value.officialSet.trim() ? value.officialSet.trim() : undefined;
  const officialCardNumber = typeof value.officialCardNumber === 'string' && value.officialCardNumber.trim() ? value.officialCardNumber.trim() : undefined;
  const rawCardType = typeof value.rawCardType === 'string' && value.rawCardType.trim() ? value.rawCardType.trim() : undefined;
  const color = typeof value.color === 'string' && value.color.trim() ? value.color.trim() : undefined;
  const rarity = typeof value.rarity === 'string' && value.rarity.trim() ? value.rarity.trim() : undefined;
  const buildRule = typeof value.buildRule === 'string' && value.buildRule.trim() ? value.buildRule.trim() : undefined;
  const illustrator = typeof value.illustrator === 'string' && value.illustrator.trim() ? value.illustrator.trim() : undefined;
  const baseAtk = typeof value.baseAtk === 'string' && value.baseAtk.trim() ? value.baseAtk.trim() : undefined;
  const awakenedAtk = typeof value.awakenedAtk === 'string' && value.awakenedAtk.trim() ? value.awakenedAtk.trim() : undefined;
  const baseHp = typeof value.baseHp === 'string' && value.baseHp.trim() ? value.baseHp.trim() : undefined;
  const awakenedHp = typeof value.awakenedHp === 'string' && value.awakenedHp.trim() ? value.awakenedHp.trim() : undefined;

  return createRegisteredCard({
    id: value.id.trim(),
    name: value.name.trim(),
    type: value.type,
    deckGroup: value.deckGroup,
    cost: Math.floor(value.cost),
    power,
    effectType: value.effectType,
    effectValue: value.effectValue,
    text: value.text.trim(),
    maxCopies,
    expansion,
    sortOrder,
    tags,
    officialUrl,
    officialImageUrl,
    imageStatus,
    officialSet,
    officialCardNumber,
    rawCardType,
    color,
    rarity,
    buildRule,
    illustrator,
    baseAtk,
    awakenedAtk,
    baseHp,
    awakenedHp,
  });
};

export const sanitizeImportedCardCatalog = (payload: unknown): RegisteredCard[] | null => {
  const rawCards = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.cards)
      ? payload.cards
      : null;

  if (!rawCards) return null;

  const nextCards = rawCards
    .map((card, index) => sanitizeRegisteredCardEntry(card, index + 1))
    .filter((card): card is RegisteredCard => Boolean(card));

  if (nextCards.length === 0) return null;

  const seenIds = new Set<string>();
  const deduped = nextCards.filter((card) => {
    if (seenIds.has(card.id)) return false;
    seenIds.add(card.id);
    return true;
  });

  return sortCardCatalog(deduped);
};
