import { Component, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, type ScrollViewInstance, Share, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import {
  getStartupDiagnosticSnapshot, markStartupPhase, recordStartupError,
  setWidgetDiagnosticBypass, subscribeStartupDiagnostics,
} from './startupDiagnostics';

// Keep the app and its native dependencies out of this entry point's imports.
// The first diagnostic screen must mount before loading any suspect module.
const modules = [
  { label: 'SQLiteネイティブモジュール', load: () => require('expo-sqlite') },
  { label: '画像ネイティブモジュール', load: () => require('expo-image') },
  { label: 'フォントネイティブモジュール', load: () => require('expo-font') },
  { label: 'ウィジェットの検出・登録', load: () => require('../widgets/registerWidgets') },
];

// Give React Native time to paint the phase before the next synchronous native call.
const afterPaint = () => new Promise<void>(resolve => { setTimeout(resolve, 200); });

class DiagnosticBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { recordStartupError('アプリ描画', error); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function StartupDiagnosticApp() {
  const diagnostic = useSyncExternalStore(subscribeStartupDiagnostics, getStartupDiagnosticSnapshot, getStartupDiagnosticSnapshot);
  const [AppComponent, setAppComponent] = useState<ComponentType | null>(null);
  const [running, setRunning] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const started = useRef(false);
  const laidOut = useRef(false);
  const logScroll = useRef<ScrollViewInstance>(null);

  const start = async (withoutWidget: boolean) => {
    if (started.current) return;
    started.current = true;
    setRunning(true);
    setWidgetDiagnosticBypass(withoutWidget);
    markStartupPhase(withoutWidget ? '診断開始（ウィジェット登録を除外）' : '診断開始（通常の構成）');
    try {
      for (const module of modules) {
        markStartupPhase(`読み込み開始：${module.label}`);
        await afterPaint();
        module.load();
        markStartupPhase(`読み込み完了：${module.label}`);
      }
      markStartupPhase('読み込み開始：アプリ本体・画面');
      await afterPaint();
      const component = require('../../App').default as ComponentType;
      markStartupPhase('読み込み完了：アプリ本体・画面');
      setAppComponent(() => component);
    } catch (cause) {
      recordStartupError('アプリ起動前のモジュール読み込み', cause);
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: ['ZUBORA簿 起動診断', ...diagnostic.events, '\n未完了：', ...diagnostic.pending].join('\n') });
    } catch { /* Closing the share sheet must not change the diagnostic result. */ }
  };

  const showPanel = !diagnostic.ready || detailsOpen || !!diagnostic.error;
  return <View style={styles.root} onLayout={() => {
    if (laidOut.current) return;
    laidOut.current = true;
    markStartupPhase('診断画面の描画完了（JavaScript起動済み）');
    void SplashScreen.hideAsync().catch(cause => recordStartupError('起動画面を閉じる', cause, false));
  }}>
    {AppComponent && <DiagnosticBoundary><AppComponent /></DiagnosticBoundary>}
    {showPanel ? <SafeAreaView style={styles.panel}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>起動診断</Text>
        <Text style={styles.description}>止まった場合は、この画面を撮影するか診断結果を共有してください。</Text>
      </View>
      {!running && <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void start(false)}>
          <Text style={styles.buttonText}>起動診断を開始</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => void start(true)}>
          <Text style={styles.secondaryText}>ウィジェットを除外して確認</Text>
        </Pressable>
      </View>}
      {!!diagnostic.error && <Text accessibilityRole="alert" style={styles.error}>エラーを検出しました。下の「診断結果を共有」を使ってください。</Text>}
      <ScrollView ref={logScroll} style={styles.log} contentContainerStyle={styles.logContent}
        onContentSizeChange={() => logScroll.current?.scrollToEnd({ animated: false })}>
        <Text selectable style={styles.logText}>{diagnostic.events.join('\n')}</Text>
      </ScrollView>
      {diagnostic.pending.length > 0 && <View style={styles.pending}>
        <Text style={styles.pendingTitle}>完了待ち</Text>
        <Text style={styles.description}>{diagnostic.pending.join('\n')}</Text>
      </View>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void share()}>
          <Text style={styles.buttonText}>診断結果を共有</Text>
        </Pressable>
        {diagnostic.ready && <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => setDetailsOpen(false)}>
          <Text style={styles.secondaryText}>アプリに戻る</Text>
        </Pressable>}
      </View>
    </SafeAreaView> : <SafeAreaView pointerEvents="box-none" style={styles.badgeArea}>
      <Pressable accessibilityRole="button" style={styles.badge} onPress={() => setDetailsOpen(true)}>
        <Text style={styles.buttonText}>診断結果</Text>
      </Pressable>
    </SafeAreaView>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  panel: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 24, paddingTop: 16, gap: 8 },
  title: { color: '#000000', fontSize: 22, fontWeight: '700' },
  description: { color: '#637073', fontSize: 14, lineHeight: 21 },
  actions: { paddingHorizontal: 24, paddingVertical: 12, gap: 8 },
  button: { minHeight: 48, padding: 12, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E90FF' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#1E90FF', fontSize: 15, fontWeight: '600' },
  log: { flex: 1, marginHorizontal: 24, marginTop: 8, backgroundColor: '#F3F5F6', borderRadius: 12 },
  logContent: { padding: 12 },
  logText: { color: '#000000', fontSize: 12, lineHeight: 19 },
  pending: { paddingHorizontal: 24, paddingTop: 12, gap: 4 },
  pendingTitle: { color: '#000000', fontSize: 14, fontWeight: '700' },
  error: { paddingHorizontal: 24, paddingTop: 12, color: '#B33340', fontSize: 14 },
  badgeArea: { position: 'absolute', top: 0, right: 8 },
  badge: { minHeight: 44, padding: 12, borderRadius: 22, backgroundColor: '#1E90FF' },
});
