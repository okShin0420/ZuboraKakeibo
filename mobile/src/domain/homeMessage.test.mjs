import assert from 'node:assert/strict';
import test from 'node:test';

import { homeMessage } from './homeMessage.ts';

const cases = [
  [80, ['今日も、自分のペースで。', 'まだまだ余裕があるね。', 'このままゆったりいこう。']],
  [60, ['いい感じのペースだね。', 'この調子でいけそう。', '月末までいい感じにいけそう。']],
  [30, ['使い方を少し振り返ってみよう。', '残りの日数も見ておこう。', '月末までは少しゆっくりね。']],
  [9, ['まだ先は長いよ。出費を抑えよう！', 'このままだと足りないかも。', '月末まで持つか、確認しよう！']],
  [8, ['もう残りわずか！今すぐ確認しよう。', '残りわずか！必要なものだけに。', 'ほとんど残ってないよ。出費に注意！']],
];

test('残額割合と残り日数の15パターンを指定文言で表示する', () => {
  for (const [percentage, messages] of cases) {
    for (const [index, days] of [25, 15, 5].entries()) {
      assert.equal(homeMessage(100, percentage, days), messages[index]);
    }
  }
});

test('割合と日数の境界、および通常区分外の案内', () => {
  for (const [percentage, expected] of [
    [79, cases[1][1][0]], [59, cases[2][1][0]], [29, cases[3][1][0]],
    [10, cases[3][1][0]], [8, cases[4][1][0]], [0, cases[4][1][0]],
  ]) assert.equal(homeMessage(100, percentage, 25), expected);
  assert.equal(homeMessage(100, -100, 25), cases[4][1][0]);
  assert.equal(homeMessage(100, 80, 24), cases[0][1][1]);
  assert.equal(homeMessage(100, 80, 14), cases[0][1][2]);
  assert.equal(homeMessage(0, 0, 25), '今月の金額を設定してね。');
  assert.equal(homeMessage(100, 8, 4), '今月もあと少し。自分のペースで。');
});
