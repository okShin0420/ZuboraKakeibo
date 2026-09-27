import { useState } from 'react'
import { CalendarScreen } from './components/CalendarScreen'
import { GraphScreen } from './components/GraphScreen'
import { HomeScreen } from './components/HomeScreen'
import { SettingMoneyScreen } from './components/SettingMoneyScreen'
import { SettingsScreen } from './components/SettingsScreen'
import type { NavigationTab } from './components/BottomNavigation'
import type { HomeViewModel } from './types'

type AppScreen = NavigationTab | '設定' | '今月使える金額設定'
const spentThisMonth = 1800

export function App() {
  const [screen, setScreen] = useState<AppScreen>('ホーム')
  const [monthlyBudget, setMonthlyBudget] = useState(50000)
  const [monthlyNotification, setMonthlyNotification] = useState(true)
  const [startDay, setStartDay] = useState('1')
  const [adjustHoliday, setAdjustHoliday] = useState(true)
  const homeModel: HomeViewModel = {
    month: 9,
    remainingBudget: monthlyBudget - spentThisMonth,
    remainingDays: 10,
    todayExpense: 1200,
    message: '今日も、自分のペースで。',
  }

  const navigate = (tab: NavigationTab) => {
    setScreen(tab)
  }

  return (
    <div className="preview-shell">
      <div className="phone-preview">
        {screen === 'グラフ' && <GraphScreen onNavigate={navigate} />}
        {screen === 'カレンダー' && <CalendarScreen onNavigate={navigate} startDay={startDay} adjustHoliday={adjustHoliday} />}
        {(screen === 'ホーム' || screen === '設定' || screen === '今月使える金額設定') && <HomeScreen model={homeModel} onNavigate={navigate} onOpenSettings={() => setScreen('設定')} />}
        {screen === '設定' && (
          <SettingsScreen
            budget={monthlyBudget}
            monthlyNotification={monthlyNotification}
            startDay={startDay}
            adjustHoliday={adjustHoliday}
            onClose={() => setScreen('ホーム')}
            onOpenMoney={() => setScreen('今月使える金額設定')}
            onMonthlyNotificationChange={setMonthlyNotification}
            onStartDayChange={setStartDay}
            onAdjustHolidayChange={setAdjustHoliday}
          />
        )}
        {screen === '今月使える金額設定' && <SettingMoneyScreen budget={monthlyBudget} onClose={() => setScreen('設定')} onSave={value => { setMonthlyBudget(value); setScreen('設定') }} />}
      </div>
      <p className="preview-caption">ズボラ会計簿 <span>／</span> {screen}画面モック</p>
    </div>
  )
}
