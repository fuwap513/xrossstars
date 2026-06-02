import CardDetailModal from './CardDetailModal';
import ConfirmModal from './ConfirmModal';
import PendingChoiceModal from './PendingChoiceModal';
import QuickGuideModal from './QuickGuideModal';
import type { Card, Leader, PendingBattleChoice, RegisteredCard } from '../types/game';
import type { ConfirmTone, ModalAction } from '../hooks/useModalLayerState';

type ResolvePendingChoice = (payload: { accept: boolean; selectedCardId?: string; selectedLeaderId?: string }) => void;

type Props = {
  isGuideOpen: boolean;
  onCloseGuide: () => void;
  selectedCard: Card | null;
  modalTitle: string;
  modalAction: ModalAction;
  modalActionLabel?: string;
  onRunModalAction: () => Promise<void>;
  onClosePreview: () => void;
  confirmOpen: boolean;
  confirmTitle?: string;
  confirmMessage: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
  pendingChoice: PendingBattleChoice | undefined;
  pendingChoiceSelectableCards: Card[];
  pendingChoiceSelectableLeaders: Leader[];
  pendingChoiceNeedsCardSelection: boolean;
  pendingChoiceNeedsLeaderSelection: boolean;
  selectedPendingChoiceCardId: string;
  setSelectedPendingChoiceCardId: (value: string) => void;
  selectedPendingChoiceLeaderId: string;
  setSelectedPendingChoiceLeaderId: (value: string) => void;
  resolvePendingChoice: ResolvePendingChoice;
  cancelPendingChoice: () => void;
  cardCatalogById: Map<string, RegisteredCard>;
};

export default function AppModalLayer({
  isGuideOpen,
  onCloseGuide,
  selectedCard,
  modalTitle,
  modalAction,
  modalActionLabel,
  onRunModalAction,
  onClosePreview,
  confirmOpen,
  confirmTitle,
  confirmMessage,
  confirmLabel,
  cancelLabel,
  confirmTone,
  onConfirm,
  onCancel,
  pendingChoice,
  pendingChoiceSelectableCards,
  pendingChoiceSelectableLeaders,
  pendingChoiceNeedsCardSelection,
  pendingChoiceNeedsLeaderSelection,
  selectedPendingChoiceCardId,
  setSelectedPendingChoiceCardId,
  selectedPendingChoiceLeaderId,
  setSelectedPendingChoiceLeaderId,
  resolvePendingChoice,
  cancelPendingChoice,
  cardCatalogById,
}: Props) {
  return (
    <>
      <QuickGuideModal
        open={isGuideOpen}
        onClose={onCloseGuide}
      />

      <CardDetailModal
        card={selectedCard}
        title={modalTitle}
        actionLabel={modalActionLabel}
        onAction={modalAction ? onRunModalAction : undefined}
        onClose={onClosePreview}
      />

      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        tone={confirmTone}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />

      <PendingChoiceModal
        pendingChoice={pendingChoice}
        pendingChoiceSelectableCards={pendingChoiceSelectableCards}
        pendingChoiceSelectableLeaders={pendingChoiceSelectableLeaders}
        pendingChoiceNeedsCardSelection={pendingChoiceNeedsCardSelection}
        pendingChoiceNeedsLeaderSelection={pendingChoiceNeedsLeaderSelection}
        selectedPendingChoiceCardId={selectedPendingChoiceCardId}
        setSelectedPendingChoiceCardId={setSelectedPendingChoiceCardId}
        selectedPendingChoiceLeaderId={selectedPendingChoiceLeaderId}
        setSelectedPendingChoiceLeaderId={setSelectedPendingChoiceLeaderId}
        resolvePendingChoice={resolvePendingChoice}
        cancelPendingChoice={cancelPendingChoice}
        cardCatalogById={cardCatalogById}
      />
    </>
  );
}
