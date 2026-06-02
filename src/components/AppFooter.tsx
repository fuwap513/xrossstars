export type AppFooterProps = {
  appName: string;
  appVersion: string;
};

export default function AppFooter({ appName, appVersion }: AppFooterProps) {
  return (
    <footer className="panel app-footer">
      <div>
        <strong>{appName}</strong>
        <p>ホーム画面追加・バックアップJSON・履歴確認に対応したローカル検証向け構成です。</p>
      </div>
      <span className="app-badge">{appVersion}</span>
    </footer>
  );
}
