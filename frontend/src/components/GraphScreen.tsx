import { useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BottomNavigation, type NavigationTab } from './BottomNavigation'

const monthlyData = [
  { label: '1月', value: 1.65 }, { label: '2月', value: 1.85 },
  { label: '3月', value: 1.52 }, { label: '4月', value: 2.7 },
  { label: '5月', value: 1.18 }, { label: '6月', value: 1.47 },
  { label: '7月', value: 0.28 }, { label: '8月', value: 0.16 },
  { label: '9月', value: 0.94 }, { label: '10月', value: 1.12 },
  { label: '11月', value: 2.25 }, { label: '12月', value: 1.2 },
]

export function GraphScreen({ onNavigate }: { onNavigate: (tab: NavigationTab) => void }) {
  const [year, setYear] = useState(2026)
  const currentMonth = '9月'
  const [activeMonth, setActiveMonth] = useState(currentMonth)

  return (
    <>
      <main className="graph-screen">
        <section className="graph-panel" aria-labelledby="graph-title">
          <header className="graph-summary">
            <div className="graph-summary-top">
              <h1 id="graph-title">やりくり金額</h1>
            </div>
            <p>9月</p>
            <strong>¥48,200</strong>
            <small>月ごとの金額を、ざっくり振り返る</small>
          </header>
          <div className="month-switcher graph-year-switcher">
            <button type="button" aria-label="前年" onClick={() => setYear(current => current - 1)}><ChevronLeft aria-hidden="true" /></button>
            <p aria-live="polite"><span className="year-value"><strong>{year}</strong>年</span></p>
            <button type="button" aria-label="翌年" onClick={() => setYear(current => current + 1)}><ChevronRight aria-hidden="true" /></button>
          </div>
          <section className="chart-card" aria-labelledby="chart-heading">
            <div className="chart-card-header">
              <h2 id="chart-heading">月別のやりくり</h2>
              <span>単位：万円</span>
            </div>
            <div className="chart" role="img" aria-label={`${year}年1月から12月までの月別やりくり金額の棒グラフ。4月が2.7万円で最も高く、8月が0.16万円で最も低い。`}>
              <div className="chart-y-axis" aria-hidden="true"><span>3</span><span>2</span><span>1</span><span>0</span></div>
              <div className="chart-plot" aria-hidden="true">
                <i className="grid-line grid-line-3" /><i className="grid-line grid-line-2" />
                <i className="grid-line grid-line-1" /><i className="grid-line grid-line-0" />
                <div className="bars">
                  {monthlyData.map((item, index) => (
                    <div
                      className={`bar-column${item.label === activeMonth ? ' bar-column-active' : ''}`}
                      key={item.label}
                      style={{ '--bar-height': `${(item.value / 3) * 100}%` } as CSSProperties}
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.label}、${item.value}万円`}
                      onClick={() => setActiveMonth(item.label)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setActiveMonth(item.label)
                        }
                      }}
                    >
                      <span
                        className="bar"
                        style={{ height: `${(item.value / 3) * 100}%`, animationDelay: `${index * 12}ms` }}
                      />
                      {item.label === activeMonth && <span className="bar-selection-line" aria-hidden="true" />}
                      <span className="bar-label">{item.label.replace('月', '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      </main>
      <BottomNavigation activeTab="グラフ" onNavigate={onNavigate} />
    </>
  )
}
