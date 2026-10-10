import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const scheduled = [];
let granted = true;
let prompts = 0;
const fakeNotifications = {
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler() {},
  async setNotificationChannelAsync() {},
  async getPermissionsAsync() { return { granted, canAskAgain: !granted }; },
  async requestPermissionsAsync() { prompts++; return { granted, canAskAgain: !granted }; },
  async getAllScheduledNotificationsAsync() { return scheduled.map(({ identifier, content }) => ({ identifier, content })); },
  async cancelScheduledNotificationAsync(identifier) {
    scheduled.splice(scheduled.findIndex(item => item.identifier === identifier), 1);
  },
  async scheduleNotificationAsync(request) {
    const identifier = String(scheduled.length + 1);
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
const { notificationDate, upcomingNotificationTimes, syncMonthlyNotifications } = require('./monthlyNotifications.ts');
const settings = { monthlyNotificationEnabled: true };

test('通知日時は日本時間で作り、過ぎた時刻は除く', () => {
  assert.equal(notificationDate('2026-10-08').toISOString(), '2026-10-08T00:00:00.000Z');
  assert.deepEqual(upcomingNotificationTimes(['2026-10-08', '2026-11-08'],
    new Date('2026-10-08T00:01:00Z')).map(date => date.toISOString()), ['2026-11-08T00:00:00.000Z']);
});

test('端末内予約は重複させず、月度変更とOFFで更新する', async () => {
  scheduled.length = 0; granted = true;
  const dates = async () => ['2027-01-08', '2027-02-08'];
  await syncMonthlyNotifications(settings, dates);
  assert.equal(scheduled.length, 2);
  await syncMonthlyNotifications(settings, dates);
  assert.equal(scheduled.length, 2);
  await syncMonthlyNotifications(settings, async () => ['2027-01-08', '2027-03-08']);
  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[0].trigger.date.toISOString(), '2027-01-08T00:00:00.000Z');
  assert.equal(scheduled[1].trigger.date.toISOString(), '2027-03-08T00:00:00.000Z');
  await syncMonthlyNotifications({ ...settings, monthlyNotificationEnabled: false }, dates);
  assert.equal(scheduled.length, 0);
});

test('通知権限が拒否されたら予約しない', async () => {
  granted = false; prompts = 0;
  const warning = await syncMonthlyNotifications(settings, async () => ['2027-01-08']);
  assert.match(warning, /許可されていません/);
  assert.equal(prompts, 1);
  assert.equal(scheduled.length, 0);
});
