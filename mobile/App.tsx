import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AccessibilityInfo, Alert, Animated, AppState, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { DATABASE_NAME, initializeDatabaseForStartup } from './src/database/initializeDatabase';
import { StartupBoundary } from './src/startup/StartupBoundary';
import { deleteLocalBackupFiles, pickAndRestoreBackup, restoreLatestAutomaticBackup, shareBackup } from './src/backup/backupFiles';
import { useLocalRepository } from './src/repository/useLocalRepository';
import type { Expense, Home, Settings } from './src/repository/types';
import {
  CalendarScreen, ExpenseSheet, GraphScreen, HomeScreen, InitialBudgetWelcomeScreen, MoneyScreen, MonthlyBudgetWelcomeScreen, OnboardingScreen, SettingsSheet, TabBar,
  type Tab,
} from './src/ui/Screens';
import { todayInTokyo } from './src/ui/format';
import { homeSkyImage, preloadOnboardingFirstImage, preloadVisualAssets } from './src/ui/imageAssets';
import { CalendarSkyBackground, GraphSkyBackground } from './src/ui/skyBackground';
import { cancelMonthlyNotifications, syncMonthlyNotifications } from './src/notifications/monthlyNotifications';

const messageOf = (error: unknown) => error instanceof Error ? error.message : '処理できませんでした。もう一度お試しください。';
const SPLASH_MINIMUM_MS = 500;
const SPLASH_FADE_MS = 280;
const splashStartedAt = Date.now();

SplashScreen.setOptions({ fade: true, duration: SPLASH_FADE_MS });
void SplashScreen.preventAutoHideAsync();

function MobileApp() {
  const repo = useLocalRepository();
  const splashHidden = useRef(false);
  const splashPreviewOpacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);
  const [splashPreviewVisible, setSplashPreviewVisible] = useState(false);
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
    if (!(await repo.isInitialized())) {
      const complete = await repo.isOnboardingComplete();
      if (complete) {
        await preloadVisualAssets();
        setStatus('setup');
      } else {
        // オンボーディングを先に描画する。ホーム用画像や後続ページの先読みで、
        // 説明1画面の表示を待たせない。
        setStatus('onboarding');
      }
      return;
    }
    const imagesReady = preloadVisualAssets();
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

  useEffect(() => {
    let active = true;
    const update = (enabled: boolean) => {
      reduceMotion.current = enabled;
      SplashScreen.setOptions({ fade: !enabled, duration: enabled ? 0 : SPLASH_FADE_MS });
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => { if (active) update(enabled); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { active = false; listener.remove(); };
  }, []);

  useEffect(() => {
    if (status === 'loading' || splashHidden.current) return;
    const remaining = Math.max(0, SPLASH_MINIMUM_MS - (Date.now() - splashStartedAt));
    const timeout = setTimeout(() => {
      splashHidden.current = true;
      void SplashScreen.hideAsync();
    }, remaining);
    return () => clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!splashPreviewVisible) return;
    splashPreviewOpacity.setValue(1);
    const timeout = setTimeout(() => {
      Animated.timing(splashPreviewOpacity, {
        toValue: 0,
        duration: reduceMotion.current ? 0 : SPLASH_FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setSplashPreviewVisible(false); });
    }, SPLASH_MINIMUM_MS);
    return () => { clearTimeout(timeout); splashPreviewOpacity.stopAnimation(); };
  }, [splashPreviewVisible, splashPreviewOpacity]);

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

  const confirmBackup = () => {
    if (dataBusy) return;
    Alert.alert(
      'バックアップを保存',
      'バックアップは暗号化されていないファイルです。予算・支出・メモなどを読めるため、保存先や共有相手にご注意ください。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '共有する', onPress: () => void backupData() },
      ],
    );
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
      '現在のデータを自動バックアップしてから、選択したファイルの内容へ置き換えます。自動バックアップは新しい5件のみ残し、古いものから削除します。',
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
    Alert.alert('復元前のデータに戻す', '現在のデータも自動保存してから、直前の自動バックアップに戻します。自動バックアップは新しい5件のみ残します。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '戻す', onPress: () => void restorePreviousData() },
    ]);
  };

  const deleteAllData = async () => {
    if (dataBusy) return;
    setDataBusy(true); setSettingsError(''); setDataMessage('');
    try {
      deleteLocalBackupFiles();
      await repo.deleteAllUserData();
    } catch (cause) {
      setSettingsError(`全データを削除できませんでした。${messageOf(cause)}`);
      setDataBusy(false);
      return;
    }
    setSettingsOpen(false);
    setMoneyOpen(false);
    setExpenseDraft(null);
    setHome(null);
    setSettings(null);
    setTab('ホーム');
    setOnboardingPage(0);
    setOnboardingError('');
    setNotificationWarning('');
    setStatus('onboarding');
    try {
      await cancelMonthlyNotifications();
    } catch (cause) {
      Alert.alert('通知の取り消しを確認してください', `データは削除しましたが、予約済みの通知を取り消せませんでした。${messageOf(cause)}`);
    } finally {
      setDataBusy(false);
    }
  };

  const confirmDeleteAllData = () => {
    if (dataBusy) return;
    Alert.alert('全データを削除',
      '端末内の予算・支出・メモ・設定・説明の完了状態と、アプリ内の自動バックアップを削除します。元には戻せません。外部に保存したバックアップファイルは残ります。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'すべて削除', style: 'destructive', onPress: () => void deleteAllData() },
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
    <StatusBar style={skySurface || blueSetupSurface || onboardingSurface ? 'light' : 'dark'} hidden={onboardingSurface || splashPreviewVisible} />
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
        onBackup={confirmBackup} onRestore={confirmRestore} onRestorePrevious={confirmRestorePrevious}
        onDeleteAllData={confirmDeleteAllData} />}
      {moneyOpen &&
        <MoneyScreen key="edit" initialAmount={settings.currentBudgetAmount} setup={false}
          onSave={saveMoney} onClose={() => { setMoneyOpen(false); setSettingsOpen(true); }} />
      }
      {expenseDraft && <ExpenseSheet key={`${expenseDraft.initial?.id ?? 'new'}-${expenseDraft.date}`}
        initial={expenseDraft.initial} onClose={() => setExpenseDraft(null)} onSave={saveExpense} />}
    </>}
    </ContentSurface>
    {splashPreviewVisible && <Animated.View style={[StyleSheet.absoluteFill, styles.splashPreview, { opacity: splashPreviewOpacity }]}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={require('./assets/ios-launch-screen.png')} contentFit="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>}
  </View>;
}

function AppDatabase() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansJP: require('./assets/fonts/NotoSansJP.ttf'),
  });
  useEffect(() => { void preloadOnboardingFirstImage(); }, []);
  if (!fontsLoaded && !fontError) return null;
  return <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabaseForStartup}><MobileApp /></SQLiteProvider>;
}

export default function App() {
  return <StartupBoundary><AppDatabase /></StartupBoundary>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  splashPreview: { flex: 1, backgroundColor: '#017AF4' },
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
