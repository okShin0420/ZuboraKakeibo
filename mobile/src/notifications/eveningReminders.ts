import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, type IsoDate } from '../domain/period';
import type { Settings } from '../repository/types';

const MANAGED_KEY = 'zuboraEveningReminder';
const TEST_KEY = 'zuboraEveningReminderTest';
const CHANNEL_ID = 'evening-check-in';
const LOOKAHEAD_DAYS = 28;
const MINUTE = 30;
const HOUR = 21;

export const eveningReminderBodies: Record<number, string> = {
  2: '1日お疲れ様！今日は買い物しなかった？',
  4: '出費があれば、ぽんと入力。なかったら、おやすみなさい。',
  6: '疲れは取れた？使ってなければ、記録しなくて大丈夫だよ。',
};

function tokyoToday(now: Date): IsoDate {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function upcomingEveningReminders(now = new Date()): Array<{ date: Date; body: string }> {
  const today = tokyoToday(now);
  const result: Array<{ date: Date; body: string }> = [];
  // The app is open now: today's reminder must not be delivered, even if it is not yet evening.
  for (let offset = 1; offset <= LOOKAHEAD_DAYS; offset++) {
    const day = addDays(today, offset);
    const body = eveningReminderBodies[new Date(`${day}T00:00:00Z`).getUTCDay()];
    if (body) result.push({ date: new Date(`${day}T${HOUR}:${MINUTE}:00+09:00`), body });
  }
  return result;
}

let previousSync: Promise<unknown> = Promise.resolve();

export function syncEveningReminders(settings: Settings, now = new Date()): Promise<string> {
  const next = previousSync.catch(() => undefined).then(async () => {
    if (Platform.OS === 'web') return '';
    const existing = (await Notifications.getAllScheduledNotificationsAsync())
      .filter(request => request.content.data?.[MANAGED_KEY] === true);
    if (!settings.monthlyNotificationEnabled) {
      for (const request of existing) await Notifications.cancelScheduledNotificationAsync(request.identifier);
      return '';
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: '夜のやさしい確認', importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      for (const request of existing) await Notifications.cancelScheduledNotificationAsync(request.identifier);
      return '端末の通知が許可されていません。端末の設定から通知を許可してください。';
    }
    const desired = upcomingEveningReminders(now);
    const byTime = new Map(desired.map(item => [item.date.toISOString(), item]));
    const retained = new Set<string>();
    for (const request of existing) {
      const time = request.content.data?.scheduledAt;
      if (typeof time === 'string' && byTime.has(time) && !retained.has(time)) retained.add(time);
      else await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
    for (const item of desired) {
      const scheduledAt = item.date.toISOString();
      if (retained.has(scheduledAt)) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '今日はどうだった？',
          body: item.body,
          data: { [MANAGED_KEY]: true, scheduledAt },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.date,
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
      });
    }
    return '';
  });
  previousSync = next;
  return next;
}

export function cancelEveningReminders(): Promise<void> {
  const next = previousSync.catch(() => undefined).then(async () => {
    if (Platform.OS === 'web') return;
    const existing = (await Notifications.getAllScheduledNotificationsAsync())
      .filter(request => request.content.data?.[MANAGED_KEY] === true);
    for (const request of existing) await Notifications.cancelScheduledNotificationAsync(request.identifier);
  });
  previousSync = next;
  return next;
}

export function isEveningReminderNotification(data: Record<string, unknown>): boolean {
  return data[MANAGED_KEY] === true || data[TEST_KEY] === true;
}
