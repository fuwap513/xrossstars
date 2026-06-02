import { getDeckTotal } from '../data/cards';
import type { DeckConfig } from '../types/game';

export const APP_NAME = 'Xross Stars 検証アプリ';
export const APP_VERSION = 'v1.1.0';

export const selectDeckTotals = (deckConfig: DeckConfig) => ({
  mainTotal: getDeckTotal(deckConfig.main),
  tacticsTotal: getDeckTotal(deckConfig.tactics),
});
