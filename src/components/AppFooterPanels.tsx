import type { AppUsageStats, OperationLogCategory, OperationLogEntry } from '../types/game';

type StatusType = 'ok' | 'ng' | '';

const OPERATION_CATEGORY_LABELS: Record<OperationLogCategory, string> = {
  app: '画面',
  deck: 'デッキ',
  preset: 'プリセット',
  battle: '対戦',
  system: 'システム',
};

type Props = {
  usageStats: AppUsageStats;
  operationLogs: OperationLogEntry[];
  operationActionMessage: string;
  operationActionStatus: StatusType;
  onResetUsageStats: () => Promise<void>;
  onExportOperationLog: () => void;
  onCopyOperationLog: () => Promise<void>;
  onClearOperationLog: () => Promise<void>;
};

export default function AppFooterPanels({
  usageStats,
  operationLogs,
  operationActionMessage,
  operationActionStatus,
  onResetUsageStats,
  onExportOperationLog,
  onCopyOperationLog,
  onClearOperationLog,
}: Props) {
  return (
    <>
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
          <button className="ghost-button" onClick={() => void onResetUsageStats()}>利用統計をリセット</button>
        </div>
      </section>

      <section className="panel operation-log-panel">
        <div className="section-header">
          <h2>操作ログ</h2>
          <span>最新 {operationLogs.length} 件</span>
        </div>
        <div className="action-row wrap-actions top-gap">
          <button onClick={onExportOperationLog}>TXTを書き出す</button>
          <button className="ghost-button" onClick={() => void onCopyOperationLog()}>クリップボードにコピー</button>
          <button className="ghost-button" onClick={() => void onClearOperationLog()}>ログをクリア</button>
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
    </>
  );
}
