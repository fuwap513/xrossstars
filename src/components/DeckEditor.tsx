import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  exportCardCatalogData,
  getDeckEntryCount,
  getDeckTotal,
  getMainCardCatalog,
  getTacticCardCatalog,
} from '../data/cards';
import FieldCardTile from './FieldCardTile';
import type {
  Card,
  CardType,
  DeckConfig,
  DeckGroup,
  DeckImportExportData,
  DeckPreset,
  EffectType,
  RegisteredCard,
} from '../types/game';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

type CardFormState = {
  id: string;
  name: string;
  deckGroup: DeckGroup;
  type: CardType;
  cost: string;
  power: string;
  effectType: EffectType;
  effectValue: string;
  text: string;
  maxCopies: string;
  expansion: string;
  tags: string;
  sortOrder: string;
};

type Props = {
  cardCatalog: RegisteredCard[];
  deckConfig: DeckConfig;
  savedPresets: DeckPreset[];
  mainTotal: number;
  tacticsTotal: number;
  onMainChange: (cardId: string, delta: number) => void;
  onTacticChange: (cardId: string, delta: number) => void;
  onReset: () => void;
  onApplyFirst: () => void;
  onApplySecond: () => void;
  onPreviewCard: (card: Card) => void;
  onSavePreset: (name?: string) => void;
  onOverwritePreset: (presetId: string) => void;
  onRenamePreset: (presetId: string, nextName: string) => boolean;
  onMovePreset: (presetId: string, direction: 'up' | 'down') => void;
  onLoadPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onImportJson: (payload: unknown) => boolean;
  onImportCardCatalog: (payload: unknown) => boolean;
  onResetCardCatalog: () => void;
  onUpsertCard: (payload: unknown) => boolean;
  onDeleteCard: (cardId: string) => boolean;
  requestConfirm: (options: ConfirmOptions) => Promise<boolean>;
};

const CARD_TYPE_OPTIONS: Array<{ value: CardType; label: string }> = [
  { value: 'attack', label: 'アタック' },
  { value: 'memoria', label: 'メモリア' },
  { value: 'tactics', label: 'タクティクス' },
  { value: 'equipment', label: '装備' },
];

const EFFECT_TYPE_OPTIONS: Array<{ value: EffectType; label: string }> = [
  { value: 'none', label: 'なし' },
  { value: 'nextAttackBuff', label: '次回アタック強化' },
  { value: 'turnAttackBuff', label: 'ターン中アタック強化' },
  { value: 'heal', label: '回復' },
  { value: 'directDamage', label: '直接ダメージ' },
  { value: 'equipmentAttackBuff', label: '装備アタック強化' },
];

const SEARCH_TYPE_OPTIONS: Array<{ value: 'all' | CardType; label: string }> = [
  { value: 'all', label: '全タイプ' },
  { value: 'attack', label: 'アタック' },
  { value: 'memoria', label: 'メモリア' },
  { value: 'tactics', label: 'タクティクス' },
  { value: 'equipment', label: '装備' },
  { value: 'leader', label: 'リーダー' },
  { value: 'pp', label: 'PP' },
];

const createInitialCardForm = (deckGroup: DeckGroup = 'main'): CardFormState => ({
  id: '',
  name: '',
  deckGroup,
  type: deckGroup === 'main' ? 'attack' : 'tactics',
  cost: deckGroup === 'main' ? '1' : '0',
  power: deckGroup === 'main' ? '30' : '',
  effectType: deckGroup === 'main' ? 'none' : 'nextAttackBuff',
  effectValue: '0',
  text: '',
  maxCopies: deckGroup === 'main' ? '4' : '5',
  expansion: 'USER',
  tags: '',
  sortOrder: '',
});

const cardToFormState = (card: RegisteredCard): CardFormState => ({
  id: card.id,
  name: card.name,
  deckGroup: card.deckGroup,
  type: card.type,
  cost: String(card.cost),
  power: typeof card.power === 'number' ? String(card.power) : '',
  effectType: card.effectType,
  effectValue: String(card.effectValue),
  text: card.text,
  maxCopies: String(card.maxCopies),
  expansion: card.expansion ?? '',
  tags: card.tags?.join(', ') ?? '',
  sortOrder: String(card.sortOrder),
});

const createSuggestedCardId = (name: string, deckGroup: DeckGroup, type: CardType) => {
  const normalizedName = name
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const suffix = normalizedName || `${type}-${Date.now()}`;
  return `user-${deckGroup}-${suffix}`;
};

const getFieldAccent = (card: Pick<RegisteredCard, 'type'>): 'default' | 'equipment' => (
  card.type === 'equipment' ? 'equipment' : 'default'
);

export default function DeckEditor({
  cardCatalog,
  deckConfig,
  savedPresets,
  mainTotal,
  tacticsTotal,
  onMainChange,
  onTacticChange,
  onReset,
  onApplyFirst,
  onApplySecond,
  onPreviewCard,
  onSavePreset,
  onOverwritePreset,
  onRenamePreset,
  onMovePreset,
  onLoadPreset,
  onDeletePreset,
  onImportJson,
  onImportCardCatalog,
  onResetCardCatalog,
  onUpsertCard,
  onDeleteCard,
  requestConfirm,
}: Props) {
  const [presetName, setPresetName] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importStatus, setImportStatus] = useState<'ok' | 'ng' | ''>('');
  const [presetMessage, setPresetMessage] = useState('');
  const [presetStatus, setPresetStatus] = useState<'ok' | 'ng' | ''>('');
  const [cardCatalogMessage, setCardCatalogMessage] = useState('');
  const [cardCatalogStatus, setCardCatalogStatus] = useState<'ok' | 'ng' | ''>('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(cardCatalog[0]?.id ?? null);
  const [cardForm, setCardForm] = useState<CardFormState>(() => createInitialCardForm('main'));
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogGroupFilter, setCatalogGroupFilter] = useState<'all' | DeckGroup>('all');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'all' | CardType>('all');

  const mainRemaining = 50 - mainTotal;
  const tacticsRemaining = 5 - tacticsTotal;
  const isValid = mainTotal === 50 && tacticsTotal === 5;
  const normalizedPresetName = presetName.trim();
  const matchedPreset = normalizedPresetName
    ? savedPresets.find((preset) => preset.name === normalizedPresetName)
    : undefined;
  const previewPreset = previewPresetId
    ? savedPresets.find((preset) => preset.id === previewPresetId) ?? null
    : null;

  const mainCardCatalog = useMemo(() => getMainCardCatalog(cardCatalog), [cardCatalog]);
  const tacticCardCatalog = useMemo(() => getTacticCardCatalog(cardCatalog), [cardCatalog]);
  const cardLookup = useMemo(() => Object.fromEntries(cardCatalog.map((card) => [card.id, card])) as Record<string, RegisteredCard>, [cardCatalog]);
  const selectedCatalogCard = selectedCardId ? cardLookup[selectedCardId] ?? null : null;

  useEffect(() => {
    if (selectedCatalogCard) {
      setCardForm(cardToFormState(selectedCatalogCard));
      return;
    }
    if (cardCatalog.length > 0) {
      const fallbackCard = cardCatalog[0];
      setSelectedCardId(fallbackCard.id);
      setCardForm(cardToFormState(fallbackCard));
      return;
    }
    setCardForm(createInitialCardForm('main'));
  }, [cardCatalog, selectedCatalogCard]);

  useEffect(() => {
    setCardForm((current) => {
      const nextType = current.deckGroup === 'main'
        ? (current.type === 'tactics' || current.type === 'equipment' ? 'attack' : current.type)
        : (current.type === 'attack' || current.type === 'memoria' ? 'tactics' : current.type);
      const nextMaxCopies = current.maxCopies || (current.deckGroup === 'main' ? '4' : '5');
      const nextCost = current.deckGroup === 'tactics' && current.cost.trim() === '' ? '0' : current.cost;
      return {
        ...current,
        type: nextType,
        maxCopies: nextMaxCopies,
        cost: nextCost,
      };
    });
  }, [cardForm.deckGroup]);

  const attackCount = mainCardCatalog
    .filter((card) => card.type === 'attack')
    .reduce((sum, card) => sum + getDeckEntryCount(deckConfig.main, card.id), 0);
  const memoriaCount = mainCardCatalog
    .filter((card) => card.type === 'memoria')
    .reduce((sum, card) => sum + getDeckEntryCount(deckConfig.main, card.id), 0);
  const oneCostCount = mainCardCatalog
    .filter((card) => card.cost === 1)
    .reduce((sum, card) => sum + getDeckEntryCount(deckConfig.main, card.id), 0);
  const twoCostCount = mainCardCatalog
    .filter((card) => card.cost === 2)
    .reduce((sum, card) => sum + getDeckEntryCount(deckConfig.main, card.id), 0);
  const averageCost = mainTotal > 0
    ? (mainCardCatalog.reduce((sum, card) => sum + (getDeckEntryCount(deckConfig.main, card.id) * card.cost), 0) / mainTotal).toFixed(2)
    : '0.00';
  const directDamageSources = cardCatalog
    .filter((card) => card.effectType === 'directDamage')
    .reduce((sum, card) => sum + getDeckEntryCount(card.deckGroup === 'main' ? deckConfig.main : deckConfig.tactics, card.id), 0);
  const recoverySources = cardCatalog
    .filter((card) => card.effectType === 'heal')
    .reduce((sum, card) => sum + getDeckEntryCount(card.deckGroup === 'main' ? deckConfig.main : deckConfig.tactics, card.id), 0);
  const buffSources = cardCatalog
    .filter((card) => card.effectType === 'nextAttackBuff' || card.effectType === 'turnAttackBuff' || card.effectType === 'equipmentAttackBuff')
    .reduce((sum, card) => sum + getDeckEntryCount(card.deckGroup === 'main' ? deckConfig.main : deckConfig.tactics, card.id), 0);

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = catalogSearch.trim().toLowerCase();
    return cardCatalog.filter((card) => {
      if (catalogGroupFilter !== 'all' && card.deckGroup !== catalogGroupFilter) return false;
      if (catalogTypeFilter !== 'all' && card.type !== catalogTypeFilter) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        card.id,
        card.name,
        card.text,
        card.expansion ?? '',
        ...(card.tags ?? []),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [cardCatalog, catalogGroupFilter, catalogSearch, catalogTypeFilter]);

  const showPresetStatus = (status: 'ok' | 'ng', message: string) => {
    setPresetStatus(status);
    setPresetMessage(message);
  };

  const showCatalogStatus = (status: 'ok' | 'ng', message: string) => {
    setCardCatalogStatus(status);
    setCardCatalogMessage(message);
  };

  const updateCardForm = <K extends keyof CardFormState,>(key: K, value: CardFormState[K]) => {
    setCardForm((current) => ({ ...current, [key]: value }));
  };

  const startNewCard = (deckGroup: DeckGroup) => {
    setSelectedCardId(null);
    setCardForm(createInitialCardForm(deckGroup));
    showCatalogStatus('ok', `${deckGroup === 'main' ? 'メイン' : 'タクティクス'}用の新規カード入力に切り替えました`);
  };

  const handleSelectCatalogCard = (card: RegisteredCard) => {
    setSelectedCardId(card.id);
    setCardForm(cardToFormState(card));
    setCardCatalogStatus('');
    setCardCatalogMessage('');
  };

  const handleResetDeck = async () => {
    const confirmed = await requestConfirm({
      title: '初期構成に戻す',
      message: '現在のデッキ編集中の内容を破棄して、推奨初期構成に戻します。よろしいですか？',
      confirmLabel: '初期構成に戻す',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    onReset();
  };

  const handleResetCardCatalog = async () => {
    const confirmed = await requestConfirm({
      title: 'カードマスタを初期化',
      message: '追加登録したカード定義を破棄し、標準カード定義へ戻します。よろしいですか？',
      confirmLabel: '初期化する',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    onResetCardCatalog();
    showCatalogStatus('ok', 'カードマスタを初期状態へ戻しました');
  };

  const handleSavePreset = async () => {
    if (matchedPreset) {
      const confirmed = await requestConfirm({
        title: 'プリセットを上書き保存',
        message: `「${matchedPreset.name}」を現在の構成で上書き保存します。よろしいですか？`,
        confirmLabel: '上書き保存する',
        cancelLabel: 'キャンセル',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    onSavePreset(normalizedPresetName || undefined);
    setPresetName('');
    showPresetStatus('ok', matchedPreset ? 'プリセットを上書き保存しました' : 'プリセットを保存しました');
  };

  const handleOverwritePreset = async (presetId: string, presetNameValue: string) => {
    const confirmed = await requestConfirm({
      title: 'プリセット上書き保存',
      message: `プリセット「${presetNameValue}」を現在の構成で上書きします。よろしいですか？`,
      confirmLabel: '上書き保存する',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    onOverwritePreset(presetId);
    showPresetStatus('ok', `「${presetNameValue}」を上書き保存しました`);
  };

  const handleRenamePreset = (presetId: string) => {
    const trimmedName = editingPresetName.trim();
    if (!trimmedName) {
      showPresetStatus('ng', 'プリセット名を入力してください');
      return;
    }

    const success = onRenamePreset(presetId, trimmedName);
    if (!success) {
      showPresetStatus('ng', '同名のプリセットがあるため名前を変更できません');
      return;
    }

    setEditingPresetId(null);
    setEditingPresetName('');
    showPresetStatus('ok', `プリセット名を「${trimmedName}」に変更しました`);
  };

  const handleDeletePreset = async (presetId: string, presetNameValue: string) => {
    const confirmed = await requestConfirm({
      title: 'プリセット削除',
      message: `プリセット「${presetNameValue}」を削除します。この操作は元に戻せません。よろしいですか？`,
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;
    onDeletePreset(presetId);
    if (editingPresetId === presetId) {
      setEditingPresetId(null);
      setEditingPresetName('');
    }
    if (previewPresetId === presetId) {
      setPreviewPresetId(null);
    }
    showPresetStatus('ok', `「${presetNameValue}」を削除しました`);
  };

  const handleMovePreset = (presetId: string, direction: 'up' | 'down', presetNameValue: string) => {
    onMovePreset(presetId, direction);
    showPresetStatus('ok', `「${presetNameValue}」を${direction === 'up' ? '上へ' : '下へ'}移動しました`);
  };

  const handleExportJson = () => {
    const payload: DeckImportExportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      deckConfig,
      savedPresets,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `xrossstars-deck-data-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setImportStatus('ok');
    setImportMessage('JSONを書き出しました');
  };

  const handleExportCardCatalog = () => {
    const payload = exportCardCatalogData(cardCatalog);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `xrossstars-card-catalog-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showCatalogStatus('ok', 'カードマスタJSONを書き出しました');
  };

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = await requestConfirm({
      title: 'JSON読み込み',
      message: '現在のデッキ構成は読み込んだJSONで置き換わります。続行しますか？',
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
      const success = onImportJson(parsed);
      setImportStatus(success ? 'ok' : 'ng');
      setImportMessage(success ? 'JSONを読み込みました' : 'JSON形式が不正です');
    } catch {
      setImportStatus('ng');
      setImportMessage('JSONの読み込みに失敗しました');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportOfficialCardCatalog = async () => {
    const confirmed = await requestConfirm({
      title: '公式カードデータ読込',
      message: '第1弾〜第3弾の公式カードデータをカードマスタへ追加します。既存カードと同じIDは上書きされます。続行しますか？',
      confirmLabel: '読み込む',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const response = await fetch('/data/xrossstars-bp01-bp03-official-cards.json');
      if (!response.ok) throw new Error('fetch_failed');
      const parsed = await response.json();
      const success = onImportCardCatalog(parsed);
      showCatalogStatus(success ? 'ok' : 'ng', success ? '公式カードデータ（第1弾〜第3弾）を読み込みました' : '公式カードデータの形式が不正です');
    } catch {
      showCatalogStatus('ng', '公式カードデータの読み込みに失敗しました');
    }
  };

  const handleImportCardCatalog = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = await requestConfirm({
      title: 'カードマスタ読み込み',
      message: 'カード定義を追加 / 上書きします。既存カードと同じIDは上書きされます。続行しますか？',
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
      const success = onImportCardCatalog(parsed);
      showCatalogStatus(success ? 'ok' : 'ng', success ? 'カードマスタを読み込みました' : 'カードマスタ形式が不正です');
    } catch {
      showCatalogStatus('ng', 'カードマスタの読み込みに失敗しました');
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveCard = async () => {
    const normalizedId = cardForm.id.trim() || createSuggestedCardId(cardForm.name, cardForm.deckGroup, cardForm.type);
    const payload = {
      id: normalizedId,
      name: cardForm.name.trim(),
      deckGroup: cardForm.deckGroup,
      type: cardForm.type,
      cost: Number(cardForm.cost || 0),
      power: cardForm.power.trim() ? Number(cardForm.power) : undefined,
      effectType: cardForm.effectType,
      effectValue: Number(cardForm.effectValue || 0),
      text: cardForm.text.trim(),
      maxCopies: Number(cardForm.maxCopies || (cardForm.deckGroup === 'main' ? 4 : 5)),
      expansion: cardForm.expansion.trim() || undefined,
      tags: cardForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      sortOrder: cardForm.sortOrder.trim() ? Number(cardForm.sortOrder) : undefined,
    };

    const isExistingCard = Boolean(cardLookup[normalizedId]);
    if (isExistingCard) {
      const confirmed = await requestConfirm({
        title: 'カード定義を上書き',
        message: `カードID「${normalizedId}」は既に存在します。内容を上書きしますか？`,
        confirmLabel: '上書きする',
        cancelLabel: 'キャンセル',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    const success = onUpsertCard(payload);
    if (!success) {
      showCatalogStatus('ng', 'カード登録に失敗しました。必須項目や数値を確認してください');
      return;
    }

    setSelectedCardId(normalizedId);
    setCardForm((current) => ({ ...current, id: normalizedId }));
    showCatalogStatus('ok', isExistingCard ? `カード定義を更新しました: ${payload.name}` : `カードを登録しました: ${payload.name}`);
  };

  const handleDeleteCard = async () => {
    if (!selectedCatalogCard) {
      showCatalogStatus('ng', '削除対象のカードを選択してください');
      return;
    }

    const confirmed = await requestConfirm({
      title: 'カード削除',
      message: `「${selectedCatalogCard.name}」をカードマスタから削除します。デッキやプリセット内の同カードも除外されます。よろしいですか？`,
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    });
    if (!confirmed) return;

    const success = onDeleteCard(selectedCatalogCard.id);
    if (!success) {
      showCatalogStatus('ng', 'カード削除に失敗しました');
      return;
    }

    const remainingCards = cardCatalog.filter((card) => card.id !== selectedCatalogCard.id);
    setSelectedCardId(remainingCards[0]?.id ?? null);
    setCardForm(createInitialCardForm('main'));
    showCatalogStatus('ok', `カードを削除しました: ${selectedCatalogCard.name}`);
  };

  return (
    <main className="deck-editor-grid">
      <section className="panel deck-editor-wide">
        <div className="section-header">
          <h2>デッキ編集</h2>
          <span>メイン50枚 / タクティクス5枚</span>
        </div>
        <div className="deck-summary-grid">
          <div className="status-card compact-card">
            <div>メイン合計</div>
            <strong>{mainTotal} / 50</strong>
          </div>
          <div className="status-card compact-card">
            <div>残り</div>
            <strong>{mainRemaining}</strong>
          </div>
          <div className="status-card compact-card">
            <div>タクティクス合計</div>
            <strong>{tacticsTotal} / 5</strong>
          </div>
          <div className="status-card compact-card">
            <div>残り</div>
            <strong>{tacticsRemaining}</strong>
          </div>
        </div>
        <div className={`validation-banner ${isValid ? 'ok' : 'ng'}`}>
          {isValid ? '開始可能な構成です' : '50枚 / 5枚 になるように調整してください'}
        </div>
        <div className="action-row wrap-actions top-gap">
          <button onClick={onApplyFirst} disabled={!isValid}>この構成で先攻開始</button>
          <button onClick={onApplySecond} disabled={!isValid}>この構成で後攻開始</button>
          <button className="ghost-button" onClick={() => void handleResetDeck()}>推奨初期構成に戻す</button>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <h2>カードマスタ管理</h2>
          <span>新規カード追加・更新・JSON同期</span>
        </div>
        <div className="deck-summary-grid top-gap">
          <div className="status-card compact-card">
            <div>登録カード総数</div>
            <strong>{cardCatalog.length}</strong>
          </div>
          <div className="status-card compact-card">
            <div>メイン候補</div>
            <strong>{mainCardCatalog.length}</strong>
          </div>
          <div className="status-card compact-card">
            <div>タクティクス候補</div>
            <strong>{tacticCardCatalog.length}</strong>
          </div>
          <div className="status-card compact-card">
            <div>運用方式</div>
            <strong>UI + JSON</strong>
          </div>
        </div>
        <div className="action-row wrap-actions top-gap">
          <button onClick={handleExportCardCatalog}>カードマスタを書き出す</button>
          <label className="file-import-button">
            カードマスタを読み込む
            <input type="file" accept="application/json,.json" onChange={handleImportCardCatalog} />
          </label>
          <button onClick={() => void handleImportOfficialCardCatalog()}>公式1〜3弾を読み込む</button>
          <button className="ghost-button" onClick={() => startNewCard('main')}>新規メインカード</button>
          <button className="ghost-button" onClick={() => startNewCard('tactics')}>新規タクティクス</button>
          <button className="ghost-button" onClick={() => void handleResetCardCatalog()}>標準マスタへ戻す</button>
        </div>
        <div className="preset-hint">新カードは画面から直接登録できます。複数追加したい場合はカードマスタJSONの `cards` 配列でも一括管理できます。</div>
        {cardCatalogMessage && <div className={`import-status ${cardCatalogStatus}`}>{cardCatalogMessage}</div>}
      </section>

      <section className="panel deck-editor-wide">
        <div className="section-header">
          <h2>カード登録 / 編集</h2>
          <span>{selectedCatalogCard ? `編集中: ${selectedCatalogCard.name}` : '新規カード入力'}</span>
        </div>
        <div className="catalog-form-grid top-gap">
          <label className="form-field">
            <span>カードID</span>
            <input className="preset-name-input" value={cardForm.id} placeholder="空欄なら自動生成" onChange={(event) => updateCardForm('id', event.target.value)} />
          </label>
          <label className="form-field">
            <span>カード名</span>
            <input className="preset-name-input" value={cardForm.name} placeholder="例: 星巡りの一閃" onChange={(event) => updateCardForm('name', event.target.value)} />
          </label>
          <label className="form-field">
            <span>デッキ種別</span>
            <select className="form-select" value={cardForm.deckGroup} onChange={(event) => updateCardForm('deckGroup', event.target.value as DeckGroup)}>
              <option value="main">メイン</option>
              <option value="tactics">タクティクス</option>
            </select>
          </label>
          <label className="form-field">
            <span>カードタイプ</span>
            <select className="form-select" value={cardForm.type} onChange={(event) => updateCardForm('type', event.target.value as CardType)}>
              {CARD_TYPE_OPTIONS
                .filter((option) => (cardForm.deckGroup === 'main'
                  ? option.value === 'attack' || option.value === 'memoria'
                  : option.value === 'tactics' || option.value === 'equipment'))
                .map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
          </label>
          <label className="form-field">
            <span>コスト</span>
            <input className="preset-name-input" type="number" min="0" value={cardForm.cost} onChange={(event) => updateCardForm('cost', event.target.value)} />
          </label>
          <label className="form-field">
            <span>パワー</span>
            <input className="preset-name-input" type="number" min="0" value={cardForm.power} placeholder="攻撃札のみ" onChange={(event) => updateCardForm('power', event.target.value)} />
          </label>
          <label className="form-field">
            <span>効果種別</span>
            <select className="form-select" value={cardForm.effectType} onChange={(event) => updateCardForm('effectType', event.target.value as EffectType)}>
              {EFFECT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>効果量</span>
            <input className="preset-name-input" type="number" value={cardForm.effectValue} onChange={(event) => updateCardForm('effectValue', event.target.value)} />
          </label>
          <label className="form-field">
            <span>最大採用枚数</span>
            <input className="preset-name-input" type="number" min="1" max={cardForm.deckGroup === 'main' ? 50 : 5} value={cardForm.maxCopies} onChange={(event) => updateCardForm('maxCopies', event.target.value)} />
          </label>
          <label className="form-field">
            <span>弾 / 区分</span>
            <input className="preset-name-input" value={cardForm.expansion} placeholder="例: BP01 / USER" onChange={(event) => updateCardForm('expansion', event.target.value)} />
          </label>
          <label className="form-field">
            <span>並び順</span>
            <input className="preset-name-input" type="number" value={cardForm.sortOrder} placeholder="未入力で自動" onChange={(event) => updateCardForm('sortOrder', event.target.value)} />
          </label>
          <label className="form-field">
            <span>タグ</span>
            <input className="preset-name-input" value={cardForm.tags} placeholder="buff, heal, starter" onChange={(event) => updateCardForm('tags', event.target.value)} />
          </label>
          <label className="form-field form-field-full">
            <span>効果テキスト</span>
            <textarea className="form-textarea" rows={4} value={cardForm.text} placeholder="カード効果や備考を入力" onChange={(event) => updateCardForm('text', event.target.value)} />
          </label>
        </div>
        <div className="action-row wrap-actions top-gap">
          <button onClick={() => void handleSaveCard()}>{selectedCatalogCard ? 'カード定義を保存' : '新規カードを登録'}</button>
          <button className="ghost-button" onClick={() => setCardForm((current) => ({ ...current, id: current.id.trim() || createSuggestedCardId(current.name, current.deckGroup, current.type) }))}>ID自動生成</button>
          <button className="ghost-button" onClick={() => startNewCard(cardForm.deckGroup)}>入力をクリア</button>
          <button className="ghost-button" onClick={() => onPreviewCard({
            id: cardForm.id || 'preview-card',
            sourceCardId: cardForm.id || undefined,
            name: cardForm.name || 'プレビューカード',
            type: cardForm.type,
            cost: Number(cardForm.cost || 0),
            power: cardForm.power.trim() ? Number(cardForm.power) : undefined,
            effectType: cardForm.effectType,
            effectValue: Number(cardForm.effectValue || 0),
            text: cardForm.text || 'カード説明を入力してください',
          })}>入力内容をプレビュー</button>
          <button className="ghost-button" onClick={() => void handleDeleteCard()} disabled={!selectedCatalogCard}>選択カードを削除</button>
        </div>
        <div className="preset-hint">将来カードが増えても、このフォームから個別追加、JSONから一括追加、既存IDの上書き更新で運用できます。</div>
      </section>

      <section className="panel">
        <div className="section-header">
          <h2>登録済みカード一覧</h2>
          <span>検索して選択編集</span>
        </div>
        <div className="catalog-filter-grid top-gap">
          <input className="preset-name-input" value={catalogSearch} placeholder="カード名 / ID / タグで検索" onChange={(event) => setCatalogSearch(event.target.value)} />
          <select className="form-select" value={catalogGroupFilter} onChange={(event) => setCatalogGroupFilter(event.target.value as 'all' | DeckGroup)}>
            <option value="all">全グループ</option>
            <option value="main">メイン</option>
            <option value="tactics">タクティクス</option>
          </select>
          <select className="form-select" value={catalogTypeFilter} onChange={(event) => setCatalogTypeFilter(event.target.value as 'all' | CardType)}>
            {SEARCH_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="catalog-card-list catalog-card-list-image top-gap">
          {filteredCatalog.length === 0 ? (
            <div className="empty-preset">条件に一致するカードはありません</div>
          ) : (
            filteredCatalog.map((card) => {
              const entryCount = getDeckEntryCount(card.deckGroup === 'main' ? deckConfig.main : deckConfig.tactics, card.id);
              const isSelected = selectedCatalogCard?.id === card.id;
              return (
                <FieldCardTile
                  key={card.id}
                  card={card}
                  title={`${card.deckGroup === 'main' ? 'メイン' : 'タクティクス'} / ${card.type}`}
                  subtitle={`ID: ${card.id} / コスト ${card.cost} / 最大 ${card.maxCopies} / 採用中 ${entryCount}`}
                  accent={getFieldAccent(card)}
                  selected={isSelected}
                  onClick={() => handleSelectCatalogCard(card)}
                />
              );
            })
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <h2>構成分析</h2>
          <span>現在のデッキ傾向</span>
        </div>
        <div className="deck-summary-grid top-gap">
          <div className="status-card compact-card">
            <div>アタック枚数</div>
            <strong>{attackCount}</strong>
          </div>
          <div className="status-card compact-card">
            <div>メモリア枚数</div>
            <strong>{memoriaCount}</strong>
          </div>
          <div className="status-card compact-card">
            <div>1コスト枚数</div>
            <strong>{oneCostCount}</strong>
          </div>
          <div className="status-card compact-card">
            <div>2コスト枚数</div>
            <strong>{twoCostCount}</strong>
          </div>
          <div className="status-card compact-card">
            <div>平均コスト</div>
            <strong>{averageCost}</strong>
          </div>
          <div className="status-card compact-card">
            <div>強化ソース</div>
            <strong>{buffSources}</strong>
          </div>
          <div className="status-card compact-card">
            <div>回復ソース</div>
            <strong>{recoverySources}</strong>
          </div>
          <div className="status-card compact-card">
            <div>直撃ソース</div>
            <strong>{directDamageSources}</strong>
          </div>
        </div>
        <ul className="analysis-note-list top-gap">
          <li>{attackCount >= memoriaCount ? 'アタック寄りの構成です。ダメージレースを作りやすいです。' : 'メモリア寄りの構成です。補助札を活かす立ち回り向きです。'}</li>
          <li>{oneCostCount >= twoCostCount ? '軽量札が多めで、序盤の手札事故を抑えやすいです。' : '2コスト札が多めで、中盤の伸びを意識した構成です。'}</li>
          <li>{directDamageSources >= 4 ? '直撃手段が多く、詰め性能は高めです。' : '直撃手段は控えめなので、盤面攻撃を軸に詰める想定です。'}</li>
        </ul>
      </section>

      <section className="panel">
        <div className="section-header">
          <h2>JSON入出力</h2>
          <span>構成とプリセットを保存 / 復元</span>
        </div>
        <div className="action-row wrap-actions top-gap">
          <button onClick={handleExportJson}>JSONを書き出す</button>
          <label className="file-import-button">
            JSONを読み込む
            <input type="file" accept="application/json,.json" onChange={handleImportJson} />
          </label>
        </div>
        <div className="preset-hint">現在のデッキ構成と保存済みプリセットを1つのJSONにまとめて入出力します。</div>
        {importMessage && <div className={`import-status ${importStatus}`}>{importMessage}</div>}
      </section>

      <section className="panel">
        <div className="section-header">
          <h2>プリセット保存</h2>
          <span>保存・改名・並び替え・内容確認・再利用</span>
        </div>
        <div className="preset-save-row top-gap">
          <input
            className="preset-name-input"
            type="text"
            value={presetName}
            placeholder="例: メモリア多め / 先攻練習"
            onChange={(event) => setPresetName(event.target.value)}
          />
          <button onClick={handleSavePreset}>{matchedPreset ? '同名を上書き保存' : '保存'}</button>
        </div>
        <div className="preset-hint">
          {matchedPreset
            ? `「${matchedPreset.name}」があるため、このまま保存すると上書きされます。`
            : '未入力なら自動で名前を付けます。'}
        </div>
        {presetMessage && <div className={`import-status ${presetStatus}`}>{presetMessage}</div>}

        <div className="preset-list">
          {savedPresets.length === 0 ? (
            <div className="empty-preset">保存済みプリセットはまだありません</div>
          ) : (
            savedPresets.map((preset, index) => {
              const mainCount = getDeckTotal(preset.deckConfig.main);
              const tacticCount = getDeckTotal(preset.deckConfig.tactics);
              const isEditing = editingPresetId === preset.id;
              const isFirst = index === 0;
              const isLast = index === savedPresets.length - 1;
              return (
                <div className="preset-card" key={preset.id}>
                  <div className="preset-meta">
                    {isEditing ? (
                      <div className="preset-rename-row">
                        <input
                          className="preset-name-input"
                          type="text"
                          value={editingPresetName}
                          placeholder="新しいプリセット名"
                          onChange={(event) => setEditingPresetName(event.target.value)}
                        />
                      </div>
                    ) : (
                      <strong>{preset.name}</strong>
                    )}
                    <span>{mainCount} / 50 ・ {tacticCount} / 5</span>
                    <span>{new Date(preset.createdAt).toLocaleString('ja-JP')}</span>
                  </div>
                  <div className="preset-actions">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleRenamePreset(preset.id)}>名前を保存</button>
                        <button className="ghost-button" onClick={() => {
                          setEditingPresetId(null);
                          setEditingPresetName('');
                        }}>キャンセル</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => onLoadPreset(preset.id)}>読み込み</button>
                        <button className={previewPresetId === preset.id ? undefined : 'ghost-button'} onClick={() => setPreviewPresetId((current) => (current === preset.id ? null : preset.id))}>
                          {previewPresetId === preset.id ? '確認を閉じる' : '内容確認'}
                        </button>
                        <button onClick={() => {
                          setEditingPresetId(preset.id);
                          setEditingPresetName(preset.name);
                          setPresetMessage('');
                          setPresetStatus('');
                        }}>名前変更</button>
                        <button className="ghost-button" onClick={() => handleMovePreset(preset.id, 'up', preset.name)} disabled={isFirst}>↑ 上へ</button>
                        <button className="ghost-button" onClick={() => handleMovePreset(preset.id, 'down', preset.name)} disabled={isLast}>↓ 下へ</button>
                        <button onClick={() => void handleOverwritePreset(preset.id, preset.name)}>上書き保存</button>
                        <button className="ghost-button" onClick={() => void handleDeletePreset(preset.id, preset.name)}>削除</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {previewPreset && (
          <div className="preset-preview-panel top-gap">
            <div className="section-header">
              <h2>プリセット内容確認</h2>
              <span>{previewPreset.name}</span>
            </div>
            <div className="preset-preview-grid top-gap">
              <section className="compact-card">
                <div className="section-header">
                  <h2>メインデッキ内訳</h2>
                  <span>採用カードのみ表示</span>
                </div>
                <div className="preset-preview-list preset-preview-list-image top-gap">
                  {previewPreset.deckConfig.main.map((entry) => {
                    const card = cardLookup[entry.cardId];
                    if (!card) return null;
                    return (
                      <FieldCardTile
                        key={entry.cardId}
                        card={card}
                        title="メイン採用カード"
                        subtitle={`${entry.count}枚採用`}
                        accent={getFieldAccent(card)}
                        onClick={() => onPreviewCard(card)}
                      />
                    );
                  })}
                </div>
              </section>

              <section className="compact-card">
                <div className="section-header">
                  <h2>タクティクス内訳</h2>
                  <span>採用中のみ表示</span>
                </div>
                <div className="preset-preview-list preset-preview-list-image top-gap">
                  {previewPreset.deckConfig.tactics.map((entry) => {
                    const card = cardLookup[entry.cardId];
                    if (!card) return null;
                    return (
                      <FieldCardTile
                        key={entry.cardId}
                        card={card}
                        title="タクティクス採用カード"
                        subtitle={`${entry.count}枚採用`}
                        accent={getFieldAccent(card)}
                        onClick={() => onPreviewCard(card)}
                      />
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <h2>メインデッキ構成</h2>
          <span>詳細 / ＋ / −</span>
        </div>
        <div className="editor-list deck-editor-card-grid">
          {mainCardCatalog.map((card) => (
            <div className="deck-editor-card-stack" key={card.id}>
              <FieldCardTile
                card={card}
                title="メインデッキ候補"
                subtitle={`ID: ${card.id} / 最大 ${card.maxCopies} / コスト ${card.cost}`}
                accent={getFieldAccent(card)}
                onClick={() => onPreviewCard(card)}
              />
              <div className="deck-editor-counter-box">
                <button className="count-btn" onClick={() => onMainChange(card.id, -1)}>-</button>
                <strong className="deck-editor-counter-count">{getDeckEntryCount(deckConfig.main, card.id)}</strong>
                <button className="count-btn" onClick={() => onMainChange(card.id, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <h2>タクティクスデッキ</h2>
          <span>詳細 / ＋ / −</span>
        </div>
        <div className="editor-list deck-editor-card-grid">
          {tacticCardCatalog.map((card) => {
            const count = getDeckEntryCount(deckConfig.tactics, card.id);
            return (
              <div className="deck-editor-card-stack" key={card.id}>
                <FieldCardTile
                  card={card}
                  title="タクティクス候補"
                  subtitle={`ID: ${card.id} / 最大 ${card.maxCopies} / 効果 ${card.effectType}`}
                  accent={getFieldAccent(card)}
                  selected={count > 0}
                  onClick={() => onPreviewCard(card)}
                />
                <div className="deck-editor-counter-box">
                  <button className="count-btn" onClick={() => onTacticChange(card.id, -1)}>-</button>
                  <strong className="deck-editor-counter-count">{count}</strong>
                  <button className="count-btn" onClick={() => onTacticChange(card.id, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
