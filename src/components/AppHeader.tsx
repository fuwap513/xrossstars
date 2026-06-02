type Props = {
  appName: string;
  appVersion: string;
  round: number;
  turn: number;
  ppCurrent: number;
  ppMax: number;
  isSelfSecond: boolean;
  onOpenGuide: () => void;
};

export default function AppHeader({
  appName,
  appVersion,
  round,
  turn,
  ppCurrent,
  ppMax,
  isSelfSecond,
  onOpenGuide,
}: Props) {
  return (
    <header className="topbar panel">
      <div>
        <p className="eyebrow">{appName}</p>
        <div className="title-row">
          <h1>一人回し・対戦検証・デッキ調整</h1>
          <span className="app-badge">{appVersion}</span>
        </div>
      </div>
      <div className="round-box">
        <strong>Round {round} / 3</strong>
        <span>Turn {turn}</span>
        <span>PP {ppCurrent} / {ppMax}</span>
        <span>想定手番: {isSelfSecond ? '後攻' : '先攻'}</span>
      </div>
      <div className="topbar-actions">
        <button className="ghost-button topbar-help-button" onClick={onOpenGuide}>使い方</button>
      </div>
    </header>
  );
}
