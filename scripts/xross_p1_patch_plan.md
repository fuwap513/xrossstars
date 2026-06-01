# Xross Stars P1実装パッチ計画

P1 16枚を、**共通ロジックの追加 → 個別カードの適用 → UI選択導線追加 → テスト** の順で実装するための実務用パッチ計画です。現行コードの実装地点は `src/store/battleEffects.ts` と `src/App.tsx` を前提にしています。

---

## 目的

- 未対応P1 16枚を、個別ベタ書きではなく**共通フック**で処理する
- 「任意で捨てる」「公開する」「山上を見る」などの**プレイヤー選択**を、現在の自動解決から切り離す
- 公式大会練習向けに、**ログで何を選んだか明示**できる状態にする

---

## 最重要の現状課題

現在の `src/store/battleEffects.ts` では、`getAttackBonusFromText()` 内で一部の任意効果を**自動で実行**しています。

例:
- `手札を1枚捨ててもよい。そうしたならダメージ+20。`
- `コスト0のカード1枚を公開し、捨ててもよい。そうしたなら…`

このままだと、
- 「やらない」選択ができない
- どのカードを公開/捨てたかをUIで選べない
- 練習用途として判断検証が弱い

ので、**前処理アクション要求 → UI選択 → 確定後に打点計算** の3段構造へ変えるのが先決です。

---

## 共通設計の追加方針

### 1. battleEffects.ts に追加する型

```ts
export type PendingBattleChoice =
  | {
      kind: 'optional_discard_for_attack_bonus';
      cardInstanceId: string;
      sourceText: string;
      discardCount: 1;
      bonusDamage: number;
      selectableHandCardIds: string[];
    }
  | {
      kind: 'optional_cost0_discard_for_attack_bonus';
      cardInstanceId: string;
      sourceText: string;
      discardCount: 1;
      bonusDamage: number;
      drawCount: number;
      selectableHandCardIds: string[];
    }
  | {
      kind: 'peek_topdeck_optional_trash';
      cardInstanceId: string;
      sourceText: string;
      revealedCardId?: string;
    };
```

### 2. MatchState に追加する状態

```ts
pendingChoice?: PendingBattleChoice;
pendingChoiceSourceCardId?: string;
```

### 3. GameStore に追加する操作

```ts
resolvePendingChoice: (payload: {
  accept: boolean;
  selectedCardIds?: string[];
}) => void;
cancelPendingChoice: () => void;
```

### 4. UI側で追加するもの

- 任意効果確認モーダル
- 手札から対象カードを選ぶUI
- 山上確認モーダル
- 実行ログ
  - 例: `大黒柱: 手札1枚を捨てて打点+20を選択`
  - 例: `CLUTCH!!!: コスト0カードを捨てず通常解決`

---

## 実装順（推奨）

---

## Phase 1: 任意ディスカード→打点上昇 共通化
対象:
- BP01-020/100 大黒柱
- BP01-040/100 Lastman Standing

### 変更箇所
- `src/store/battleEffects.ts`
- `src/types/game.ts`
- `src/store/gameStore.ts`
- `src/App.tsx`

### パッチ内容
1. `getAttackBonusFromText()` から以下の自動処理を削除
   - `手札を1枚捨ててもよい。そうしたならダメージ+20`
2. 新関数追加
   - `buildPreAttackChoice(state, card): PendingBattleChoice | null`
3. `resolveAttackCard()` 冒頭で choice 要求を返せるよう変更
4. `playHandCardRuntime()` は pendingChoice が必要なら**攻撃をまだ確定しない**
5. `resolvePendingChoice()` で
   - selected card discard
   - bonusDamage を一時変数へ反映
   - その後 attack 実行

### 実装完了条件
- 手札があるときだけ選択UIが出る
- 「捨てない」を選べる
- 捨てたときのみ +20
- ログが残る

### テスト
- 手札0枚で通常攻撃
- 手札1枚で yes / no 両方
- リーサル時に打点差が正しく反映される

---

## Phase 2: コスト0公開/捨て→ドロー+打点 共通化
対象:
- BP01-026/100 CLUTCH!!!
- BP01-134/100 CLUTCH!!!
- BP03-030/081 セルフ実況

### 変更箇所
- `src/store/battleEffects.ts`
- `src/types/game.ts`
- `src/store/gameStore.ts`
- `src/App.tsx`

### パッチ内容
1. `getAttackBonusFromText()` から以下の自動処理を削除
   - `自分の手札のコスト0のカード1枚を公開し、捨ててもよい`
2. `PendingBattleChoice.kind = 'optional_cost0_discard_for_attack_bonus'` を利用
3. selectable targets は `state.self.hand.filter(card => card.cost === 0)`
4. accept 時に
   - 選択カードを discard
   - `CLUTCH!!!` は 1ドロー +40
   - `セルフ実況` は 1ドロー +20
5. no / 対象なし のときは通常攻撃へ

### 実装完了条件
- コスト0カードがないと choice が出ない
- コスト0カードが複数あると選べる
- 捨てたときだけドローと加点
- ログに「何を捨てたか」が出る

### テスト
- コスト0なし
- コスト0が1枚
- コスト0が2枚以上
- 使う/使わない
- 1ドロー後の手札枚数確認

---

## Phase 3A: アタック後 全員ディスカード
対象:
- BP01-032/100 ドリル開錠

### 変更箇所
- `src/store/battleEffects.ts`

### パッチ内容
1. `runPostAttackEffects()` に個別条件追加
2. `すべてのプレイヤーは手札を1枚捨てる。` を**attack後確定処理**として実行
3. 自分側は UI 選択式にするか、暫定で先頭捨てにせず `pendingChoice` を追加する

### 推奨
大会練習用途なら**自分の手札は選択式**が必要。
相手は簡易AIなら先頭/ランダムでもよいが、後でAI戦略ルールを入れ替えられるよう関数分離する。

### テスト
- 自分の手札1枚以上 / 0枚
- 相手手札1枚以上 / 0枚
- attack後にだけ動くこと

---

## Phase 3B: メモリア総コスト参照ドロー
対象:
- BP03-024/081 頂きの景色
- BP03-107/081 頂きの景色

### 変更箇所
- `src/store/battleEffects.ts`

### パッチ内容
1. `sumFieldMemoriaCost(state)` は既存利用可能
2. `runPostAttackEffects()` で個別分岐追加
3. attack後に `drawSelf(state, sumFieldMemoriaCost(state), deps)` を実行
4. 「この attack 自身の左/右に置かれたカードの扱い」を要確認ログ付きで実装

### テスト
- メモリア0枚
- メモリア2枚/合計3コスト
- 多数展開時の大量ドロー

---

## Phase 4: アタックカード自身が次アタック強化を付与
対象:
- BP02-043/082 マウントタックル

### 変更箇所
- `src/store/battleEffects.ts`

### パッチ内容
1. `runPostAttackEffects()` または `resolveAttackCard()` の attack 解決後に
   - `state.nextAttackBuff += 20`
2. ログ追加
   - `マウントタックル: 次のアタック +20`

### 注意
このカード自身のダメージには載せず、**次のアタック**にのみ載せる。

### テスト
- 直後の次の attack にだけ +20
- ターン終了でリセットされること

---

## Phase 5A: 2ドロー2ディスカード + 次アタック+30
対象:
- BP01-063/100 苦難の昇格
- BP01-072/100 花火づくり

### 変更箇所
- `src/store/battleEffects.ts`
- `src/App.tsx`（自分の2枚捨て選択をUI化するなら）

### パッチ内容
1. `resolveNonAttackCardEffect()` で複合効果を順番通り解決
   - 2 draw
   - 2 discard
   - nextAttackBuff +30
2. discard を選択式にするなら pendingChoice を `memoria_discard_after_draw` として追加

### テスト
- 2ドロー後に2枚捨てる
- 次 attack に +30
- 手札不足時の処理

---

## Phase 5B: 単体30回復 + 次アタック+30
対象:
- BP02-047/082 ケーキのおうち
- BP03-054/081 闇の加護

### 変更箇所
- `src/store/battleEffects.ts`

### パッチ内容
1. `resolveNonAttackCardEffect()` で
   - selected leader 30 heal
   - nextAttackBuff +30
2. 将来的には healing target を UI 選択対応
   - 暫定は activeLeader 対象でもよいが練習用なら選択対応が望ましい

### テスト
- 被ダメあり/なし
- 次 attack に +30

---

## Phase 5C: 1ドロー1ディスカード
対象:
- BP02-054/082 焦土の王者

### 変更箇所
- `src/store/battleEffects.ts`
- `src/App.tsx`（選択式にするなら）

### パッチ内容
1. `resolveNonAttackCardEffect()` で
   - 1 draw
   - 1 discard
2. discard 対象はプレイヤー選択式にする

### テスト
- 1ドロー後に任意1枚捨てる
- hand count が正しい

---

## Phase 6: 山上1枚確認→任意トラッシュ + 次アタック+10
対象:
- BP01-069/100 運もミスもない

### 変更箇所
- `src/store/battleEffects.ts`
- `src/store/gameStore.ts`
- `src/App.tsx`

### パッチ内容
1. `pendingChoice.kind = 'peek_topdeck_optional_trash'` を追加
2. memoria 解決時に deck top を reveal 状態で一時保持
3. UIで
   - 残す
   - トラッシュに置く
   を選択
4. choice 解決後に `state.nextAttackBuff += 10`

### テスト
- 山札あり
- 山札0枚
- 残す/捨てる 両方

---

## Phase 7: 同名カード参照のコスト踏み倒し + 次アタック+40
対象:
- BP01-084/100 引っ張り合い

### 変更箇所
- `src/store/battleEffects.ts`

### パッチ内容
1. 既存 `canPlayWithoutCost()` を利用/拡張
2. 同名1枚なら cost 0
3. 2枚以上なら通常コスト
4. 解決後に `state.nextAttackBuff += 40`

### テスト
- field に同名0枚
- 同名1枚
- 同名2枚以上

---

## 先に追加すべき共通ヘルパー

### battleEffects.ts
- `buildPreAttackChoice()`
- `buildMemoriaChoice()`
- `applyResolvedChoice()`
- `discardSelectedCards()`
- `revealTopDeckCard()`
- `consumePendingAttackBonus()`

### gameStore.ts
- `resolvePendingChoice()`
- `cancelPendingChoice()`

### App.tsx
- `PendingChoiceModal`
- 手札選択UI
- 山札1枚確認UI

---

## 推奨コミット分割

1. `feat: add pending battle choice state and resolver`
2. `feat: implement optional discard attack bonus cards`
3. `feat: implement cost0 reveal discard attack bonus cards`
4. `feat: implement post-attack discard and memoria-cost draw cards`
5. `feat: implement composite memoria P1 cards`
6. `feat: implement top-deck peek and same-name free-play cards`
7. `test: add P1 regression scenarios`

---

## 完了判定

P1完了の条件は以下です。

- 16枚すべてが `未対応` から外れる
- 任意効果に yes/no がある
- 公開/捨てる対象を選べる
- ログで選択内容が追える
- 直後の nextAttackBuff / draw / discard / heal が再現される
- 既存ビルドが通る

---

## 実装の次の一手

最初に着手するなら **Phase 1 → Phase 2** です。

理由:
- `getAttackBonusFromText()` の自動処理を除去できる
- 今後の任意選択系カードの土台になる
- 実戦練習で重要な「選ばされる判断」を再現できる
