const messages = [
  ['今月が始まったね！使いすぎないようにね！', 'まだまだ余裕やん！その調子！', '節約達人すぎるて！ちょっとは自分にご褒美してあげてww'],
  ['ちょっと使うペース早くない？ww', 'めっちゃいいペース！やりくりできてるやん！', '節約できすぎてる！やればできるやんw'],
  ['このペースはまずいって！使い方考えて！', '残りの日数見てみ！使い方考えなよ！', 'いい感じ！でもここで油断したらあかんよ！'],
  ['何してんねん！もう無くなるって！', 'あっかん！使いすぎてるで！', 'ちょうど使いきるペース！ニアピン狙い？ww'],
  ['使い方荒すぎて笑えてくるwww何買ったん？ww', 'もう無いよ！どうすんの！', 'もうあとちょっと！ふんばって！'],
] as const;

const overBudgetMessages = [
  'ちょっと使いすぎちゃったね。',
  '今月の使い方を、少し振り返ってね。',
  'あと少し。できる範囲でやりくりしよう。',
  '惜しい。来月また一緒に始めよう。',
] as const;

export function homeMessage(budgetAmount: number, remainingAmount: number, remainingDays: number): string {
  if (budgetAmount <= 0) return '予算決めよーよー。';
  if (remainingAmount < 0) {
    if (remainingDays <= 4) return overBudgetMessages[3];
    if (remainingDays >= 25) return overBudgetMessages[0];
    if (remainingDays >= 15) return overBudgetMessages[1];
    return overBudgetMessages[2];
  }
  if (remainingDays < 5) return '今月もあと少し。自分のペースで。';

  const percentage = Math.floor(Math.max(0, remainingAmount) * 100 / budgetAmount);
  const row = percentage >= 80 ? 0 : percentage >= 60 ? 1 : percentage >= 30 ? 2
    : percentage >= 9 ? 3 : 4;

  const column = remainingDays >= 25 ? 0 : remainingDays >= 15 ? 1 : 2;
  return messages[row][column];
}
