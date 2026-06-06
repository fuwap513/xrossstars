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
  Side,
} from '../types/game';

type ConfirmTone = 'default' | 'danger';

type ConfirmRequest = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

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
  roundSummaries?: RoundSummaryEntry[];
  recentRoundSummaries?: RoundSummaryEntry[];
  nextActionHints: string[];
  cardCatalogMap?: Record<string, RegisteredCard | undefined>;
  cardCatalogById?: Map<string, RegisteredCard>;
  latestLogMessage?: string;
  logStatusText?: string;
  selectableCards?: Card[];
  pendingChoiceSelectableCards?: Card[];
  selectableLeaders?: Leader[];
  pendingChoiceSelectableLeaders?: Leader[];
  requiresCardSelection?: boolean;
  pendingChoiceNeedsCardSelection?: boolean;
  requiresLeaderSelection?: boolean;
  pendingChoiceNeedsLeaderSelection?: boolean;
  requestConfirm?: (options: ConfirmRequest) => Promise<boolean>;
  applyDeckAndStartGame?: (firstPlayer?: Side) => void;
  resetGame?: () => void;
  clearSavedGame?: () => void;
  selectTargetLeader?: (leaderId: string) => void;
  selectActiveLeader?: (leaderId: string) => void;
  endTurn?: () => void;
  handleUndoBattle?: () => void;
  openPreview?: (card: Card) => void;
  playHandCard?: (cardId: string) => void;
  discardHandCard?: (cardId: string) => void;
  handleExportLog?: () => void;
  handleCopyLog?: () => void;
  [key: string]: unknown;
};

const formatTimestamp = (value?: string) => {
  if (!value) return '';
  const normalized = value.replace('T', ' ').replace('Z', '');
  return normalized.length > 16 ? normalized.slice(0, 16) : normalized;
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
  recentRoundSummaries,
  nextActionHints,
  cardCatalogMap,
  cardCatalogById,
  latestLogMessage,
  logStatusText,
  selectableCards,
  pendingChoiceSelectableCards,
  selectableLeaders,
  pendingChoiceSelectableLeaders,
  requiresCardSelection,
  pendingChoiceNeedsCardSelection,
  requiresLeaderSelection,
  pendingChoiceNeedsLeaderSelection,
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
  const leaderLookup = cardCatalogById ?? cardCatalogMap;
  const summaryItems = recentRoundSummaries ?? roundSummaries ?? [];
  const cardChoices = selectableCards ?? pendingChoiceSelectableCards ?? [];
  const leaderChoices = selectableLeaders ?? pendingChoiceSelectableLeaders ?? [];
  const needsCardSelection =
    requiresCardSelection ?? pendingChoiceNeedsCardSelection ?? false;
  const needsLeaderSelection =
    requiresLeaderSelection ?? pendingChoiceNeedsLeaderSelection ?? false;

  const confirmWithFallback = async (
    message: string,
    title = '確認',
    tone: ConfirmTone = 'danger',
  ) => {
    if (requestConfirm) {
      return requestConfirm({
        title,
        message,
        confirmLabel: '実行する',
        cancelLabel: 'キャンセル',
        tone,
      });
    }

    if (typeof window !== 'undefined') {
      return window.confirm(message);
    }

    return false;
  };

  const handleResetGame = async () => {
    if (!resetGame) return;
    const ok = await confirmWithFallback(
      '現在の対戦状態をリセットします。よろしいですか？',
      '対戦リセット',
      'danger',
    );
    if (ok) resetGame();
  };

  const handleClearAll = async () => {
    if (!clearSavedGame) return;
    const ok = await confirmWithFallback(
      '保存済みデータを削除します。よろしいですか？',
      '保存データ削除',
      'danger',
    );
    if (ok) clearSavedGame();
  };

  return (
    <div className="battle-screen">
      <section className="panel battle-management-panel">
        <div className="section-header">
          <h2>対戦管理</h2>
          <span>{logStatusText ?? '進行中'}</span>
        </div>

        <div className="action-row wrap-actions top-gap">
          <button onClick={() => applyDeckAndStartGame?.('self')}>先攻で開始</button>
          <button onClick={() => applyDeckAndStartGame?.('opponent')}>後攻で開始</button>
          <button className="ghost-button" onClick={() => void handleResetGame()}>
            対戦をリセット
          </button>
          <button className="danger-button" onClick={() => void handleClearAll()}>
            保存データを削除
          </button>
        </div>

        <div className="status-grid top-gap">
          <div className="detail-box">
            <div className="eyebrow">ラウンド</div>
            <div className="detail-description">
              {state.round} / 3 ・ ターン {state.turn}
            </div>
          </div>

          <div className="detail-box">
            <div className="eyebrow">PP</div>
            <div className="detail-description">
              {state.ppCurrent} / {state.ppMax}
            </div>
          </div>

          <div className="detail-box">
            <div className="eyebrow">先攻</div>
            <div className="detail-description">
              {state.firstPlayer === 'self' ? '自分' : '相手'}
            </div>
          </div>

          <div className="detail-box">
            <div className="eyebrow">相手残数</div>
            <div className="detail-description">{remainingOpponentLeaders} 体</div>
          </div>

          <div className="detail-box">
            <div className="eyebrow">自分手札 / 山札 / トラッシュ</div>
            <div className="detail-description">
              {state.self.hand.length} / {state.self.mainDeck.length} / {state.self.trash.length}
            </div>
          </div>

          <div className="detail-box">
            <div className="eyebrow">相手手札 / 山札 / トラッシュ</div>
            <div className="detail-description">
              {state.opponent.hand.length} / {state.opponent.mainDeck.length} /{' '}
              {state.opponent.trash.length}
            </div>
          </div>
        </div>
      </section>

      <section className="panel top-gap">
        <div className="section-header">
          <h2>次の行動ヒント</h2>
          <span>{latestLogMessage ?? '操作を選択してください。'}</span>
        </div>

        <div className="top-gap">
          {nextActionHints.length > 0 ? (
            <ul className="hint-list">
              {nextActionHints.map((hint, index) => (
                <li key={`${hint}-${index}`}>{hint}</li>
              ))}
            </ul>
          ) : (
            <div className="detail-box">操作候補はありません。</div>
          )}
        </div>
      </section>

      <div className="battle-core-board top-gap">
        <LeaderRow
          title="相手リーダー"
          leaders={state.opponent.leaders}
          selectedId={state.targetLeaderId}
          onSelect={selectTargetLeader}
          cardLookup={leaderLookup}
        />

        <section className="panel battle-shared-area">
          <div className="section-header">
            <h2>共有プレイエリア</h2>
            <span>{state.fieldCards.length} 枚</span>
          </div>

          <div className="battle-focus-grid top-gap">
            <div className="detail-box">
              <div className="eyebrow">アクティブリーダー</div>
              <div className="detail-description">
                {activeLeader
                  ? `${activeLeader.name} / HP ${activeLeaderRemainingHp} / ${activeLeaderMaxHp}`
                  : '未選択'}
              </div>
            </div>

            <div className="detail-box">
              <div className="eyebrow">対象リーダー</div>
              <div className="detail-description">
                {targetLeader
                  ? `${targetLeader.name} / HP ${targetLeaderRemainingHp} / ${targetLeaderMaxHp}`
                  : '未選択'}
              </div>
            </div>

            <div className="detail-box">
              <div className="eyebrow">攻撃補正</div>
              <div className="detail-description">
                次攻撃 +{state.nextAttackBuff} / ターン +{state.turnAttackBuff} / ラウンド +
                {state.roundAttackBuff}
              </div>
            </div>

            <div className="detail-box">
              <div className="eyebrow">タクティクス状態</div>
              <div className="detail-description">
                {state.roundTacticSelected ? 'ラウンドセット済み' : '未セット'} /{' '}
                {state.tacticsUsedThisTurn ? 'このターン使用済み' : '未使用'}
              </div>
            </div>

            <div className="detail-box">
              <div className="eyebrow">その他</div>
              <div className="detail-description">
                捨て待ち {state.pendingDiscardCount} / PPチケット{' '}
                {state.self.ppTicket ? 'あり' : 'なし'}
              </div>
            </div>
          </div>

          <div className="action-row wrap-actions top-gap">
            <button onClick={() => endTurn?.()}>ターン終了</button>
            <button onClick={() => handleUndoBattle?.()} disabled={!canUndoBattle}>
              やり直す
            </button>
          </div>

          {setupRequired ? (
            <div className="import-status ng top-gap">
              まだラウンド開始準備が完了していません。タクティクス設定を確認してください。
            </div>
          ) : null}

          <div className="field-grid top-gap">
            {state.fieldCards.length > 0 ? (
              state.fieldCards.map((card, index) => (
                <FieldCardTile
                  key={`${card.id}-${index}`}
                  card={card}
                  title={`場のカード ${index + 1}`}
                  subtitle={card.name}
                  onClick={() => openPreview?.(card)}
                />
              ))
            ) : (
              <div className="detail-box">
                <div className="eyebrow">場の状態</div>
                <div className="detail-description">場のカードはまだありません</div>
              </div>
            )}
          </div>
        </section>

        <LeaderRow
          title="自分リーダー"
          leaders={state.self.leaders}
          selectedId={state.activeLeaderId}
          onSelect={selectActiveLeader}
          cardLookup={leaderLookup}
        />
      </div>

      <div className="battle-lower-panels top-gap">
        <section className="panel">
          <div className="section-header">
            <h2>セット済みタクティクス</h2>
            <span>{state.self.tacticsSet.length} 枚</span>
          </div>

          <div className="field-grid top-gap">
            {state.self.tacticsSet.length > 0 ? (
              state.self.tacticsSet.map((card, index) => (
                <FieldCardTile
                  key={`${card.id}-${index}`}
                  card={card}
                  title={`タクティクス ${index + 1}`}
                  subtitle={card.name}
                  onClick={() => openPreview?.(card)}
                />
              ))
            ) : (
              <div className="detail-box">
                <div className="detail-description">
                  セット済みタクティクスはありません
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel top-gap">
          <div className="section-header">
            <h2>装備・サポート</h2>
            <span>{state.self.equipmentZone.length} 枚</span>
          </div>

          <div className="field-grid top-gap">
            {state.self.equipmentZone.length > 0 ? (
              state.self.equipmentZone.map((card, index) => (
                <FieldCardTile
                  key={`${card.id}-${index}`}
                  card={card}
                  title={`装備 ${index + 1}`}
                  subtitle={card.name}
                  onClick={() => openPreview?.(card)}
                />
              ))
            ) : (
              <div className="detail-box">
                <div className="detail-description">
                  装備中のカードはありません
                </div>
              </div>
            )}
          </div>
        </section>
        <section className="panel top-gap">
          <div className="section-header">
            <h2>手札</h2>
            <span>{state.self.hand.length} 枚</span>
          </div>

          <div className="top-gap">
            <HandPanel
              cards={state.self.hand}
              disabled={Boolean(state.winner) || needsCardSelection}
              onUseCard={(cardId) => playHandCard?.(cardId)}
              onPreviewCard={(card) => openPreview?.(card)}
            />
          </div>
        </section>

        {needsCardSelection ? (
          <section className="panel top-gap">
            <div className="section-header">
              <h2>選択対象カード</h2>
              <span>{cardChoices.length} 枚</span>
            </div>

            <div className="field-grid top-gap">
              {cardChoices.map((card, index) => (
                <FieldCardTile
                  key={`${card.id}-${index}`}
                  card={card}
                  title={`候補 ${index + 1}`}
                  subtitle={card.name}
                  onClick={() => openPreview?.(card)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {needsLeaderSelection ? (
          <section className="panel top-gap">
            <div className="section-header">
              <h2>選択対象リーダー</h2>
              <span>{leaderChoices.length} 体</span>
            </div>

            <LeaderRow
              title="選択候補"
              leaders={leaderChoices}
              cardLookup={leaderLookup}
            />
          </section>
        ) : null}

        {state.pendingDiscardCount > 0 && state.self.hand.length > 0 ? (
          <section className="panel top-gap">
            <div className="section-header">
              <h2>捨て札候補</h2>
              <span>残り {state.pendingDiscardCount} 枚</span>
            </div>

            <div className="field-grid top-gap">
              {state.self.hand.map((card, index) => (
                <FieldCardTile
                  key={`${card.id}-${index}`}
                  card={card}
                  title={`手札 ${index + 1}`}
                  subtitle={card.name}
                  onClick={() => openPreview?.(card)}
                />
              ))}
            </div>

            <div className="action-row wrap-actions top-gap">
              {state.self.hand.map((card, index) => (
                <button
                  key={`${card.id}-discard-${index}`}
                  className="ghost-button"
                  onClick={() => discardHandCard?.(card.id)}
                >
                  {card.name} を捨てる
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel top-gap">
          <div className="section-header">
            <h2>バトルログ</h2>
            <span>{state.logs.length} 件</span>
          </div>

          <div className="action-row wrap-actions top-gap">
            <button className="ghost-button" onClick={() => handleExportLog?.()}>
              ログを出力
            </button>
            <button className="ghost-button" onClick={() => handleCopyLog?.()}>
              ログをコピー
            </button>
          </div>

          <div className="log-list top-gap">
            {state.logs.length > 0 ? (
              [...state.logs].slice(-20).reverse().map((entry, index) => (
                <div className="detail-box" key={`${entry}-${index}`}>
                  <div className="detail-description">{entry}</div>
                </div>
              ))
            ) : (
              <div className="detail-box">
                <div className="detail-description">まだログはありません</div>
              </div>
            )}
          </div>
        </section>

        <section className="panel top-gap">
          <div className="section-header">
            <h2>対戦履歴</h2>
            <span>{recentBattleHistory.length} 件</span>
          </div>

          <div className="log-list top-gap">
            {recentBattleHistory.length > 0 ? (
              recentBattleHistory.map((entry) => (
                <div className="detail-box" key={entry.id}>
                  <div className="eyebrow">
                    R{entry.round} / T{entry.turn} / {formatTimestamp(entry.timestamp)}
                  </div>
                  <div className="detail-description">{entry.message}</div>
                </div>
              ))
            ) : (
              <div className="detail-box">
                <div className="detail-description">履歴はまだありません</div>
              </div>
            )}
          </div>
        </section>

        <section className="panel top-gap">
          <div className="section-header">
            <h2>ラウンドサマリー</h2>
            <span>{summaryItems.length} 件</span>
          </div>

          <div className="log-list top-gap">
            {summaryItems.length > 0 ? (
              summaryItems.map((summary) => (
                <div className="detail-box" key={summary.id}>
                  <div className="eyebrow">
                    Round {summary.round} / Turn {summary.turnReached}
                  </div>
                  <div className="detail-description">
                    自分勝利数 {summary.selfWins} ・ 自分DOWN {summary.selfLeadersDown} ・
                    相手DOWN {summary.opponentLeadersDown}
                  </div>
                  <div className="detail-description">
                    手札 {summary.handCount} / 山札 {summary.deckCount} / トラッシュ{' '}
                    {summary.trashCount}
                  </div>
                  <div className="detail-description">{summary.note}</div>
                </div>
              ))
            ) : (
              <div className="detail-box">
                <div className="detail-description">サマリーはまだありません</div>
              </div>
            )}
          </div>
        </section>

        <section className="panel top-gap">
          <div className="section-header">
            <h2>アプリ情報</h2>
            <span>
              {appName} / {appVersion}
            </span>
          </div>

          <div className="detail-box top-gap">
            <div className="eyebrow">状態</div>
            <div className="detail-description">{logStatusText ?? '進行中'}</div>
          </div>

          <div className="detail-box top-gap">
            <div className="eyebrow">最新ログ</div>
            <div className="detail-description">
              {latestLogMessage ?? '操作を選択してください。'}
            </div>
          </div>

          {state.winner ? (
            <div className="import-status ok top-gap">
              対戦結果: {state.winner === 'self' ? '自分側の勝利' : '相手側の勝利'}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

