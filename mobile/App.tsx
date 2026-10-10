import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { Alert, AppState, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { DATABASE_NAME, initializeDatabase } from './src/database/initializeDatabase';
import { pickAndRestoreBackup, restoreLatestAutomaticBackup, shareBackup } from './src/backup/backupFiles';
import { useLocalRepository } from './src/repository/useLocalRepository';
import type { Expense, Home, Settings } from './src/repository/types';
import {
  CalendarScreen, ExpenseSheet, GraphScreen, HomeScreen, InitialBudgetWelcomeScreen, MoneyScreen, MonthlyBudgetWelcomeScreen, OnboardingScreen, SettingsSheet, TabBar,
  type Tab,
} from './src/ui/Screens';
import { todayInTokyo } from './src/ui/format';
import { homeSkyImage, preloadVisualAssets } from './src/ui/imageAssets';
import { CalendarSkyBackground, GraphSkyBackground } from './src/ui/skyBackground';
import { syncMonthlyNotifications } from './src/notifications/monthlyNotifications';

const messageOf = (error: unknown) => error instanceof Error ? error.message : '処理できませんでした。もう一度お試しください。';

function MobileApp() {
  const repo = useLocalRepository();
  const [status, setStatus] = useState<'loading' | 'onboarding' | 'onboardingPreview' | 'setup' | 'setupPreview' | 'monthlySetup' | 'ready' | 'error'>('loading');
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const [tab, setTab] = useState<Tab>('ホーム');
  const [home, setHome] = useState<Home | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [monthlyWelcomePreview, setMonthlyWelcomePreview] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<{ date: string; initial?: Expense } | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [notificationWarning, setNotificationWarning] = useState('');
  const [dataMessage, setDataMessage] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setMonthlyWelcomePreview(false);
    const imagesReady = preloadVisualAssets();
    if (!(await repo.isInitialized())) {
      const complete = await repo.isOnboardingComplete();
      await imagesReady;
      setStatus(complete ? 'setup' : 'onboarding');
      return;
    }
    const today = todayInTokyo();
    const nextHome = await repo.getHome(today);
    const nextSettings = await repo.getSettings(today);
    setHome(nextHome);
    setSettings(nextSettings);
    await imagesReady;
    if (!nextSettings.currentBudgetConfigured) {
      setSettingsOpen(false);
      setMoneyOpen(false);
      setStatus('monthlySetup');
    } else {
      setStatus('ready');
    }
    setRevision(value => value + 1);
    void syncMonthlyNotifications(nextSettings, () => repo.getUpcomingNotificationDates(today, 13))
      .then(setNotificationWarning)
      .catch(cause => setNotificationWarning(`通知を予約できませんでした。アプリを開き直してお試しください。${messageOf(cause)}`));
  }, [repo]);

  useEffect(() => {
    void refresh().catch(cause => { setError(messageOf(cause)); setStatus('error'); });
  }, [refresh]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh().catch(cause => { setError(messageOf(cause)); setStatus('error'); });
    });
    return () => listener.remove();
  }, [refresh]);

  const saveSettings = async (changes: Partial<Pick<Settings, 'monthlyNotificationEnabled' | 'startDay' | 'adjustForWeekendsAndHolidays'>>) => {
    if (!settings || settingsBusy || dataBusy) return;
    setSettingsBusy(true); setSettingsError('');
    try {
      await repo.updateSettings({
        monthlyNotificationEnabled: changes.monthlyNotificationEnabled ?? settings.monthlyNotificationEnabled,
        startDay: changes.startDay ?? settings.startDay,
        adjustForWeekendsAndHolidays: changes.adjustForWeekendsAndHolidays ?? settings.adjustForWeekendsAndHolidays,
      });
      await refresh();
    } catch (cause) { setSettingsError(messageOf(cause)); }
    finally { setSettingsBusy(false); }
  };

  const saveMoney = async (amount: number) => {
    if (dataBusy) return;
    if (status === 'setup') await repo.setup(amount);
    else await repo.updateCurrentBudget(amount);
    await refresh();
  };

  const finishOnboarding = async () => {
    if (onboardingBusy) return;
    if (status === 'onboardingPreview') {
      setStatus('ready');
      return;
    }
    setOnboardingBusy(true);
    setOnboardingError('');
    try {
      await repo.completeOnboarding();
      setStatus('setup');
    } catch (cause) {
      setOnboardingError(messageOf(cause));
    } finally {
      setOnboardingBusy(false);
    }
  };

  const backupData = async () => {
    if (dataBusy) return;
    setDataBusy(true); setSettingsError(''); setDataMessage('');
    try {
      await shareBackup(repo);
      setDataMessage('共有メニューを開きました。ファイルの保存先を確認してください。');
    } catch (cause) { setSettingsError(messageOf(cause)); }
    finally { setDataBusy(false); }
  };

  const restoreData = async () => {
    if (dataBusy) return;
    setDataBusy(true); setSettingsError(''); setDataMessage('');
    let restored = false;
    try {
      const result = await pickAndRestoreBackup(repo);
      if (result.canceled) return;
      restored = true;
      await refresh();
      if (result.automaticBackupName) setDataMessage('復元しました。前のデータは「復元前のデータに戻す」から戻せます。');
    } catch (cause) {
      if (restored) {
        setError(`データは復元されましたが、画面を読み直せませんでした。${messageOf(cause)}`);
        setStatus('error');
      } else if (status === 'setup') Alert.alert('復元できませんでした', messageOf(cause));
      else setSettingsError(messageOf(cause));
    }
    finally { setDataBusy(false); }
  };

  const confirmRestore = () => {
    if (dataBusy) return;
    if (status === 'setup') { void restoreData(); return; }
    Alert.alert(
      'バックアップから復元',
      '現在のデータを自動バックアップしてから、選択したファイルの内容へ置き換えます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ファイルを選ぶ', onPress: () => void restoreData() },
      ],
    );
  };

  const restorePreviousData = async () => {
    if (dataBusy) return;
    setDataBusy(true); setSettingsError(''); setDataMessage('');
    let restored = false;
    try {
      await restoreLatestAutomaticBackup(repo);
      restored = true;
      await refresh();
      setDataMessage('復元前のデータに戻しました。');
    } catch (cause) {
      if (restored) {
        setError(`データは復元されましたが、画面を読み直せませんでした。${messageOf(cause)}`);
        setStatus('error');
      } else setSettingsError(messageOf(cause));
    }
    finally { setDataBusy(false); }
  };

  const confirmRestorePrevious = () => {
    if (dataBusy) return;
    Alert.alert('復元前のデータに戻す', '現在のデータも自動保存してから、直前の自動バックアップに戻します。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '戻す', onPress: () => void restorePreviousData() },
    ]);
  };

  const saveExpense = async (amount: number, memo: string) => {
    if (!expenseDraft) return;
    const input = { spentOn: expenseDraft.date, amount, memo: memo || null };
    if (expenseDraft.initial) await repo.updateExpense(expenseDraft.initial.id, input);
    else await repo.createExpense(input);
    await refresh();
    if (tab !== 'カレンダー') setTab('ホーム');
  };

  const skySurface = status === 'ready';
  const blueSetupSurface = status === 'monthlySetup' || status === 'setup' || status === 'setupPreview';
  const onboardingSurface = status === 'onboarding' || status === 'onboardingPreview';
  const ContentSurface = onboardingSurface ? View : SafeAreaView;
  return <View style={[styles.root, skySurface && styles.skyRoot, blueSetupSurface && styles.monthlySetupRoot,
    onboardingSurface && styles.onboardingRoot]}>
    {onboardingSurface && <LinearGradient colors={['#017AF4', '#017AF4', '#3D9BF9']} locations={[0, 0.495, 1]}
      style={StyleSheet.absoluteFill} />}
    {skySurface && <Image source={homeSkyImage} blurRadius={5} contentFit="cover" cachePolicy="memory-disk"
      style={styles.homeSky} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
    {status === 'ready' && tab === 'カレンダー' && <CalendarSkyBackground />}
    {status === 'ready' && tab === 'グラフ' && <GraphSkyBackground />}
    {status === 'ready' && <View pointerEvents="none" style={[styles.bottomSafeFill,
      (moneyOpen || expenseDraft) && styles.keypadBottomSafeFill]} />}
    {blueSetupSurface && <View pointerEvents="none" style={styles.monthlyKeyboardSafeFill} />}
    <ContentSurface testID="app-safe-area" style={styles.safe}>
    <StatusBar style={skySurface || blueSetupSurface || onboardingSurface ? 'light' : 'dark'} hidden={onboardingSurface} />
    {status === 'loading' && <View style={styles.center}><Text>読み込み中です…</Text></View>}
    {status === 'error' && <View style={styles.center}>
      <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => void refresh().catch(cause => setError(messageOf(cause)))}>
        <Text style={styles.retry}>もう一度読み込む</Text>
      </Pressable>
    </View>}
    {onboardingSurface && <OnboardingScreen page={onboardingPage} busy={onboardingBusy} error={onboardingError}
      onBack={() => { setOnboardingError(''); setOnboardingPage(value => Math.max(0, value - 1)); }}
      onNext={() => {
        if (onboardingPage < 2) { setOnboardingError(''); setOnboardingPage(value => value + 1); }
        else void finishOnboarding();
      }}
      onSkip={() => void finishOnboarding()} />}
    {status === 'setup' && <InitialBudgetWelcomeScreen key="initial-setup" onStart={saveMoney}
      onRestore={confirmRestore} restoreBusy={dataBusy} />}
    {status === 'setupPreview' && <InitialBudgetWelcomeScreen key="initial-setup-preview" preview
      onStart={async () => {}} onRestore={confirmRestore} restoreBusy={dataBusy}
      onClosePreview={() => { setStatus('ready'); }} />}
    {status === 'monthlySetup' && settings && <MonthlyBudgetWelcomeScreen key={settings.currentPeriodRange.labelMonth}
      onStart={monthlyWelcomePreview ? async () => {
        setMonthlyWelcomePreview(false);
        setStatus('ready');
      } : saveMoney} />}
    {status === 'ready' && home && settings && <>
      {tab === 'ホーム' && <HomeScreen home={home} onSettings={() => setSettingsOpen(true)} onExpense={() => setExpenseDraft({ date: todayInTokyo() })} />}
      {tab === 'カレンダー' && <CalendarScreen revision={revision} initialMonth={home.labelMonth.slice(0, 7)}
        initialPeriod={settings.currentPeriodRange} onExpense={(date, initial) => setExpenseDraft({ date, initial })}
        onExpenseDeleted={refresh} onSettings={() => setSettingsOpen(true)} />}
      {tab === 'グラフ' && <GraphScreen revision={revision} initialMonth={home.labelMonth.slice(0, 7)}
        onSettings={() => setSettingsOpen(true)} />}
      <TabBar active={tab} onChange={setTab} />
      {settingsOpen && !moneyOpen && <SettingsSheet settings={settings} busy={settingsBusy} error={settingsError || notificationWarning}
        onClose={() => setSettingsOpen(false)} onMoney={() => { setSettingsOpen(false); setMoneyOpen(true); }}
        onChange={changes => void saveSettings(changes)} dataBusy={dataBusy} dataMessage={dataMessage}
        onBackup={() => void backupData()} onRestore={confirmRestore} onRestorePrevious={confirmRestorePrevious}
        onPreviewMonthlyWelcome={__DEV__ ? () => {
          setSettingsOpen(false);
          setMonthlyWelcomePreview(true);
          setStatus('monthlySetup');
        } : undefined}
        onPreviewInitialSetup={__DEV__ ? () => {
          setSettingsOpen(false);
          setStatus('setupPreview');
        } : undefined}
        onPreviewOnboarding={__DEV__ ? () => {
          setSettingsOpen(false);
          setOnboardingPage(0);
          setOnboardingError('');
          setStatus('onboardingPreview');
        } : undefined} />}
      {moneyOpen &&
        <MoneyScreen key="edit" initialAmount={settings.currentBudgetAmount} setup={false}
          onSave={saveMoney} onClose={() => { setMoneyOpen(false); setSettingsOpen(true); }} />
      }
      {expenseDraft && <ExpenseSheet key={`${expenseDraft.initial?.id ?? 'new'}-${expenseDraft.date}`}
        initial={expenseDraft.initial} onClose={() => setExpenseDraft(null)} onSave={saveExpense} />}
    </>}
    </ContentSurface>
  </View>;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansJP: require('./assets/fonts/NotoSansJP.ttf'),
  });
  if (!fontsLoaded && !fontError) return null;
  return <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}><MobileApp /></SQLiteProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  skyRoot: { backgroundColor: '#4E8BFA' },
  monthlySetupRoot: { backgroundColor: '#017AF4' },
  onboardingRoot: { backgroundColor: '#017AF4' },
  homeSky: { position: 'absolute', left: -4, top: -4, width: '104%', height: '104%' },
  bottomSafeFill: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: '#FFFFFF' },
  keypadBottomSafeFill: { backgroundColor: '#DFE1E5' },
  monthlyKeyboardSafeFill: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: '#DFE1E5' },
  safe: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  error: { color: '#B33340', textAlign: 'center' },
  retry: { color: '#1E90FF', fontSize: 16, fontWeight: '600' },
});
