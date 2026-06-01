from pathlib import Path

root = Path('/home/user/xrossstars-react-mvp')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Failed to locate {label}')
    return text.replace(old, new, 1)


# --- src/types/game.ts ---
game_types = root / 'src/types/game.ts'
text = game_types.read_text()
text = replace_once(
    text,
    "export type RoundSummaryEntry = {\n  id: string;\n  round: MatchRound;\n  turnReached: number;\n  selfWins: number;\n  selfLeadersDown: number;\n  opponentLeadersDown: number;\n  handCount: number;\n  deckCount: number;\n  trashCount: number;\n  note: string;\n};\n\nexport type Leader = {",
    "export type RoundSummaryEntry = {\n  id: string;\n  round: MatchRound;\n  turnReached: number;\n  selfWins: number;\n  selfLeadersDown: number;\n  opponentLeadersDown: number;\n  handCount: number;\n  deckCount: number;\n  trashCount: number;\n  note: string;\n};\n\nexport type PendingBattleChoice = {\n  kind: 'optional_discard_for_attack_bonus';\n  cardInstanceId: string;\n  sourceCardName: string;\n  sourceText: string;\n  prompt: string;\n  bonusDamage: number;\n  selectableHandCardIds: string[];\n};\n\nexport type Leader = {",
    'RoundSummaryEntry insert',
)
text = replace_once(
    text,
    "  cardsDiscardedThisTurn: number;\n  winner?: Side;\n",
    "  cardsDiscardedThisTurn: number;\n  pendingChoice?: PendingBattleChoice;\n  winner?: Side;\n",
    'MatchState pendingChoice field',
)
text = replace_once(
    text,
    "  discardHandCard: (cardId: string) => void;\n  endTurn: () => void;\n};\n",
    "  discardHandCard: (cardId: string) => void;\n  resolvePendingChoice: (payload: { accept: boolean; selectedCardId?: string }) => void;\n  cancelPendingChoice: () => void;\n  endTurn: () => void;\n};\n",
    'GameStore pending choice methods',
)
game_types.write_text(text)

# --- src/store/battleEffects.ts ---
battle = root / 'src/store/battleEffects.ts'
text = battle.read_text()
text = replace_once(
    text,
    "import type { Card, Leader, LeaderSetupEntry, MatchState, PlayerBoard, RegisteredCard, Side } from '../types/game';",
    "import type { Card, Leader, LeaderSetupEntry, MatchState, PendingBattleChoice, PlayerBoard, RegisteredCard, Side } from '../types/game';",
    'battleEffects type import',
)
text = replace_once(
    text,
    "type AttackContext = {\n  attacker: Leader;\n  targetId: string;\n  targetName: string;\n  targetColor?: string;\n  damage: number;\n  downed: boolean;\n  overkill: number;\n  postEffectDamageDealt: boolean;\n};\n",
    "type AttackContext = {\n  attacker: Leader;\n  targetId: string;\n  targetName: string;\n  targetColor?: string;\n  damage: number;\n  downed: boolean;\n  overkill: number;\n  postEffectDamageDealt: boolean;\n};\n\ntype ResolveAttackOptions = {\n  fromFreePlay?: boolean;\n  bypassPreAttackChoice?: boolean;\n  choiceBonusDamage?: number;\n};\n",
    'ResolveAttackOptions insert',
)
text = replace_once(
    text,
    "const playEligibleHandMemoria = (state: MatchState, maxCostSum: number, deps: RuntimeDeps) => {",
    "const buildPreAttackChoice = (state: MatchState, card: Card): PendingBattleChoice | null => {\n  const text = normalizeText(card.text);\n  if (text.includes('手札を1枚捨ててもよい。そうしたならダメージ+20')) {\n    const selectableHandCardIds = state.self.hand.map((handCard) => handCard.id).filter((handCardId) => handCardId !== card.id);\n    if (selectableHandCardIds.length === 0) return null;\n    return {\n      kind: 'optional_discard_for_attack_bonus',\n      cardInstanceId: card.id,\n      sourceCardName: card.name,\n      sourceText: card.text,\n      prompt: '手札を1枚捨てると、このアタックのダメージが+20されます。',\n      bonusDamage: 20,\n      selectableHandCardIds,\n    };\n  }\n  return null;\n};\n\nconst playEligibleHandMemoria = (state: MatchState, maxCostSum: number, deps: RuntimeDeps) => {",
    'buildPreAttackChoice insert',
)
text = replace_once(
    text,
    "  if (text.includes('手札を1枚捨ててもよい。そうしたならダメージ+20') && state.self.hand.length > 0) {\n    discardFromHand(state.self, 1, state, { ...depsStub, log: () => undefined, onRoundWin: () => undefined });\n    bonus += 20;\n  }\n",
    '',
    'auto discard attack bonus removal',
)
text = replace_once(
    text,
    "const resolveAttackCard = (state: MatchState, card: Card, deps: RuntimeDeps, fromFreePlay = false) => {\n",
    "const resolveAttackCard = (state: MatchState, card: Card, deps: RuntimeDeps, options: ResolveAttackOptions = {}) => {\n",
    'resolveAttackCard signature',
)
text = replace_once(
    text,
    "  const attacker = getLeaderById(state.self.leaders, state.activeLeaderId);\n",
    "  if (!options.bypassPreAttackChoice) {\n    const pendingChoice = buildPreAttackChoice(state, card);\n    if (pendingChoice) {\n      state.pendingChoice = pendingChoice;\n      deps.log(`${card.name}: 任意効果の選択待ち`);\n      return true;\n    }\n  }\n  const attacker = getLeaderById(state.self.leaders, state.activeLeaderId);\n",
    'resolveAttackCard pre-choice gate',
)
text = replace_once(
    text,
    "    const extraBonus = getAttackBonusFromText(state, card, attacker, target);\n",
    "    const extraBonus = getAttackBonusFromText(state, card, attacker, target) + (options.choiceBonusDamage ?? 0);\n",
    'resolveAttackCard bonus merge',
)
text = replace_once(
    text,
    "  void fromFreePlay;\n  return true;\n};\n\nexport const playHandCardRuntime =",
    "  void options.fromFreePlay;\n  return true;\n};\n\nexport const playHandCardRuntime =",
    'resolveAttackCard trailing cleanup',
)
text = replace_once(
    text,
    "      resolveAttackCard(state, card, deps, true);\n",
    "      resolveAttackCard(state, card, deps, { fromFreePlay: true });\n",
    'free play attack update',
)
text = replace_once(
    text,
    "export const useSetTacticRuntime = (state: MatchState, cardId: string, deps: RuntimeDeps) => {",
    "export const resolvePendingChoiceRuntime = (\n  state: MatchState,\n  payload: { accept: boolean; selectedCardId?: string },\n  deps: RuntimeDeps,\n) => {\n  const pendingChoice = state.pendingChoice;\n  if (!pendingChoice) return false;\n\n  if (pendingChoice.kind === 'optional_discard_for_attack_bonus') {\n    const sourceCard = state.fieldCards.find((card) => card.id === pendingChoice.cardInstanceId);\n    if (!sourceCard) {\n      state.pendingChoice = undefined;\n      deps.log('保留中の攻撃カードが見つからないため、選択を終了しました');\n      return false;\n    }\n\n    let choiceBonusDamage = 0;\n    if (payload.accept) {\n      const fallbackCardId = pendingChoice.selectableHandCardIds[0];\n      const selectedCardId = payload.selectedCardId ?? fallbackCardId;\n      const handIndex = state.self.hand.findIndex((card) => card.id === selectedCardId && pendingChoice.selectableHandCardIds.includes(card.id));\n      if (handIndex < 0) {\n        deps.log('捨てる手札を選択してください');\n        return false;\n      }\n      const [discardedCard] = state.self.hand.splice(handIndex, 1);\n      state.self.trash.push(discardedCard);\n      state.cardsDiscardedThisTurn += 1;\n      choiceBonusDamage = pendingChoice.bonusDamage;\n      deps.log(`${sourceCard.name}: ${discardedCard.name} を捨ててダメージ+${choiceBonusDamage}`);\n    } else {\n      deps.log(`${sourceCard.name}: 任意ディスカードを行わず通常解決`);\n    }\n\n    state.pendingChoice = undefined;\n    return resolveAttackCard(state, sourceCard, deps, {\n      bypassPreAttackChoice: true,\n      choiceBonusDamage,\n    });\n  }\n\n  return false;\n};\n\nexport const useSetTacticRuntime = (state: MatchState, cardId: string, deps: RuntimeDeps) => {",
    'resolvePendingChoiceRuntime insert',
)
battle.write_text(text)

# --- src/store/gameStore.ts ---
store = root / 'src/store/gameStore.ts'
text = store.read_text()
text = replace_once(
    text,
    "  playHandCardRuntime,\n  resetTurnDamage,\n  useSetTacticRuntime,\n",
    "  playHandCardRuntime,\n  resetTurnDamage,\n  resolvePendingChoiceRuntime,\n  useSetTacticRuntime,\n",
    'gameStore battleEffects import',
)
text = replace_once(
    text,
    "  state.turn += 1;\n  state.ppCurrent = state.ppMax;\n",
    "  state.turn += 1;\n  state.ppCurrent = state.ppMax;\n  state.pendingChoice = undefined;\n",
    'beginNextTurn pendingChoice reset',
)
text = replace_once(
    text,
    "  state.round = (state.round + 1) as MatchRound;\n  state.turn = 1;\n",
    "  state.round = (state.round + 1) as MatchRound;\n  state.turn = 1;\n  state.pendingChoice = undefined;\n",
    'prepareNextRound pendingChoice reset',
)
text = replace_once(
    text,
    "    cardsDiscardedThisTurn: 0,\n    self: {\n",
    "    cardsDiscardedThisTurn: 0,\n    pendingChoice: undefined,\n    self: {\n",
    'createInitialState pendingChoice field',
)
text = replace_once(
    text,
    "          if (state.pendingDiscardCount > 0) {\n            log(state, '先に手札を7枚まで捨ててください');\n            return { state };\n          }\n",
    "          if (state.pendingChoice) {\n            log(state, '先に保留中のカード効果を解決してください');\n            return { state };\n          }\n          if (state.pendingDiscardCount > 0) {\n            log(state, '先に手札を7枚まで捨ててください');\n            return { state };\n          }\n",
    'playHandCard pendingChoice guard',
)
text = replace_once(
    text,
    "          if (state.roundTacticSelected) {\n            log(state, 'このラウンドではすでにタクティクスをセット済みです');\n            return { state };\n          }\n",
    "          if (state.pendingChoice) {\n            log(state, '先に保留中のカード効果を解決してください');\n            return { state };\n          }\n          if (state.roundTacticSelected) {\n            log(state, 'このラウンドではすでにタクティクスをセット済みです');\n            return { state };\n          }\n",
    'setRoundTactic pendingChoice guard',
)
text = replace_once(
    text,
    "          if (state.tacticsUsedThisTurn) {\n            log(state, '同一ターンにタクティクスカードを2枚使えません');\n            return { state };\n          }\n",
    "          if (state.pendingChoice) {\n            log(state, '先に保留中のカード効果を解決してください');\n            return { state };\n          }\n          if (state.tacticsUsedThisTurn) {\n            log(state, '同一ターンにタクティクスカードを2枚使えません');\n            return { state };\n          }\n",
    'useSetTactic pendingChoice guard',
)
text = replace_once(
    text,
    "          if (state.pendingDiscardCount <= 0) return { state };\n",
    "          if (state.pendingChoice) {\n            log(state, '先に保留中のカード効果を解決してください');\n            return { state };\n          }\n          if (state.pendingDiscardCount <= 0) return { state };\n",
    'discardHandCard pendingChoice guard',
)
text = replace_once(
    text,
    "          if (state.pendingDiscardCount > 0) {\n            log(state, '先にディスカードを完了してください');\n            return { state };\n          }\n",
    "          if (state.pendingChoice) {\n            log(state, '先に保留中のカード効果を解決してください');\n            return { state };\n          }\n          if (state.pendingDiscardCount > 0) {\n            log(state, '先にディスカードを完了してください');\n            return { state };\n          }\n",
    'endTurn pendingChoice guard',
)
text = replace_once(
    text,
    "      endTurn: () =>\n        set((store) => {",
    "      resolvePendingChoice: (payload) =>\n        set((store) => {\n          const previousState = clone(store.state);\n          const state = clone(store.state);\n          if (!state.pendingChoice) return { state };\n          const cardsDiscardedBefore = previousState.cardsDiscardedThisTurn;\n          const didResolve = resolvePendingChoiceRuntime(state, payload, {\n            log: (message) => log(state, message),\n            onRoundWin: () => checkRoundWin(state),\n          });\n          if (!didResolve) return { state };\n          const discardDelta = Math.max(0, state.cardsDiscardedThisTurn - cardsDiscardedBefore);\n          return {\n            state,\n            battleUndoStack: pushBattleUndo(store.battleUndoStack, previousState),\n            operationLogs: appendOperationLog(\n              store.operationLogs,\n              payload.accept ? '保留中の任意効果を解決しました' : '保留中の任意効果をスキップして解決しました',\n              'battle',\n            ),\n            usageStats: { ...store.usageStats, discards: store.usageStats.discards + discardDelta },\n          };\n        }),\n      cancelPendingChoice: () =>\n        get().resolvePendingChoice({ accept: false }),\n      endTurn: () =>\n        set((store) => {",
    'resolvePendingChoice store methods insert',
)
store.write_text(text)

# --- src/App.tsx ---
app = root / 'src/App.tsx'
text = app.read_text()
text = replace_once(
    text,
    "    discardHandCard,\n    endTurn,\n  } = useGameStore();\n",
    "    discardHandCard,\n    resolvePendingChoice,\n    cancelPendingChoice,\n    endTurn,\n  } = useGameStore();\n",
    'App store destructuring',
)
text = replace_once(
    text,
    "  const [isGuideOpen, setIsGuideOpen] = useState(false);\n",
    "  const [isGuideOpen, setIsGuideOpen] = useState(false);\n  const [selectedPendingChoiceCardId, setSelectedPendingChoiceCardId] = useState('');\n",
    'App pending choice local state',
)
text = replace_once(
    text,
    "  const roundSummaries = [...state.roundSummaries].reverse();\n",
    "  const roundSummaries = [...state.roundSummaries].reverse();\n  const pendingChoice = state.pendingChoice;\n  const pendingChoiceSelectableCards = pendingChoice?.kind === 'optional_discard_for_attack_bonus'\n    ? state.self.hand.filter((card) => pendingChoice.selectableHandCardIds.includes(card.id))\n    : [];\n",
    'App pendingChoice derived state',
)
text = replace_once(
    text,
    "    if (setupRequired) {\n",
    "    if (pendingChoice) {\n      hints.push(`${pendingChoice.sourceCardName} の任意効果を解決してください。`);\n      return hints;\n    }\n\n    if (setupRequired) {\n",
    'nextActionHints pendingChoice branch',
)
text = replace_once(
    text,
    "  }, [battleUndoStack.length, canUndoBattle, remainingOpponentLeaders, setupRequired, state.pendingDiscardCount, state.ppCurrent, state.round, state.self.hand.length, state.self.ppTicket, state.self.tacticsDeck.length, state.self.tacticsSet.length, state.tacticsUsedThisTurn, state.winner]);\n",
    "  }, [battleUndoStack.length, canUndoBattle, pendingChoice, remainingOpponentLeaders, setupRequired, state.pendingDiscardCount, state.ppCurrent, state.round, state.self.hand.length, state.self.ppTicket, state.self.tacticsDeck.length, state.self.tacticsSet.length, state.tacticsUsedThisTurn, state.winner]);\n",
    'nextActionHints deps',
)
text = replace_once(
    text,
    "  useEffect(() => {\n    const handleBeforeInstallPrompt = (event: Event) => {",
    "  useEffect(() => {\n    if (pendingChoice?.kind === 'optional_discard_for_attack_bonus') {\n      const firstSelectableCardId = pendingChoice.selectableHandCardIds.find((cardId) => state.self.hand.some((card) => card.id === cardId)) ?? '';\n      setSelectedPendingChoiceCardId(firstSelectableCardId);\n      return;\n    }\n    setSelectedPendingChoiceCardId('');\n  }, [pendingChoice, state.self.hand]);\n\n  useEffect(() => {\n    const handleBeforeInstallPrompt = (event: Event) => {",
    'pendingChoice selection effect',
)
text = replace_once(
    text,
    "      <ConfirmModal\n        open={confirmState.open}\n        title={confirmState.title}\n        message={confirmState.message}\n        confirmLabel={confirmState.confirmLabel}\n        cancelLabel={confirmState.cancelLabel}\n        tone={confirmState.tone}\n        onConfirm={() => closeConfirm(true)}\n        onCancel={() => closeConfirm(false)}\n      />\n",
    "      <ConfirmModal\n        open={confirmState.open}\n        title={confirmState.title}\n        message={confirmState.message}\n        confirmLabel={confirmState.confirmLabel}\n        cancelLabel={confirmState.cancelLabel}\n        tone={confirmState.tone}\n        onConfirm={() => closeConfirm(true)}\n        onCancel={() => closeConfirm(false)}\n      />\n\n      {pendingChoice?.kind === 'optional_discard_for_attack_bonus' && (\n        <div className=\"modal-backdrop\">\n          <section className=\"modal-card\" onClick={(event) => event.stopPropagation()}>\n            <div className=\"section-header\">\n              <h2>{pendingChoice.sourceCardName} の任意効果</h2>\n            </div>\n            <p>{pendingChoice.prompt}</p>\n            <div className=\"guide-step-list\">\n              {pendingChoiceSelectableCards.map((card) => (\n                <button\n                  key={card.id}\n                  type=\"button\"\n                  className={selectedPendingChoiceCardId === card.id ? 'primary-button' : ''}\n                  onClick={() => setSelectedPendingChoiceCardId(card.id)}\n                >\n                  捨てる候補: {card.name} / コスト {card.cost}\n                </button>\n              ))}\n            </div>\n            <div className=\"action-row\">\n              <button\n                type=\"button\"\n                onClick={() => resolvePendingChoice({ accept: true, selectedCardId: selectedPendingChoiceCardId })}\n                disabled={!selectedPendingChoiceCardId}\n              >\n                選んだカードを捨てて +{pendingChoice.bonusDamage}\n              </button>\n              <button type=\"button\" onClick={cancelPendingChoice}>通常解決</button>\n            </div>\n          </section>\n        </div>\n      )}\n",
    'pending choice modal render',
)
app.write_text(text)

print('Phase 1 implementation files updated.')
