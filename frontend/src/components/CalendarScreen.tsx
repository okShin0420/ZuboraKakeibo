import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, WalletCards, X } from 'lucide-react'
import { ApiError, errorMessage } from '../api/client'
import { getCalendarMonth, getDailyExpenses } from '../api/calendar'
import { createExpense, deleteExpense, updateExpense } from '../api/expenses'
import type { CalendarMonthResponse, DailyExpensesResponse, ExpenseResponse } from '../api/types'
import type { ExpenseDraft } from '../types'
import { BottomNavigation, type NavigationTab } from './BottomNavigation'
import { ExpenseInputModal } from './ExpenseInputModal'

const weekdays = ['月', '火', '水', '木', '金', '土', '日']
const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)
const periodCells = (start: string, end: string): Array<string | null> => {
  const first = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  const dates: Array<string | null> = Array.from({ length: (first.getUTCDay() + 6) % 7 }, () => null)
  for (let date = first; date <= last; date = new Date(date.getTime() + 86_400_000)) dates.push(date.toISOString().slice(0, 10))
  while (dates.length % 7 !== 0) dates.push(null)
  return dates
}
const dateRange = (start: string, end: string) => `${Number(start.slice(5, 7))}月${Number(start.slice(8, 10))}日〜${Number(end.slice(5, 7))}月${Number(end.slice(8, 10))}日`
const swipeWidth = 72

export function CalendarScreen({ onNavigate, initialMonth, initialDate, revision, onExpenseSaved }: {
  onNavigate: (tab: NavigationTab) => void
  initialMonth: string
  initialDate: string
  revision: number
  onExpenseSaved: () => Promise<void>
}) {
  const [displayMonth, setDisplayMonth] = useState(initialMonth)
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate)
  const [calendar, setCalendar] = useState<CalendarMonthResponse | null>(null)
  const [daily, setDaily] = useState<DailyExpensesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null)
  const [creatingExpense, setCreatingExpense] = useState(false)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(Number(initialMonth.slice(0, 4)))
  const [openExpenseId, setOpenExpenseId] = useState<string | null>(null)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const swipeDidMove = useRef(false)
  const [draggingExpenseId, setDraggingExpenseId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const year = Number(displayMonth.slice(0, 4))
  const month = Number(displayMonth.slice(5, 7))

  useEffect(() => {
    let active = true
    setCalendar(null)
    setLoading(true)
    setError('')
    getCalendarMonth(displayMonth).then(result => {
      if (!active) return
      setCalendar(result)
      setSelectedDate(date => date && date >= result.periodStart && date <= result.periodEnd ? date : null)
    }).catch(cause => {
      if (!active) return
      setCalendar(null)
      setSelectedDate(null)
      setError(cause instanceof ApiError && cause.status === 404
        ? 'この月度のデータはまだありません。' : errorMessage(cause))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [displayMonth, revision, refresh])

  useEffect(() => {
    if (!selectedDate || !calendar) { setDaily(null); return }
    let active = true
    getDailyExpenses(selectedDate)
      .then(result => { if (active) setDaily(result) })
      .catch(cause => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [calendar, selectedDate, refresh])

  const totals = Object.fromEntries((calendar?.dailyTotals ?? []).map(item =>
    [item.date, item.totalAmount])) as Record<string, number>
  const calendarDays = useMemo(() => calendar ? periodCells(calendar.periodStart, calendar.periodEnd) : [], [calendar])
  const cellHeight = Math.min(49, Math.floor(275 / Math.max(1, calendarDays.length / 7)))

  const changeMonth = (difference: number) => {
    const next = new Date(Date.UTC(year, month - 1 + difference, 1))
    setDisplayMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`)
    setSelectedDate(null)
    setDaily(null)
  }

  const chooseMonth = (yearValue: number, monthValue: number) => {
    setDisplayMonth(`${yearValue}-${String(monthValue).padStart(2, '0')}`)
    setSelectedDate(null)
    setDaily(null)
    setOpenExpenseId(null)
    setMonthPickerOpen(false)
  }

  const removeExpense = async (id: string) => {
    if (deletingExpenseId) return
    setDeletingExpenseId(id)
    setError('')
    try {
      await deleteExpense(id)
      setOpenExpenseId(null)
      setRefresh(value => value + 1)
      await onExpenseSaved()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setDeletingExpenseId(null) }
  }

  const saveEditedExpense = async (draft: ExpenseDraft) => {
    if (!selectedDate || !editingExpense) return
    await updateExpense(editingExpense.id, {
      spentOn: selectedDate, amount: Number(draft.amount), memo: draft.memo || null,
    })
    setRefresh(value => value + 1)
    void onExpenseSaved().catch(cause => setError(errorMessage(cause)))
  }

  const saveNewExpense = async (draft: ExpenseDraft) => {
    if (!selectedDate) return
    await createExpense({
      spentOn: selectedDate, amount: Number(draft.amount), memo: draft.memo || null,
    })
    setRefresh(value => value + 1)
    void onExpenseSaved().catch(cause => setError(errorMessage(cause)))
  }

  return (
    <>
      <main className="calendar-screen">
        <section className="calendar-panel" aria-label="カレンダー">
          <h1 className="sr-only">カレンダー</h1>
          <div className="calendar-month-switcher">
            <button type="button" aria-label="前の月" onClick={() => changeMonth(-1)}><ChevronLeft aria-hidden="true" /></button>
            <button className="calendar-month-picker-trigger" type="button" aria-label="表示する月度を選択" aria-haspopup="dialog" aria-expanded={monthPickerOpen} onClick={() => { setPickerYear(Math.min(2030, Math.max(2026, year))); setMonthPickerOpen(true) }}><span>{year}年</span>{' '}<strong>{month}月</strong></button>
            <button type="button" aria-label="次の月" onClick={() => changeMonth(1)}><ChevronRight aria-hidden="true" /></button>
          </div>
          {calendar && <p className="calendar-period-range">{dateRange(calendar.periodStart, calendar.periodEnd)}</p>}
          {error && <p className="api-inline-error" role="alert">{error}</p>}
          {loading && <p className="api-loading" role="status">読み込み中です…</p>}
          <section className="calendar-card" aria-label={`${year}年${month}月度の支出カレンダー`}>
            <div className="weekday-row" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((date, index) => {
                if (date === null) return <span className="calendar-empty" key={`empty-${index}`} />
                const day = Number(date.slice(8, 10))
                const dateMonth = Number(date.slice(5, 7))
                const amount = totals[date] ?? 0
                return <button
                    className="calendar-day"
                    data-has-expense={Boolean(amount)}
                    aria-pressed={selectedDate === date}
                    aria-label={`${dateMonth}月${day}日${amount ? `、${yen(amount)}円` : '、支出なし'}`}
                    key={date}
                    type="button"
                    style={{ minHeight: cellHeight, height: cellHeight }}
                    onClick={() => {
                      if (selectedDate !== date) setDaily(null)
                      setSelectedDate(date)
                    }}
                  >
                    <span className="day-number">{date === calendar?.periodStart || day === 1 ? `${dateMonth}/${day}` : day}</span>
                    {amount ? <span className="day-amount">¥{yen(amount)}</span> : null}
                </button>
              })}
            </div>
          </section>
          <section className="selected-day-card" aria-live="polite">
            <header className="selected-day-header">
              <span className="selected-day-icon" aria-hidden="true"><WalletCards size={20} strokeWidth={1.8} /></span>
              <div>
                <h2>{selectedDate ? `${Number(selectedDate.slice(5, 7))}月${Number(selectedDate.slice(8, 10))}日` : '日付を選択'}</h2>
                <p>{selectedDate ? ((daily?.expenses.length ?? 0) ? `${daily?.expenses.length}件の支出` : '支出はありません') : '確認したい日をタップ'}</p>
              </div>
              {selectedDate && <button className="selected-day-add" type="button" onClick={() => setCreatingExpense(true)} aria-label="支出を入力する"><Plus size={20} strokeWidth={2.2} aria-hidden="true" /></button>}
            </header>
            {selectedDate && <div className="expense-list" aria-label={`${Number(selectedDate.slice(5, 7))}月${Number(selectedDate.slice(8, 10))}日の支出リスト`}>
              {(daily?.expenses ?? []).map(entry => <div className="expense-swipe-row" data-active={openExpenseId === entry.id || draggingExpenseId === entry.id} key={entry.id}>
                <button className="expense-delete-button" type="button" aria-label={`${entry.memo || 'メモなし'}、${yen(entry.amount)}円の支出を削除`} aria-hidden={openExpenseId !== entry.id} tabIndex={openExpenseId === entry.id ? 0 : -1} disabled={deletingExpenseId === entry.id} onClick={() => void removeExpense(entry.id)}><span className="expense-delete-symbol"><Minus size={18} strokeWidth={3} aria-hidden="true" /></span></button>
                <button className="expense-edit-button" data-open={openExpenseId === entry.id} data-dragging={draggingExpenseId === entry.id} type="button" style={{ transform: `translateX(${draggingExpenseId === entry.id ? dragOffset : openExpenseId === entry.id ? -swipeWidth : 0}px)` }} onClick={() => { if (swipeDidMove.current) { swipeDidMove.current = false; return } if (openExpenseId === entry.id) setOpenExpenseId(null); else setEditingExpense(entry) }} aria-label={`${entry.memo || 'メモなし'}、${yen(entry.amount)}円を編集。左にスワイプして削除`}
                  onPointerDown={event => { swipeStart.current = { x: event.clientX, y: event.clientY }; swipeDidMove.current = false; event.currentTarget.setPointerCapture(event.pointerId) }}
                  onPointerMove={event => { const start = swipeStart.current; if (!start) return; const dx = event.clientX - start.x; if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(event.clientY - start.y)) { swipeDidMove.current = true; setDraggingExpenseId(entry.id); setDragOffset(Math.max(-swipeWidth, Math.min(0, (openExpenseId === entry.id ? -swipeWidth : 0) + dx))) } }}
                  onPointerUp={event => { const start = swipeStart.current; swipeStart.current = null; if (!start || !swipeDidMove.current) return; const dx = event.clientX - start.x; const finalOffset = Math.max(-swipeWidth, Math.min(0, (openExpenseId === entry.id ? -swipeWidth : 0) + dx)); setOpenExpenseId(finalOffset < -swipeWidth / 2 ? entry.id : null); setDraggingExpenseId(null); event.preventDefault() }}
                  onPointerCancel={() => { swipeStart.current = null; swipeDidMove.current = false; setDraggingExpenseId(null) }}>
                  <span>{entry.memo || 'メモなし'}</span><strong>¥{yen(entry.amount)}</strong>
                </button>
              </div>)}
            </div>}
          </section>
        </section>
      </main>
      <BottomNavigation activeTab="カレンダー" onNavigate={onNavigate} />
      {monthPickerOpen && <div className="calendar-month-picker-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setMonthPickerOpen(false) }}><section className="calendar-month-picker" role="dialog" aria-modal="true" aria-label="表示する月度を選択"><header><h2>表示する月度</h2><button type="button" aria-label="閉じる" onClick={() => setMonthPickerOpen(false)}><X size={20} /></button></header><div className="calendar-picker-years" aria-label="年を選択">{[2026, 2027, 2028, 2029, 2030].map(option => <button key={option} type="button" aria-pressed={pickerYear === option} onClick={() => setPickerYear(option)}>{option}年</button>)}</div><div className="calendar-picker-months" aria-label="月を選択">{Array.from({ length: 12 }, (_, index) => index + 1).map(option => <button key={option} type="button" aria-pressed={year === pickerYear && month === option} onClick={() => chooseMonth(pickerYear, option)}>{option}月</button>)}</div></section></div>}
      {editingExpense && <ExpenseInputModal mode="edit" initialDraft={{ amount: String(editingExpense.amount), memo: editingExpense.memo ?? '' }} onSave={saveEditedExpense} onClose={() => setEditingExpense(null)} />}
      {creatingExpense && <ExpenseInputModal onSave={saveNewExpense} onClose={() => setCreatingExpense(false)} />}
    </>
  )
}
