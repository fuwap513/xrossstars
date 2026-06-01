import type { ChangeEvent } from 'react';
import type { LeaderSetup, Side } from '../types/game';

type Props = {
  leaderSetup: LeaderSetup;
  onUpdate: (side: Side, leaderId: string, patch: { name?: string; baseHp?: number }) => void;
  onReset: () => void;
};

const SIDE_LABELS: Record<Side, string> = {
  self: '自分側',
  opponent: '相手側',
};

const clampHp = (value: number) => Math.min(200, Math.max(50, value));

export default function LeaderSetupEditor({ leaderSetup, onUpdate, onReset }: Props) {
  const handleNameChange = (side: Side, leaderId: string) => (event: ChangeEvent<HTMLInputElement>) => {
    onUpdate(side, leaderId, { name: event.target.value });
  };

  const handleHpChange = (side: Side, leaderId: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = Number(event.target.value);
    if (Number.isNaN(rawValue)) return;
    onUpdate(side, leaderId, { baseHp: clampHp(rawValue) });
  };

  return (
    <section className="panel leader-setup-panel">
      <div className="section-header">
        <h2>リーダー設定</h2>
        <span>名前 / 基礎HP</span>
      </div>
      <p>対戦開始時に反映するリーダー名と基礎HPを編集できます。HPは 50〜200 の範囲で保存されます。</p>
      <div className="leader-setup-grid top-gap">
        {(['self', 'opponent'] as Side[]).map((side) => (
          <section className="leader-setup-group compact-card" key={side}>
            <div className="section-header">
              <h2>{SIDE_LABELS[side]}</h2>
              <span>{leaderSetup[side].length} 体</span>
            </div>
            <div className="leader-setup-list top-gap">
              {leaderSetup[side].map((leader) => (
                <article className="leader-setup-item" key={leader.id}>
                  <div className="leader-setup-id">{leader.id.toUpperCase()}</div>
                  <div className="leader-setup-fields">
                    <label className="leader-field">
                      <span>表示名</span>
                      <input
                        className="preset-name-input"
                        type="text"
                        maxLength={24}
                        value={leader.name}
                        onChange={handleNameChange(side, leader.id)}
                        placeholder={side === 'self' ? '自分リーダー名' : '相手リーダー名'}
                      />
                    </label>
                    <label className="leader-field leader-field-hp">
                      <span>基礎HP</span>
                      <input
                        className="preset-name-input leader-hp-input"
                        type="number"
                        min={50}
                        max={200}
                        step={10}
                        value={leader.baseHp}
                        onChange={handleHpChange(side, leader.id)}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="action-row wrap-actions top-gap">
        <button className="ghost-button" onClick={onReset}>推奨初期値に戻す</button>
      </div>
    </section>
  );
}
