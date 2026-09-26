import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { AmountKeypad } from './AmountKeypad'
const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)

export function SettingMoneyScreen({
  budget,
  onClose,
  onSave,
}: {
  budget: number
  onClose: () => void
  onSave: (budget: number) => void
}) {
  const [amount, setAmount] = useState(String(budget))
  const numericAmount = Number(amount)

  const appendDigit = (digit: string) => {
    setAmount(current => current === '0' ? digit : current.length < 9 ? `${current}${digit}` : current)
  }

  const deleteDigit = () => {
    setAmount(current => current.length <= 1 ? '0' : current.slice(0, -1))
  }

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (/^[0-9]$/.test(event.key)) appendDigit(event.key)
      if (event.key === 'Backspace') {
        event.preventDefault()
        deleteDigit()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="settings-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="setting-money-panel" role="dialog" aria-modal="true" aria-labelledby="setting-money-title">
        <header className="sheet-stack-header sheet-stack-header-centered">
          <span aria-hidden="true" />
          <h1 id="setting-money-title">今月使える金額</h1>
          <button className="sheet-close-button" type="button" aria-label="金額設定を閉じる" onClick={onClose} autoFocus><X aria-hidden="true" /></button>
        </header>
        <div className="money-dog-guide">
          <p>今月使えるお金を決めよう。</p>
          <img src="/assets/jikkun.png" alt="青緑の服を着た黒い犬" width="1254" height="1254" draggable="false" />
        </div>

        <div className="budget-entry-area">
          <div className="budget-input">
            <label className="sr-only" htmlFor="monthly-budget">今月使える金額</label>
            <span>¥</span>
            <input
              id="monthly-budget"
              type="text"
              inputMode="none"
              readOnly
              value={yen(numericAmount || 0)}
              aria-label="今月使える金額"
            />
          </div>
          <button
            className="primary-button budget-save-button"
            type="button"
            disabled={!Number.isFinite(numericAmount) || numericAmount <= 0}
            onClick={() => onSave(numericAmount)}
          >保存する</button>
        </div>

        <AmountKeypad onDigit={appendDigit} onDelete={deleteDigit} onQuickAmount={value => setAmount(String(value))} />
      </section>
    </div>
  )
}
