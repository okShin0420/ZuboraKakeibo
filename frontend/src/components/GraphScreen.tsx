import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { BottomNavigation, type NavigationTab } from './BottomNavigation'

const yearlyData = [
  {
    year: 2026,
    months: [
      { label: '1月', value: 1.65 }, { label: '2月', value: 1.85 },
      { label: '3月', value: 1.52 }, { label: '4月', value: 2.7 },
      { label: '5月', value: 1.18 }, { label: '6月', value: 1.47 },
      { label: '7月', value: 0.28 }, { label: '8月', value: 0.16 },
      { label: '9月', value: 0.94 }, { label: '10月', value: 1.12 },
      { label: '11月', value: 2.25 }, { label: '12月', value: 1.2 },
    ],
  },
]

const currentYear = 2026
const currentMonth = '9月'
const formatYen = (value: number) => Math.round(value * 10000).toLocaleString('ja-JP')

export function GraphScreen({ onNavigate }: { onNavigate: (tab: NavigationTab) => void }) {
  const [activeYear, setActiveYear] = useState(currentYear)
  const [activeMonth, setActiveMonth] = useState(currentMonth)
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const yearButtonRef = useRef<HTMLButtonElement>(null)
  const yearSheetRef = useRef<HTMLElement>(null)
  const monthButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const availableYears = useMemo(() => yearlyData.map(item => item.year), [])
  const monthlyData = yearlyData.find(item => item.year === activeYear)?.months ?? []
  const activeData = monthlyData.find(item => item.label === activeMonth) ?? monthlyData[0]
  const activeIndex = monthlyData.findIndex(item => item.label === activeData.label)
  const selectionPosition = `${((activeIndex + 0.5) / monthlyData.length) * 100}%`

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
    setActiveMonth(monthlyData[nextIndex].label)
    monthButtonRefs.current[nextIndex]?.focus()
  }

  return (
    <>
      <main className="graph-screen">
        <section className="graph-panel" aria-labelledby="graph-title">
          <header className="graph-summary">
            <h1 id="graph-title">やりくり金額</h1>
            <p aria-live="polite">{activeData.label}</p>
            <strong aria-live="polite">¥{formatYen(activeData.value)}</strong>
            <small>月ごとの金額を、ざっくり振り返る</small>
          </header>
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
          <section className="chart-card" aria-label={`${activeYear}年の月別やりくり金額`}>
            <div className="chart-selection-row">
              <span className="chart-unit" aria-hidden="true">万円</span>
              <div className="chart-selection-track">
                <div className="chart-selection-summary" style={{ '--selection-position': selectionPosition } as CSSProperties} aria-live="polite">
                  <span>{activeData.label}</span>
                  <strong>¥{formatYen(activeData.value)}</strong>
                </div>
                <span className="chart-selection-connector" style={{ '--selection-position': selectionPosition } as CSSProperties} aria-hidden="true" />
              </div>
            </div>
            <div className="chart">
              <div className="chart-y-axis" aria-hidden="true"><span>3</span><span>2</span><span>1</span><span>0</span></div>
              <div className="chart-plot">
                <i className="grid-line grid-line-3" aria-hidden="true" /><i className="grid-line grid-line-2" aria-hidden="true" />
                <i className="grid-line grid-line-1" aria-hidden="true" /><i className="grid-line grid-line-0" aria-hidden="true" />
                <div className="bars">
                  {monthlyData.map((item, index) => {
                    const selected = item.label === activeMonth
                    return <button
                      ref={element => { monthButtonRefs.current[index] = element }}
                      className={`bar-column${selected ? ' bar-column-active' : ''}`}
                      key={item.label}
                      type="button"
                      aria-label={`${activeYear}年${item.label}、${formatYen(item.value)}円`}
                      aria-pressed={selected}
                      onClick={() => setActiveMonth(item.label)}
                      onKeyDown={event => selectMonthWithKeyboard(event, index)}
                    >
                      <span className="bar" style={{ height: `${(item.value / 3) * 100}%`, animationDelay: `${index * 12}ms` }} aria-hidden="true" />
                      {selected && <span className="bar-selection-line" aria-hidden="true" />}
                      <span className="bar-label" aria-hidden="true">{item.label.replace('月', '')}</span>
                    </button>
                  })}
                </div>
              </div>
            </div>
          </section>
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
