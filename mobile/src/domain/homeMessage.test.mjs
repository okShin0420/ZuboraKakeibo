import assert from 'node:assert/strict';
import test from 'node:test';

import { homeMessage } from './homeMessage.ts';

const cases = [
  [80, ['今月が始まったね！使いすぎないようにね！', 'まだまだ余裕やん！その調子！', '節約達人すぎるて！ちょっとは自分にご褒美してあげなね！']],
  [60, ['ちょっと使うペース早くない？', 'めっちゃいいペース！やりくりできてるやん！', '節約できすぎてる！やればできる！']],
  [30, ['このペースはまずいって！使い方考えて！', '残りの日数見て！使い方考えなよ！', 'いい感じ！でもここで油断したらあかんよ！']],
  [9, ['何してるん！もう無くなるって！', 'あっかん！使いすぎてるで！', 'ちょうど使いきるペース！ニアピン狙い？']],
  [8, ['使い方荒すぎて笑えてくるよ！何買ったん？？', 'もう無いよ！どうすんの！', 'もうあとちょっと！ふんばって！']],
];

test('残額割合と残り日数の15パターンを指定文言で表示する', () => {
  for (const [percentage, messages] of cases) {
    for (const [index, days] of [25, 15, 5].entries()) {
      assert.equal(homeMessage(10000, percentage * 100, days), messages[index]);
    }
  }
});

test('割合と日数の境界、および通常区分外の案内', () => {
  for (const [percentage, expected] of [
    [79, cases[1][1][0]], [59, cases[2][1][0]], [29, cases[3][1][0]],
    [10, cases[3][1][0]], [8, cases[4][1][0]], [0, cases[4][1][0]],
  ]) assert.equal(homeMessage(10000, percentage * 100, 25), expected);
  assert.equal(homeMessage(10000, 8000, 24), cases[0][1][1]);
  assert.equal(homeMessage(10000, 8000, 14), cases[0][1][2]);
  assert.equal(homeMessage(10000, 800, 4), 'やりくり上手い！完璧じゃん！');
});

test('予算0円と少額予算は残額割合の表より優先する', () => {
  for (const days of [30, 4]) {
    assert.equal(homeMessage(0, 0, days), '使いながら予算決めていこ！');
    assert.equal(homeMessage(1, 1, days), '予算少ないけど大丈夫？？');
    assert.equal(homeMessage(1000, 0, days), '予算少ないけど大丈夫？？');
    assert.equal(homeMessage(1001, 1001, days), 'このくらいの予算からはじめてみるのもあり！');
    assert.equal(homeMessage(5000, 5000, days), 'このくらいの予算からはじめてみるのもあり！');
    assert.equal(homeMessage(5001, 5001, days), days <= 4
      ? 'やりくり上手い！完璧じゃん！' : cases[0][1][0]);
  }
});

test('マイナス残額は予算の設定有無と金額帯で切り替える', () => {
  const bands = [
    [-1, 'ついにマイナスだよ...', '使いながら予算決めていこ！'],
    [-5000, 'ついにマイナスだよ...', '使いながら予算決めていこ！'],
    [-5001, 'マイナスが膨らんでる～', '予算決めてもいいかも！'],
    [-10000, 'マイナスが膨らんでる～', '予算決めてもいいかも！'],
    [-10001, '使い方考えないと止まらないよ！', 'そろそろ予算決めてみない？'],
    [-30000, '使い方考えないと止まらないよ！', 'そろそろ予算決めてみない？'],
    [-30001, 'もう使うのやめよ...', '予算決めないの？'],
  ];
  for (const [remaining, withBudget, withoutBudget] of bands) {
    assert.equal(homeMessage(1000, remaining, 4), withBudget);
    assert.equal(homeMessage(0, remaining, 30), withoutBudget);
  }
});
