const messages = [
  ['今月が始まったね！使いすぎないようにね！', 'まだまだ余裕やん！その調子！', '節約達人すぎるて！ちょっとは自分にご褒美してあげなね！'],
  ['ちょっと使うペース早くない？', 'めっちゃいいペース！やりくりできてるやん！', '節約できすぎてる！やればできる！'],
  ['このペースはまずいって！使い方考えて！', '残りの日数見て！使い方考えなよ！', 'いい感じ！でもここで油断したらあかんよ！'],
  ['何してるん！もう無くなるって！', 'あっかん！使いすぎてるで！', 'ちょうど使いきるペース！ニアピン狙い？'],
  ['使い方荒すぎて笑えてくるよ！何買ったん？？', 'もう無いよ！どうすんの！', 'もうあとちょっと！ふんばって！'],
] as const;

function negativeBalanceMessage(remainingAmount: number, hasBudget: boolean): string {
  if (remainingAmount < -30000) return hasBudget ? 'もう使うのやめよ...' : '予算決めないの？';
  if (remainingAmount < -10000) return hasBudget ? '使い方考えないと止まらないよ！' : 'そろそろ予算決めてみない？';
  if (remainingAmount < -5000) return hasBudget ? 'マイナスが膨らんでる～' : '予算決めてもいいかも！';
  return hasBudget ? 'ついにマイナスだよ...' : '使いながら予算決めていこ！';
}

export function homeMessage(budgetAmount: number, remainingAmount: number, remainingDays: number): string {
  if (budgetAmount <= 0) return negativeBalanceMessage(Math.min(remainingAmount, 0), false);
  if (remainingAmount < 0) return negativeBalanceMessage(remainingAmount, true);
  if (budgetAmount <= 1000) return '予算少ないけど大丈夫？？';
  if (budgetAmount <= 5000) return 'このくらいの予算からはじめてみるのもあり！';
  if (remainingDays < 5) return 'やりくり上手い！完璧じゃん！';

  const percentage = Math.floor(Math.max(0, remainingAmount) * 100 / budgetAmount);
  const row = percentage >= 80 ? 0 : percentage >= 60 ? 1 : percentage >= 30 ? 2
    : percentage >= 9 ? 3 : 4;

  const column = remainingDays >= 25 ? 0 : remainingDays >= 15 ? 1 : 2;
  return messages[row][column];
}
