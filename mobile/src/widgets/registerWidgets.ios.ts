import { requireOptionalNativeModule } from 'expo';
import { addDays } from '../domain/period';
import type { Home } from '../repository/types';
import { todayInTokyo } from '../ui/format';
import type { OpenHomeWidgetProps } from './openHomeWidget';
import { isWidgetDiagnosticBypassed, markStartupPhase } from '../startup/startupDiagnostics';

// Expo Go and older development builds do not contain the widget native module.
// Register the widget only in a binary built after expo-widgets was installed.
markStartupPhase('ウィジェット：ネイティブモジュール確認開始');
const nativeWidgetsAvailable = !isWidgetDiagnosticBypassed() && !!requireOptionalNativeModule('ExpoWidgets');
markStartupPhase(nativeWidgetsAvailable ? 'ウィジェット：レイアウト登録開始' : 'ウィジェット：未搭載または診断で除外');
const widget = nativeWidgetsAvailable ? require('./openHomeWidget').default as import('expo-widgets').Widget<OpenHomeWidgetProps> : null;
markStartupPhase('ウィジェット：登録処理の完了');
export async function updateHomeWidget(home: Home | null): Promise<void> {
  if (!widget) return;
  try {
    const props: OpenHomeWidgetProps = {
      amountText: home ? `¥${Math.round(home.remainingAmount).toLocaleString('ja-JP')}` : '¥—',
      daysText: home ? `残り${home.remainingDays}日` : '残り—日',
      dogUri: '',
    };
    if (!home) {
      widget.updateSnapshot(props);
      return;
    }
    // The native widget loads the image bundled with its extension. Do not
    // delay the balance update for a second image copy into the App Group.
    const today = todayInTokyo();
    const remainingDays = Number.isFinite(home.remainingDays) ? Math.max(0, Math.floor(home.remainingDays)) : 0;
    const entries = Array.from({ length: Math.min(remainingDays, 32) + 1 }, (_, offset) => ({
      date: offset === 0 ? new Date() : new Date(`${addDays(today, offset)}T00:00:00+09:00`),
      props: {
        ...props,
        daysText: offset >= remainingDays ? '残り—日' : `残り${remainingDays - offset}日`,
        amountText: offset >= remainingDays ? '¥—' : props.amountText,
      },
    }));
    widget.updateTimeline(entries);
  } catch (cause) {
    console.warn('ロック画面ウィジェットを更新できませんでした。', cause);
  }
}
