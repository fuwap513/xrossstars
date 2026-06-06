import FieldCardTile from './FieldCardTile';
import HandPanel from './HandPanel';
import LeaderRow from './LeaderRow';
import type {
  BattleHistoryEntry,
  Card,
  Leader,
  MatchState,
  RegisteredCard,
  RoundSummaryEntry,
} from '../types/game';
import type { ConfirmOptions, ModalAction } from '../hooks/useModalLayerState';

type StatusType = 'ok' | 'ng' | '';
type RequestConfirm = (options: ConfirmOptions) => Promise<boolean>;

type Props = {
  appName: string;
  appVersion: string;
  state: MatchState;
  canUndoBattle: boolean;
  setupRequired: boolean;
  activeLeader?: Leader;
  targetLeader?: Leader;
  activeLeaderMaxHp: number;
  targetLeaderMaxHp: number;
  activeLeaderRemainingHp: number;
  targetLeaderRemainingHp: number;
  remainingOpponentLeaders: number;
  recentBattleHistory: BattleHistoryEntry[];
  roundSummaries: RoundSummaryEntry[];
  nextActionHints: string[];
  cardCatalogById: Map<string, RegisteredCard>;
  logActionMessage: string;
  logActionStatus: StatusType;
  requestConfirm: RequestConfirm;
  applyDeckAndStartGame: (order: 'self' | 'opponent') => void;
  resetGame: () => void;
  clearSavedGame: () => void;
  selectTargetLeader: (leaderId: string) => void;
  selectActiveLeader: (leaderId: string) => void;
  endTurn: () => void;
  handleUndoBattle: () => void;
  openPreview: (card: Card, title?: string, action?: ModalAction) => void;
  playHandCard: (cardId: string, options?: { forceCostPayment?: boolean }) => void;
  discardHandCard: (cardId: string) => void;
  handleExportLog: () => void;
  handleCopyLog: () => Promise<void>;
};

export default function BattleScreen({
  appName,
  appVersion,
  state,
  canUndoBattle,
  setupRequired,
  activeLeader,
  targetLeader,
  activeLeaderMaxHp,
  targetLeaderMaxHp,
  activeLeaderRemainingHp,
  targetLeaderRemainingHp,
  remainingOpponentLeaders,
  recentBattleHistory,
  roundSummaries,
  nextActionHints,
  cardCatalogById,
  logActionMessage,
  logActionStatus,
  requestConfirm,
  applyDeckAndStartGame,
  resetGame,
  clearSavedGame,
  selectTargetLeader,
  selectActiveLeader,
  endTurn,
  handleUndoBattle,
  openPreview,
  playHandCard,
  discardHandCard,
  handleExportLog,
  handleCopyLog,
}: Props) {
  const handleResetSameCondition = async () => {
    const confirmed = await requestConfirm({
      title: '同条件でリセット',
      message: '現在の対戦状態を破棄して、同条件で最初からやり直します。よろしいですか？',
      confirmLabel: 'リセットする',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    resetGame();
  };

  const handleClearAllSavedData = async () => {
    const confirmed = await requestConfirm({
      title: '保存データ削除',
      message: '保存データをすべて削除します。デッキ構成・プリセット・対戦状態が初期化されます。よろしいですか？',
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    clearSavedGame();
  };

  const handleRetryBattle = async () => {
    const confirmed = await requestConfirm({
      title: '再試行',
      message: '現在の対戦状態を破棄して、この試合を再試行します。よろしいですか？',
      confirmLabel: '再試行する',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    resetGame();
  };

  return (
    <>
      <section className="panel battle-core-board">
        <div className="section-header">
          <h2>対戦盤面</h2>
          <span>{state.winner ? '試合終了' : `Round ${state.round} / Turn ${state.turn}`}</span>
        </div>

        <div className="battle-overview-row">
          <div className="compact-card battle-overview-card">
            <div className="support-label">進行</div>
            <strong>{state.firstPlayer === 'self' ? '先攻' : '後攻'}</strong>
            <span>PP {state.ppCurrent} / {state.ppMax}</span>
          </div>
          <div className="compact-card battle-overview-card">
            <div className="support-label">相手残りリーダー</div>
            <strong>{remainingOpponentLeaders}</strong>
            <span>{state.opponent.wins} 勝 / 自分 {state.self.wins} 勝</span>
          </div>
          <div className="compact-card battle-overview-card">
            <div className="support-label">手札 / セット</div>
            <strong>{state.self.hand.length} / {state.self.tacticsSet.length}</strong>
            <span>タクティクス山 {state.self.tacticsDeck.length}</span>
          </div>
          <div className="compact-card battle-overview-card">
            <div className="support-label">場 / トラッシュ</div>
            <strong>{state.fieldCards.length} / {state.self.trash.length}</strong>
            <span>装備 {state.self.equipmentZone.length}</span>
          </div>
        </div>

        <div className="battle-control-bar">
          <button onClick={endTurn} disabled={Boolean(state.winner)}>ターン終了</button>
          <button
            className="ghost-button"
            onClick={handleUndoBattle}
            disabled={!canUndoBattle}
          >
            1手戻す
          </button>
          <button onClick={() => void handleRetryBattle()}>再試行</button>
        </div>

        <LeaderRow
          title="相手リーダー（4体常時表示 / 対象選択）"
          leaders={state.opponent.leaders}
          selectedId={state.targetLeaderId}
          onSelect={selectTargetLeader}
          cardLookup={cardCatalogById}
        />

        <section className="panel battle-shared-area">
          <div className="section-header">
            <h2>共有プレイエリア</h2>
            <span>場のカード {state.fieldCards.length}</span>
          </div>

          <div className="battle-focus-grid">
            <div className="compact-card">
              <div className="support-label">対象リーダー</div>
              <strong>{targetLeader?.name ?? '未選択'}</strong>
              <span>
                現在 HP {targetLeaderRemainingHp} / {targetLeaderMaxHp}
              </span>
            </div>
            <div className="compact-card">
              <div className="support-label">アクティブリーダー</div>
              <strong>{activeLeader?.name ?? '未選択'}</strong>
              <span>
                現在 HP {activeLeaderRemainingHp} / {activeLeaderMaxHp}
              </span>
            </div>
          </div>

          {setupRequired && (
            <div className="import-status ng">
              ラウンド開始処理: このラウンドで使うタクティクスを1枚セットしてください
            </div>
          )}

          {state.fieldCards.length > 0 ? (
            <div className="battle-field-grid">
              {state.fieldCards.map((card) => (
                <FieldCardTile
                  key={card.id}
                  card={card}
                  title="共有プレイエリア"
                  subtitle="場に出ているカード"
                  onClick={() => openPreview(card, '共有プレイエリア / カード詳細')}
                />
              ))}
            </div>
          ) : (
            <div className="battle-field-empty">
              共有プレイエリアにカードはまだありません
            </div>
          )}

          <div className="battle-summary">
            <div><strong>次回攻撃補正:</strong> +{state.nextAttackBuff}</div>
            <div><strong>ターン中補正:</strong> +{state.turnAttackBuff}</div>
            <div><strong>タクティクス使用:</strong> {state.tacticsUsedThisTurn ? '使用済み' : '未使用'}</div>
            <div><strong>要ディスカード:</strong>
