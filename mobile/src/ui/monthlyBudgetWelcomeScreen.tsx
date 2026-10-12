import { useState } from 'react';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { yen } from './format';
import { AmountCaret, NumberPad } from './theme';

const messageOf = (error: unknown) => error instanceof Error ? error.message : '保存できませんでした。';

function BudgetWelcomeScreen({ testID, title, buttonLabel, onStart, onRestore, restoreBusy, preview, onClosePreview }: {
  testID: string;
  title: string; buttonLabel: string; onStart: (amount: number) => Promise<void>;
  onRestore?: () => void; restoreBusy?: boolean; preview?: boolean; onClosePreview?: () => void;
}) {
  const [amount, setAmount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [amountLineWidth, setAmountLineWidth] = useState(0);
  const [amountTextWidth, setAmountTextWidth] = useState(0);
  const { height } = useWindowDimensions();
  const compact = height <= 700;
  const value = Number(amount);

  const start = async () => {
    if (busy || !Number.isSafeInteger(value) || value < 0) return;
    setBusy(true);
    setError('');
    try { await onStart(value); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  };

  return <View testID={testID} style={styles.root}>
    <View style={[styles.top, compact && styles.topCompact]}>
      <Text style={styles.eyebrow}>{title}</Text>
    </View>

    <View style={styles.center}>
      <View accessibilityLabel={`今月使える金額 ${yen(value)}円`} style={[styles.amountCard, compact && styles.amountCardCompact]}>
        <Text style={styles.amountLabel}>今月使えるお金を設定</Text>
        <View style={styles.amountLine} onLayout={event => setAmountLineWidth(event.nativeEvent.layout.width)}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.48}
            onLayout={event => setAmountTextWidth(event.nativeEvent.layout.width)}
            style={[styles.amount, compact && styles.amountCompact]}>¥{yen(value)}</Text>
          {amountLineWidth > 0 && amountTextWidth > 0 && <View pointerEvents="none"
            style={[styles.amountCaretPosition, { left: Math.min(amountLineWidth - 2, (amountLineWidth + amountTextWidth) / 2 + 5) }]}>
            <AmountCaret color="#FFFFFF" />
          </View>}
        </View>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>

    <View style={[styles.bottom, compact && styles.bottomCompact]}>
      <Pressable accessibilityRole="button" accessibilityLabel={buttonLabel}
        accessibilityState={{ disabled: busy || !!restoreBusy }} disabled={busy || !!restoreBusy}
        onPress={() => preview ? onClosePreview?.() : void start()} style={[styles.startButton, compact && styles.startButtonCompact, busy && styles.startDisabled]}>
        <Text style={styles.startText}>{busy ? '保存中…' : buttonLabel}</Text>
        <ArrowRight size={20} color="#017AF4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Pressable>
      {onRestore && <Pressable accessibilityRole="button" accessibilityLabel="バックアップから復元"
        accessibilityState={{ disabled: busy || !!restoreBusy }} disabled={busy || !!restoreBusy}
        onPress={onRestore} style={styles.restoreButton}>
        <Text style={styles.restoreText}>{restoreBusy ? '復元中…' : 'バックアップから復元'}</Text>
      </Pressable>}
    </View>

    <NumberPad value={amount} onChange={setAmount} compact={compact} quickAmounts={[10000, 30000, 50000]} />
  </View>;
}

export function MonthlyBudgetWelcomeScreen({ onStart }: { onStart: (amount: number) => Promise<void> }) {
  return <BudgetWelcomeScreen testID="monthly-budget-welcome" title="新しい月度がはじまりました" buttonLabel="家計簿をはじめる" onStart={onStart} />;
}

export function InitialBudgetWelcomeScreen({ onStart, onRestore, restoreBusy, preview, onClosePreview }: {
  onStart: (amount: number) => Promise<void>; onRestore?: () => void; restoreBusy?: boolean;
  preview?: boolean; onClosePreview?: () => void;
}) {
  return <BudgetWelcomeScreen testID="initial-budget-welcome" title="さあ、はじめてみよう" buttonLabel="家計簿を始める"
    onStart={onStart} onRestore={onRestore} restoreBusy={restoreBusy} preview={preview} onClosePreview={onClosePreview} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#017AF4' },
  top: { paddingTop: 82, alignItems: 'center' },
  topCompact: { paddingTop: 68 },
  eyebrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bottom: { paddingHorizontal: 26, paddingBottom: 8 },
  bottomCompact: { paddingBottom: 8, gap: 9 },
  amountCard: { width: '100%', alignItems: 'center', paddingHorizontal: 23, paddingVertical: 20,
    transform: [{ translateY: -22 }] },
  amountCardCompact: { paddingVertical: 13 },
  amountLabel: { color: '#FFFFFFE8', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  amountLine: { width: '100%', height: 64, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  amountCaretPosition: { position: 'absolute', top: 11 },
  amount: { color: '#FFFFFF', maxWidth: '100%', fontFamily: 'ui-rounded', fontSize: 48, fontWeight: '600', letterSpacing: -1.8, textAlign: 'center' },
  amountCompact: { fontSize: 40 },
  startButton: { minHeight: 60, borderRadius: 30, backgroundColor: '#FFFFFF', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: '#034C9D', shadowOpacity: 0.18,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  startDisabled: {},
  startButtonCompact: { minHeight: 52 },
  startText: { color: '#017AF4', fontSize: 17, fontWeight: '700' },
  restoreButton: { alignSelf: 'center', minHeight: 42, justifyContent: 'center', paddingHorizontal: 16 },
  restoreText: { color: '#FFFFFFE8', fontSize: 13, fontWeight: '600' },
  error: { color: '#FFFFFF', textAlign: 'center', fontSize: 12 },
});
