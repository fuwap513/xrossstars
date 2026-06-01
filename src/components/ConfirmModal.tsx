type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title = '確認',
  message,
  confirmLabel = '実行する',
  cancelLabel = 'キャンセル',
  tone = 'default',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <section className="modal-card confirm-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="section-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close-button" onClick={onCancel}>×</button>
        </div>

        <div className="confirm-message-box">
          <p>{message}</p>
        </div>

        <div className="action-row top-gap">
          <button
            type="button"
            className={tone === 'danger' ? 'danger-button' : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className="ghost-button" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </section>
    </div>
  );
}
