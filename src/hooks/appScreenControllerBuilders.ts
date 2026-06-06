import { APP_NAME, APP_VERSION } from './appScreenControllerSelectors';
import type {
  AppFooterPanelsProps,
  AppFooterProps,
  AppHeaderProps,
  AppModalLayerProps,
  AppTopPanelsProps,
  BattleScreenInputProps,
  BattleScreenProps,
  DeckEditorProps,
  HeaderInputProps,
  LeaderSetupEditorProps,
} from './appScreenControllerTypes';

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
