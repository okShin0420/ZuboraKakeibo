import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ExpenseDraft } from '../types'
import { errorMessage } from '../api/client'
import { AmountKeypad } from './AmountKeypad'

const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)

export function ExpenseInputModal({
  onClose,
  initialDraft = { amount: '', memo: '' },
  mode = 'create',
  onSave,
}: {
  onClose: () => void
  initialDraft?: ExpenseDraft
  mode?: 'create' | 'edit'
  onSave?: (draft: ExpenseDraft) => Promise<void>
}) {
  const sheetRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const completionTimer = useRef<number | null>(null)
  const focusTimer = useRef<number | null>(null)
  const [draft, setDraft] = useState<ExpenseDraft>({ ...initialDraft, amount: initialDraft.amount || '0' })
  const [keypadOpen, setKeypadOpen] = useState(false)
  const [saveComplete, setSaveComplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const numericAmount = Number(draft.amount)

  const appendDigit = (digit: string) => {
    setDraft(current => ({
      ...current,
      amount: current.amount === '0' ? digit : current.amount.length < 9 ? `${current.amount}${digit}` : current.amount,
    }))
  }

  const deleteDigit = () => {
    setDraft(current => ({ ...current, amount: current.amount.length <= 1 ? '0' : current.amount.slice(0, -1) }))
  }

  useEffect(() => {
    if (focusTimer.current !== null) window.clearTimeout(focusTimer.current)
    if (previousFocus.current === null) previousFocus.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      const target = previousFocus.current
      focusTimer.current = window.setTimeout(() => target?.focus({ preventScroll: true }), 0)
    }
  }, [])

  useEffect(() => () => {
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current)
  }, [])

  const handleSave = async () => {
    if (saving || saveComplete || numericAmount <= 0) return
    setSaving(true)
    setSaveError('')
    try {
      await onSave?.(draft)
      setSaveComplete(true)
      completionTimer.current = window.setTimeout(onClose, 780)
    } catch (error) {
      setSaveError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saveComplete && !saving) onClose()
      if (keypadOpen && /^[0-9]$/.test(event.key)) appendDigit(event.key)
      if (keypadOpen && event.key === 'Backspace') {
        event.preventDefault()
        deleteDigit()
      }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const controls = sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [keypadOpen, onClose, saveComplete, saving])

  return (
    <div className="settings-overlay expense-overlay" onMouseDown={event => { if (!saveComplete && !saving && event.target === event.currentTarget) onClose() }}>
      <section ref={sheetRef} className={`expense-bottom-sheet${keypadOpen ? ' expense-keypad-open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="expense-title">
        <header className="sheet-stack-header sheet-stack-header-centered">
          <span aria-hidden="true" />
          <h2 id="expense-title">{mode === 'edit' ? '支出を編集' : '支出を入力'}</h2>
          <button ref={closeRef} className="sheet-close-button" type="button" aria-label="閉じる" onClick={onClose} disabled={saveComplete || saving}><X aria-hidden="true" /></button>
        </header>

        <form onSubmit={event => { event.preventDefault(); handleSave() }}>
          <button className="expense-amount-trigger" type="button" aria-label={`使った金額 ${yen(numericAmount || 0)}円`} aria-expanded={keypadOpen} onClick={() => setKeypadOpen(true)}>
            <span>¥</span>{yen(numericAmount || 0)}
          </button>

          <label className="expense-memo-label" htmlFor="memo">メモ</label>
          <input className="memo-field" id="memo" name="memo" type="text" autoComplete="off" maxLength={120} placeholder="何に使ったか" value={draft.memo} onChange={event => setDraft({ ...draft, memo: event.target.value })} />
          {saveError && <p className="api-inline-error" role="alert">{saveError}</p>}
          <button className={`primary-button save-button${saveComplete ? ' save-button-success' : ''}`} type="submit" disabled={numericAmount <= 0 || saving || saveComplete} aria-busy={saving}>
            {saveComplete ? <Check className="save-check" size={25} strokeWidth={2.6} aria-label="保存しました" /> : saving ? '保存中…' : '保存する'}
          </button>
        </form>

        {keypadOpen && (
          <AmountKeypad className="expense-keypad" onDigit={appendDigit} onDelete={deleteDigit} onQuickAmount={value => setDraft(current => ({ ...current, amount: String(value) }))} />
        )}
      </section>
    </div>
  )
}
