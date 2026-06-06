import useAppDataActions from './useAppDataActions';
import useAppUiState from './useAppUiState';
import useModalLayerState from './useModalLayerState';
import useBattleScreenState from './useBattleScreenState';
import type { AppStoreBindings } from './useAppStoreBindings';

export type AppUiBindings = ReturnType<typeof useAppUiState>;
export type ModalLayerBindings = ReturnType<typeof useModalLayerState>;
export type BattleScreenBindings = ReturnType<typeof useBattleScreenState>;
export type AppDataActionBindings = ReturnType<typeof useAppDataActions>;

export type AppScreenBindings = {
  appUiState: AppUiBindings;
  modalLayerState: ModalLayerBindings;
  battleScreenState: BattleScreenBindings;
  appDataActions: AppDataActionBindings;
};

export default function useAppScreenBindings(
  store: AppStoreBindings,
): AppScreenBindings {
  const appUiState = useAppUiState({
    addOperationLog: store.addOperationLog,
  });

  const modalLayerState = useModalLayerState({
    addOperationLog: store.addOperationLog,
    pendingChoice: store.state.pendingChoice,
    selfHand: store.state.self.hand,
    selfLeaders: store.state.self.leaders,
    opponentLeaders: store.state.opponent.leaders,
    fieldCards: store.state.fieldCards,
    playHandCard: store.playHandCard,
    setRoundTactic: store.setRoundTactic,
    useSetTactic: store.useSetTactic,
  });

  const battleScreenState = useBattleScreenState({
    state: store.state,
    battleUndoCount: store.battleUndoStack.length,
    cardCatalog: store.cardCatalog,
  });

  const appDataActions = useAppDataActions({
    currentScreen: store.currentScreen,
    deckConfig: store.deckConfig,
    cardCatalog: store.cardCatalog,
    leaderSetup: store.leaderSetup,
    savedPresets: store.savedPresets,
    operationLogs: store.operationLogs,
    usageStats: store.usageStats,
    state: store.state,
    isSelfSecond: battleScreenState.isSelfSecond,
    canUndoBattle: battleScreenState.canUndoBattle,
    importAppBackup: store.importAppBackup,
    addOperationLog: store.addOperationLog,
    clearOperationLogs: store.clearOperationLogs,
    incrementUsageStat: store.incrementUsageStat,
    resetUsageStats: store.resetUsageStats,
    resetLeaderSetup: store.resetLeaderSetup,
    undoBattleAction: store.undoBattleAction,
    requestConfirm: modalLayerState.requestConfirm,
  });

  return {
    appUiState,
    modalLayerState,
    battleScreenState,
    appDataActions,
  };
}
