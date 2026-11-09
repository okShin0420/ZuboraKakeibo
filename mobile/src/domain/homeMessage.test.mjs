import assert from 'node:assert/strict';
import test from 'node:test';

import { homeMessage } from './homeMessage.ts';

const cases = [
  [80, ['今月が始まったね！使いすぎないようにね！', 'まだまだ余裕やん！その調子！', '節約達人すぎるて！ちょっとは自分にご褒美してあげてww']],
  [60, ['ちょっと使うペース早くない？ww', 'めっちゃいいペース！やりくりできてるやん！', '節約できすぎてる！やればできるやんw']],
  [30, ['このペースはまずいって！使い方考えて！', '残りの日数見てみ！使い方考えなよ！', 'いい感じ！でもここで油断したらあかんよ！']],
  [9, ['何してんねん！もう無くなるって！', 'あっかん！使いすぎてるで！', 'ちょうど使いきるペース！ニアピン狙い？ww']],
  [8, ['使い方荒すぎて笑えてくるwww何買ったん？ww', 'もう無いよ！どうすんの！', 'もうあとちょっと！ふんばって！']],
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
  assert.equal(homeMessage(100, -100, 25), 'ちょっと使いすぎちゃったね。');
  assert.equal(homeMessage(100, 80, 24), cases[0][1][1]);
  assert.equal(homeMessage(100, 80, 14), cases[0][1][2]);
  assert.equal(homeMessage(0, 0, 25), '予算決めよーよー。');
  assert.equal(homeMessage(0, -100, 4), '予算決めよーよー。');
  assert.equal(homeMessage(100, 8, 4), '今月もあと少し。自分のペースで。');
});
