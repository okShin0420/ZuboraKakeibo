import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, PencilLine, Plus, WalletCards } from 'lucide-react'
import { BottomNavigation, type NavigationTab } from './BottomNavigation'
import { ExpenseInputModal } from './ExpenseInputModal'
import type { ExpenseDraft } from '../types'

const weekdays = ['月', '火', '水', '木', '金', '土', '日']
const holidays2026 = new Set([
  '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20',
  '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
  '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23',
  '2026-10-12', '2026-11-03', '2026-11-23',
])

type CalendarExpense = { id: string; amount: number; memo: string }

const initialSeptemberEntries: Record<number, CalendarExpense[]> = {
  1: [{ id: '1-1', amount: 800, memo: 'ランチ' }],
  3: [{ id: '3-1', amount: 1200, memo: '日用品' }],
  7: [{ id: '7-1', amount: 500, memo: '飲みもの' }],
  9: [{ id: '9-1', amount: 3200, memo: '買いもの' }],
  12: [{ id: '12-1', amount: 980, memo: 'ランチ' }],
  15: [{ id: '15-1', amount: 1600, memo: '日用品' }],
  18: [{ id: '18-1', amount: 740, memo: 'カフェ' }],
  21: [
    { id: '21-1', amount: 800, memo: 'ランチ' },
    { id: '21-2', amount: 400, memo: '飲みもの' },
  ],
  24: [{ id: '24-1', amount: 2100, memo: '買いもの' }],
  27: [{ id: '27-1', amount: 650, memo: 'カフェ' }],
  30: [{ id: '30-1', amount: 1480, memo: '日用品' }],
}

const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)
const isoDate = (date: Date) => [
  date.getUTCFullYear(),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0'),
].join('-')

const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}
const isWeekendOrHoliday = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6 || holidays2026.has(isoDate(date))

const scheduledStart = (year: number, monthIndex: number, startDay: number) => {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, monthIndex, Math.min(startDay, lastDay)))
}

const adjustedStart = (date: Date, adjustHoliday: boolean) => {
  let start = new Date(date)
  if (adjustHoliday) {
    while (isWeekendOrHoliday(start)) start = addDays(start, -1)
  }
  return start
}

const calculatePeriod = (year: number, monthIndex: number, startDay: number, adjustHoliday: boolean) => {
  const start = adjustedStart(scheduledStart(year, monthIndex, startDay), adjustHoliday)
  const nextStart = adjustedStart(scheduledStart(year, monthIndex + 1, startDay), adjustHoliday)
  return { start, end: addDays(nextStart, -1) }
}

export function CalendarScreen({ onNavigate, startDay, adjustHoliday }: {
  onNavigate: (tab: NavigationTab) => void
  startDay: string
  adjustHoliday: boolean
}) {
  const [displayDate, setDisplayDate] = useState(new Date(2026, 8, 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(21)
  const [expenseEntries, setExpenseEntries] = useState(initialSeptemberEntries)
  const [editingExpense, setEditingExpense] = useState<CalendarExpense | null>(null)
  const [creatingExpense, setCreatingExpense] = useState(false)
  const year = displayDate.getFullYear()
  const month = displayDate.getMonth() + 1
  const isSeptember2026 = year === 2026 && month === 9
  const daysInMonth = new Date(year, month, 0).getDate()
  const period = useMemo(() => {
    const parsedStartDay = Number(startDay)
    return calculatePeriod(year, month - 1, parsedStartDay, adjustHoliday)
  }, [adjustHoliday, month, startDay, year])
  const isDayInPeriod = (day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day))
    return date >= period.start && date <= period.end
  }
  const entries = isSeptember2026 ? expenseEntries : {}
  const expenses = Object.fromEntries(Object.entries(entries).map(([day, dayEntries]) => [day, dayEntries.reduce((sum, entry) => sum + entry.amount, 0)])) as Record<number, number>

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay()
    const mondayStartOffset = (firstDay + 6) % 7
    return [
      ...Array.from({ length: mondayStartOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ]
  }, [daysInMonth, month, year])

  useEffect(() => {
    if (selectedDay && !isDayInPeriod(selectedDay)) setSelectedDay(null)
  }, [period.end, period.start, selectedDay])

  const changeMonth = (difference: number) => {
    const next = new Date(year, month - 1 + difference, 1)
    setDisplayDate(next)
    setSelectedDay(next.getFullYear() === 2026 && next.getMonth() === 8 ? 21 : null)
  }

  const selectedAmount = selectedDay ? expenses[selectedDay] ?? 0 : 0
  const selectedEntries = selectedDay ? entries[selectedDay] ?? [] : []

  const saveEditedExpense = (draft: ExpenseDraft) => {
    if (!selectedDay || !editingExpense) return
    setExpenseEntries(current => ({
      ...current,
      [selectedDay]: (current[selectedDay] ?? []).map(entry => entry.id === editingExpense.id
        ? { ...entry, amount: Number(draft.amount), memo: draft.memo }
        : entry),
    }))
  }

  const saveNewExpense = (draft: ExpenseDraft) => {
    if (!selectedDay || Number(draft.amount) <= 0) return
    setExpenseEntries(current => ({
      ...current,
      [selectedDay]: [...(current[selectedDay] ?? []), {
        id: `new-${Date.now()}`,
        amount: Number(draft.amount),
        memo: draft.memo,
      }],
    }))
  }

  return (
    <>
      <main className="calendar-screen">
        <section className="calendar-panel" aria-label="カレンダー">
          <p className="calendar-description">使った日を、ざっくり振り返る</p>

          <div className="calendar-month-switcher">
            <button type="button" aria-label="前の月" onClick={() => changeMonth(-1)}><ChevronLeft aria-hidden="true" /></button>
            <p aria-live="polite"><span>{year}年</span><strong>{month}月</strong></p>
            <button type="button" aria-label="次の月" onClick={() => changeMonth(1)}><ChevronRight aria-hidden="true" /></button>
          </div>

          <section className="calendar-card" aria-label={`${year}年${month}月の支出カレンダー`}>
            <div className="weekday-row" aria-hidden="true">
              {weekdays.map(day => <span key={day}>{day}</span>)}
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day, index) => day === null
                ? <span className="calendar-empty" key={`empty-${index}`} />
                : (
                  <button
                    className="calendar-day"
                    data-has-expense={Boolean(expenses[day])}
                    data-outside-period={!isDayInPeriod(day)}
                    aria-pressed={selectedDay === day}
                    aria-label={`${month}月${day}日${expenses[day] ? `、${yen(expenses[day])}円` : '、支出なし'}${isDayInPeriod(day) ? '' : '、対象期間外'}`}
                    key={day}
                    type="button"
                    disabled={!isDayInPeriod(day)}
                    onClick={() => setSelectedDay(day)}
                  >
                    <span className="day-number">{day}</span>
                    {expenses[day] ? <span className="day-amount">¥{yen(expenses[day])}</span> : null}
                  </button>
                ))}
            </div>
          </section>

          <section className="selected-day-card" aria-live="polite">
            <header className="selected-day-header">
              <span className="selected-day-icon" aria-hidden="true"><WalletCards size={20} strokeWidth={1.8} /></span>
              <div>
                <h2>{selectedDay ? `${month}月${selectedDay}日` : '日付を選択'}</h2>
                <p>{selectedDay ? (selectedAmount ? `${selectedEntries.length}件の支出` : '支出はありません') : '確認したい日をタップ'}</p>
              </div>
              {selectedDay && (
                <button className="selected-day-add" type="button" onClick={() => setCreatingExpense(true)} aria-label="支出を入力する">
                  <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
                </button>
              )}
            </header>
            {selectedDay && (
              <div className="expense-list" aria-label={`${month}月${selectedDay}日の支出リスト`}>
                {selectedEntries.map(entry => (
                  <button type="button" key={entry.id} onClick={() => setEditingExpense(entry)} aria-label={`${entry.memo || 'メモなし'}、${yen(entry.amount)}円を編集`}>
                    <span>{entry.memo || 'メモなし'}</span>
                    <strong>¥{yen(entry.amount)}</strong>
                    <PencilLine size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>

      <BottomNavigation activeTab="カレンダー" onNavigate={onNavigate} />
      {editingExpense && (
        <ExpenseInputModal
          mode="edit"
          initialDraft={{ amount: String(editingExpense.amount), memo: editingExpense.memo }}
          onSave={saveEditedExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {creatingExpense && (
        <ExpenseInputModal
          onSave={saveNewExpense}
          onClose={() => setCreatingExpense(false)}
        />
      )}
    </>
  )
}
