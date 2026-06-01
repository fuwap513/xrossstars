import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import CardDetailModal from './components/CardDetailModal';
import ConfirmModal from './components/ConfirmModal';
import DeckEditor from './components/DeckEditor';
import FieldCardTile from './components/FieldCardTile';
import HandPanel from './components/HandPanel';
import LeaderSetupEditor from './components/LeaderSetupEditor';
import LeaderRow from './components/LeaderRow';
import { getDeckTotal } from './data/cards';
import { useGameStore } from './store/gameStore';
import type { AppBackupData, Card, OperationLogCategory } from './types/game';

type ModalAction =
  | { type: 'play-hand'; cardId: string }
  | { type: 'set-tactic'; cardId: string }
  | { type: 'use-set-tactic'; cardId: string }
  | null;

type ConfirmTone = 'default' | 'danger';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolver?: (confirmed: boolean) => void;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const initialConfirmState: ConfirmState = {
  open: false,
  title: '確認',
  message: '',
  confirmLabel: '実行する',
  cancelLabel: 'キャンセル',
  tone: 'default',
};

const GUIDE_STORAGE_KEY = 'xrossstars-guide-dismissed-v1';
const APP_NAME = 'Xross Stars 検証アプリ';
const APP_VERSION = 'v1.1.0';

const getLeaderMaxHp = (leader?: { baseHp: number; awakened: boolean }) => (
  leader ? leader.baseHp + (leader.awakened ? 30 : 0) : 0
);

const OPERATION_CATEGORY_LABELS: Record<OperationLogCategory, string> = {
  app: '画面',
  deck: 'デッキ',
  preset: 'プリセット',
  battle: '対戦',
  system: 'システム',
};

const getInitialGuideBannerState = () => {
  if (typeof window === 'undefined') return false;
  try {
    return !window.localStorage.getItem(GUIDE_STORAGE_KEY);
  } catch {
    return true;
  }
};

export default function App() {
  const {
    currentScreen,
    cardCatalog,
    deckConfig,
    leaderSetup,
    savedPresets,
    operationLogs,
    usageStats,
    battleUndoStack,
    state,
    switchScreen,
    applyDeckAndStartGame,
    resetGame,
    clearSavedGame,
    resetDeckConfig,
    saveDeckPreset,
    overwriteDeckPreset,
    renameDeckPreset,
    moveDeckPreset,
    importDeckData,
    importCardCatalog,
    importAppBackup,
    loadDeckPreset,
    deleteDeckPreset,
    addOperationLog,
    clearOperationLogs,
    incrementUsageStat,
    resetUsageStats,
    undoBattleAction,
    updateLeaderSetup,
    resetLeaderSetup,
    resetCardCatalog,
    upsertCardCatalogEntry,
    deleteCardCatalogEntry,
    updateMainDeckCount,
    updateTacticDeckCount,
    selectActiveLeader,
    selectTargetLeader,
    playHandCard,
    setRoundTactic,
    useSetTactic,
    discardHandCard,
    resolvePendingChoice,
    cancelPendingChoice,
    endTurn,
  } = useGameStore();

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [modalTitle, setModalTitle] = useState<string>('カード詳細');
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(initialConfirmState);
  const [logActionMessage, setLogActionMessage] = useState('');
  const [logActionStatus, setLogActionStatus] = useState<'ok' | 'ng' | ''>('');
  const [operationActionMessage, setOperationActionMessage] = useState('');
  const [operationActionStatus, setOperationActionStatus] = useState<'ok' | 'ng' | ''>('');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupStatus, setBackupStatus] = useState<'ok' | 'ng' | ''>('');
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installMessage, setInstallMessage] = useState('');
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlineCacheMessage, setOfflineCacheMessage] = useState('');
  const [offlineCacheStatus, setOfflineCacheStatus] = useState<'ok' | 'ng' | ''>('');
  const [showGuideBanner, setShowGuideBanner] = useState(getInitialGuideBannerState);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedPendingChoiceCardId, setSelectedPendingChoiceCardId] = useState('');
  const [selectedPendingChoiceLeaderId, setSelectedPendingChoiceLeaderId] = useState('');

  const mainTotal = getDeckTotal(deckConfig.main);
  const tacticsTotal = getDeckTotal(deckConfig.tactics);
  const isSelfSecond = state.firstPlayer === 'opponent';
  const setupRequired = !state.roundTacticSelected && state.self.tacticsDeck.length > 0 && !state.winner;
  const activeLeader = state.self.leaders.find((leader) => leader.id == state.activeLeaderId) ?? state.self.leaders[0];
  const targetLeader = state.opponent.leaders.find((leader) => leader.id == state.targetLeaderId) ?? state.opponent.leaders[0];
  const activeLeaderMaxHp = getLeaderMaxHp(activeLeader);
  const targetLeaderMaxHp = getLeaderMaxHp(targetLeader);
  const activeLeaderRemainingHp = Math.max(activeLeaderMaxHp - (activeLeader?.currentDamage ?? 0), 0);
  const targetLeaderRemainingHp = Math.max(targetLeaderMaxHp - (targetLeader?.currentDamage ?? 0), 0);
  const remainingOpponentLeaders = state.opponent.leaders.filter((leader) => !leader.isDown).length;
  const canUndoBattle = battleUndoStack.length > 0;
  const recentBattleHistory = state.battleHistory.slice(0, 30);
  const roundSummaries = [...state.roundSummaries].reverse();
  const pendingChoice = state.pendingChoice;
  const pendingChoiceSelectableCards = pendingChoice
    ? state.self.hand.filter((card) => pendingChoice.selectableHandCardIds.includes(card.id))
    : [];
  const cardCatalogById = useMemo(() => new Map(cardCatalog.map((card) => [card.id, card])), [cardCatalog]);
  const pendingChoiceSelectableLeaders = pendingChoice?.kind === 'post_attack_other_leader_damage' || pendingChoice?.kind === 'drain_rod_damage_target'
    ? state.opponent.leaders.filter((leader) => pendingChoice.selectableLeaderIds.includes(leader.id))
    : pendingChoice?.kind === 'drain_rod_heal_distribution'
      ? state.self.leaders.filter((leader) => pendingChoice.selectableLeaderIds.includes(leader.id))
      : [];
  const pendingChoiceNeedsCardSelection = Boolean(
    pendingChoice
    && pendingChoice.kind !== 'optional_trash_topdeck_for_next_attack_buff'
    && pendingChoice.kind !== 'post_attack_other_leader_damage'
    && pendingChoice.kind !== 'drain_rod_heal_distribution'
    && pendingChoice.kind !== 'drain_rod_damage_target',
  );
  const pendingChoiceNeedsLeaderSelection = pendingChoice?.kind === 'post_attack_other_leader_damage'
    || pendingChoice?.kind === 'drain_rod_heal_distribution'
    || pendingChoice?.kind === 'drain_rod_damage_target';

  const nextActionHints = useMemo(() => {
    const hints: string[] = [];

    if (state.winner) {
      hints.push('試合終了です。再試行かデッキ編集に戻って次の検証を進められます。');
      if (canUndoBattle) hints.push(`直前操作を ${battleUndoStack.length} 件分まで巻き戻せます。`);
      return hints;
    }

    if (pendingChoice) {
      hints.push(`${pendingChoice.sourceCardName} の任意効果を解決してください。`);
      return hints;
    }

    if (setupRequired) {
      hints.push(`ラウンド開始処理として、セット可能タクティクスから1枚選んでください。残り候補は ${state.self.tacticsDeck.length} 枚です。`);
    }

    if (state.pendingDiscardCount > 0) {
      hints.push(`手札調整中です。あと ${state.pendingDiscardCount} 枚捨てるとターン進行を再開できます。`);
    }

    if (!setupRequired && state.pendingDiscardCount === 0) {
      if (state.ppCurrent <= 0) {
        hints.push('PPを使い切っています。ターン終了で次のドローとPP回復に進めます。');
      } else if (state.self.hand.length > 0) {
        hints.push(`手札は ${state.self.hand.length} 枚あります。PP ${state.ppCurrent} の範囲でカード使用を進められます。`);
      } else {
        hints.push('手札がないため、ターン終了で次のドローを待つ流れです。');
      }
    }

    if (!state.tacticsUsedThisTurn && state.self.tacticsSet.length > 0 && !setupRequired) {
      hints.push(`セット済みタクティクスが ${state.self.tacticsSet.length} 枚あります。このターン中に1枚使えます。`);
    }

    if (remainingOpponentLeaders === 1) {
      hints.push('相手リーダーは残り1体です。高打点か直撃効果で詰めを狙いやすい状況です。');
    }

    if (state.self.ppTicket && state.round === 1) {
      hints.push('後攻補助のPP回復タクティクスを使える前提です。序盤のテンポ確保を意識できます。');
    }

    if (canUndoBattle) {
      hints.push(`直前操作を ${battleUndoStack.length} 件分まで1手戻すで巻き戻せます。`);
    }

    return hints.slice(0, 3);
  }, [battleUndoStack.length, canUndoBattle, pendingChoice, remainingOpponentLeaders, setupRequired, state.pendingDiscardCount, state.ppCurrent, state.round, state.self.hand.length, state.self.ppTicket, state.self.tacticsDeck.length, state.self.tacticsSet.length, state.tacticsUsedThisTurn, state.winner]);

  const modalActionLabel = useMemo(() => {
    if (!modalAction) return undefined;
    if (modalAction.type === 'play-hand') return 'このカードを使用';
    if (modalAction.type === 'set-tactic') return 'このタクティクスをセット';
    if (modalAction.type === 'use-set-tactic') return 'このタクティクスを使用';
    return undefined;
  }, [modalAction]);

  useEffect(() => {
    if (pendingChoice) {
      const firstSelectableCardId = pendingChoice.selectableHandCardIds.find((cardId) => state.self.hand.some((card) => card.id === cardId)) ?? '';
      setSelectedPendingChoiceCardId(firstSelectableCardId);
      const firstSelectableLeaderId = pendingChoice.kind === 'post_attack_other_leader_damage' || pendingChoice.kind === 'drain_rod_damage_target'
        ? pendingChoice.selectableLeaderIds.find((leaderId) => state.opponent.leaders.some((leader) => leader.id === leaderId)) ?? ''
        : pendingChoice.kind === 'drain_rod_heal_distribution'
          ? pendingChoice.selectableLeaderIds.find((leaderId) => state.self.leaders.some((leader) => leader.id === leaderId)) ?? ''
          : '';
      setSelectedPendingChoiceLeaderId(firstSelectableLeaderId);
      return;
    }
    setSelectedPendingChoiceCardId('');
    setSelectedPendingChoiceLeaderId('');
  }, [pendingChoice, state.opponent.leaders, state.self.hand, state.self.leaders]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setInstallMessage('このアプリをホーム画面に追加できます');
    };

    const handleInstalled = () => {
      setInstallPromptEvent(null);
      setShowInstallBanner(false);
      setInstallMessage('アプリをインストールしました');
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleServiceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'OFFLINE_CACHE_READY') {
        setOfflineCacheStatus('ok');
        setOfflineCacheMessage('オフライン利用の準備が完了しました');
      }
      if (event.data?.type === 'OFFLINE_CACHE_FAILED') {
        setOfflineCacheStatus('ng');
        setOfflineCacheMessage('オフライン用アセットの保存に失敗しました');
      }
      if (event.data?.type === 'OFFLINE_CACHE_REFRESHED') {
        setOfflineCacheStatus('ok');
        setOfflineCacheMessage('キャッシュを最新状態に更新しました');
      }
    };

    const handleControllerChange = () => {
      window.location.reload();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const requestConfirm = (options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setConfirmState({
      open: true,
      title: options.title ?? '確認',
      message: options.message,
      confirmLabel: options.confirmLabel ?? '実行する',
      cancelLabel: options.cancelLabel ?? 'キャンセル',
      tone: options.tone ?? 'default',
      resolver: resolve,
    });
  });

  const closeConfirm = (confirmed: boolean) => {
    setConfirmState((current) => {
      current.resolver?.(confirmed);
      return initialConfirmState;
    });
  };

  const openPreview = (card: Card, title = 'カード詳細', action: ModalAction = null) => {
    setSelectedCard(card);
    setModalTitle(title);
    setModalAction(action);
  };

  const closePreview = () => {
    setSelectedCard(null);
    setModalAction(null);
    setModalTitle('カード詳細');
  };

  const markGuideSeen = () => {
    try {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  const openGuide = () => {
    setIsGuideOpen(true);
    setShowGuideBanner(false);
    markGuideSeen();
    addOperationLog('クイックガイドを開きました', 'app');
  };

  const closeGuide = () => {
    setIsGuideOpen(false);
  };

  const dismissGuideBanner = () => {
    setShowGuideBanner(false);
    markGuideSeen();
    addOperationLog('クイックガイドバナーを閉じました', 'app');
  };

  const runModalAction = async () => {
    if (!modalAction) return;
    if (modalAction.type === 'play-hand') {
      const handCard = state.self.hand.find((card) => card.id === modalAction.cardId);
      const canOptionallyPlayWithoutCost = Boolean(
        handCard
        && handCard.cost > 0
        && handCard.text.includes(`プレイエリアに別の「${handCard.name}」が1枚あるなら、コストを支払わずにこのカードをプレイしてもよい`)
        && state.fieldCards.filter((fieldCard) => fieldCard.name === handCard.name).length === 1,
      );
      if (handCard && canOptionallyPlayWithoutCost) {
        const shouldPlayWithoutCost = await requestConfirm({
          title: 'コスト支払い方法',
          message: `${handCard.name} は同名カード条件を満たしています。コストを支払わずにプレイしますか？`,
          confirmLabel: 'コストなしで使う',
          cancelLabel: 'コストを払って使う',
        });
        playHandCard(modalAction.cardId, { forceCostPayment: !shouldPlayWithoutCost });
        closePreview();
        return;
      }
      playHandCard(modalAction.cardId);
    }
    if (modalAction.type === 'set-tactic') setRoundTactic(modalAction.cardId);
    if (modalAction.type === 'use-set-tactic') useSetTactic(modalAction.cardId);
    closePreview();
  };

  const buildLogText = () => {
    const summaryLines = roundSummaries.map((summary, index) => (
      `${index + 1}. Round ${summary.round} / T${summary.turnReached} / 勝利数 ${summary.selfWins} / 自分ダウン ${summary.selfLeadersDown} / 相手ダウン ${summary.opponentLeadersDown} / 手札 ${summary.handCount} / 山札 ${summary.deckCount} / トラッシュ ${summary.trashCount} / ${summary.note}`
    ));

    const historyLines = [...state.battleHistory]
      .reverse()
      .map((entry, index) => `${index + 1}. [${new Date(entry.timestamp).toLocaleString('ja-JP')}] [R${entry.round} / T${entry.turn}] ${entry.message}`);

    const lines = [
      'Xross Stars 一人回しシミュレーター ログ出力',
      `Round ${state.round} / Turn ${state.turn}`,
      `PP ${state.ppCurrent} / ${state.ppMax}`,
      `想定手番: ${isSelfSecond ? '後攻' : '先攻'}`,
      `履歴件数: ${state.battleHistory.length}`,
      `ラウンドサマリー件数: ${roundSummaries.length}`,
      '',
      '--- ラウンドサマリー ---',
      ...(summaryLines.length > 0 ? summaryLines : ['サマリーはありません']),
      '',
      '--- 対戦履歴（全件 / 古い順） ---',
      ...(historyLines.length > 0 ? historyLines : ['履歴はありません']),
    ];
    return lines.join('\n');
  };

  const buildOperationLogText = () => {
    const lines = [
      'Xross Stars 一人回しシミュレーター 操作ログ',
      `出力件数: ${operationLogs.length}`,
      '',
      '--- 最新操作ログ ---',
      ...operationLogs.map((entry, index) => `${index + 1}. [${new Date(entry.timestamp).toLocaleString('ja-JP')}] [${OPERATION_CATEGORY_LABELS[entry.category]}] ${entry.message}`),
    ];
    return lines.join('\n');
  };

  const handleExportLog = () => {
    const text = buildLogText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `xrossstars-battle-log-${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setLogActionStatus('ok');
    setLogActionMessage('対戦ログをTXTで書き出しました');
    incrementUsageStat('battleLogExports');
    addOperationLog('対戦ログをTXTで書き出しました', 'app');
  };

  const handleCopyLog = async () => {
    try {
      await navigator.clipboard.writeText(buildLogText());
      setLogActionStatus('ok');
      setLogActionMessage('対戦ログをクリップボードにコピーしました');
      addOperationLog('対戦ログをクリップボードにコピーしました', 'app');
    } catch {
      setLogActionStatus('ng');
      setLogActionMessage('クリップボードへのコピーに失敗しました');
      addOperationLog('対戦ログのコピーに失敗しました', 'system');
    }
  };

  const handleExportOperationLog = () => {
    const text = buildOperationLogText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `xrossstars-operation-log-${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setOperationActionStatus('ok');
    setOperationActionMessage('操作ログをTXTで書き出しました');
    incrementUsageStat('operationLogExports');
    addOperationLog('操作ログをTXTで書き出しました', 'app');
  };

  const handleCopyOperationLog = async () => {
    try {
      await navigator.clipboard.writeText(buildOperationLogText());
      setOperationActionStatus('ok');
      setOperationActionMessage('操作ログをクリップボードにコピーしました');
      addOperationLog('操作ログをクリップボードにコピーしました', 'app');
    } catch {
      setOperationActionStatus('ng');
      setOperationActionMessage('操作ログのコピーに失敗しました');
      addOperationLog('操作ログのコピーに失敗しました', 'system');
    }
  };

  const handleClearOperationLog = async () => {
    const confirmed = await requestConfirm({
      title: '操作ログをクリア',
      message: '現在の操作ログを初期化します。よろしいですか？',
      confirmLabel: 'クリアする',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    clearOperationLogs();
    setOperationActionStatus('ok');
    setOperationActionMessage('操作ログをクリアしました');
  };

  const handleResetUsageStats = async () => {
    const confirmed = await requestConfirm({
      title: '利用統計をリセット',
      message: '累計の利用統計をリセットします。操作ログは保持します。よろしいですか？',
      confirmLabel: 'リセットする',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    resetUsageStats();
    setOperationActionStatus('ok');
    setOperationActionMessage('利用統計をリセットしました');
  };

  const handleInstallApp = async () => {
    if (!installPromptEvent) {
      setInstallMessage('この端末ではブラウザメニューからホーム画面追加を行ってください');
      addOperationLog('インストール案内のみ表示しました', 'app');
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallMessage('インストールを開始しました');
      setShowInstallBanner(false);
      addOperationLog('PWAインストールを開始しました', 'app');
    } else {
      setInstallMessage('インストールはキャンセルされました');
      addOperationLog('PWAインストールをキャンセルしました', 'app');
    }
    setInstallPromptEvent(null);
  };

  const handleExportAppBackup = () => {
    const payload: AppBackupData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      currentScreen,
      deckConfig,
      cardCatalog,
      leaderSetup,
      savedPresets,
      operationLogs,
      usageStats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `xrossstars-app-backup-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupStatus('ok');
    setBackupMessage('アプリ用バックアップJSONを書き出しました');
    addOperationLog('アプリ用バックアップJSONを書き出しました', 'app');
  };

  const handleImportAppBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = await requestConfirm({
      title: 'アプリバックアップ読込',
      message: '現在のプリセット、操作ログ、利用統計をバックアップ内容で置き換えます。続行しますか？',
      confirmLabel: '読み込む',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });

    if (!confirmed) {
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const success = importAppBackup(parsed);
      setBackupStatus(success ? 'ok' : 'ng');
      setBackupMessage(success ? 'アプリバックアップを読み込みました' : 'アプリバックアップ形式が不正です');
    } catch {
      setBackupStatus('ng');
      setBackupMessage('アプリバックアップの読み込みに失敗しました');
    } finally {
      event.target.value = '';
    }
  };

  const handleResetLeaderSetup = async () => {
    const confirmed = await requestConfirm({
      title: 'リーダー設定を初期化',
      message: '自分側 / 相手側のリーダー名と基礎HPを推奨初期値へ戻します。よろしいですか？',
      confirmLabel: '初期化する',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    resetLeaderSetup();
    setBackupStatus('ok');
    setBackupMessage('リーダー設定を推奨初期値へ戻しました');
  };

  const handleUndoBattle = () => {
    if (!canUndoBattle) return;
    undoBattleAction();
    setLogActionStatus('ok');
    setLogActionMessage('直前の対戦操作を1手戻しました');
  };

  const handlePrepareOffline = async () => {
    if (!('serviceWorker' in navigator)) {
      setOfflineCacheStatus('ng');
      setOfflineCacheMessage('この環境ではService Workerが使えません');
      return;
    }

    setOfflineCacheStatus('');
    setOfflineCacheMessage('オフライン用アセットを保存中です...');
    addOperationLog('オフライン用アセット保存を開始しました', 'app');

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'CACHE_OFFLINE_ASSETS' });
  };

  const handleRefreshOfflineCache = async () => {
    if (!('serviceWorker' in navigator)) {
      setOfflineCacheStatus('ng');
      setOfflineCacheMessage('この環境ではService Workerが使えません');
      return;
    }

    if (isOffline) {
      setOfflineCacheStatus('ng');
      setOfflineCacheMessage('オフライン中はキャッシュ更新できません');
      return;
    }

    setOfflineCacheStatus('');
    setOfflineCacheMessage('キャッシュを更新中です...');
    addOperationLog('オフラインキャッシュ更新を開始しました', 'app');

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'REFRESH_OFFLINE_CACHE' });
    registration.update().catch(() => {
      setOfflineCacheStatus('ng');
      setOfflineCacheMessage('更新確認に失敗しました');
    });
  };

  return (
    <main className="app-shell">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">{APP_NAME}</p>
          <div className="title-row">
            <h1>一人回し・対戦検証・デッキ調整</h1>
            <span className="app-badge">{APP_VERSION}</span>
          </div>
        </div>
        <div className="round-box">
          <strong>Round {state.round} / 3</strong>
          <span>Turn {state.turn}</span>
          <span>PP {state.ppCurrent} / {state.ppMax}</span>
          <span>想定手番: {isSelfSecond ? '後攻' : '先攻'}</span>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button topbar-help-button" onClick={openGuide}>使い方</button>
        </div>
      </header>

      {isOffline && (
        <section className="panel offline-banner">
          <div className="section-header">
            <h2>オフラインモード</h2>
            <span>通信なし</span>
          </div>
          <p>保存済みデータを使って操作できます。初回表示や未取得アセットは一部制限される場合があります。</p>
        </section>
      )}

      {showInstallBanner && (installPromptEvent || installMessage) && (
        <section className="panel install-banner">
          <div className="section-header">
            <h2>アプリとして使う</h2>
            <span>PWA</span>
          </div>
          <p>{installMessage || 'ホーム画面に追加して全画面で使えます'}</p>
          <div className="action-row wrap-actions top-gap">
            <button onClick={() => void handleInstallApp()}>インストール</button>
            <button className="ghost-button" onClick={() => setShowInstallBanner(false)}>閉じる</button>
          </div>
        </section>
      )}

      {showGuideBanner && (
        <section className="panel guide-banner">
          <div className="section-header">
            <h2>クイックガイド</h2>
            <span>初回向け</span>
          </div>
          <p>デッキ作成 → 対戦開始 → ログ確認までの基本操作を短く確認できます。</p>
          <div className="action-row wrap-actions top-gap">
            <button onClick={openGuide}>使い方を見る</button>
            <button className="ghost-button" onClick={dismissGuideBanner}>閉じる</button>
          </div>
        </section>
      )}

      <section className="panel cache-banner">
        <div className="section-header">
          <h2>オフライン利用を準備</h2>
          <span>キャッシュ</span>
        </div>
        <p>主要アセットを端末に保存して、通信が不安定でも再表示しやすくします。</p>
        <div className="action-row wrap-actions top-gap">
          <button onClick={() => void handlePrepareOffline()} disabled={isOffline}>オフライン用に保存</button>
          <button className="ghost-button" onClick={() => void handleRefreshOfflineCache()} disabled={isOffline}>キャッシュを更新</button>
        </div>
        {offlineCacheMessage && <div className={`import-status ${offlineCacheStatus} top-gap`}>{offlineCacheMessage}</div>}
      </section>

      <section className="panel backup-panel">
        <div className="section-header">
          <h2>アプリデータ管理</h2>
          <span>バックアップ / 復元</span>
        </div>
        <p>プリセット・操作ログ・利用統計・現在画面をまとめてJSON保存できます。</p>
        <div className="action-row wrap-actions top-gap">
          <button onClick={handleExportAppBackup}>バックアップを書き出す</button>
          <label className="file-import-button ghost-file-import">
            バックアップを読み込む
            <input type="file" accept="application/json,.json" onChange={(event) => void handleImportAppBackup(event)} />
          </label>
        </div>
        <div className="preset-hint">対戦状態そのものではなく、アプリ利用データの復元用バックアップです。</div>
        {backupMessage && <div className={`import-status ${backupStatus}`}>{backupMessage}</div>}
      </section>

      <section className="tab-row panel">
        <button className={currentScreen === 'battle' ? 'tab-button active' : 'tab-button'} onClick={() => switchScreen('battle')}>
          バトル
        </button>
        <button className={currentScreen === 'deck' ? 'tab-button active' : 'tab-button'} onClick={() => switchScreen('deck')}>
          デッキ編集
        </button>
      </section>

      {currentScreen === 'deck' ? (
        <>
          <DeckEditor
            cardCatalog={cardCatalog}
            deckConfig={deckConfig}
            savedPresets={savedPresets}
            mainTotal={mainTotal}
            tacticsTotal={tacticsTotal}
            onMainChange={updateMainDeckCount}
            onTacticChange={updateTacticDeckCount}
            onReset={resetDeckConfig}
            onApplyFirst={() => applyDeckAndStartGame('self')}
            onApplySecond={() => applyDeckAndStartGame('opponent')}
            onPreviewCard={(card) => openPreview(card, 'デッキ編集 / カード詳細')}
            onSavePreset={saveDeckPreset}
            onOverwritePreset={overwriteDeckPreset}
            onRenamePreset={renameDeckPreset}
            onMovePreset={moveDeckPreset}
            onLoadPreset={loadDeckPreset}
            onDeletePreset={deleteDeckPreset}
            onImportJson={importDeckData}
            onImportCardCatalog={importCardCatalog}
            onResetCardCatalog={resetCardCatalog}
            onUpsertCard={upsertCardCatalogEntry}
            onDeleteCard={deleteCardCatalogEntry}
            requestConfirm={requestConfirm}
          />

          <LeaderSetupEditor
            leaderSetup={leaderSetup}
            onUpdate={updateLeaderSetup}
            onReset={() => void handleResetLeaderSetup()}
          />
        </>
      ) : (
        <>
          <section className="panel control-panel">
            <div className="section-header">
              <h2>対戦管理</h2>
              <span>現在の構成でそのまま検証を開始・再開できます</span>
            </div>
            <div className="action-row wrap-actions">
              <button onClick={() => applyDeckAndStartGame('self')}>先攻で開始</button>
              <button onClick={() => applyDeckAndStartGame('opponent')}>後攻で開始</button>
              <button onClick={async () => {
                const confirmed = await requestConfirm({
                  title: '同条件でリセット',
                  message: '現在の対戦状態を破棄して、同条件で最初からやり直します。よろしいですか？',
                  confirmLabel: 'リセットする',
                  cancelLabel: 'キャンセル',
                  tone: 'danger',
                });
                if (!confirmed) return;
                resetGame();
              }}>同条件でリセット</button>
              <button className="ghost-button" onClick={async () => {
                const confirmed = await requestConfirm({
                  title: '保存データ削除',
                  message: '保存データをすべて削除します。デッキ構成・プリセット・対戦状態が初期化されます。よろしいですか？',
                  confirmLabel: '削除する',
                  cancelLabel: 'キャンセル',
                  tone: 'danger',
                });
                if (!confirmed) return;
                clearSavedGame();
              }}>保存データ削除</button>
            </div>
          </section>

          <section className="status-row status-row-6">
            <div className="panel status-card"><div>メインデッキ</div><strong>{state.self.mainDeck.length}</strong></div>
            <div className="panel status-card"><div>タクティクス山</div><strong>{state.self.tacticsDeck.length}</strong></div>
            <div className="panel status-card"><div>セット中</div><strong>{state.self.tacticsSet.length}</strong></div>
            <div className="panel status-card"><div>装備</div><strong>{state.self.equipmentZone.length}</strong></div>
            <div className="panel status-card"><div>トラッシュ</div><strong>{state.self.trash.length}</strong></div>
            <div className="panel status-card"><div>勝利R</div><strong>{state.self.wins} - {state.opponent.wins}</strong></div>
          </section>

          <section className="panel support-panel">
            <div className="section-header">
              <h2>進行サポート</h2>
              <span>次の一手を確認</span>
            </div>
            <div className="support-summary-grid top-gap">
              <div className="compact-card">
                <div className="support-label">自分の攻撃役</div>
                <strong>{activeLeader?.name ?? '未選択'}</strong>
                <span>{activeLeaderRemainingHp} / {activeLeaderMaxHp} HP</span>
              </div>
              <div className="compact-card">
                <div className="support-label">相手の対象</div>
                <strong>{targetLeader?.name ?? '未選択'}</strong>
                <span>{targetLeaderRemainingHp} / {targetLeaderMaxHp} HP</span>
              </div>
              <div className="compact-card">
                <div className="support-label">このターンの行動札</div>
                <strong>{state.self.hand.length + state.self.tacticsSet.length}</strong>
                <span>手札 {state.self.hand.length} / セット済み {state.self.tacticsSet.length}</span>
              </div>
              <div className="compact-card">
                <div className="support-label">相手残りリーダー</div>
                <strong>{remainingOpponentLeaders}</strong>
                <span>{state.winner ? '試合終了' : 'ダウンでラウンドを進行'}</span>
              </div>
            </div>
            <div className="support-tip-list top-gap">
              {nextActionHints.map((hint, index) => (
                <div className="support-tip" key={`${hint}-${index}`}>
                  <strong>ヒント {index + 1}</strong>
                  <p>{hint}</p>
                </div>
              ))}
            </div>
          </section>

          <LeaderRow
            title={`相手リーダー（対象: ${state.targetLeaderId}）`}
            leaders={state.opponent.leaders}
            selectedId={state.targetLeaderId}
            onSelect={selectTargetLeader}
            cardLookup={cardCatalogById}
          />

          <section className="battle-lane panel">
            <div className="section-header">
              <h2>中央プレイエリア</h2>
              <span>{state.winner ? '試合終了' : `場のカード ${state.fieldCards.length}`}</span>
            </div>
            <div className="battle-summary">
              <div><strong>選択中の自分リーダー:</strong> {state.activeLeaderId}</div>
              <div><strong>選択中の相手リーダー:</strong> {state.targetLeaderId}</div>
              <div><strong>次回攻撃補正:</strong> +{state.nextAttackBuff}</div>
              <div><strong>ターン中補正:</strong> +{state.turnAttackBuff}</div>
              <div><strong>タクティクス使用:</strong> {state.tacticsUsedThisTurn ? '使用済み' : '未使用'}</div>
              <div><strong>要ディスカード:</strong> {state.pendingDiscardCount} 枚</div>
              <div><strong>後攻補助:</strong> {state.self.ppTicket ? 'PP回復タクティクスあり' : 'なし'}</div>
              <div><strong>ラウンド開始セット:</strong> {state.roundTacticSelected ? '完了' : '未選択'}</div>
            </div>
            <div className="action-row">
              <button onClick={endTurn} disabled={Boolean(state.winner)}>ターン終了</button>
              <button className="ghost-button" onClick={handleUndoBattle} disabled={!canUndoBattle}>1手戻す</button>
              <button onClick={async () => {
                const confirmed = await requestConfirm({
                  title: '再試行',
                  message: '現在の対戦状態を破棄して、この試合を再試行します。よろしいですか？',
                  confirmLabel: '再試行する',
                  cancelLabel: 'キャンセル',
                  tone: 'danger',
                });
                if (!confirmed) return;
                resetGame();
              }}>再試行</button>
            </div>
          </section>

          {setupRequired && (
            <section className="panel notice-panel">
              <div className="section-header">
                <h2>ラウンド開始処理</h2>
                <span>このラウンドで使うタクティクスを1枚セットしてください</span>
              </div>
            </section>
          )}

          <LeaderRow
            title={`自分リーダー（攻撃役: ${state.activeLeaderId}）`}
            leaders={state.self.leaders}
            selectedId={state.activeLeaderId}
            onSelect={selectActiveLeader}
            cardLookup={cardCatalogById}
          />

          <section className="panel">
            <div className="section-header">
              <h2>セット可能タクティクス</h2>
              <span>{state.roundTacticSelected ? 'このラウンドはセット済み' : '1枚選択できます'}</span>
            </div>
            <div className="mini-card-grid field-card-grid">
              {state.self.tacticsDeck.map((card) => (
                <FieldCardTile
                  key={card.id}
                  card={card}
                  title="セット可能タクティクス"
                  subtitle="プレビューからこのラウンドにセット"
                  onClick={() => openPreview(card, 'セット可能タクティクス', { type: 'set-tactic', cardId: card.id })}
                />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-header">
              <h2>セット済みタクティクス / 装備</h2>
              <span>同一ターン1枚まで</span>
            </div>
            <div className="mini-card-grid field-card-grid">
              {state.self.tacticsSet.map((card) => (
                <FieldCardTile
                  key={card.id}
                  card={card}
                  title="セット済みタクティクス"
                  subtitle="プレビューから使用可能"
                  onClick={() => openPreview(card, 'セット済みタクティクス', { type: 'use-set-tactic', cardId: card.id })}
                />
              ))}
              {state.self.equipmentZone.map((card) => (
                <FieldCardTile
                  key={card.id}
                  card={card}
                  title="装備カード"
                  subtitle={`装備中: 攻撃 +${card.effectValue}`}
                  accent="equipment"
                  onClick={() => openPreview(card, '装備カード詳細')}
                />
              ))}
            </div>
          </section>

          <HandPanel
            cards={state.self.hand}
            disabled={state.pendingDiscardCount > 0 || Boolean(state.winner) || Boolean(state.pendingChoice)}
            onUseCard={playHandCard}
            onPreviewCard={(card) => openPreview(card, '手札カード詳細', { type: 'play-hand', cardId: card.id })}
          />

          {state.pendingDiscardCount > 0 && (
            <section className="panel discard-panel">
              <div className="section-header">
                <h2>手札調整</h2>
                <span>あと {state.pendingDiscardCount} 枚捨てる</span>
              </div>
              <div className="mini-card-grid field-card-grid discard-card-grid">
                {state.self.hand.map((card) => (
                  <FieldCardTile
                    key={card.id}
                    card={card}
                    title="手札調整 / 捨てる候補"
                    subtitle={`あと ${state.pendingDiscardCount} 枚捨てる`}
                    accent="warning"
                    actionLabel="このカードを捨てる"
                    actionTone="warning"
                    onClick={() => openPreview(card, '手札調整 / カード詳細')}
                    onAction={() => discardHandCard(card.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="bottom-grid">
            <section className="panel">
              <div className="section-header">
                <h2>ログ</h2>
                <span>最新12件</span>
              </div>
              <div className="action-row wrap-actions top-gap">
                <button onClick={handleExportLog}>TXTを書き出す</button>
                <button className="ghost-button" onClick={() => void handleCopyLog()}>クリップボードにコピー</button>
              </div>
              {logActionMessage && <div className={`import-status ${logActionStatus} top-gap`}>{logActionMessage}</div>}
              <ul className="log-list">
                {state.logs.map((log, index) => (
                  <li key={`${log}-${index}`}>{log}</li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <div className="section-header">
                <h2>アプリ情報</h2>
                <span>インストール・保存・検証をひとまとめ</span>
              </div>
              <ul className="todo-list">
                <li>リーダー設定で名前と基礎HPを事前に調整できます</li>
                <li>1手戻すで直前の対戦操作を段階的に巻き戻せます</li>
                <li>対戦履歴を時系列で残し、TXT出力には全履歴を含めます</li>
                <li>ラウンドごとの到達ターンや盤面状況をサマリー表示します</li>
                <li>対戦ログ・操作ログ・利用統計を分けて確認できます</li>
                <li>バックアップJSONで端末間の引き継ぎを行えます</li>
                <li>PWAとしてホーム画面追加・全画面表示・オフライン再表示に対応しています</li>
                <li>オフライン保存を行うと通信不安定時でも再表示しやすくなります</li>
                <li>デッキ編集のプリセットとJSON入出力で検証条件を再利用できます</li>
              </ul>
              <div className="app-info-box top-gap">
                <strong>{APP_NAME}</strong>
                <span>{APP_VERSION}</span>
                <p>端末保存を前提に、オフライン導線・バックアップ・履歴確認を揃えた検証向けアプリとして整理しています。</p>
              </div>
              {state.winner && <div className="winner-banner">勝者: 自分</div>}
            </section>
          </section>


          <section className="panel battle-history-panel">
            <div className="section-header">
              <h2>対戦履歴</h2>
              <span>最新 {recentBattleHistory.length} / 累計 {state.battleHistory.length} 件</span>
            </div>
            <p>この試合で発生した対戦イベントを保持します。TXT出力には全履歴を含み、1手戻すを使うと履歴も現在状態に合わせて戻ります。</p>
            <div className="battle-history-list top-gap">
              {recentBattleHistory.map((entry) => (
                <article className="battle-history-item" key={entry.id}>
                  <div className="battle-history-meta">
                    <span className="detail-chip">R{entry.round} / T{entry.turn}</span>
                    <span>{new Date(entry.timestamp).toLocaleString('ja-JP')}</span>
                  </div>
                  <p>{entry.message}</p>
                </article>
              ))}
            </div>
          </section>


          <section className="panel round-summary-panel">
            <div className="section-header">
              <h2>ラウンドサマリー</h2>
              <span>完了 {roundSummaries.length} 件</span>
            </div>
            <p>ラウンド勝利時点の進行状況を記録します。試合終了時の振り返りにも使えます。</p>
            <div className="round-summary-list top-gap">
              {roundSummaries.length > 0 ? roundSummaries.map((summary) => (
                <article className="round-summary-item" key={summary.id}>
                  <div className="round-summary-meta">
                    <span className="detail-chip">Round {summary.round}</span>
                    <span>T{summary.turnReached}</span>
                    <span>{summary.selfWins} 勝到達</span>
                  </div>
                  <div className="round-summary-grid">
                    <div><strong>自分ダウン</strong><span>{summary.selfLeadersDown}</span></div>
                    <div><strong>相手ダウン</strong><span>{summary.opponentLeadersDown}</span></div>
                    <div><strong>手札</strong><span>{summary.handCount}</span></div>
                    <div><strong>山札</strong><span>{summary.deckCount}</span></div>
                    <div><strong>トラッシュ</strong><span>{summary.trashCount}</span></div>
                  </div>
                  <p>{summary.note}</p>
                </article>
              )) : (
                <div className="empty-summary">ラウンド完了後にサマリーが表示されます。</div>
              )}
            </div>
            {state.winner && (
              <div className="winner-banner top-gap">
                試合サマリー: {state.self.wins} ラウンド勝利 / 対戦履歴 {state.battleHistory.length} 件 / 最終 Round {state.round}
              </div>
            )}
          </section>
        </>
      )}

      <section className="panel usage-stats-panel">
        <div className="section-header">
          <h2>利用統計</h2>
          <span>アプリ利用の累計</span>
        </div>
        <div className="deck-summary-grid top-gap">
          <div className="status-card compact-card">
            <div>対戦開始</div>
            <strong>{usageStats.gamesStarted}</strong>
          </div>
          <div className="status-card compact-card">
            <div>対戦リセット</div>
            <strong>{usageStats.gameResets}</strong>
          </div>
          <div className="status-card compact-card">
            <div>使用カード</div>
            <strong>{usageStats.cardsPlayed}</strong>
          </div>
          <div className="status-card compact-card">
            <div>セットタクティクス</div>
            <strong>{usageStats.tacticsSet}</strong>
          </div>
          <div className="status-card compact-card">
            <div>使用タクティクス</div>
            <strong>{usageStats.tacticsUsed}</strong>
          </div>
          <div className="status-card compact-card">
            <div>ディスカード</div>
            <strong>{usageStats.discards}</strong>
          </div>
          <div className="status-card compact-card">
            <div>対戦ログ出力</div>
            <strong>{usageStats.battleLogExports}</strong>
          </div>
          <div className="status-card compact-card">
            <div>操作ログ出力</div>
            <strong>{usageStats.operationLogExports}</strong>
          </div>
        </div>
        <div className="action-row wrap-actions top-gap">
          <button className="ghost-button" onClick={() => void handleResetUsageStats()}>利用統計をリセット</button>
        </div>
      </section>

      <section className="panel operation-log-panel">
        <div className="section-header">
          <h2>操作ログ</h2>
          <span>最新 {operationLogs.length} 件</span>
        </div>
        <div className="action-row wrap-actions top-gap">
          <button onClick={handleExportOperationLog}>TXTを書き出す</button>
          <button className="ghost-button" onClick={() => void handleCopyOperationLog()}>クリップボードにコピー</button>
          <button className="ghost-button" onClick={() => void handleClearOperationLog()}>ログをクリア</button>
        </div>
        {operationActionMessage && <div className={`import-status ${operationActionStatus} top-gap`}>{operationActionMessage}</div>}
        <div className="operation-log-list top-gap">
          {operationLogs.map((entry) => (
            <article className="operation-log-item" key={entry.id}>
              <div className="operation-log-meta">
                <span className={`operation-log-chip operation-log-chip-${entry.category}`}>{OPERATION_CATEGORY_LABELS[entry.category]}</span>
                <span>{new Date(entry.timestamp).toLocaleString('ja-JP')}</span>
              </div>
              <p>{entry.message}</p>
            </article>
          ))}
        </div>
      </section>

      {isGuideOpen && (
        <div className="modal-backdrop" onClick={closeGuide}>
          <section className="modal-card guide-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <h2>クイックガイド</h2>
              <button className="modal-close-button" onClick={closeGuide} aria-label="使い方を閉じる">×</button>
            </div>
            <div className="guide-step-list">
              <article className="guide-step">
                <strong>1. デッキを50枚 / 5枚に整える</strong>
                <p>デッキ編集画面でメイン50枚、タクティクス5枚に調整し、必要ならプリセット保存します。</p>
              </article>
              <article className="guide-step">
                <strong>2. 先攻 / 後攻で対戦開始</strong>
                <p>現在の構成で先攻開始または後攻開始を押すと、そのまま対戦画面へ反映されます。</p>
              </article>
              <article className="guide-step">
                <strong>3. ラウンド開始時はタクティクスをセット</strong>
                <p>案内バナーが表示されたら、このラウンドで使うタクティクスを1枚セットしてから進行します。</p>
              </article>
              <article className="guide-step">
                <strong>4. ログとオフライン保存を活用</strong>
                <p>ログはTXT出力やコピーが可能です。必要ならオフライン用に保存して再表示を安定させられます。</p>
              </article>
            </div>
            <div className="action-row">
              <button onClick={closeGuide}>閉じる</button>
            </div>
          </section>
        </div>
      )}

      <CardDetailModal
        card={selectedCard}
        title={modalTitle}
        actionLabel={modalActionLabel}
        onAction={modalAction ? runModalAction : undefined}
        onClose={closePreview}
      />

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        tone={confirmState.tone}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />

      {pendingChoice && (
        <div className="modal-backdrop">
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <h2>{pendingChoice.sourceCardName} の{pendingChoice.kind === 'self_discard_after_draw' || pendingChoice.kind === 'post_attack_self_discard' || pendingChoice.kind === 'post_attack_other_leader_damage' || pendingChoice.kind === 'drain_rod_heal_distribution' || pendingChoice.kind === 'drain_rod_damage_target' ? '追加処理' : '任意効果'}</h2>
            </div>
            <p>{pendingChoice.prompt}</p>
            {pendingChoice.kind === 'optional_trash_topdeck_for_next_attack_buff' ? (
              <div className="mini-card-grid field-card-grid pending-choice-grid top-gap">
                <FieldCardTile
                  card={pendingChoice.revealedCard}
                  title="公開されたカード"
                  subtitle="このカードをトラッシュに置くか、山札の上に戻します"
                  accent="warning"
                  onClick={() => setSelectedPendingChoiceCardId(pendingChoice.revealedCard.id)}
                />
              </div>
            ) : pendingChoice.kind === 'post_attack_other_leader_damage' || pendingChoice.kind === 'drain_rod_heal_distribution' || pendingChoice.kind === 'drain_rod_damage_target' ? (
              <div className="guide-step-list pending-choice-grid">
                {pendingChoiceSelectableLeaders.map((leader) => {
                  const maxHp = getLeaderMaxHp(leader);
                  const remainingHp = Math.max(maxHp - leader.currentDamage, 0);
                  const leaderCard = leader.sourceCardId ? cardCatalogById.get(leader.sourceCardId) : undefined;
                  return (
                    <button
                      key={leader.id}
                      type="button"
                      className={`pending-choice-leader-card ${selectedPendingChoiceLeaderId === leader.id ? 'pending-choice-leader-card-selected' : ''}`}
                      onClick={() => setSelectedPendingChoiceLeaderId(leader.id)}
                    >
                      <div className="pending-choice-leader-art-shell">
                        {leaderCard?.officialImageUrl ? (
                          <img
                            className="pending-choice-leader-art-image"
                            src={leaderCard.officialImageUrl}
                            alt={`${leader.name} のリーダーイラスト`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="pending-choice-leader-art-placeholder">
                            <strong>{leader.name}</strong>
                            <span>リーダー画像未設定</span>
                          </div>
                        )}
                      </div>
                      <div className="pending-choice-leader-body">
                        <div className="hand-card-chip-row">
                          <span className="detail-chip">{pendingChoice.kind === 'drain_rod_heal_distribution' ? '回復先' : '対象'}</span>
                          <span className="detail-chip">HP {remainingHp}/{maxHp}</span>
                          {leader.isDown && <span className="detail-chip">DOWN</span>}
                        </div>
                        <strong className="field-card-name">{leader.name}</strong>
                        <div className="field-card-meta-row">
                          <span>ATK {leader.baseAtk + (leader.awakened ? 10 : 0)}</span>
                          <span>ダメージ {leader.currentDamage}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mini-card-grid field-card-grid pending-choice-grid">
                {pendingChoiceSelectableCards.map((card) => (
                  <FieldCardTile
                    key={card.id}
                    card={card}
                    title={pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus' ? '公開して捨てる候補' : '捨てる候補'}
                    subtitle={pendingChoice.kind === 'self_discard_after_draw'
                      ? `残り ${pendingChoice.discardCountRemaining} 枚の手札調整`
                      : pendingChoice.kind === 'optional_discard_for_attack_bonus' || pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus'
                        ? '選択すると任意効果の解決対象になります'
                        : '選択すると追加処理の解決対象になります'}
                    accent="warning"
                    selected={selectedPendingChoiceCardId === card.id}
                    onClick={() => setSelectedPendingChoiceCardId(card.id)}
                  />
                ))}
              </div>
            )}
            <div className="action-row">
              <button
                type="button"
                onClick={() => resolvePendingChoice({
                  accept: true,
                  selectedCardId: selectedPendingChoiceCardId,
                  selectedLeaderId: selectedPendingChoiceLeaderId,
                })}
                disabled={(pendingChoiceNeedsCardSelection && !selectedPendingChoiceCardId) || (pendingChoiceNeedsLeaderSelection && !selectedPendingChoiceLeaderId)}
              >
                {pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus'
                  ? `選んだカードを公開して捨て、1枚引いて +${pendingChoice.bonusDamage}`
                  : pendingChoice.kind === 'optional_trash_topdeck_for_next_attack_buff'
                    ? 'このカードをトラッシュに置く'
                    : pendingChoice.kind === 'post_attack_other_leader_damage' || pendingChoice.kind === 'drain_rod_damage_target'
                      ? `選んだリーダーに ${pendingChoice.damageAmount} ダメージ`
                      : pendingChoice.kind === 'drain_rod_heal_distribution'
                        ? `選んだリーダーを回復する（残り ${pendingChoice.remainingHeal}）`
                        : pendingChoice.kind === 'post_attack_self_discard' || pendingChoice.kind === 'self_discard_after_draw'
                          ? pendingChoice.kind === 'self_discard_after_draw'
                            ? `選んだカードを捨てる（残り ${pendingChoice.discardCountRemaining} 枚）`
                            : '選んだカードを捨てる'
                          : `選んだカードを捨てて +${pendingChoice.bonusDamage}`}
              </button>
              {pendingChoice.kind === 'optional_trash_topdeck_for_next_attack_buff' ? (
                <button type="button" onClick={cancelPendingChoice}>山札の上に戻す</button>
              ) : pendingChoice.kind !== 'post_attack_self_discard' && pendingChoice.kind !== 'self_discard_after_draw' && pendingChoice.kind !== 'post_attack_other_leader_damage' && pendingChoice.kind !== 'drain_rod_heal_distribution' && pendingChoice.kind !== 'drain_rod_damage_target' && (
                <button type="button" onClick={cancelPendingChoice}>通常解決</button>
              )}
            </div>
          </section>
        </div>
      )}

      <footer className="panel app-footer">
        <div>
          <strong>{APP_NAME}</strong>
          <p>ホーム画面追加・バックアップJSON・履歴確認に対応したローカル検証向け構成です。</p>
        </div>
        <span className="app-badge">{APP_VERSION}</span>
      </footer>
    </main>
  );
}
