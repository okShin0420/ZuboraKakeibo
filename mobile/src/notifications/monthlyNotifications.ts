import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Settings } from '../repository/types';
import type { IsoDate } from '../domain/period';

const CHANNEL_ID = 'monthly-budget-start';
const MANAGED_KEY = 'zuboraMonthlyStart';
const FUTURE_COUNT = 12;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function notificationDate(date: IsoDate): Date {
  // アプリの月度と同じ Asia/Tokyo 基準。端末のタイムゾーン変更でも通知日をずらさない。
  return new Date(`${date}T09:00:00+09:00`);
}

export function upcomingNotificationTimes(dates: IsoDate[], now = new Date()): Date[] {
  return dates.map(notificationDate)
    .filter(date => date.getTime() > now.getTime())
    .slice(0, FUTURE_COUNT);
}

async function sync(settings: Settings, getDates: () => Promise<IsoDate[]>): Promise<string> {
  if (Platform.OS === 'web') return '';
  const existing = (await Notifications.getAllScheduledNotificationsAsync())
    .filter(request => request.content.data?.[MANAGED_KEY] === true);

  if (!settings.monthlyNotificationEnabled) {
    for (const request of existing) await Notifications.cancelScheduledNotificationAsync(request.identifier);
    return '';
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '月度のはじまり', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    for (const request of existing) await Notifications.cancelScheduledNotificationAsync(request.identifier);
    return '端末の通知が許可されていません。端末の設定から通知を許可してください。';
  }

  const dates = await getDates();
  const times = upcomingNotificationTimes(dates);
  const desired = new Set(times.map(date => date.toISOString()));
  const retained = new Set<string>();
  for (const request of existing) {
    const scheduledAt = request.content.data?.scheduledAt;
    if (typeof scheduledAt === 'string' && desired.has(scheduledAt) && !retained.has(scheduledAt)) {
      retained.add(scheduledAt);
    } else {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
  for (const date of times) {
    const scheduledAt = date.toISOString();
    if (retained.has(scheduledAt)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '新しい月度がはじまりました',
        body: '今月のやりくり金額を確認してみましょう。',
        data: { [MANAGED_KEY]: true, scheduledAt },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
  return '';
}

let previousSync: Promise<unknown> = Promise.resolve();
export function syncMonthlyNotifications(settings: Settings, getDates: () => Promise<IsoDate[]>): Promise<string> {
  const next = previousSync.catch(() => undefined).then(() => sync(settings, getDates));
  previousSync = next;
  return next;
}
