import { useEffect, useState } from 'react';
import type { OperationLogCategory } from '../types/game';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type Params = {
  addOperationLog: (message: string, category?: OperationLogCategory) => void;
};

export default function useAppUiState({ addOperationLog }: Params) {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installMessage, setInstallMessage] = useState('');
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlineCacheMessage, setOfflineCacheMessage] = useState('');
  const [offlineCacheStatus, setOfflineCacheStatus] = useState<'ok' | 'ng' | ''>('');

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setInstallMessage('このアプリをホーム画面に追加できます');
    };

    const handleInstalled = () => {
      setInstallPromptEvent(null);
      setShowInstallBanner(false);
      setInstallMessage('アプリをインストールしました');
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleServiceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'OFFLINE_CACHE_READY') {
        setOfflineCacheStatus('ok');
        setOfflineCacheMessage('オフライン利用の準備が完了しました');
      }
      if (event.data?.type === 'OFFLINE_CACHE_FAILED') {
        setOfflineCacheStatus('ng');
        setOfflineCacheMessage('オフライン用アセットの保存に失敗しました');
      }
      if (event.data?.type === 'OFFLINE_CACHE_REFRESHED') {
        setOfflineCacheStatus('ok');
        setOfflineCacheMessage('キャッシュを最新状態に更新しました');
      }
    };

    const handleControllerChange = () => {
      window.location.reload();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
  };

  const handleInstallApp = async () => {
    if (!installPromptEvent) {
      setInstallMessage('この端末ではブラウザメニューからホーム画面追加を行ってください');
      addOperationLog('インストール案内のみ表示しました', 'app');
      return;
    }

    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallMessage('インストールを開始しました');
      setShowInstallBanner(false);
      addOperationLog('PWAインストールを開始しました', 'app');
    } else {
      setInstallMessage('インストールはキャンセルされました');
      addOperationLog('PWAインストールをキャンセルしました', 'app');
    }
    setInstallPromptEvent(null);
  };

  const handlePrepareOffline = async () => {
    if (!('serviceWorker' in navigator)) {
      setOfflineCacheStatus('ng');
      setOfflineCacheMessage('この環境ではService Workerが使えません');
      return;
    }

    setOfflineCacheStatus('');
    setOfflineCacheMessage('オフライン用アセットを保存中です...');
    addOperationLog('オフライン用アセット保存を開始しました', 'app');

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'CACHE_OFFLINE_ASSETS' });
  };

  const handleRefreshOfflineCache = async () => {
    if (!('serviceWorker' in navigator)) {
      setOfflineCacheStatus('ng');
      setOfflineCacheMessage('この環境ではService Workerが使えません');
      return;
    }

    if (isOffline) {
      setOfflineCacheStatus('ng');
      setOfflineCacheMessage('オフライン中はキャッシュ更新できません');
      return;
    }

    setOfflineCacheStatus('');
    setOfflineCacheMessage('キャッシュを更新中です...');
    addOperationLog('オフラインキャッシュ更新を開始しました', 'app');

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'REFRESH_OFFLINE_CACHE' });
    registration.update().catch(() => {
      setOfflineCacheStatus('ng');
      setOfflineCacheMessage('更新確認に失敗しました');
    });
  };

  return {
    installMessage,
    showInstallBanner,
    hasInstallPrompt: Boolean(installPromptEvent),
    isOffline,
    offlineCacheMessage,
    offlineCacheStatus,
    dismissInstallBanner,
    handleInstallApp,
    handlePrepareOffline,
    handleRefreshOfflineCache,
  };
}
