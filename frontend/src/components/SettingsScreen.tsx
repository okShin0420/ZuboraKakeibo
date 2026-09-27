import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, ChevronRight, X } from 'lucide-react'
import { BudgetCoinsIcon } from './AppIcons'

const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)

function SettingSwitch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button
      className="settings-switch"
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  )
}

function StartDayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" />
    </svg>
  )
}

const holidays2026 = new Set([
  '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20',
  '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
  '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23',
  '2026-10-12', '2026-11-03', '2026-11-23',
])

const isoDate = (date: Date) => [
  date.getUTCFullYear(),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0'),
].join('-')

const monthDay = (date: Date) => `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`

const isWeekendOrHoliday = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6 || holidays2026.has(isoDate(date))

const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function scheduledStart(year: number, monthIndex: number, startDay: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, monthIndex, Math.min(startDay, lastDay)))
}

function adjustedStart(date: Date, adjustHoliday: boolean) {
  let start = new Date(date)
  if (adjustHoliday) {
    while (isWeekendOrHoliday(start)) start = addDays(start, -1)
  }
  return start
}

function periodRange(year: number, monthIndex: number, startDay: number, adjustHoliday: boolean) {
  const start = adjustedStart(scheduledStart(year, monthIndex, startDay), adjustHoliday)
  const nextScheduledStart = scheduledStart(year, monthIndex + 1, startDay)
  return {
    start,
    nominalEnd: addDays(nextScheduledStart, -1),
    end: addDays(adjustedStart(nextScheduledStart, adjustHoliday), -1),
  }
}

export function SettingsScreen({
  budget,
  monthlyNotification,
  startDay,
  adjustHoliday,
  onClose,
  onOpenMoney,
  onMonthlyNotificationChange,
  onStartDayChange,
  onAdjustHolidayChange,
}: {
  budget: number
  monthlyNotification: boolean
  startDay: string
  adjustHoliday: boolean
  onClose: () => void
  onOpenMoney: () => void
  onMonthlyNotificationChange: (checked: boolean) => void
  onStartDayChange: (day: string) => void
  onAdjustHolidayChange: (checked: boolean) => void
}) {
  const [startDayPickerOpen, setStartDayPickerOpen] = useState(false)
  const [pendingStartDay, setPendingStartDay] = useState(startDay)
  const pickerCancelRef = useRef<HTMLButtonElement>(null)
  const wheelRef = useRef<HTMLDivElement>(null)

  const displayedRanges = useMemo(() => {
    const parsedStartDay = Number(startDay)
    return [0, 1].map(offset => {
      const date = new Date(Date.UTC(2026, 8 + offset, 1))
      const calculatedRange = periodRange(date.getUTCFullYear(), date.getUTCMonth(), parsedStartDay, adjustHoliday)
      const range = {
        label: `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月度`,
        ...calculatedRange,
      }
      return range
    })
  }, [adjustHoliday, startDay])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (startDayPickerOpen) {
        setStartDayPickerOpen(false)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, startDayPickerOpen])

  useEffect(() => {
    if (!startDayPickerOpen) return
    pickerCancelRef.current?.focus()
    const selected = wheelRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    selected?.scrollIntoView({ block: 'center' })
  }, [startDayPickerOpen])

  const openStartDayPicker = () => {
    setPendingStartDay(startDay)
    setStartDayPickerOpen(true)
  }

  const confirmStartDay = () => {
    onStartDayChange(pendingStartDay)
    setStartDayPickerOpen(false)
  }

  return (
    <div className="settings-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="sheet-stack-header">
          <h1 id="settings-title">設定</h1>
          <button className="sheet-close-button" type="button" aria-label="設定を閉じる" onClick={onClose} autoFocus><X aria-hidden="true" /></button>
        </header>
        <p className="settings-intro">今月のやりくりを、無理のない形に整えます。</p>

        <section className="settings-group" aria-labelledby="budget-settings-title">
          <h2 id="budget-settings-title">やりくり</h2>
          <button className="settings-link-row" type="button" onClick={onOpenMoney}>
            <span className="settings-row-icon"><BudgetCoinsIcon aria-hidden="true" /></span>
            <span className="settings-row-copy"><strong>今月使える金額</strong><small>今月の予算を変更</small></span>
            <span className="settings-row-value">¥{yen(budget)}</span>
            <ChevronRight className="settings-chevron" size={18} aria-hidden="true" />
          </button>
        </section>

        <section className="settings-group" aria-labelledby="notification-settings-title">
          <h2 id="notification-settings-title">通知</h2>
          <div className="settings-control-row">
            <span className="settings-row-icon"><Bell aria-hidden="true" /></span>
            <span className="settings-row-copy"><strong>月初通知</strong><small>新しい月のはじまりにお知らせ</small></span>
            <SettingSwitch checked={monthlyNotification} label="月初通知" onChange={onMonthlyNotificationChange} />
          </div>
        </section>

        <section className="settings-group" aria-labelledby="cycle-settings-title">
          <h2 id="cycle-settings-title">期間</h2>
          <div className="settings-period-card">
            <div className="settings-control-row">
              <span className="settings-row-icon"><StartDayIcon /></span>
              <span className="settings-row-copy"><strong>月度の開始日</strong><small>次月度の開始日前日までを1月度として扱います</small></span>
              <button className="start-day-selector" type="button" aria-label={`月度の開始日: ${startDay}日。変更する`} onClick={openStartDayPicker}>
                <span>{startDay}日</span><ChevronRight aria-hidden="true" />
              </button>
            </div>
            <div className="settings-period-preview" aria-live="polite">
              <p>月度の範囲</p>
              <ul>
                {displayedRanges.map(range => (
                  <li key={range.label}>
                    <strong>{range.label}</strong>
                    <span>{monthDay(range.start)}〜{monthDay(range.end)}</span>
                    {adjustHoliday && isoDate(range.nominalEnd) !== isoDate(range.end) && <small>土日祝を考慮</small>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="settings-control-row settings-control-row-divided">
              <span className="settings-row-spacer" aria-hidden="true" />
              <span className="settings-row-copy"><strong>土日祝の自動調整</strong><small>月度の開始日を直前の平日に調整</small></span>
              <SettingSwitch checked={adjustHoliday} label="土日祝の自動調整" onChange={onAdjustHolidayChange} />
            </div>
          </div>
        </section>
      </section>
      {startDayPickerOpen && (
        <div className="start-day-picker-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setStartDayPickerOpen(false) }}>
          <section className="start-day-picker" role="dialog" aria-modal="true" aria-labelledby="start-day-picker-title">
            <header className="start-day-picker-header">
              <button ref={pickerCancelRef} className="picker-action-button" type="button" aria-label="開始日の変更をキャンセル" onClick={() => setStartDayPickerOpen(false)}><X aria-hidden="true" /></button>
              <div><h2 id="start-day-picker-title">月度の開始日</h2><p>{pendingStartDay}日から開始します</p></div>
              <button className="picker-action-button picker-confirm-button" type="button" aria-label="開始日を確定" onClick={confirmStartDay}><Check aria-hidden="true" /></button>
            </header>
            <div className="day-wheel" ref={wheelRef} role="listbox" aria-label="月度の開始日を選択">
              <div className="day-wheel-selection" aria-hidden="true" />
              {Array.from({ length: 31 }, (_, index) => {
                const day = String(index + 1)
                const selected = pendingStartDay === day
                return <button key={day} type="button" role="option" aria-selected={selected} aria-pressed={selected} className={selected ? 'is-selected' : ''} onClick={() => setPendingStartDay(day)}>{day}日</button>
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
