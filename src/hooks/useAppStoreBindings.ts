import { selectDeckTotals } from './appScreenControllerSelectors';
import { useGameStore } from '../store/gameStore';
import type { GameStore } from '../types/game';

export type AppStoreBindings = GameStore & {
  mainTotal: number;
  tacticsTotal: number;
};

export default function useAppStoreBindings(): AppStoreBindings {
  const store = useGameStore();
  const { mainTotal, tacticsTotal } = selectDeckTotals(store.deckConfig);

  return {
    ...store,
    mainTotal,
    tacticsTotal,
  };
}

