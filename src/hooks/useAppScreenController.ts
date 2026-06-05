import {
  buildAppFooterProps,
  buildBattleScreenProps,
  buildDeckEditorProps,
  buildFooterPanelsProps,
  buildHeaderProps,
  buildLeaderSetupEditorProps,
  buildModalLayerProps,
  buildTopPanelsProps,
} from './appScreenControllerBuilders';
import type { AppScreenControllerResult } from './appScreenControllerTypes';
import useAppScreenBindings from './useAppScreenBindings';
import useAppStoreBindings from './useAppStoreBindings';

export default function useAppScreenController(): AppScreenControllerResult {
  const store = useAppStoreBindings();
  const bindings = useAppScreenBindings(store);

  const headerProps = buildHeaderProps({
    round: store.state.round,
    turn: store.state.turn,
    ppCurrent: store.state.ppCurrent,
    ppMax: store.state.ppMax,
    isSelfSecond: bindings.battleScreenState.isSelfSecond,
    onOpenGuide: bindings.modalLayerState.openGuide,
  });

  const topPanelsProps = buildTopPanelsProps({
    currentScreen: store.currentScreen,
    switchScreen: store.switchScreen,
    isOffline: bindings.appUiState.isOffline,
    showInstallBanner: bindings.appUiState.showInstallBanner,
    hasInstallPrompt: bindings.appUiState.hasInstallPrompt,
    installMessage: bindings.appUiState.installMessage,
    showGuideBanner: bindings.modalLayerState.showGuideBanner,
    offlineCacheMessage: bindings.appUiState.offlineCacheMessage,
    offlineCacheStatus: bindings.appUiState.offlineCacheStatus,
    backupMessage: bindings.appDataActions.backupMessage,
    backupStatus: bindings.appDataActions.backupStatus,
    onInstallApp: bindings.appUiState.handleInstallApp,
    onDismissInstallBanner: bindings.appUiState.dismissInstallBanner,
    onOpenGuide: bindings.modalLayerState.openGuide,
    onDismissGuideBanner: bindings.modalLayerState.dismissGuideBanner,
    onPrepareOffline: bindings.appUiState.handlePrepareOffline,
    onRefreshOfflineCache: bindings.appUiState.handleRefreshOfflineCache,
    onExportAppBackup: bindings.appDataActions.handleExportAppBackup,
    onImportAppBackup: bindings.appDataActions.handleImportAppBackup,
  });

  const deckEditorProps = buildDeckEditorProps({
    cardCatalog: store.cardCatalog,
    deckConfig: store.deckConfig,
    savedPresets: store.savedPresets,
    mainTotal: store.mainTotal,
    tacticsTotal: store.tacticsTotal,
    onMainChange: store.updateMainDeckCount,
    onTacticChange: store.updateTacticDeckCount,
    onReset: store.resetDeckConfig,
    onApplyFirst: () => store.applyDeckAndStartGame('self'),
    onApplySecond: () => store.applyDeckAndStartGame('opponent'),
    onPreviewCard: (card) => bindings.modalLayerState.openPreview(card, 'デッキ編集 / カード詳細'),
    onSavePreset: store.saveDeckPreset,
    onOverwritePreset: store.overwriteDeckPreset,
    onRenamePreset: store.renameDeckPreset,
    onMovePreset: store.moveDeckPreset,
    onLoadPreset: store.loadDeckPreset,
    onDeletePreset: store.deleteDeckPreset,
    onImportJson: store.importDeckData,
    onImportCardCatalog: store.importCardCatalog,
    onResetCardCatalog: store.resetCardCatalog,
    onUpsertCard: store.upsertCardCatalogEntry,
    onDeleteCard: store.deleteCardCatalogEntry,
    requestConfirm: bindings.modalLayerState.requestConfirm,
  });

  const leaderSetupEditorProps = buildLeaderSetupEditorProps({
    leaderSetup: store.leaderSetup,
    cardCatalog: store.cardCatalog,
    onUpdate: store.updateLeaderSetup,
    onReset: () => void bindings.appDataActions.handleResetLeaderSetup(),
    onImportOfficialCardCatalog: async () => {
      const response = await fetch('/data/xrossstars-bp01-bp03-official-cards.json');
      if (!response.ok) return false;
      const parsed = await response.json();
      return store.importCardCatalog(parsed);
    },
  });

  const battleScreenProps = buildBattleScreenProps({
    state: store.state,
    canUndoBattle: bindings.battleScreenState.canUndoBattle,
    setupRequired: bindings.battleScreenState.setupRequired,
    activeLeader: bindings.battleScreenState.activeLeader,
    targetLeader: bindings.battleScreenState.targetLeader,
    activeLeaderMaxHp: bindings.battleScreenState.activeLeaderMaxHp,
    targetLeaderMaxHp: bindings.battleScreenState.targetLeaderMaxHp,
    activeLeaderRemainingHp: bindings.battleScreenState.activeLeaderRemainingHp,
    targetLeaderRemainingHp: bindings.battleScreenState.targetLeaderRemainingHp,
    remainingOpponentLeaders: bindings.battleScreenState.remainingOpponentLeaders,
    recentBattleHistory: bindings.battleScreenState.recentBattleHistory,
    roundSummaries: bindings.battleScreenState.roundSummaries,
    nextActionHints: bindings.battleScreenState.nextActionHints,
    cardCatalogById: bindings.battleScreenState.cardCatalogById,
    logActionMessage: bindings.appDataActions.logActionMessage,
    logActionStatus: bindings.appDataActions.logActionStatus,
    requestConfirm: bindings.modalLayerState.requestConfirm,
    applyDeckAndStartGame: store.applyDeckAndStartGame,
    resetGame: store.resetGame,
    clearSavedGame: store.clearSavedGame,
    selectTargetLeader: store.selectTargetLeader,
    selectActiveLeader: store.selectActiveLeader,
    endTurn: store.endTurn,
    handleUndoBattle: bindings.appDataActions.handleUndoBattle,
    openPreview: bindings.modalLayerState.openPreview,
    playHandCard: store.playHandCard,
    discardHandCard: store.discardHandCard,
    handleExportLog: bindings.appDataActions.handleExportLog,
    handleCopyLog: bindings.appDataActions.handleCopyLog,
  });

  const footerPanelsProps = buildFooterPanelsProps({
    usageStats: store.usageStats,
    operationLogs: store.operationLogs,
    operationActionMessage: bindings.appDataActions.operationActionMessage,
    operationActionStatus: bindings.appDataActions.operationActionStatus,
    onResetUsageStats: bindings.appDataActions.handleResetUsageStats,
    onExportOperationLog: bindings.appDataActions.handleExportOperationLog,
    onCopyOperationLog: bindings.appDataActions.handleCopyOperationLog,
    onClearOperationLog: bindings.appDataActions.handleClearOperationLog,
  });

  const modalLayerProps = buildModalLayerProps({
    isGuideOpen: bindings.modalLayerState.isGuideOpen,
    onCloseGuide: bindings.modalLayerState.closeGuide,
    selectedCard: bindings.modalLayerState.selectedCard,
    modalTitle: bindings.modalLayerState.modalTitle,
    modalAction: bindings.modalLayerState.modalAction,
    modalActionLabel: bindings.modalLayerState.modalActionLabel,
    onRunModalAction: bindings.modalLayerState.runModalAction,
    onClosePreview: bindings.modalLayerState.closePreview,
    confirmOpen: bindings.modalLayerState.confirmState.open,
    confirmTitle: bindings.modalLayerState.confirmState.title,
    confirmMessage: bindings.modalLayerState.confirmState.message,
    confirmLabel: bindings.modalLayerState.confirmState.confirmLabel,
    cancelLabel: bindings.modalLayerState.confirmState.cancelLabel,
    confirmTone: bindings.modalLayerState.confirmState.tone,
    onConfirm: () => bindings.modalLayerState.closeConfirm(true),
    onCancel: () => bindings.modalLayerState.closeConfirm(false),
    pendingChoice: bindings.battleScreenState.pendingChoice,
    pendingChoiceSelectableCards: bindings.battleScreenState.pendingChoiceSelectableCards,
    pendingChoiceSelectableLeaders: bindings.battleScreenState.pendingChoiceSelectableLeaders,
    pendingChoiceNeedsCardSelection: bindings.battleScreenState.pendingChoiceNeedsCardSelection,
    pendingChoiceNeedsLeaderSelection: bindings.battleScreenState.pendingChoiceNeedsLeaderSelection,
    selectedPendingChoiceCardId: bindings.modalLayerState.selectedPendingChoiceCardId,
    setSelectedPendingChoiceCardId: bindings.modalLayerState.setSelectedPendingChoiceCardId,
    selectedPendingChoiceLeaderId: bindings.modalLayerState.selectedPendingChoiceLeaderId,
    setSelectedPendingChoiceLeaderId: bindings.modalLayerState.setSelectedPendingChoiceLeaderId,
    resolvePendingChoice: store.resolvePendingChoice,
    cancelPendingChoice: store.cancelPendingChoice,
    cardCatalogById: bindings.battleScreenState.cardCatalogById,
  });

  const appFooterProps = buildAppFooterProps();

  return {
    currentScreen: store.currentScreen,
    headerProps,
    topPanelsProps,
    deckEditorProps,
    leaderSetupEditorProps,
    battleScreenProps,
    footerPanelsProps,
    modalLayerProps,
    appFooterProps,
  };
}
