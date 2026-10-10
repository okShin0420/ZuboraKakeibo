import { Image as ExpoImage } from 'expo-image';
import { Image as NativeImage, Platform } from 'react-native';

// A single source for every screen keeps Expo Image's cache keys identical.
export const dogImage = require('../../assets/jikkun-optimized.png');
export const dogBlinkEyesImage = require('../../assets/jikkun-blink-eyes.png');
export const homeSkyImage = require('../../assets/home-sunset-optimized.jpg');
export const onboardingPreviewImage = require('../../assets/onboarding/home-preview.png');
export const onboardingBudgetCardImage = require('../../assets/onboarding/dog-budget-card-only.png');
export const onboardingHomeBackgroundImage = require('../../assets/onboarding/home-screen-background.png');
export const onboardingOriginalPhoneImage = require('../../assets/onboarding/original-home-phone.png');
export const onboardingExpensePhoneImage = require('../../assets/onboarding/expense-phone-upright-full-battery.png');
export const onboardingCalendarGraphPhonesImage = require('../../assets/onboarding/calendar-graph-phones-v2-full-battery.png');

let preloadPromise: Promise<boolean> | undefined;

export function preloadVisualAssets(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(true);
  if (!preloadPromise) {
    const urls = [dogImage, dogBlinkEyesImage, homeSkyImage, onboardingOriginalPhoneImage,
      onboardingExpensePhoneImage, onboardingCalendarGraphPhonesImage]
      .map(asset => NativeImage.resolveAssetSource(asset).uri);
    preloadPromise = ExpoImage.prefetch(urls, 'memory-disk').catch(() => false);
  }
  return preloadPromise;
}
