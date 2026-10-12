const messages = [
  ['今日も、自分のペースで。', 'まだまだ余裕があるね。', 'このままゆったりいこう。'],
  ['いい感じのペースだね。', 'この調子でいけそう。', '月末までいい感じにいけそう。'],
  ['使い方を少し振り返ってみよう。', '残りの日数も見ておこう。', '月末までは少しゆっくりね。'],
  ['まだ先は長いよ。出費を抑えよう！', 'このままだと足りないかも。', '月末まで持つか、確認しよう！'],
  ['もう残りわずか！今すぐ確認しよう。', '残りわずか！必要なものだけに。', 'ほとんど残ってないよ。出費に注意！'],
] as const;

export function homeMessage(budgetAmount: number, remainingAmount: number, remainingDays: number): string {
  if (budgetAmount <= 0) return '今月の金額を設定してね。';
  if (remainingDays < 5) return '今月もあと少し。自分のペースで。';

  const percentage = Math.floor(Math.max(0, remainingAmount) * 100 / budgetAmount);
  const row = percentage >= 80 ? 0 : percentage >= 60 ? 1 : percentage >= 30 ? 2
    : percentage >= 9 ? 3 : 4;

  const column = remainingDays >= 25 ? 0 : remainingDays >= 15 ? 1 : 2;
  return messages[row][column];
}
