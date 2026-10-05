import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { errorMessage } from '../api/client'
import { getYearlySummary } from '../api/graph'
import type { MonthlyBudgetSummary, YearlyBudgetSummaryResponse } from '../api/types'
import { BottomNavigation, type NavigationTab } from './BottomNavigation'

const formatYen = (value: number) => value.toLocaleString('ja-JP')
const emptyMonth = (month: number): MonthlyBudgetSummary => ({ month, budgetAmount: 0, spentAmount: 0, remainingAmount: 0, expenseCount: 0 })

export function GraphScreen({ onNavigate, initialYear, initialMonth, revision }: {
  onNavigate: (tab: NavigationTab) => void
  initialYear: number
  initialMonth: number
  revision: number
}) {
  const [activeYear, setActiveYear] = useState(initialYear)
  const [activeMonth, setActiveMonth] = useState(initialMonth)
  const [summary, setSummary] = useState<YearlyBudgetSummaryResponse | null>(null)
  const [error, setError] = useState('')
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const yearButtonRef = useRef<HTMLButtonElement>(null)
  const yearSheetRef = useRef<HTMLElement>(null)
  const monthButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const availableYears = summary?.availableYears ?? []
  const monthlyData = Array.from({ length: 12 }, (_, index) => summary?.monthlySummaries.find(item => item.month === index + 1) ?? emptyMonth(index + 1))
  const activeData = monthlyData[activeMonth - 1] ?? monthlyData[0]
  const activeIndex = activeData.month - 1
  const selectionPosition = `${((activeIndex + 0.5) / monthlyData.length) * 100}%`
  const maxUnits = Math.max(3, Math.ceil(Math.max(...monthlyData.map(item => item.remainingAmount)) / 10000))

  useEffect(() => {
    let active = true
    setError('')
    setSummary(null)
    getYearlySummary(activeYear).then(result => {
      if (active) setSummary(result)
    }).catch(cause => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [activeYear, revision])

  useEffect(() => {
    if (!yearPickerOpen) return
    const frame = requestAnimationFrame(() => yearSheetRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setYearPickerOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const controls = yearSheetRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      yearButtonRef.current?.focus({ preventScroll: true })
    }
  }, [yearPickerOpen])

  const selectMonthWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    let nextIndex = index
    if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1)
    if (event.key === 'ArrowRight') nextIndex = Math.min(monthlyData.length - 1, index + 1)
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = monthlyData.length - 1
    setActiveMonth(monthlyData[nextIndex].month)
    monthButtonRefs.current[nextIndex]?.focus()
  }

  return (
    <>
      <main className="graph-screen">
        <section className="graph-panel" aria-labelledby="graph-title">
          {summary && <header className="graph-summary">
            <h1 id="graph-title">やりくり金額</h1>
            <p aria-live="polite">{activeData.month}月</p>
            <strong aria-live="polite">¥{formatYen(activeData.remainingAmount)}</strong>
            <small>月ごとの金額を、ざっくり振り返る</small>
          </header>}
          {!summary && <h1 id="graph-title" className="sr-only">やりくり金額</h1>}
          <button
            ref={yearButtonRef}
            className="graph-year-switcher"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={yearPickerOpen}
            aria-controls="graph-year-picker"
            onClick={() => setYearPickerOpen(true)}
          >
            <span>{activeYear}年</span>
            <ChevronDown aria-hidden="true" />
          </button>
          {error && <p className="api-inline-error" role="alert">{error}</p>}
          {!summary && !error && <p className="api-loading" role="status">グラフを読み込み中です…</p>}
          {summary && <section className="chart-card" aria-label={`${activeYear}年の月別やりくり金額`}>
            <div className="chart-selection-row">
              <span className="chart-unit" aria-hidden="true">万円</span>
              <div className="chart-selection-track">
                <div className="chart-selection-summary" style={{ '--selection-position': selectionPosition } as CSSProperties} aria-live="polite">
                  <span>{activeData.month}月</span>
                  <strong>¥{formatYen(activeData.remainingAmount)}</strong>
                </div>
                <span className="chart-selection-connector" style={{ '--selection-position': selectionPosition } as CSSProperties} aria-hidden="true" />
              </div>
            </div>
            <div className="chart">
              <div className="chart-y-axis" aria-hidden="true"><span>{maxUnits}</span><span>{Math.round(maxUnits * 2 / 3 * 10) / 10}</span><span>{Math.round(maxUnits / 3 * 10) / 10}</span><span>0</span></div>
              <div className="chart-plot">
                <i className="grid-line grid-line-3" aria-hidden="true" /><i className="grid-line grid-line-2" aria-hidden="true" />
                <i className="grid-line grid-line-1" aria-hidden="true" /><i className="grid-line grid-line-0" aria-hidden="true" />
                <div className="bars">
                  {monthlyData.map((item, index) => {
                    const selected = item.month === activeMonth
                    return <button
                      ref={element => { monthButtonRefs.current[index] = element }}
                      className={`bar-column${selected ? ' bar-column-active' : ''}`}
                      key={item.month}
                      type="button"
                      aria-label={`${activeYear}年${item.month}月、${formatYen(item.remainingAmount)}円`}
                      aria-pressed={selected}
                      onClick={() => setActiveMonth(item.month)}
                      onKeyDown={event => selectMonthWithKeyboard(event, index)}
                    >
                      <span className="bar" style={{ height: `${Math.max(0, item.remainingAmount) / (maxUnits * 10000) * 100}%`, animationDelay: `${index * 12}ms` }} aria-hidden="true" />
                      {selected && <span className="bar-selection-line" aria-hidden="true" />}
                      <span className="bar-label" aria-hidden="true">{item.month}</span>
                    </button>
                  })}
                </div>
              </div>
            </div>
          </section>}
        </section>
      </main>
      <BottomNavigation activeTab="グラフ" onNavigate={onNavigate} />
      {yearPickerOpen && (
        <div className="year-picker-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setYearPickerOpen(false) }}>
          <section id="graph-year-picker" ref={yearSheetRef} className="year-picker" role="dialog" aria-modal="true" aria-labelledby="graph-year-picker-title">
            <header className="year-picker-header">
              <div><h2 id="graph-year-picker-title">表示する年</h2><p>記録がある年を表示します</p></div>
              <button type="button" aria-label="年選択を閉じる" onClick={() => setYearPickerOpen(false)}><X aria-hidden="true" /></button>
            </header>
            <div className="year-picker-options" role="radiogroup" aria-label="表示年">
              {availableYears.map(year => <button key={year} type="button" role="radio" aria-checked={year === activeYear} onClick={() => { setActiveYear(year); setYearPickerOpen(false) }}><span>{year}年</span>{year === activeYear && <Check aria-hidden="true" />}</button>)}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
