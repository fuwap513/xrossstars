import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { AppBackupData, AppScreen, AppUsageStats, DeckConfig, DeckPreset, LeaderSetup, MatchState, OperationLogCategory, OperationLogEntry, RegisteredCard } from '../types/game';
import type { ConfirmOptions } from './useModalLayerState';

const OPERATION_CATEGORY_LABELS: Record<OperationLogCategory, string> = {
  app: '画面',
  deck: 'デッキ',
  preset: 'プリセット',
  battle: '対戦',
  system: 'システム',
};

type StatusType = 'ok' | 'ng' | '';

type RequestConfirm = (options: ConfirmOptions) => Promise<boolean>;
type ImportAppBackup = (payload: unknown) => boolean;
type AddOperationLog = (message: string, category?: OperationLogCategory) => void;
type ClearOperationLogs = () => void;
type IncrementUsageStat = (key: keyof AppUsageStats, amount?: number) => void;
type ResetUsageStats = () => void;
type ResetLeaderSetup = () => void;
type UndoBattleAction = () => void;

type Params = {
  currentScreen: AppScreen;
  deckConfig: DeckConfig;
  cardCatalog: RegisteredCard[];
  leaderSetup: LeaderSetup;
  savedPresets: DeckPreset[];
  operationLogs: OperationLogEntry[];
  usageStats: AppUsageStats;
  state: MatchState;
  isSelfSecond: boolean;
  canUndoBattle: boolean;
  importAppBackup: ImportAppBackup;
  addOperationLog: AddOperationLog;
  clearOperationLogs: ClearOperationLogs;
  incrementUsageStat: IncrementUsageStat;
  resetUsageStats: ResetUsageStats;
  resetLeaderSetup: ResetLeaderSetup;
  undoBattleAction: UndoBattleAction;
  requestConfirm: RequestConfirm;
};

const downloadTextFile = (text: string, filename: string, mimeType: string) => {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const buildTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export default function useAppDataActions({
  currentScreen,
  deckConfig,
  cardCatalog,
  leaderSetup,
  savedPresets,
  operationLogs,
  usageStats,
  state,
  isSelfSecond,
  canUndoBattle,
  importAppBackup,
  addOperationLog,
  clearOperationLogs,
  incrementUsageStat,
  resetUsageStats,
  resetLeaderSetup,
  undoBattleAction,
  requestConfirm,
}: Params) {
  const [logActionMessage, setLogActionMessage] = useState('');
  const [logActionStatus, setLogActionStatus] = useState<StatusType>('');
  const [operationActionMessage, setOperationActionMessage] = useState('');
  const [operationActionStatus, setOperationActionStatus] = useState<StatusType>('');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupStatus, setBackupStatus] = useState<StatusType>('');

  const roundSummaries = useMemo(() => [...state.roundSummaries].reverse(), [state.roundSummaries]);

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
    downloadTextFile(buildLogText(), `xrossstars-battle-log-${buildTimestamp()}.txt`, 'text/plain;charset=utf-8');
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
    downloadTextFile(buildOperationLogText(), `xrossstars-operation-log-${buildTimestamp()}.txt`, 'text/plain;charset=utf-8');
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
    downloadTextFile(JSON.stringify(payload, null, 2), `xrossstars-app-backup-${buildTimestamp()}.json`, 'application/json');
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

  return {
    roundSummaries,
    logActionMessage,
    logActionStatus,
    operationActionMessage,
    operationActionStatus,
    backupMessage,
    backupStatus,
    handleExportLog,
    handleCopyLog,
    handleExportOperationLog,
    handleCopyOperationLog,
    handleClearOperationLog,
    handleResetUsageStats,
    handleExportAppBackup,
    handleImportAppBackup,
    handleResetLeaderSetup,
    handleUndoBattle,
  };
}
