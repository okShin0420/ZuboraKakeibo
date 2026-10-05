import { useCallback, useEffect, useState } from 'react'
import { ApiError, errorMessage } from './api/client'
import { todayInTokyo } from './api/dates'
import { createExpense } from './api/expenses'
import { getHome } from './api/home'
import { createSetup, getSetupStatus } from './api/setup'
import { getSettings, updateSettings } from './api/settings'
import { updateCurrentBudget } from './api/budget'
import type { HomeResponse, SettingsResponse, UpdateSettingsRequest } from './api/types'
import { CalendarScreen } from './components/CalendarScreen'
import { GraphScreen } from './components/GraphScreen'
import { HomeScreen } from './components/HomeScreen'
import { SettingMoneyScreen } from './components/SettingMoneyScreen'
import { SettingsScreen } from './components/SettingsScreen'
import type { NavigationTab } from './components/BottomNavigation'
import type { ExpenseDraft, HomeViewModel } from './types'

type AppScreen = NavigationTab | '設定' | '今月使える金額設定'
type AppStatus = 'loading' | 'setup' | 'ready' | 'error'

export function App() {
  const [screen, setScreen] = useState<AppScreen>('ホーム')
  const [status, setStatus] = useState<AppStatus>('loading')
  const [home, setHome] = useState<HomeResponse | null>(null)
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [message, setMessage] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const asOf = todayInTokyo()

  const load = useCallback(async () => {
    setStatus('loading')
    setMessage('')
    try {
      const setup = await getSetupStatus()
      if (!setup.initialized) {
        setStatus('setup')
        return
      }
      const [nextHome, nextSettings] = await Promise.all([getHome(asOf), getSettings()])
      setHome(nextHome)
      setSettings(nextSettings)
      setStatus('ready')
    } catch (error) {
      setMessage(errorMessage(error))
      setStatus('error')
    }
  }, [asOf])

  useEffect(() => { void load() }, [load])

  const refreshHome = async () => {
    setHome(await getHome(asOf))
    setMessage('')
    setRevision(value => value + 1)
  }

  const saveExpense = async (draft: ExpenseDraft, spentOn: string) => {
    await createExpense({ spentOn, amount: Number(draft.amount), memo: draft.memo || null })
    try {
      await refreshHome()
    } catch (error) {
      setMessage(errorMessage(error))
    }
  }

  const saveSettings = async (changes: Partial<UpdateSettingsRequest>) => {
    if (!settings || settingsBusy) return
    setSettingsBusy(true)
    setSettingsError('')
    try {
      const saved = await updateSettings({
        monthlyNotificationEnabled: changes.monthlyNotificationEnabled ?? settings.monthlyNotificationEnabled,
        startDay: changes.startDay ?? settings.startDay,
        adjustForWeekendsAndHolidays: changes.adjustForWeekendsAndHolidays ?? settings.adjustForWeekendsAndHolidays,
      })
      setSettings(saved)
      setRevision(value => value + 1)
    } catch (error) {
      setSettingsError(errorMessage(error))
    } finally {
      setSettingsBusy(false)
    }
  }

  const saveBudget = async (amount: number) => {
    const saved = await updateCurrentBudget(asOf, amount)
    setSettings(current => current ? { ...current, currentBudgetAmount: saved.budgetAmount } : current)
    try {
      await refreshHome()
    } catch (error) {
      setMessage(errorMessage(error))
    }
    setScreen('設定')
  }

  const setupBudget = async (amount: number) => {
    try {
      await createSetup(amount)
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 409)) throw error
    }
    await load()
  }

  const navigate = (tab: NavigationTab) => setScreen(tab)
  const homeModel: HomeViewModel | null = home && {
    month: Number(home.labelMonth.slice(5, 7)),
    remainingBudget: home.remainingAmount,
    remainingDays: home.remainingDays,
    todayExpense: home.todayExpense,
    message: home.message,
  }

  return (
    <div className="preview-shell">
      <div className="phone-preview">
        {status === 'loading' && <main className="app-state" role="status">読み込み中です…</main>}
        {status === 'error' && <main className="app-state" role="alert"><p>{message}</p><button type="button" onClick={() => void load()}>もう一度読み込む</button></main>}
        {status === 'setup' && <SettingMoneyScreen budget={0} onSave={setupBudget} />}
        {status === 'ready' && homeModel && settings && <>
          {message && <div className="api-inline-error" role="alert">{message}<button type="button" onClick={() => { setMessage(''); void refreshHome().catch(error => setMessage(errorMessage(error))) }}>再読み込み</button></div>}
          {screen === 'グラフ' && <GraphScreen onNavigate={navigate} initialYear={Number(asOf.slice(0, 4))} initialMonth={Number(asOf.slice(5, 7))} revision={revision} />}
          {screen === 'カレンダー' && <CalendarScreen onNavigate={navigate} initialMonth={asOf.slice(0, 7)} initialDay={Number(asOf.slice(8, 10))} revision={revision} onExpenseSaved={refreshHome} />}
          {(screen === 'ホーム' || screen === '設定' || screen === '今月使える金額設定') && <HomeScreen model={homeModel} onNavigate={navigate} onOpenSettings={() => setScreen('設定')} onSaveExpense={draft => saveExpense(draft, asOf)} />}
          {screen === '設定' && <SettingsScreen
            budget={settings.currentBudgetAmount}
            monthlyNotification={settings.monthlyNotificationEnabled}
            startDay={String(settings.startDay)}
            adjustHoliday={settings.adjustForWeekendsAndHolidays}
            currentPeriodRange={settings.currentPeriodRange}
            nextPeriodRange={settings.nextPeriodRange}
            busy={settingsBusy}
            error={settingsError}
            onClose={() => setScreen('ホーム')}
            onOpenMoney={() => setScreen('今月使える金額設定')}
            onMonthlyNotificationChange={value => void saveSettings({ monthlyNotificationEnabled: value })}
            onStartDayChange={value => void saveSettings({ startDay: Number(value) })}
            onAdjustHolidayChange={value => void saveSettings({ adjustForWeekendsAndHolidays: value })}
          />}
          {screen === '今月使える金額設定' && <SettingMoneyScreen budget={settings.currentBudgetAmount} onClose={() => setScreen('設定')} onSave={saveBudget} />}
        </>}
      </div>
      <p className="preview-caption">ズボラ会計簿 <span>／</span> {status === 'setup' ? '初期設定' : screen}画面</p>
    </div>
  )
}
