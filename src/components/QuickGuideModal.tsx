type Props = {
  open: boolean;
  onClose: () => void;
};

export default function QuickGuideModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card guide-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="section-header">
          <h2>クイックガイド</h2>
          <button className="modal-close-button" onClick={onClose} aria-label="使い方を閉じる">×</button>
        </div>
        <div className="guide-step-list">
          <article className="guide-step">
            <strong>1. デッキを50枚 / 5枚に整える</strong>
            <p>デッキ編集画面でメイン50枚、タクティクス5枚に調整し、必要ならプリセット保存します。</p>
          </article>
          <article className="guide-step">
            <strong>2. 先攻 / 後攻で対戦開始</strong>
            <p>現在の構成で先攻開始または後攻開始を押すと、そのまま対戦画面へ反映されます。</p>
          </article>
          <article className="guide-step">
            <strong>3. ラウンド開始時はタクティクスをセット</strong>
            <p>案内バナーが表示されたら、このラウンドで使うタクティクスを1枚セットしてから進行します。</p>
          </article>
          <article className="guide-step">
            <strong>4. ログとオフライン保存を活用</strong>
            <p>ログはTXT出力やコピーが可能です。必要ならオフライン用に保存して再表示を安定させられます。</p>
          </article>
        </div>
        <div className="action-row">
          <button onClick={onClose}>閉じる</button>
        </div>
      </section>
    </div>
  );
}
