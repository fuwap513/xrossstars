import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { LeaderSetup, RegisteredCard, Side } from '../types/game';

type Props = {
  leaderSetup: LeaderSetup;
  cardCatalog: RegisteredCard[];
  onUpdate: (
    side: Side,
    leaderId: string,
    patch: { name?: string; baseHp?: number; sourceCardId?: string },
  ) => void;
  onReset: () => void;
  onImportOfficialCardCatalog: () => Promise<boolean>;
};

const SIDE_LABELS: Record<Side, string> = {
  self: '自分側',
  opponent: '相手側',
};

const clampHp = (value: number) => Math.min(200, Math.max(50, value));

const parseStat = (value?: string, fallback = 0) => {
  if (!value) return fallback;
  const matched = value.match(/\d+/);
  return matched ? Number(matched[0]) : fallback;
};

export default function LeaderSetupEditor({
  leaderSetup,
  cardCatalog,
  onUpdate,
  onReset,
  onImportOfficialCardCatalog,
}: Props) {
  const [importMessage, setImportMessage] = useState('');
  const [importStatus, setImportStatus] = useState<'ok' | 'ng' | ''>('');

  const officialLeaderCards = useMemo(
    () =>
      cardCatalog
        .filter((card) => card.type === 'leader')
        .sort((a, b) => {
          const setCompare = (a.officialSet ?? '').localeCompare(
            b.officialSet ?? '',
            'ja-JP',
          );
          if (setCompare !== 0) return setCompare;

          const orderCompare = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          if (orderCompare !== 0) return orderCompare;

          return `${a.name}-${a.id}`.localeCompare(
            `${b.name}-${b.id}`,
            'ja-JP',
          );
        }),
    [cardCatalog],
  );

  const getMatchedLeaderCard = (leader: LeaderSetup['self'][number]) =>
    leader.sourceCardId
      ? officialLeaderCards.find((card) => card.id === leader.sourceCardId)
      : officialLeaderCards.find((card) => card.name === leader.name);

  const handleNameChange =
    (side: Side, leaderId: string) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onUpdate(side, leaderId, {
        name: event.target.value,
        sourceCardId: '',
      });
    };

  const handleHpChange =
    (side: Side, leaderId: string) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = Number(event.target.value);
      if (Number.isNaN(rawValue)) return;

      onUpdate(side, leaderId, {
        baseHp: clampHp(rawValue),
        sourceCardId: '',
      });
    };

  const handleSelectOfficialLeader =
    (side: Side, leaderId: string) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selectedCard = officialLeaderCards.find(
        (card) => card.id === event.target.value,
      );
      if (!selectedCard) return;

      onUpdate(side, leaderId, {
        name: selectedCard.name,
        baseHp: parseStat(selectedCard.baseHp, 100),
        sourceCardId: selectedCard.id,
      });
    };

  const handleImportOfficial = async () => {
    setImportMessage('');
    setImportStatus('');

    const success = await onImportOfficialCardCatalog();

    setImportStatus(success ? 'ok' : 'ng');
    setImportMessage(
      success
        ? '公式カードデータ（第1弾〜第3弾）を読み込みました'
        : '公式カードデータの読み込みに失敗しました',
    );
  };

  return (
    <section className="panel leader-setup-panel">
      <div className="section-header">
        <h2>リーダー設定</h2>
        <span>4リーダー / 公式カード優先</span>
      </div>

      <p>
        Xross Stars の一人回し練習用に、対戦開始時の4リーダーを設定します。
        公式カードを読み込むと、公式名・公式ステータスをベースに反映できます。
      </p>

      <div className="action-row wrap-actions top-gap">
        <button onClick={() => void handleImportOfficial()}>
          公式1〜3弾を読み込む
        </button>
        <button className="ghost-button" onClick={onReset}>
          推奨初期値に戻す
        </button>
      </div>

      {importMessage ? (
        <div className={`import-status ${importStatus} top-gap`}>
          {importMessage}
        </div>
      ) : null}

      <div className="leader-setup-grid top-gap">
        {(['self', 'opponent'] as Side[]).map((side) => (
          <section className="leader-setup-group compact-card" key={side}>
            <div className="section-header">
              <h2>{SIDE_LABELS[side]}</h2>
              <span>{leaderSetup[side].length} 体</span>
            </div>

            <div className="leader-setup-list top-gap">
              {leaderSetup[side].map((leader) => {
                const matchedLeader = getMatchedLeaderCard(leader);
                const baseAtk = parseStat(matchedLeader?.baseAtk, 30);
                const baseHp = parseStat(matchedLeader?.baseHp, leader.baseHp);
                const awakenedAtk = parseStat(
                  matchedLeader?.awakenedAtk,
                  baseAtk + 10,
                );
                const awakenedHp = parseStat(
                  matchedLeader?.awakenedHp,
                  baseHp + 30,
                );

                return (
                  <article className="leader-setup-item" key={leader.id}>
                    <div className="leader-setup-id">{leader.id.toUpperCase()}</div>

                    <div className="leader-setup-fields">
                      {officialLeaderCards.length > 0 ? (
                        <label className="leader-field">
                          <span>公式リーダー選択</span>
                          <select
                            className="form-select"
                            value={matchedLeader?.id ?? ''}
                            onChange={handleSelectOfficialLeader(side, leader.id)}
                          >
                            <option value="">リーダーを選択</option>
                            {officialLeaderCards.map((card) => (
                              <option key={card.id} value={card.id}>
                                {`${card.name} / ${card.officialCardNumber ?? card.id}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <div className="detail-box">
                        <div className="detail-chip-row">
                          <span className="detail-chip">
                            {matchedLeader?.name ?? leader.name}
                          </span>

                          {matchedLeader?.officialCardNumber ? (
                            <span className="detail-chip detail-chip-muted">
                              {matchedLeader.officialCardNumber}
                            </span>
                          ) : null}

                          {matchedLeader?.color ? (
                            <span className="detail-chip detail-chip-success">
                              {matchedLeader.color}
                            </span>
                          ) : null}
                        </div>

                        <div className="detail-description">
                          通常 ATK {baseAtk} / HP {baseHp} ・ 覚醒 ATK {awakenedAtk} /
                          HP {awakenedHp}
                        </div>
                      </div>

                      {!officialLeaderCards.length ? (
                        <>
                          <label className="leader-field">
                            <span>表示名</span>
                            <input
                              className="preset-name-input"
                              type="text"
                              maxLength={24}
                              value={leader.name}
                              onChange={handleNameChange(side, leader.id)}
                              placeholder={
                                side === 'self'
                                  ? '自分リーダー名'
                                  : '相手リーダー名'
                              }
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
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
