import { Delete as DeleteIcon } from 'lucide-react'

const quickAmounts = [5000, 1000, 2000]
const keypadKeys = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
]
const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)

export function AmountKeypad({ onDigit, onDelete, onQuickAmount, className = '' }: {
  onDigit: (digit: string) => void
  onDelete: () => void
  onQuickAmount: (amount: number) => void
  className?: string
}) {
  return (
    <section className={`money-keypad ${className}`.trim()} aria-label="金額入力キーパッド">
      <div className="quick-amounts">
        {quickAmounts.map(value => (
          <button type="button" key={value} onClick={() => onQuickAmount(value)}>¥{yen(value)}</button>
        ))}
      </div>
      <div className="number-pad">
        {keypadKeys.map(({ digit, letters }) => (
          <button className="number-key" type="button" key={digit} aria-label={`${digit}を入力`} onClick={() => onDigit(digit)}>
            <strong>{digit}</strong>
            {letters && <small>{letters}</small>}
          </button>
        ))}
        <span className="number-pad-spacer" aria-hidden="true" />
        <button className="number-key number-key-zero" type="button" aria-label="0を入力" onClick={() => onDigit('0')}><strong>0</strong></button>
        <button className="delete-key" type="button" aria-label="削除" onClick={onDelete}><DeleteIcon aria-hidden="true" /></button>
      </div>
    </section>
  )
}
