import type { ComponentProps } from 'react';
import AppFooterPanels from '../components/AppFooterPanels';
import AppHeader from '../components/AppHeader';
import AppModalLayer from '../components/AppModalLayer';
import AppTopPanels from '../components/AppTopPanels';
import BattleScreen from '../components/BattleScreen';
import DeckEditor from '../components/DeckEditor';
import LeaderSetupEditor from '../components/LeaderSetupEditor';
import { APP_NAME, APP_VERSION } from './appScreenControllerSelectors';

export type AppHeaderProps = ComponentProps<typeof AppHeader>;
export type AppTopPanelsProps = ComponentProps<typeof AppTopPanels>;
export type DeckEditorProps = ComponentProps<typeof DeckEditor>;
export type LeaderSetupEditorProps = ComponentProps<typeof LeaderSetupEditor>;
export type BattleScreenProps = ComponentProps<typeof BattleScreen>;
export type AppFooterPanelsProps = ComponentProps<typeof AppFooterPanels>;
export type AppModalLayerProps = ComponentProps<typeof AppModalLayer>;

export type AppFooterProps = {
  appName: string;
  appVersion: string;
};

export type HeaderInputProps = Omit<AppHeaderProps, 'appName' | 'appVersion'>;
export type BattleScreenInputProps = Omit<BattleScreenProps, 'appName' | 'appVersion'>;

export const buildHeaderProps = (
  props: HeaderInputProps,
): AppHeaderProps => ({
  appName: APP_NAME,
  appVersion: APP_VERSION,
  ...props,
});

export const buildTopPanelsProps = (
  props: AppTopPanelsProps,
): AppTopPanelsProps => props;

export const buildDeckEditorProps = (
  props: DeckEditorProps,
): DeckEditorProps => props;

export const buildLeaderSetupEditorProps = (
  props: LeaderSetupEditorProps,
): LeaderSetupEditorProps => props;

export const buildBattleScreenProps = (
  props: BattleScreenInputProps,
): BattleScreenProps => ({
  appName: APP_NAME,
  appVersion: APP_VERSION,
  ...props,
});

export const buildFooterPanelsProps = (
  props: AppFooterPanelsProps,
): AppFooterPanelsProps => props;

export const buildModalLayerProps = (
  props: AppModalLayerProps,
): AppModalLayerProps => props;

export const buildAppFooterProps = (): AppFooterProps => ({
  appName: APP_NAME,
  appVersion: APP_VERSION,
});
