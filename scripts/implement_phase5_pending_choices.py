from pathlib import Path

ROOT = Path('/home/user/xrossstars-react-mvp')

def replace_once(text: str, old: str, new: str, path: str) -> str:
    if old not in text:
        raise SystemExit(f'marker not found in {path}: {old[:80]!r}')
    return text.replace(old, new, 1)

# src/types/game.ts
path = ROOT / 'src/types/game.ts'
text = path.read_text()
old = """  | {
      kind: 'post_attack_self_discard';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      selectableHandCardIds: string[];
    };
"""
new = """  | {
      kind: 'post_attack_self_discard';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      selectableHandCardIds: string[];
    }
  | {
      kind: 'self_discard_after_draw';
      cardInstanceId: string;
      sourceCardName: string;
      sourceText: string;
      prompt: string;
      discardCountRemaining: number;
      selectableHandCardIds: string[];
    };
"""
text = replace_once(text, old, new, str(path))
path.write_text(text)

# src/store/battleEffects.ts
path = ROOT / 'src/store/battleEffects.ts'
text = path.read_text()

insert_after = """const buildPreAttackChoice = (state: MatchState, card: Card): PendingBattleChoice | null => {
  const text = normalizeText(card.text);
  if (text.includes('手札を1枚捨ててもよい。そうしたならダメージ+20')) {
    const selectableHandCardIds = state.self.hand.map((handCard) => handCard.id).filter((handCardId) => handCardId !== card.id);
    if (selectableHandCardIds.length === 0) return null;
    return {
      kind: 'optional_discard_for_attack_bonus',
      cardInstanceId: card.id,
      sourceCardName: card.name,
      sourceText: card.text,
      prompt: '手札を1枚捨てると、このアタックのダメージが+20されます。',
      bonusDamage: 20,
      selectableHandCardIds,
    };
  }
  if (text.includes('自分の手札のコスト0のカード1枚を公開し、捨ててもよい')) {
    const selectableHandCardIds = state.self.hand
      .filter((handCard) => handCard.cost === 0 && handCard.id !== card.id)
      .map((handCard) => handCard.id);
    if (selectableHandCardIds.length === 0) return null;
    const bonusDamage = text.includes('ダメージ+40') ? 40 : 20;
    return {
      kind: 'optional_cost0_discard_for_attack_bonus',
      cardInstanceId: card.id,
      sourceCardName: card.name,
      sourceText: card.text,
      prompt: `手札のコスト0カード1枚を公開して捨てると、カードを1枚引き、このアタックのダメージが+${bonusDamage}されます。`,
      bonusDamage,
      drawCount: 1,
      selectableHandCardIds,
    };
  }
  return null;
};
"""
helper = insert_after + """

const queueSelfDiscardAfterDraw = (state: MatchState, card: Card, discardCount: number, deps: RuntimeDeps) => {
  const discardCountRemaining = Math.min(discardCount, state.self.hand.length);
  if (discardCountRemaining <= 0) {
    deps.log(`${card.name}: 捨てる手札がないため追加ディスカードはありません`);
    return false;
  }
  state.pendingChoice = {
    kind: 'self_discard_after_draw',
    cardInstanceId: card.id,
    sourceCardName: card.name,
    sourceText: card.text,
    prompt: discardCountRemaining > 1
      ? `手札を${discardCountRemaining}枚、順に選んで捨ててください。`
      : '手札を1枚選んで捨ててください。',
    discardCountRemaining,
    selectableHandCardIds: state.self.hand.map((handCard) => handCard.id),
  };
  deps.log(`${card.name}: 手札を${discardCountRemaining}枚選んで捨ててください`);
  return true;
};
"""
text = replace_once(text, insert_after, helper, str(path))

old = """const resolveNonAttackCardEffect = (state: MatchState, card: Card, deps: RuntimeDeps) => {
  const text = normalizeText(card.text);
  if (!applyPlayRestrictions(state, card, deps)) return;

  if (text.includes('すべてのプレイヤーはカードを1枚引く')) drawBothPlayers(state, 1, deps);
  if (text.includes('カードを3枚引く')) drawSelf(state, 3, deps);
  else if (text.includes('カードを2枚引く')) drawSelf(state, 2, deps);
  else if (text.includes('カードを1枚引く')) drawSelf(state, 1, deps);

  if (text.includes('カードを2枚引き、手札を2枚捨てる')) {
    discardFromHand(state.self, 2, state, deps);
  } else if (text.includes('カードを1枚引き、手札を1枚捨てる')) {
    discardFromHand(state.self, 1, state, deps);
  }
"""
new = """const resolveNonAttackCardEffect = (state: MatchState, card: Card, deps: RuntimeDeps) => {
  const text = normalizeText(card.text);
  if (!applyPlayRestrictions(state, card, deps)) return;

  const hasDrawTwoDiscardTwo = text.includes('カードを2枚引き、手札を2枚捨てる');
  const hasDrawOneDiscardOne = text.includes('カードを1枚引き、手札を1枚捨てる');

  if (text.includes('すべてのプレイヤーはカードを1枚引く')) drawBothPlayers(state, 1, deps);
  if (hasDrawTwoDiscardTwo) drawSelf(state, 2, deps);
  else if (text.includes('カードを3枚引く')) drawSelf(state, 3, deps);
  else if (hasDrawOneDiscardOne) drawSelf(state, 1, deps);
  else if (text.includes('カードを2枚引く')) drawSelf(state, 2, deps);
  else if (text.includes('カードを1枚引く')) drawSelf(state, 1, deps);

  if (hasDrawTwoDiscardTwo) {
    queueSelfDiscardAfterDraw(state, card, 2, deps);
  } else if (hasDrawOneDiscardOne) {
    queueSelfDiscardAfterDraw(state, card, 1, deps);
  }
"""
text = replace_once(text, old, new, str(path))

old = """  if (pendingChoice.kind === 'post_attack_self_discard') {
    const fallbackCardId = pendingChoice.selectableHandCardIds[0];
    const selectedCardId = payload.selectedCardId ?? fallbackCardId;
    const handIndex = state.self.hand.findIndex((card) => card.id === selectedCardId && pendingChoice.selectableHandCardIds.includes(card.id));
    if (handIndex < 0) {
      deps.log('捨てる手札を選択してください');
      return false;
    }
    const [discardedCard] = state.self.hand.splice(handIndex, 1);
    state.self.trash.push(discardedCard);
    state.cardsDiscardedThisTurn += 1;
    state.pendingChoice = undefined;
    deps.log(`${pendingChoice.sourceCardName}: アタック後に ${discardedCard.name} を捨てました`);
    return true;
  }

  return false;
};
"""
new = """  if (pendingChoice.kind === 'post_attack_self_discard') {
    const fallbackCardId = pendingChoice.selectableHandCardIds[0];
    const selectedCardId = payload.selectedCardId ?? fallbackCardId;
    const handIndex = state.self.hand.findIndex((card) => card.id === selectedCardId && pendingChoice.selectableHandCardIds.includes(card.id));
    if (handIndex < 0) {
      deps.log('捨てる手札を選択してください');
      return false;
    }
    const [discardedCard] = state.self.hand.splice(handIndex, 1);
    state.self.trash.push(discardedCard);
    state.cardsDiscardedThisTurn += 1;
    state.pendingChoice = undefined;
    deps.log(`${pendingChoice.sourceCardName}: アタック後に ${discardedCard.name} を捨てました`);
    return true;
  }

  if (pendingChoice.kind === 'self_discard_after_draw') {
    if (!payload.accept) {
      deps.log('このディスカード処理はスキップできません');
      return false;
    }
    const fallbackCardId = pendingChoice.selectableHandCardIds[0];
    const selectedCardId = payload.selectedCardId ?? fallbackCardId;
    const handIndex = state.self.hand.findIndex((card) => card.id === selectedCardId && pendingChoice.selectableHandCardIds.includes(card.id));
    if (handIndex < 0) {
      deps.log('捨てる手札を選択してください');
      return false;
    }
    const [discardedCard] = state.self.hand.splice(handIndex, 1);
    state.self.trash.push(discardedCard);
    state.cardsDiscardedThisTurn += 1;

    const remainingSelectableHandCardIds = state.self.hand.map((card) => card.id);
    const remainingDiscardCount = Math.min(
      pendingChoice.discardCountRemaining - 1,
      remainingSelectableHandCardIds.length,
    );

    if (remainingDiscardCount > 0) {
      state.pendingChoice = {
        ...pendingChoice,
        prompt: remainingDiscardCount > 1
          ? `手札を${remainingDiscardCount}枚、順に選んで捨ててください。`
          : '手札を1枚選んで捨ててください。',
        discardCountRemaining: remainingDiscardCount,
        selectableHandCardIds: remainingSelectableHandCardIds,
      };
      deps.log(`${pendingChoice.sourceCardName}: ${discardedCard.name} を捨てました（残り ${remainingDiscardCount} 枚）`);
      return true;
    }

    state.pendingChoice = undefined;
    deps.log(`${pendingChoice.sourceCardName}: ${discardedCard.name} を捨てて追加処理を完了しました`);
    return true;
  }

  return false;
};
"""
text = replace_once(text, old, new, str(path))
path.write_text(text)

# src/App.tsx
path = ROOT / 'src/App.tsx'
text = path.read_text()
old = """              <div className=\"section-header\">\n                <h2>{pendingChoice.sourceCardName} の任意効果</h2>\n              </div>\n"""
new = """              <div className=\"section-header\">\n                <h2>{pendingChoice.sourceCardName} の{pendingChoice.kind === 'self_discard_after_draw' || pendingChoice.kind === 'post_attack_self_discard' ? '追加処理' : '任意効果'}</h2>\n              </div>\n"""
text = replace_once(text, old, new, str(path))

old = """                  {pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus' ? '公開して捨てる候補' : '捨てる候補'}: {card.name} / コスト {card.cost}
"""
new = """                  {pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus' ? '公開して捨てる候補' : '捨てる候補'}: {card.name} / コスト {card.cost}
"""
# unchanged placeholder to keep replace_once pattern simple if needed
if old not in text:
    raise SystemExit('expected pending choice candidate label not found in App.tsx')

old = """                {pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus'
                  ? `選んだカードを公開して捨て、1枚引いて +${pendingChoice.bonusDamage}`
                  : pendingChoice.kind === 'post_attack_self_discard'
                    ? '選んだカードを捨てる'
                    : `選んだカードを捨てて +${pendingChoice.bonusDamage}`}
              </button>
              {pendingChoice.kind !== 'post_attack_self_discard' && (
                <button type="button" onClick={cancelPendingChoice}>通常解決</button>
              )}
"""
new = """                {pendingChoice.kind === 'optional_cost0_discard_for_attack_bonus'
                  ? `選んだカードを公開して捨て、1枚引いて +${pendingChoice.bonusDamage}`
                  : pendingChoice.kind === 'post_attack_self_discard' || pendingChoice.kind === 'self_discard_after_draw'
                    ? pendingChoice.kind === 'self_discard_after_draw'
                      ? `選んだカードを捨てる（残り ${pendingChoice.discardCountRemaining} 枚）`
                      : '選んだカードを捨てる'
                    : `選んだカードを捨てて +${pendingChoice.bonusDamage}`}
              </button>
              {pendingChoice.kind !== 'post_attack_self_discard' && pendingChoice.kind !== 'self_discard_after_draw' && (
                <button type="button" onClick={cancelPendingChoice}>通常解決</button>
              )}
"""
text = replace_once(text, old, new, str(path))

old = """          <HandPanel
            cards={state.self.hand}
            disabled={state.pendingDiscardCount > 0 || Boolean(state.winner)}
            onUseCard={playHandCard}
            onPreviewCard={(card) => openPreview(card, '手札カード詳細', { type: 'play-hand', cardId: card.id })}
          />
"""
new = """          <HandPanel
            cards={state.self.hand}
            disabled={state.pendingDiscardCount > 0 || Boolean(state.winner) || Boolean(state.pendingChoice)}
            onUseCard={playHandCard}
            onPreviewCard={(card) => openPreview(card, '手札カード詳細', { type: 'play-hand', cardId: card.id })}
          />
"""
text = replace_once(text, old, new, str(path))
path.write_text(text)

# src/store/gameStore.ts
path = ROOT / 'src/store/gameStore.ts'
text = path.read_text()
old = """          const resolutionMessage = previousState.pendingChoice?.kind === 'post_attack_self_discard'
            ? '保留中のアタック後ディスカードを解決しました'
            : payload.accept
              ? '保留中の任意効果を解決しました'
              : '保留中の任意効果をスキップして解決しました';
"""
new = """          const resolutionMessage = previousState.pendingChoice?.kind === 'post_attack_self_discard'
            ? '保留中のアタック後ディスカードを解決しました'
            : previousState.pendingChoice?.kind === 'self_discard_after_draw'
              ? '保留中のプレイ時ディスカードを解決しました'
              : payload.accept
                ? '保留中の任意効果を解決しました'
                : '保留中の任意効果をスキップして解決しました';
"""
text = replace_once(text, old, new, str(path))
path.write_text(text)

print('Phase 5 pending choice updates applied successfully.')
