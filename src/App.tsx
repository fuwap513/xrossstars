import AppHeader from './components/AppHeader';
import AppTopPanels from './components/AppTopPanels';
import AppFooterPanels from './components/AppFooterPanels';
import AppFooter from './components/AppFooter';
import AppModalLayer from './components/AppModalLayer';
import DeckEditor from './components/DeckEditor';
import BattleScreen from './components/BattleScreen';
import LeaderSetupEditor from './components/LeaderSetupEditor';
import useAppScreenController from './hooks/useAppScreenController';

export default function App() {
  const {
    currentScreen,
    headerProps,
    topPanelsProps,
    deckEditorProps,
    leaderSetupEditorProps,
    battleScreenProps,
    footerPanelsProps,
    modalLayerProps,
    appFooterProps,
  } = useAppScreenController();

  return (
    <main className="app-shell">
      <AppHeader {...headerProps} />

      <AppTopPanels {...topPanelsProps} />

      {currentScreen === 'deck' ? (
        <>
          <DeckEditor {...deckEditorProps} />
          <LeaderSetupEditor {...leaderSetupEditorProps} />
        </>
      ) : (
        <BattleScreen {...battleScreenProps} />
      )}

      <AppFooterPanels {...footerPanelsProps} />

      <AppModalLayer {...modalLayerProps} />

      <AppFooter {...appFooterProps} />
    </main>
  );
}
