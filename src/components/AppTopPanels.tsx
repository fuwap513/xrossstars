import type { ChangeEvent } from 'react';
import type { AppScreen } from '../types/game';

type StatusType = 'ok' | 'ng' | '';

type Props = {
  currentScreen: AppScreen;
  switchScreen: (screen: AppScreen) => void;
  isOffline: boolean;
  showInstallBanner: boolean;
  hasInstallPrompt: boolean;
  installMessage: string;
  showGuideBanner: boolean;
  offlineCacheMessage: string;
  offlineCacheStatus: StatusType;
  backupMessage: string;
  backupStatus: StatusType;
  onInstallApp: () => Promise<void>;
  onDismissInstallBanner: () => void;
  onOpenGuide: () => void;
  onDismissGuideBanner: () => void;
  onPrepareOffline: () => Promise<void>;
  onRefreshOfflineCache: () => Promise<void>;
  onExportAppBackup: () => void;
  onImportAppBackup: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
};

export default function AppTopPanels({
  currentScreen,
  switchScreen,
  isOffline,
  showInstallBanner,
  hasInstallPrompt,
  installMessage,
  showGuideBanner,
  offlineCacheMessage,
  offlineCacheStatus,
  backupMessage,
  backupStatus,
  onInstallApp,
  onDismissInstallBanner,
  onOpenGuide,
  onDismissGuideBanner,
  onPrepareOffline,
  onRefreshOfflineCache,
  onExportAppBackup,
  onImportAppBackup,
}: Props) {
  return (
    <>
      {isOffline && (
        <section className="panel offline-banner">
          <div className="section-header">
            <h2>オフラインモード</h2>
            <span>通信なし</span>
          </div>
          <p>保存済みデータを使って操作できます。初回表示や未取得アセットは一部制限される場合があります。</p>
        </section>
      )}

      {showInstallBanner && (hasInstallPrompt || installMessage) && (
        <section className="panel install-banner">
          <div className="section-header">
            <h2>アプリとして使う</h2>
            <span>PWA</span>
          </div>
          <p>{installMessage || 'ホーム画面に追加して全画面で使えます'}</p>
          <div className="action-row wrap-actions top-gap">
            <button onClick={() => void onInstallApp()}>インストール</button>
            <button className="ghost-button" onClick={onDismissInstallBanner}>閉じる</button>
          </div>
        </section>
      )}

      {showGuideBanner && (
        <section className="panel guide-banner">
          <div className="section-header">
            <h2>クイックガイド</h2>
            <span>初回向け</span>
          </div>
          <p>デッキ作成 → 対戦開始 → ログ確認までの基本操作を短く確認できます。</p>
          <div className="action-row wrap-actions top-gap">
            <button onClick={onOpenGuide}>使い方を見る</button>
            <button className="ghost-button" onClick={onDismissGuideBanner}>閉じる</button>
          </div>
        </section>
      )}

      <section className="panel cache-banner">
        <div className="section-header">
          <h2>オフライン利用を準備</h2>
          <span>キャッシュ</span>
        </div>
        <p>主要アセットを端末に保存して、通信が不安定でも再表示しやすくします。</p>
        <div className="action-row wrap-actions top-gap">
          <button onClick={() => void onPrepareOffline()} disabled={isOffline}>オフライン用に保存</button>
          <button className="ghost-button" onClick={() => void onRefreshOfflineCache()} disabled={isOffline}>キャッシュを更新</button>
        </div>
        {offlineCacheMessage && <div className={`import-status ${offlineCacheStatus} top-gap`}>{offlineCacheMessage}</div>}
      </section>

      <section className="panel backup-panel">
        <div className="section-header">
          <h2>アプリデータ管理</h2>
          <span>バックアップ / 復元</span>
        </div>
        <p>プリセット・操作ログ・利用統計・現在画面をまとめてJSON保存できます。</p>
        <div className="action-row wrap-actions top-gap">
          <button onClick={onExportAppBackup}>バックアップを書き出す</button>
          <label className="file-import-button ghost-file-import">
            バックアップを読み込む
            <input type="file" accept="application/json,.json" onChange={(event) => void onImportAppBackup(event)} />
          </label>
        </div>
        <div className="preset-hint">対戦状態そのものではなく、アプリ利用データの復元用バックアップです。</div>
        {backupMessage && <div className={`import-status ${backupStatus}`}>{backupMessage}</div>}
      </section>

      <section className="tab-row panel">
        <button className={currentScreen === 'battle' ? 'tab-button active' : 'tab-button'} onClick={() => switchScreen('battle')}>
          バトル
        </button>
        <button className={currentScreen === 'deck' ? 'tab-button active' : 'tab-button'} onClick={() => switchScreen('deck')}>
          デッキ編集
        </button>
      </section>
    </>
  );
}
