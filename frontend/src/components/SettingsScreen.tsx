import { useEffect } from 'react'
import { Bell, ChevronRight, X } from 'lucide-react'
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

function ClosingDayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
    </svg>
  )
}

export function SettingsScreen({
  budget,
  monthlyNotification,
  startDay,
  closingDay,
  adjustHoliday,
  onClose,
  onOpenMoney,
  onMonthlyNotificationChange,
  onStartDayChange,
  onClosingDayChange,
  onAdjustHolidayChange,
}: {
  budget: number
  monthlyNotification: boolean
  startDay: string
  closingDay: string
  adjustHoliday: boolean
  onClose: () => void
  onOpenMoney: () => void
  onMonthlyNotificationChange: (checked: boolean) => void
  onStartDayChange: (day: string) => void
  onClosingDayChange: (day: string) => void
  onAdjustHolidayChange: (checked: boolean) => void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

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
              <label className="settings-row-copy" htmlFor="start-day"><strong>月初めの日</strong><small>やりくり期間の開始日</small></label>
              <select id="start-day" value={startDay} onChange={event => onStartDayChange(event.target.value)}>
                {Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>毎月{index + 1}日</option>)}
              </select>
            </div>
            <div className="settings-control-row settings-control-row-divided">
              <span className="settings-row-icon"><ClosingDayIcon /></span>
              <label className="settings-row-copy" htmlFor="closing-day"><strong>月締めの日</strong><small>やりくり期間の最終日</small></label>
              <select id="closing-day" value={closingDay} onChange={event => onClosingDayChange(event.target.value)}>
                <option value="last">毎月最終日</option>
                {Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>毎月{index + 1}日</option>)}
              </select>
            </div>
            <div className="settings-control-row settings-control-row-divided">
              <span className="settings-row-spacer" aria-hidden="true" />
              <span className="settings-row-copy"><strong>土日祝の自動調整</strong><small>直前の平日を締め日にする</small></span>
              <SettingSwitch checked={adjustHoliday} label="土日祝の自動調整" onChange={onAdjustHolidayChange} />
            </div>
          </div>
        </section>
      </section>
    </div>
  )
}
