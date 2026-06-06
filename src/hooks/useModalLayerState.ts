import { useEffect, useMemo, useState } from 'react';
import type { Card, Leader, OperationLogCategory, PendingBattleChoice } from '../types/game';

export type ModalAction =
  | { type: 'play-hand'; cardId: string }
  | { type: 'set-tactic'; cardId: string }
  | { type: 'use-set-tactic'; cardId: string }
  | null;

export type ConfirmTone = 'default' | 'danger';

export type ConfirmOptions = {
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

type PlayHandCard = (
  cardId: string,
  options?: { forceCostPayment?: boolean },
) => void;

type SetRoundTactic = (cardId: string) => void;
type UseSetTactic = (cardId: string) => void;

type Params = {
  addOperationLog: (message: string, category?: OperationLogCategory) => void;
  pendingChoice?: PendingBattleChoice;
  selfHand: Card[];
  selfLeaders: Leader[];
  opponentLeaders: Leader[];
  fieldCards: Card[];
  playHandCard: PlayHandCard;
  setRoundTactic: SetRoundTactic;
  useSetTactic: UseSetTactic;
};

const GUIDE_STORAGE_KEY = 'xrossstars-guide-dismissed-v1';

const initialConfirmState: ConfirmState = {
  open: false,
  title: '確認',
  message: '',
  confirmLabel: '実行する',
  cancelLabel: 'キャンセル',
  tone: 'default',
};

const getInitialGuideBannerState = () => {
  if (typeof window === 'undefined') return false;

  try {
    return !window.localStorage.getItem(GUIDE_STORAGE_KEY);
  } catch {
    return true;
  }
};

export default function useModalLayerState({
  addOperationLog,
  pendingChoice,
  selfHand,
  selfLeaders,
  opponentLeaders,
  fieldCards,
  playHandCard,
  setRoundTactic,
  useSetTactic,
}: Params) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [modalTitle, setModalTitle] = useState<string>('カード詳細');
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [confirmState, setConfirmState] =
    useState<ConfirmState>(initialConfirmState);
  const [showGuideBanner, setShowGuideBanner] = useState(
    getInitialGuideBannerState,
  );
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedPendingChoiceCardId, setSelectedPendingChoiceCardId] =
    useState('');
  const [selectedPendingChoiceLeaderId, setSelectedPendingChoiceLeaderId] =
    useState('');

  useEffect(() => {
    if (pendingChoice) {
      const firstSelectableCardId =
        pendingChoice.selectableHandCardIds.find((cardId) =>
          selfHand.some((card) => card.id === cardId),
        ) ?? '';

      setSelectedPendingChoiceCardId(firstSelectableCardId);

      const firstSelectableLeaderId =
        pendingChoice.kind === 'post_attack_other_leader_damage' ||
        pendingChoice.kind === 'drain_rod_damage_target'
          ? pendingChoice.selectableLeaderIds.find((leaderId) =>
              opponentLeaders.some((leader) => leader.id === leaderId),
            ) ?? ''
          : pendingChoice.kind === 'drain_rod_heal_distribution'
            ? pendingChoice.selectableLeaderIds.find((leaderId) =>
                selfLeaders.some((leader) => leader.id === leaderId),
              ) ?? ''
            : '';

      setSelectedPendingChoiceLeaderId(firstSelectableLeaderId);
      return;
    }

    setSelectedPendingChoiceCardId('');
    setSelectedPendingChoiceLeaderId('');
  }, [opponentLeaders, pendingChoice, selfHand, selfLeaders]);

  const requestConfirm = (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
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

  const openPreview = (
    card: Card,
    title = 'カード詳細',
    action: ModalAction = null,
  ) => {
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
      // storage error is ignored
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

  const modalActionLabel = useMemo(() => {
    if (!modalAction) return undefined;
    if (modalAction.type === 'play-hand') return 'このカードを使用';
    if (modalAction.type === 'set-tactic') return 'このタクティクスをセット';
    if (modalAction.type === 'use-set-tactic') return 'このタクティクスを使用';
    return undefined;
  }, [modalAction]);

  const runModalAction = async () => {
    if (!modalAction) return;

    if (modalAction.type === 'play-hand') {
      const handCard = selfHand.find((card) => card.id === modalAction.cardId);

      const canOptionallyPlayWithoutCost = Boolean(
        handCard &&
          handCard.cost > 0 &&
          handCard.text.includes(
            `プレイエリアに別の「${handCard.name}」が1枚あるなら、コストを支払わずにこのカードをプレイしてもよい`,
          ) &&
          fieldCards.filter((fieldCard) => fieldCard.name === handCard.name)
            .length === 1,
      );

      if (handCard && canOptionallyPlayWithoutCost) {
        const shouldPlayWithoutCost = await requestConfirm({
          title: 'コスト支払い方法',
          message: `${handCard.name} は同名カード条件を満たしています。コストを支払わずにプレイしますか？`,
          confirmLabel: 'コストなしで使う',
          cancelLabel: 'コストを払って使う',
        });

        playHandCard(modalAction.cardId, {
          forceCostPayment: !shouldPlayWithoutCost,
        });
        closePreview();
        return;
      }

      playHandCard(modalAction.cardId);
    }

    if (modalAction.type === 'set-tactic') {
      setRoundTactic(modalAction.cardId);
    }

    if (modalAction.type === 'use-set-tactic') {
      useSetTactic(modalAction.cardId);
    }

    closePreview();
  };

  return {
    selectedCard,
    modalTitle,
    modalAction,
    modalActionLabel,
    confirmState,
    showGuideBanner,
    isGuideOpen,
    selectedPendingChoiceCardId,
    setSelectedPendingChoiceCardId,
    selectedPendingChoiceLeaderId,
    setSelectedPendingChoiceLeaderId,
    requestConfirm,
    closeConfirm,
    openPreview,
    closePreview,
    openGuide,
    closeGuide,
    dismissGuideBanner,
    runModalAction,
  };
}
