import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, PencilLine, Plus, WalletCards } from 'lucide-react'
import { ApiError, errorMessage } from '../api/client'
import { getCalendarMonth, getDailyExpenses } from '../api/calendar'
import { createExpense, updateExpense } from '../api/expenses'
import type { CalendarMonthResponse, DailyExpensesResponse, ExpenseResponse } from '../api/types'
import type { ExpenseDraft } from '../types'
import { BottomNavigation, type NavigationTab } from './BottomNavigation'
import { ExpenseInputModal } from './ExpenseInputModal'

const weekdays = ['月', '火', '水', '木', '金', '土', '日']
const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)
const isoDay = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`

export function CalendarScreen({ onNavigate, initialMonth, initialDay, revision, onExpenseSaved }: {
  onNavigate: (tab: NavigationTab) => void
  initialMonth: string
  initialDay: number
  revision: number
  onExpenseSaved: () => Promise<void>
}) {
  const [displayMonth, setDisplayMonth] = useState(initialMonth)
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDay)
  const [calendar, setCalendar] = useState<CalendarMonthResponse | null>(null)
  const [daily, setDaily] = useState<DailyExpensesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null)
  const [creatingExpense, setCreatingExpense] = useState(false)
  const year = Number(displayMonth.slice(0, 4))
  const month = Number(displayMonth.slice(5, 7))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  useEffect(() => {
    let active = true
    setCalendar(null)
    setLoading(true)
    setError('')
    getCalendarMonth(displayMonth).then(result => {
      if (!active) return
      setCalendar(result)
      setSelectedDay(day => day && isoDay(displayMonth, day) >= result.periodStart
        && isoDay(displayMonth, day) <= result.periodEnd ? day : null)
    }).catch(cause => {
      if (!active) return
      setCalendar(null)
      setSelectedDay(null)
      setError(cause instanceof ApiError && cause.status === 404
        ? 'この月度のデータはまだありません。' : errorMessage(cause))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [displayMonth, revision, refresh])

  useEffect(() => {
    if (!selectedDay || !calendar) { setDaily(null); return }
    let active = true
    getDailyExpenses(isoDay(displayMonth, selectedDay))
      .then(result => { if (active) setDaily(result) })
      .catch(cause => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [calendar, displayMonth, selectedDay, refresh])

  const totals = Object.fromEntries((calendar?.dailyTotals ?? []).map(item =>
    [Number(item.date.slice(8, 10)), item.totalAmount])) as Record<number, number>
  const isDayInPeriod = (day: number) => {
    const date = isoDay(displayMonth, day)
    return !!calendar && date >= calendar.periodStart && date <= calendar.periodEnd
  }
  const calendarDays = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    return [
      ...Array.from({ length: (firstDay + 6) % 7 }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ]
  }, [daysInMonth, month, year])

  const changeMonth = (difference: number) => {
    const next = new Date(Date.UTC(year, month - 1 + difference, 1))
    setDisplayMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`)
    setSelectedDay(null)
    setDaily(null)
  }

  const saveEditedExpense = async (draft: ExpenseDraft) => {
    if (!selectedDay || !editingExpense) return
    await updateExpense(editingExpense.id, {
      spentOn: isoDay(displayMonth, selectedDay), amount: Number(draft.amount), memo: draft.memo || null,
    })
    setRefresh(value => value + 1)
    void onExpenseSaved().catch(cause => setError(errorMessage(cause)))
  }

  const saveNewExpense = async (draft: ExpenseDraft) => {
    if (!selectedDay) return
    await createExpense({
      spentOn: isoDay(displayMonth, selectedDay), amount: Number(draft.amount), memo: draft.memo || null,
    })
    setRefresh(value => value + 1)
    void onExpenseSaved().catch(cause => setError(errorMessage(cause)))
  }

  return (
    <>
      <main className="calendar-screen">
        <section className="calendar-panel" aria-label="カレンダー">
          <h1 className="sr-only">カレンダー</h1>
          <p className="calendar-description">使った日を、ざっくり振り返る</p>
          <div className="calendar-month-switcher">
            <button type="button" aria-label="前の月" onClick={() => changeMonth(-1)}><ChevronLeft aria-hidden="true" /></button>
            <p aria-live="polite"><span>{year}年</span><strong>{month}月</strong></p>
            <button type="button" aria-label="次の月" onClick={() => changeMonth(1)}><ChevronRight aria-hidden="true" /></button>
          </div>
          {error && <p className="api-inline-error" role="alert">{error}</p>}
          {loading && <p className="api-loading" role="status">読み込み中です…</p>}
          <section className="calendar-card" aria-label={`${year}年${month}月の支出カレンダー`}>
            <div className="weekday-row" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((day, index) => day === null
                ? <span className="calendar-empty" key={`empty-${index}`} />
                : <button
                    className="calendar-day"
                    data-has-expense={Boolean(totals[day])}
                    data-outside-period={!isDayInPeriod(day)}
                    aria-pressed={selectedDay === day}
                    aria-label={`${month}月${day}日${totals[day] ? `、${yen(totals[day])}円` : '、支出なし'}${isDayInPeriod(day) ? '' : '、対象期間外'}`}
                    key={day}
                    type="button"
                    disabled={!isDayInPeriod(day)}
                    onClick={() => {
                      if (selectedDay !== day) setDaily(null)
                      setSelectedDay(day)
                    }}
                  >
                    <span className="day-number">{day}</span>
                    {totals[day] ? <span className="day-amount">¥{yen(totals[day])}</span> : null}
                  </button>)}
            </div>
          </section>
          <section className="selected-day-card" aria-live="polite">
            <header className="selected-day-header">
              <span className="selected-day-icon" aria-hidden="true"><WalletCards size={20} strokeWidth={1.8} /></span>
              <div>
                <h2>{selectedDay ? `${month}月${selectedDay}日` : '日付を選択'}</h2>
                <p>{selectedDay ? ((daily?.expenses.length ?? 0) ? `${daily?.expenses.length}件の支出` : '支出はありません') : '確認したい日をタップ'}</p>
              </div>
              {selectedDay && <button className="selected-day-add" type="button" onClick={() => setCreatingExpense(true)} aria-label="支出を入力する"><Plus size={20} strokeWidth={2.2} aria-hidden="true" /></button>}
            </header>
            {selectedDay && <div className="expense-list" aria-label={`${month}月${selectedDay}日の支出リスト`}>
              {(daily?.expenses ?? []).map(entry => <button type="button" key={entry.id} onClick={() => setEditingExpense(entry)} aria-label={`${entry.memo || 'メモなし'}、${yen(entry.amount)}円を編集`}>
                <span>{entry.memo || 'メモなし'}</span><strong>¥{yen(entry.amount)}</strong><PencilLine size={14} aria-hidden="true" />
              </button>)}
            </div>}
          </section>
        </section>
      </main>
      <BottomNavigation activeTab="カレンダー" onNavigate={onNavigate} />
      {editingExpense && <ExpenseInputModal mode="edit" initialDraft={{ amount: String(editingExpense.amount), memo: editingExpense.memo ?? '' }} onSave={saveEditedExpense} onClose={() => setEditingExpense(null)} />}
      {creatingExpense && <ExpenseInputModal onSave={saveNewExpense} onClose={() => setCreatingExpense(false)} />}
    </>
  )
}
