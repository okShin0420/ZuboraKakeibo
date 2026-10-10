import type { SQLiteDatabase } from 'expo-sqlite';
import { withDatabaseTransaction } from './transaction';

// 内閣府「国民の祝日について」掲載の祝日・休日（振替休日・国民の休日を含む）。
// https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
// 公表済みの年だけをcoverageとして登録する。新しい年は公式発表後に更新する。
const source = '内閣府 国民の祝日について';
export const bundledHolidays: Readonly<Record<number, ReadonlyArray<readonly [string, string]>>> = {
  2025: [
    ['2025-01-01', '元日'], ['2025-01-13', '成人の日'], ['2025-02-11', '建国記念の日'],
    ['2025-02-23', '天皇誕生日'], ['2025-02-24', '休日'], ['2025-03-20', '春分の日'],
    ['2025-04-29', '昭和の日'], ['2025-05-03', '憲法記念日'], ['2025-05-04', 'みどりの日'],
    ['2025-05-05', 'こどもの日'], ['2025-05-06', '休日'], ['2025-07-21', '海の日'],
    ['2025-08-11', '山の日'], ['2025-09-15', '敬老の日'], ['2025-09-23', '秋分の日'],
    ['2025-10-13', 'スポーツの日'], ['2025-11-03', '文化の日'],
    ['2025-11-23', '勤労感謝の日'], ['2025-11-24', '休日'],
  ],
  2026: [
    ['2026-01-01', '元日'], ['2026-01-12', '成人の日'], ['2026-02-11', '建国記念の日'],
    ['2026-02-23', '天皇誕生日'], ['2026-03-20', '春分の日'], ['2026-04-29', '昭和の日'],
    ['2026-05-03', '憲法記念日'], ['2026-05-04', 'みどりの日'],
    ['2026-05-05', 'こどもの日'], ['2026-05-06', '休日'], ['2026-07-20', '海の日'],
    ['2026-08-11', '山の日'], ['2026-09-21', '敬老の日'], ['2026-09-22', '休日'],
    ['2026-09-23', '秋分の日'], ['2026-10-12', 'スポーツの日'],
    ['2026-11-03', '文化の日'], ['2026-11-23', '勤労感謝の日'],
  ],
  2027: [
    ['2027-01-01', '元日'], ['2027-01-11', '成人の日'], ['2027-02-11', '建国記念の日'],
    ['2027-02-23', '天皇誕生日'], ['2027-03-21', '春分の日'], ['2027-03-22', '休日'],
    ['2027-04-29', '昭和の日'], ['2027-05-03', '憲法記念日'],
    ['2027-05-04', 'みどりの日'], ['2027-05-05', 'こどもの日'],
    ['2027-07-19', '海の日'], ['2027-08-11', '山の日'], ['2027-09-20', '敬老の日'],
    ['2027-09-23', '秋分の日'], ['2027-10-11', 'スポーツの日'],
    ['2027-11-03', '文化の日'], ['2027-11-23', '勤労感謝の日'],
  ],
};

export async function seedBundledHolidays(db: SQLiteDatabase): Promise<void> {
  for (const [yearText, holidays] of Object.entries(bundledHolidays)) {
    const year = Number(yearText);
    const existing = await db.getFirstAsync<{ calendar_year: number }>(
      'SELECT calendar_year FROM holiday_calendar_coverage WHERE calendar_year = ?', [year],
    );
    if (existing) continue;
    await withDatabaseTransaction(db, async (tx) => {
      const timestamp = new Date().toISOString();
      await tx.runAsync(
        'INSERT INTO holiday_calendar_coverage (calendar_year, source, imported_at) VALUES (?, ?, ?)',
        [year, source, timestamp],
      );
      for (const [date, name] of holidays) {
        await tx.runAsync(
          'INSERT INTO holidays (holiday_date, calendar_year, name, source, created_at) VALUES (?, ?, ?, ?, ?)',
          [date, year, name, source, timestamp],
        );
      }
    });
  }
}
