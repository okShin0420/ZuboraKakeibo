import { Component, Fragment, type ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// SQLiteProviderは接続・初期化の非同期エラーをrender時に再送出する。
// フォント読み込みも含め、Providerの外側で受け止める。
export class StartupBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() {
    void SplashScreen.hideAsync().catch(() => {});
  }

  retry = () => {
    this.setState(state => ({ failed: false, attempt: state.attempt + 1 }));
  };

  render() {
    if (!this.state.failed) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
    return <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>読み込みできませんでした</Text>
        <Text accessibilityRole="alert" style={styles.message}>
          保存済みのデータは削除していません。もう一度読み込んでみてください。
        </Text>
        <Pressable accessibilityRole="button" onPress={this.retry} style={styles.retry}>
          <Text style={styles.retryText}>もう一度読み込む</Text>
        </Pressable>
        <Text style={styles.message}>解決しない場合は、アプリを更新してからお試しください。お問い合わせ：amenochihareruya432@gmail.com</Text>
      </ScrollView>
    </SafeAreaView>;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { color: '#000000', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: { color: '#637073', fontSize: 14, lineHeight: 23, textAlign: 'center' },
  retry: { minHeight: 48, padding: 14, alignItems: 'center', borderRadius: 24, backgroundColor: '#1E90FF' },
  retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
