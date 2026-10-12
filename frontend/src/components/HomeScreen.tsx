import { useState } from 'react'
import { PawPrint } from 'lucide-react'
import type { ExpenseDraft, HomeViewModel } from '../types'
import { SettingsGearIcon, TodayExpenseIcon } from './AppIcons'
import { BottomNavigation, type NavigationTab } from './BottomNavigation'
import { DogGrowthScene } from './DogGrowthScene'
import { ExpenseInputModal } from './ExpenseInputModal'

const yen = (value: number) => new Intl.NumberFormat('ja-JP').format(value)

export function HomeScreen({ model, onNavigate, onOpenSettings, onSaveExpense }: {
  model: HomeViewModel
  onNavigate: (tab: NavigationTab) => void
  onOpenSettings: () => void
  onSaveExpense: (draft: ExpenseDraft) => Promise<void>
}) {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <>
      <main className="home-screen">
        <header className="home-header">
          <h1 className="current-month"><strong>{model.month}</strong><span>月</span></h1>
          <button className="icon-button settings-button" type="button" aria-label="設定" onClick={onOpenSettings}>
            <SettingsGearIcon width={23} height={23} aria-hidden="true" />
          </button>
        </header>

        <section className="balance-card" aria-label="今月のやりくり">
          <DogGrowthScene message={model.message} />
          <div className="balance-summary">
            <div className="balance-paws" aria-hidden="true">
              <PawPrint /><PawPrint /><PawPrint />
            </div>
            <h2>今月あとつかえるお金</h2>
            <p className="balance-amount" aria-label={`残り予算 ${yen(model.remainingBudget)}円`}><span className="currency">¥</span>{yen(model.remainingBudget)}</p>
            <p className="remaining-days"><span>残</span><strong>{model.remainingDays}</strong><span>日</span></p>
          </div>
        </section>

        <section className="today-card" aria-label="今日の支出">
          <span className="today-icon" aria-hidden="true"><TodayExpenseIcon width={20} height={20} /></span>
          <h2>今日つかった</h2>
          <p>¥{yen(model.todayExpense)}</p>
        </section>

        <button type="button" className="primary-button record-button" onClick={() => setModalOpen(true)}>入力する</button>
      </main>

      <BottomNavigation activeTab="ホーム" onNavigate={onNavigate} />
      {modalOpen && <ExpenseInputModal onClose={() => setModalOpen(false)} onSave={onSaveExpense} />}
    </>
  )
}
