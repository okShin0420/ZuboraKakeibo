import { Image as ExpoImage } from 'expo-image';
import { Image as NativeImage, Platform } from 'react-native';

// A single source for every screen keeps Expo Image's cache keys identical.
export const dogImage = require('../../assets/jikkun-optimized.png');
export const dogBlinkEyesImage = require('../../assets/jikkun-blink-eyes.png');
export const homeSkyImage = require('../../assets/home-sunset-optimized.jpg');
export const onboardingPreviewImage = require('../../assets/onboarding/home-preview.png');
export const onboardingBudgetCardImage = require('../../assets/onboarding/dog-budget-card-only.png');
export const onboardingHomeBackgroundImage = require('../../assets/onboarding/home-screen-background.png');
export const onboardingHomePhoneImage = require('../../assets/onboarding/home-phone-full-battery-glass-month.png');
export const onboardingExpensePhoneImage = require('../../assets/onboarding/expense-phone-upright-full-battery.png');
export const onboardingCalendarGraphPhonesImage = require('../../assets/onboarding/calendar-graph-phones-v2-full-battery.png');

let preloadPromise: Promise<boolean> | undefined;
let onboardingFirstImagePromise: Promise<boolean> | undefined;

export function preloadOnboardingFirstImage(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(true);
  if (!onboardingFirstImagePromise) {
    const uri = NativeImage.resolveAssetSource(onboardingHomePhoneImage).uri;
    onboardingFirstImagePromise = ExpoImage.prefetch(uri, 'memory-disk').catch(() => false);
  }
  return onboardingFirstImagePromise;
}

export function preloadVisualAssets(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(true);
  if (!preloadPromise) {
    // オンボーディング画像は各ページを描画するときに読み込む。
    // 初期画面の表示前に全ページ分を先読みすると、説明1の表示まで待ちが発生する。
    const urls = [dogImage, dogBlinkEyesImage, homeSkyImage]
      .map(asset => NativeImage.resolveAssetSource(asset).uri);
    preloadPromise = ExpoImage.prefetch(urls, 'memory-disk').catch(() => false);
  }
  return preloadPromise;
}
