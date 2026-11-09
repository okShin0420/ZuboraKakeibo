import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const scheduled = [];
let nextId = 0;
let permissionGranted = true;
const fakeNotifications = {
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  async getPermissionsAsync() { return { granted: permissionGranted, canAskAgain: true }; },
  async requestPermissionsAsync() { return { granted: permissionGranted, canAskAgain: true }; },
  async getAllScheduledNotificationsAsync() { return scheduled.map(({ identifier, content }) => ({ identifier, content })); },
  async cancelScheduledNotificationAsync(identifier) {
    const index = scheduled.findIndex(item => item.identifier === identifier);
    if (index >= 0) scheduled.splice(index, 1);
  },
  async scheduleNotificationAsync(request) {
    const identifier = String(++nextId);
    scheduled.push({ identifier, ...request });
    return identifier;
  },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'expo-notifications') return fakeNotifications;
  if (request === 'react-native') return { Platform: { OS: 'ios' } };
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(code, filename);
};

const { budgetReminderTitle, budgetReminderBody, cancelEveningReminders, eveningReminderBodies, isEveningReminderNotification,
  syncEveningReminders, upcomingEveningReminders } = require('./eveningReminders.ts');
const settings = { monthlyNotificationEnabled: true };

test('火・木・日だけを今後4週分予約し、起動した当日は除く', () => {
  const now = new Date('2026-11-10T01:00:00Z'); // Tuesday 10:00 JST
  const plan = upcomingEveningReminders(now);
  assert.equal(plan.length, 12);
  assert.equal(plan[0].date.toISOString(), '2026-11-12T12:30:00.000Z');
  assert.equal(plan[0].body, eveningReminderBodies[4]);
  assert.equal(plan[0].body, 'お金使ってないの？？？？？？');
  assert.equal(plan[0].title, '寂しいよーーーーーーーーー');
  assert.equal(plan[1].body, eveningReminderBodies[0]);
  assert.equal(plan[1].body, '楽しむのも大事だけど忘れないでよ！');
  assert.equal(plan[1].title, 'おーーーーーーーーーい');
  assert.equal(plan[2].title, '最近お金使ってないの？');
  assert.equal(plan[2].body, 'アプリ開いてくれてないけど…');
  assert.ok(plan.every(item => [0, 2, 4].includes(new Date(item.date.getTime() + 9 * 3600000).getUTCDay())));
});

test('21:30固定、重複なし、当日起動、OFF、全削除を反映する', async () => {
  scheduled.length = 0;
  permissionGranted = true;
  const monday = new Date('2026-11-09T01:00:00Z');
  await syncEveningReminders(settings, monday);
  assert.equal(scheduled.length, 12);
  await syncEveningReminders(settings, monday);
  assert.equal(scheduled.length, 12);
  await syncEveningReminders(settings, new Date('2026-11-10T01:00:00Z'));
  assert.equal(scheduled.length, 12);
  assert.ok(scheduled.every(item => item.content.data.scheduledAt !== '2026-11-10T12:30:00.000Z'));
  assert.ok(scheduled.every(item => item.trigger.date.toISOString().endsWith('12:30:00.000Z')));
  scheduled.push({ identifier: 'other', content: { data: {} } });
  await syncEveningReminders({ ...settings, monthlyNotificationEnabled: false }, monday);
  assert.deepEqual(scheduled.map(item => item.identifier), ['other']);
  await syncEveningReminders(settings, monday);
  await cancelEveningReminders();
  assert.deepEqual(scheduled.map(item => item.identifier), ['other']);
  scheduled.length = 0;
});

test('予算0円の間は火・土だけ予算設定を促し、設定後は通常の通知へ切り替える', async () => {
  scheduled.length = 0;
  permissionGranted = true;
  const monday = new Date('2026-11-09T01:00:00Z');
  const plan = upcomingEveningReminders(monday, true);
  assert.equal(plan.length, 8);
  assert.ok(plan.every(item => [2, 6].includes(new Date(item.date.getTime() + 9 * 3600000).getUTCDay())));
  assert.ok(plan.every(item => item.title === budgetReminderTitle && item.body === budgetReminderBody));
  assert.equal(budgetReminderTitle, '忘れてない？');
  assert.equal(budgetReminderBody, '寝る前くらいアプリ開いてよ…');
  await syncEveningReminders(settings, monday, true);
  assert.equal(scheduled.length, 8);
  assert.ok(scheduled.every(item => item.content.title === budgetReminderTitle));
  await syncEveningReminders(settings, monday, true);
  assert.equal(scheduled.length, 8);
  await syncEveningReminders(settings, monday, false);
  assert.equal(scheduled.length, 12);
  assert.ok(scheduled.every(item => item.content.title !== budgetReminderTitle));
  await syncEveningReminders({ ...settings, monthlyNotificationEnabled: false }, monday, true);
  assert.equal(scheduled.length, 0);
});

test('権限拒否時は予約せず、既存のテスト通知もタップ先を判別できる', async () => {
  scheduled.length = 0;
  permissionGranted = false;
  assert.match(await syncEveningReminders(settings, new Date('2026-11-09T01:00:00Z')), /許可されていません/);
  assert.equal(scheduled.length, 0);
  assert.equal(isEveningReminderNotification({ zuboraEveningReminderTest: true }), true);
  assert.equal(isEveningReminderNotification({ zuboraEveningReminder: true }), true);
  permissionGranted = true;
  scheduled.length = 0;
});
