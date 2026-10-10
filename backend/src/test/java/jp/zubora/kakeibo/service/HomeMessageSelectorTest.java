package jp.zubora.kakeibo.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class HomeMessageSelectorTest {
    private static final String[][] EXPECTED = {
            { "今日も、自分のペースで。", "まだまだ余裕があるね。", "このままゆったりいこう。" },
            { "いい感じのペースだね。", "この調子でいけそう。", "月末までいい感じにいけそう。" },
            { "使い方を少し振り返ってみよう。", "残りの日数も見ておこう。", "月末までは少しゆっくりね。" },
            { "まだ先は長いよ。出費を抑えよう！", "このままだと足りないかも。", "月末まで持つか、確認しよう！" },
            { "もう残りわずか！今すぐ確認しよう。", "残りわずか！必要なものだけに。", "ほとんど残ってないよ。出費に注意！" }
    };

    @Test
    void selectsAllFifteenMessages() {
        int[] percentages = { 80, 60, 30, 9, 8 };
        int[] days = { 25, 15, 5 };
        for (int row = 0; row < percentages.length; row++) {
            for (int column = 0; column < days.length; column++) {
                assertEquals(EXPECTED[row][column], HomeMessageSelector.select(100, percentages[row], days[column]));
            }
        }
    }

    @Test
    void handlesPercentageAndDayBoundariesAndFallbacks() {
        assertEquals(EXPECTED[1][0], HomeMessageSelector.select(100, 79, 25));
        assertEquals(EXPECTED[2][0], HomeMessageSelector.select(100, 59, 25));
        assertEquals(EXPECTED[3][0], HomeMessageSelector.select(100, 29, 25));
        assertEquals(EXPECTED[3][0], HomeMessageSelector.select(100, 10, 25));
        assertEquals(EXPECTED[4][0], HomeMessageSelector.select(100, 0, 25));
        assertEquals(EXPECTED[4][0], HomeMessageSelector.select(100, -100, 25));
        assertEquals(EXPECTED[0][1], HomeMessageSelector.select(100, 80, 24));
        assertEquals(EXPECTED[0][2], HomeMessageSelector.select(100, 80, 14));
        assertEquals("今月の金額を設定してね。", HomeMessageSelector.select(0, 0, 25));
        assertEquals("今月もあと少し。自分のペースで。", HomeMessageSelector.select(100, 8, 4));
    }
}
