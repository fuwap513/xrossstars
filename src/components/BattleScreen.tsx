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
            <div><strong>要ディスカード:</strong> {state.pendingDiscardCount} 枚</div>
            <div><strong>後攻補助:</strong> {state.self.ppTicket ? 'PP回復タクティクスあり' : 'なし'}</div>
            <div><strong>ラウンド開始セット:</strong> {state.roundTacticSelected ? '完了' : '未選択'}</div>
          </div>
        </section>

        <LeaderRow
          title="自分リーダー（4体常時表示 / 攻撃役選択）"
          leaders={state.self.leaders}
          selectedId={state.activeLeaderId}
          onSelect={selectActiveLeader}
          cardLookup={cardCatalogById}
        />
      </section>

      <section className="panel battle-management-panel">
        <div className="section-header">
          <h2>対戦管理</h2>
          <span>現在の構成でそのまま検証を開始・再開できます</span>
        </div>
        <div className="action-row wrap-actions">
          <button onClick={() => applyDeckAndStartGame('self')}>先攻で開始</button>
          <button onClick={() => applyDeckAndStartGame('opponent')}>後攻で開始</button>
          <button onClick={() => void handleResetSameCondition()}>同条件でリセット</button>
          <button className="ghost-button" onClick={() => void handleClearAllSavedData()}>
            保存データ削除
          </button>
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
            <span>{state.winner ? '試合終了' : 'ダウンでラウンド進行'}</span>
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
              onClick={() =>
                openPreview(card, 'セット可能タクティクス', {
                  type: 'set-tactic',
                  cardId: card.id,
                })
              }
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
              onClick={() =>
                openPreview(card, 'セット済みタクティクス', {
                  type: 'use-set-tactic',
                  cardId: card.id,
                })
              }
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
        onPreviewCard={(card) =>
          openPreview(card, '手札カード詳細', {
            type: 'play-hand',
            cardId: card.id,
          })
        }
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
            <button className="ghost-button" onClick={() => void handleCopyLog()}>
              クリップボードにコピー
            </button>
          </div>
          {logActionMessage && (
            <div className={`import-status ${logActionStatus} top-gap`}>
              {logActionMessage}
            </div>
          )}
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
            <strong>{appName}</strong>
            <span>{appVersion}</span>
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
        <p>
          この試合で発生した対戦イベントを保持します。TXT出力には全履歴を含み、
          1手戻すを使うと履歴も現在状態に合わせて戻ります。
        </p>
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
          <span>最新 {roundSummaries.length} 件</span>
        </div>
        <div className="round-summary-list top-gap">
          {roundSummaries.map((summary) => (
            <article className="compact-card" key={summary.id}>
              <div className="battle-history-meta">
                <span className="detail-chip">Round {summary.round}</span>
                <span>到達ターン {summary.turnReached}</span>
              </div>
              <div className="battle-summary top-gap">
                <div><strong>勝利数:</strong> 自分 {summary.selfWins}</div>
                <div><strong>自分ダウン:</strong> {summary.selfLeadersDown}</div>
                <div><strong>相手ダウン:</strong> {summary.opponentLeadersDown}</div>
                <div><strong>手札:</strong> {summary.handCount}</div>
                <div><strong>山札:</strong> {summary.deckCount}</div>
                <div><strong>トラッシュ:</strong> {summary.trashCount}</div>
              </div>
              <p className="top-gap">{summary.note}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

