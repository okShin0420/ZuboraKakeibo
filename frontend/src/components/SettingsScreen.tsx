import { useEffect, useRef, useState } from 'react'
import { Bell, Check, ChevronRight, X } from 'lucide-react'
import { BudgetCoinsIcon } from './AppIcons'
import type { PeriodRangeResponse } from '../api/types'

const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)

function SettingSwitch({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: (checked: boolean) => void; disabled: boolean }) {
  return (
    <button
      className="settings-switch"
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
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

const monthDay = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`

export function SettingsScreen({
  budget,
  monthlyNotification,
  startDay,
  adjustHoliday,
  currentPeriodRange,
  nextPeriodRange,
  busy,
  error,
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
  currentPeriodRange: PeriodRangeResponse
  nextPeriodRange: PeriodRangeResponse
  busy: boolean
  error: string
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

  const displayedRanges = [currentPeriodRange, nextPeriodRange]

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
        {error && <p className="api-inline-error" role="alert">{error}</p>}

        <section className="settings-group" aria-labelledby="budget-settings-title">
          <h2 id="budget-settings-title">やりくり</h2>
          <button className="settings-link-row" type="button" onClick={onOpenMoney}>
            <span className="settings-row-icon"><BudgetCoinsIcon aria-hidden="true" /></span>
            <span className="settings-row-copy"><strong>今月使える金額</strong></span>
            <span className="settings-row-value">¥{yen(budget)}</span>
            <ChevronRight className="settings-chevron" size={18} aria-hidden="true" />
          </button>
        </section>

        <section className="settings-group" aria-labelledby="notification-settings-title">
          <h2 id="notification-settings-title">通知</h2>
          <div className="settings-control-row">
            <span className="settings-row-icon"><Bell aria-hidden="true" /></span>
            <span className="settings-row-copy"><strong>月初通知</strong><small>新しい月のはじまりにお知らせ</small></span>
            <SettingSwitch checked={monthlyNotification} label="月初通知" onChange={onMonthlyNotificationChange} disabled={busy} />
          </div>
        </section>

        <section className="settings-group" aria-labelledby="cycle-settings-title">
          <h2 id="cycle-settings-title">期間</h2>
          <div className="settings-period-card">
            <div className="settings-control-row">
              <span className="settings-row-icon"><StartDayIcon /></span>
              <span className="settings-row-copy"><strong>月度の開始日</strong></span>
              <button className="start-day-selector" type="button" aria-label={`月度の開始日: ${startDay}日。変更する`} onClick={openStartDayPicker} disabled={busy}>
                <span>{startDay}日</span><ChevronRight aria-hidden="true" />
              </button>
            </div>
            <div className="settings-period-preview" aria-live="polite">
              <p>月度の範囲</p>
              <ul>
                {displayedRanges.map(range => (
                  <li key={range.labelMonth}>
                    <strong>{Number(range.labelMonth.slice(0, 4))}年{Number(range.labelMonth.slice(5, 7))}月度</strong>
                    <span>{monthDay(range.startDate)}〜{monthDay(range.endDate)}</span>
                    {adjustHoliday && <small>土日祝を考慮</small>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="settings-control-row settings-control-row-divided">
              <span className="settings-row-spacer" aria-hidden="true" />
              <span className="settings-row-copy"><strong>土日祝の自動調整</strong><small>月度の開始日を直前の平日に調整</small></span>
              <SettingSwitch checked={adjustHoliday} label="土日祝の自動調整" onChange={onAdjustHolidayChange} disabled={busy} />
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
              <button className="picker-action-button picker-confirm-button" type="button" aria-label="開始日を確定" onClick={confirmStartDay} disabled={busy}><Check aria-hidden="true" /></button>
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
