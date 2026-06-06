import type { ComponentProps } from 'react';
import AppFooter from '../components/AppFooter';
import AppFooterPanels from '../components/AppFooterPanels';
import AppHeader from '../components/AppHeader';
import AppModalLayer from '../components/AppModalLayer';
import AppTopPanels from '../components/AppTopPanels';
import BattleScreen from '../components/BattleScreen';
import DeckEditor from '../components/DeckEditor';
import LeaderSetupEditor from '../components/LeaderSetupEditor';
import type { AppScreen } from '../types/game';

export type AppHeaderProps = ComponentProps<typeof AppHeader>;
export type AppTopPanelsProps = ComponentProps<typeof AppTopPanels>;
export type DeckEditorProps = ComponentProps<typeof DeckEditor>;
export type LeaderSetupEditorProps = ComponentProps<typeof LeaderSetupEditor>;
export type BattleScreenProps = ComponentProps<typeof BattleScreen>;
export type AppFooterPanelsProps = ComponentProps<typeof AppFooterPanels>;
export type AppModalLayerProps = ComponentProps<typeof AppModalLayer>;
export type AppFooterProps = ComponentProps<typeof AppFooter>;

export type HeaderInputProps = Omit<AppHeaderProps, 'appName' | 'appVersion'>;
export type BattleScreenInputProps = Omit<BattleScreenProps, 'appName' | 'appVersion'>;

export type AppScreenControllerResult = {
  currentScreen: AppScreen;
  headerProps: AppHeaderProps;
  topPanelsProps: AppTopPanelsProps;
  deckEditorProps: DeckEditorProps;
  leaderSetupEditorProps: LeaderSetupEditorProps;
  battleScreenProps: BattleScreenProps;
  footerPanelsProps: AppFooterPanelsProps;
  modalLayerProps: AppModalLayerProps;
  appFooterProps: AppFooterProps;
};

