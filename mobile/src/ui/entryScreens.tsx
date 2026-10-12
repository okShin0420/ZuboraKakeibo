import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Check, X } from 'lucide-react-native';
import {
  Animated, Keyboard, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';

import type { Expense } from '../repository/types';
import { yen } from './format';
import { dogImage } from './imageAssets';
import { AmountCaret, colors, NumberPad, PrimaryButton } from './theme';
import { useBottomSheetMotion } from './useBottomSheetMotion';

const errorText = (error: unknown) => error instanceof Error ? error.message : '保存できませんでした。';

export function MoneyScreen({ initialAmount, setup, onSave, onClose, onRestore, restoreBusy }: {
  initialAmount: number; setup: boolean; onSave: (amount: number) => Promise<void>; onClose: () => void;
  onRestore?: () => void; restoreBusy?: boolean;
}) {
  const [amount, setAmount] = useState(String(initialAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { width, height } = useWindowDimensions();
  const compact = width <= 350 || height <= 700;
  const { backdropStyle, sheetStyle, close } = useBottomSheetMotion(!setup, onClose, height);
  const save = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onSave(Number(amount)); if (!setup) close(); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const content = <View style={styles.moneyOverlay}>
    {!setup && <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.backdrop} onPress={() => close()} accessibilityLabel="金額設定を閉じる" />
      </Animated.View>}
    <Animated.View style={[styles.moneySheet, { height: Math.min(height - 28, 730) }, !setup && sheetStyle]}>
      <View style={[styles.header, compact && styles.compactHeader]}>
        <View style={styles.headerSide} />
        <Text style={[styles.headerTitle, styles.moneyHeaderTitle]}>今月使える金額</Text>
        {setup ? <View style={styles.headerSide} /> : <Pressable accessibilityRole="button" accessibilityLabel="金額設定を閉じる"
          onPress={() => close()} style={styles.closeButton}><X size={16} color={colors.ink} /></Pressable>}
      </View>
      <ScrollView contentContainerStyle={styles.moneyContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.guide, compact && styles.compactGuide]}>
          <View style={styles.guideBubble}><Text style={styles.guideText}>今月使えるお金を決めよう。</Text></View>
          <Image source={dogImage} contentFit="contain" cachePolicy="memory-disk" style={styles.guideDog} />
        </View>
        <View style={[styles.budgetEntry, compact && styles.compactBudgetEntry]}>
          <View style={styles.moneyAmountRow}><Text style={styles.moneyCurrency}>¥</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.48} style={styles.moneyAmount}>{yen(Number(amount) || 0)}</Text><AmountCaret color={colors.blue} /></View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={busy ? '保存中…' : '保存する'} onPress={() => void save()}
            disabled={busy || Number(amount) < 0} style={styles.budgetSave} />
          {setup && onRestore && <Pressable accessibilityRole="button" accessibilityLabel="バックアップから復元"
            disabled={busy || restoreBusy} onPress={onRestore} style={styles.setupRestoreButton}>
            <Text style={styles.setupRestoreText}>{restoreBusy ? '復元中…' : 'バックアップから復元'}</Text>
          </Pressable>}
        </View>
        <View style={styles.moneySpacer} />
        <NumberPad value={amount} onChange={setAmount} compact={compact} quickAmounts={[10000, 30000, 50000]} />
      </ScrollView>
    </Animated.View>
  </View>;
  return setup ? content : <Modal visible transparent animationType="none" onRequestClose={() => close()}>{content}</Modal>;
}

export function ExpenseSheet({ initial, onClose, onSave }: {
  initial?: Expense; onClose: () => void; onSave: (amount: number, memo: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(initial?.amount ?? 0));
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [inputMode, setInputMode] = useState<'amount' | 'memo'>('amount');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width, height } = useWindowDimensions();
  const compact = width <= 350 || height <= 700;
  const { backdropStyle, sheetStyle, close } = useBottomSheetMotion(true, onClose, height);
  useEffect(() => {
    Keyboard.dismiss();
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);
  const save = async () => {
    if (busy || saved) return;
    setBusy(true); setError('');
    try {
      await onSave(Number(amount), memo);
      setSaved(true);
      closeTimer.current = setTimeout(() => close(), 780);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  return <Modal visible transparent animationType="none" onRequestClose={() => close()}>
    <View style={styles.modalFill}>
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.backdrop} onPress={() => close()} accessibilityLabel="閉じる" />
      </Animated.View>
      <Animated.View style={[styles.expenseSheet, { height: Math.min(700, height - 28) }, sheetStyle]}>
        <View style={[styles.header, compact && styles.compactHeader]}>
          <View style={styles.headerSide} />
          <Text style={styles.headerTitle}>{initial ? '支出を編集' : '支出を入力'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="閉じる" onPress={() => close()} style={styles.closeButton}>
            <X size={16} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView scrollEnabled={false} bounces={false} overScrollMode="never"
          contentContainerStyle={[styles.expenseContent, compact && styles.compactExpenseContent]}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel={`使った金額 ${yen(Number(amount) || 0)}円`}
            accessibilityState={{ expanded: inputMode === 'amount' }}
            onPress={() => { Keyboard.dismiss(); setInputMode('amount'); }} style={styles.amountTrigger}>
            <View style={styles.expenseAmountRow}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.48} style={styles.expenseAmount}>
                <Text style={styles.expenseCurrency}>¥</Text>{yen(Number(amount) || 0)}
              </Text>
              {inputMode === 'amount' && <AmountCaret />}
            </View>
          </Pressable>
          <Text style={styles.memoLabel}>メモ</Text>
          <TextInput value={memo} onChangeText={setMemo} placeholder="何に使ったか" maxLength={120}
            accessibilityLabel="メモ" style={styles.memo} placeholderTextColor="#98A2A0"
            onFocus={() => setInputMode('memo')} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {saved ? <View accessibilityRole="alert" accessibilityLabel="保存しました" style={styles.savedButton}>
            <Check size={25} color={colors.white} strokeWidth={2.6} />
          </View> : <PrimaryButton label={busy ? '保存中…' : '保存する'} onPress={() => void save()}
            disabled={busy || Number(amount) < 1} style={styles.expenseSave} />}
          {inputMode === 'amount' && <>
            <View style={styles.expensePadSpacer} />
            <View style={[styles.expensePad, compact && styles.compactExpensePad]}>
              <NumberPad value={amount} onChange={setAmount} compact={compact} quickAmounts={[1000, 2000, 5000]} />
            </View>
          </>}
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  moneyOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  modalFill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#073F4566' },
  moneySheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.white,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.white },
  expenseSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.soft,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.white },
  header: { height: 74, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compactHeader: { paddingHorizontal: 26 },
  headerSide: { width: 30 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 15, fontWeight: '700' },
  moneyHeaderTitle: { color: colors.ink },
  closeButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E7ECEC', alignItems: 'center', justifyContent: 'center' },
  moneyContent: { flexGrow: 1 },
  guide: { height: 160, marginHorizontal: 20, borderRadius: 24, overflow: 'hidden', backgroundColor: '#017AF4' },
  compactGuide: { marginHorizontal: 14 },
  guideBubble: { position: 'absolute', zIndex: 2, top: 18, left: 18, borderRadius: 14, borderWidth: 1,
    borderColor: colors.white, backgroundColor: '#FFFFFFF2', paddingHorizontal: 14, paddingVertical: 10 },
  guideText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  guideDog: { position: 'absolute', right: 22, bottom: -34, width: 170, height: 170 },
  budgetEntry: { paddingHorizontal: 20, paddingTop: 10 },
  compactBudgetEntry: { paddingHorizontal: 14 },
  moneyAmountRow: { height: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  moneyAmount: { fontFamily: 'ui-rounded', flexShrink: 1, color: colors.ink, fontSize: 47, fontWeight: '600', letterSpacing: -1.7 },
  moneyCurrency: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 20, fontWeight: '600', letterSpacing: 0 },
  budgetSave: { minHeight: 50, marginTop: 4 },
  setupRestoreButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: 10 },
  setupRestoreText: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  moneySpacer: { flexGrow: 1 },
  expenseContent: { flexGrow: 1, paddingHorizontal: 20 },
  compactExpenseContent: { paddingHorizontal: 14 },
  amountTrigger: { minHeight: 104, alignItems: 'center', justifyContent: 'center' },
  expenseAmountRow: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  expenseAmount: { fontFamily: 'ui-rounded', flexShrink: 1, color: colors.ink, fontSize: 47, fontWeight: '600', letterSpacing: -1.7 },
  expenseCurrency: { fontFamily: 'ui-rounded', fontSize: 20, fontWeight: '600', letterSpacing: 0 },
  memoLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  memo: { height: 54, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line,
    borderRadius: 15, backgroundColor: '#F7F9F9', color: colors.ink, fontSize: 16 },
  expenseSave: { marginTop: 18 },
  savedButton: { width: 54, height: 54, marginTop: 18, borderRadius: 27, alignSelf: 'center',
    backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  expensePadSpacer: { flexGrow: 1, minHeight: 18 },
  expensePad: { marginHorizontal: -20 },
  compactExpensePad: { marginHorizontal: -14 },
  error: { color: '#A32929', fontSize: 13, marginVertical: 10 },
});
