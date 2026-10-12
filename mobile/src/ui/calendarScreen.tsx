import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, WalletCards, X } from 'lucide-react-native';
import { AccessibilityInfo, Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { addMonths } from '../domain/period';
import type { PeriodRange } from '../domain/period';
import { useLocalRepository } from '../repository/useLocalRepository';
import type { CalendarMonth, DailyExpenses, Expense } from '../repository/types';
import { periodCalendarCells, rangeLabel, todayInTokyo, yen } from './format';
import { SettingsButton } from './settingsButton';
import { colors } from './theme';
import { useBottomSheetMotion } from './useBottomSheetMotion';

const messageOf = (error: unknown) => error instanceof Error ? error.message : '読み込めませんでした。';
const swipeWidth = 72;

function SwipeableExpenseRow({ expense, open, deleting, onSwipe, onEdit, onDelete }: {
  expense: Expense; open: boolean; deleting: boolean;
  onSwipe: (id: string | null) => void; onEdit: () => void; onDelete: () => void;
}) {
  const lastSwipeAt = useRef(0);
  const offsetX = useRef(new Animated.Value(open ? -swipeWidth : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const gestureBase = useRef(0);
  const previousOpen = useRef(open);
  const surfaceColor = offsetX.interpolate({ inputRange: [-swipeWidth, 0], outputRange: ['#EEE7E5', '#FFFFFF'], extrapolate: 'clamp' });
  const containerColor = offsetX.interpolate({ inputRange: [-swipeWidth, 0], outputRange: ['#F6EFED', '#FFFFFF'], extrapolate: 'clamp' });
  const dividerColor = offsetX.interpolate({ inputRange: [-swipeWidth, 0], outputRange: ['transparent', '#EEF1F1'], extrapolate: 'clamp' });
  const cornerRadius = offsetX.interpolate({ inputRange: [-swipeWidth, 0], outputRange: [27, 10], extrapolate: 'clamp' });
  const containerRadius = offsetX.interpolate({ inputRange: [-swipeWidth, 0], outputRange: [27, 0], extrapolate: 'clamp' });
  const horizontalPadding = offsetX.interpolate({ inputRange: [-swipeWidth, 0], outputRange: [16, 5], extrapolate: 'clamp' });
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (previousOpen.current === open) return;
    previousOpen.current = open;
    Animated.timing(offsetX, { toValue: open ? -swipeWidth : 0, duration: reduceMotion ? 0 : 200,
      easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [open, offsetX, reduceMotion]);
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderGrant: () => {
      lastSwipeAt.current = Date.now();
      offsetX.stopAnimation(value => { gestureBase.current = value; });
    },
    onPanResponderMove: (_, gesture) => {
      offsetX.setValue(Math.max(-swipeWidth, Math.min(0, gestureBase.current + gesture.dx)));
    },
    onPanResponderRelease: (_, gesture) => {
      lastSwipeAt.current = Date.now();
      const nextOpen = Math.max(-swipeWidth, Math.min(0, gestureBase.current + gesture.dx)) < -swipeWidth / 2;
      previousOpen.current = nextOpen;
      Animated.timing(offsetX, { toValue: nextOpen ? -swipeWidth : 0, duration: reduceMotion ? 0 : 200,
        easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      onSwipe(nextOpen ? expense.id : null);
    },
    onPanResponderTerminate: () => {
      lastSwipeAt.current = Date.now();
      Animated.timing(offsetX, { toValue: open ? -swipeWidth : 0, duration: reduceMotion ? 0 : 200,
        easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    },
    onPanResponderTerminationRequest: () => false,
  }), [expense.id, offsetX, onSwipe, open, reduceMotion]);

  return <Animated.View {...responder.panHandlers} style={[styles.expenseSwipeRow,
    { backgroundColor: containerColor, borderBottomColor: dividerColor, borderRadius: containerRadius }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${expense.memo || 'メモなし'}、${yen(expense.amount)}円の支出を削除`}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      disabled={deleting} onPress={onDelete} style={styles.deleteButton}>
      <View style={styles.deleteSymbol}><Minus size={18} color="#FF3640" strokeWidth={3} /></View>
    </Pressable>
    <Animated.View style={[styles.expenseRow,
      { backgroundColor: surfaceColor, borderRadius: cornerRadius, paddingHorizontal: horizontalPadding,
        transform: [{ translateX: offsetX }] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${expense.memo || 'メモなし'}、${yen(expense.amount)}円を編集。左へスワイプして削除`}
        onPress={() => { if (Date.now() - lastSwipeAt.current < 400) return; if (open) onSwipe(null); else onEdit(); }}
        style={styles.expensePressable}>
        <Text style={styles.expenseMemo}>{expense.memo || 'メモなし'}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={styles.expenseAmount}>¥{yen(expense.amount)}</Text>
      </Pressable>
    </Animated.View>
  </Animated.View>;
}

export function CalendarScreen({ revision, initialMonth, initialPeriod, onExpense, onExpenseDeleted, onSettings }: {
  revision: number; initialMonth: string; initialPeriod: PeriodRange;
  onExpense: (date: string, expense?: Expense) => void; onExpenseDeleted: () => Promise<void>; onSettings: () => void;
}) {
  const repo = useLocalRepository();
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<string | null>(todayInTokyo());
  const [calendar, setCalendar] = useState<CalendarMonth | null>(() => ({
    month: initialMonth, periodStart: initialPeriod.startDate, periodEnd: initialPeriod.endDate, dailyTotals: [],
  }));
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [daily, setDaily] = useState<DailyExpenses | null>(null);
  const [error, setError] = useState('');
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(Number(initialMonth.slice(0, 4)));
  const [openExpenseId, setOpenExpenseId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const { width, height } = useWindowDimensions();
  const compact = width <= 350 || height <= 700;
  const { backdropStyle, sheetStyle, close: closeMonthPicker } = useBottomSheetMotion(
    monthPickerOpen, () => setMonthPickerOpen(false), height,
  );

  useEffect(() => {
    let active = true;
    repo.getMonthlyCalendar(month).then(value => {
      if (!active) return;
      setCalendar(value);
      setSelected(current => current && current >= value.periodStart && current <= value.periodEnd ? current : null);
      setCalendarLoaded(true);
      setError('');
    }).catch(cause => { if (active) { setCalendarLoaded(true); setSelected(null); setError(messageOf(cause)); } });
    return () => { active = false; };
  }, [month, revision, repo]);
  useEffect(() => {
    if (!calendarLoaded || !selected || !calendar) { setDaily(null); return; }
    let active = true;
    repo.getDailyExpenses(selected).then(value => { if (active) setDaily(value); })
      .catch(cause => { if (active) setError(messageOf(cause)); });
    return () => { active = false; };
  }, [selected, calendar, calendarLoaded, revision, repo]);
  const totals = useMemo(() => new Map(calendar?.dailyTotals.map(row => [row.date, row.totalAmount])), [calendar]);
  const cells = useMemo(() => calendar ? periodCalendarCells(calendar.periodStart, calendar.periodEnd) : [], [calendar]);
  const dayHeight = Math.min(compact ? 44 : 49, Math.floor(275 / Math.max(1, cells.length / 7)));
  const changeMonth = (direction: number) => { setMonth(addMonths(month, direction)); setSelected(null); setDaily(null); setCalendarLoaded(false); };
  const openMonthPicker = () => {
    setPickerYear(Math.min(2030, Math.max(2026, year)));
    setMonthPickerOpen(true);
  };
  const chooseMonth = (yearValue: number, monthValue: number) => {
    setMonth(`${yearValue}-${String(monthValue).padStart(2, '0')}`);
    setSelected(null); setDaily(null); setCalendarLoaded(false); setOpenExpenseId(null); closeMonthPicker();
  };
  const removeExpense = async (id: string) => {
    if (deletingExpenseId) return;
    setDeletingExpenseId(id); setError('');
    try { await repo.deleteExpense(id); setOpenExpenseId(null); await onExpenseDeleted(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setDeletingExpenseId(null); }
  };
  const monthNumber = Number(month.slice(5, 7));
  const year = Number(month.slice(0, 4));

  return <View style={styles.screen}>
    <ScrollView scrollEnabled={false} bounces={false} overScrollMode="never" contentContainerStyle={[styles.content, compact && styles.compactContent]} showsVerticalScrollIndicator={false}>
      <View style={[styles.monthSwitcher, compact && styles.compactMonthSwitcher]}>
        <Pressable accessibilityRole="button" accessibilityLabel="前の月" onPress={() => changeMonth(-1)} style={styles.arrow}><ChevronLeft size={27} color={colors.white} strokeWidth={2.5} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="表示する月度を選択" accessibilityState={{ expanded: monthPickerOpen }} onPress={openMonthPicker} style={styles.monthPickerTrigger}><Text style={styles.monthText}>{year}年 {monthNumber}月</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="次の月" onPress={() => changeMonth(1)} style={styles.arrow}><ChevronRight size={27} color={colors.white} strokeWidth={2.5} /></Pressable>
      </View>
      {calendar && <Text style={styles.periodRange}>{rangeLabel(calendar.periodStart, calendar.periodEnd)}</Text>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={[styles.calendarArea, compact && styles.compactCalendarArea]}
        onTouchStart={event => { touchStartX.current = event.nativeEvent.pageX; }}
        onTouchEnd={event => { if (touchStartX.current === null) return; const movement = event.nativeEvent.pageX - touchStartX.current; touchStartX.current = null; if (Math.abs(movement) > 85) changeMonth(movement < 0 ? 1 : -1); }}>
        <View style={[styles.weekRow, compact && styles.compactWeekRow]}>{['月', '火', '水', '木', '金', '土', '日'].map(day => <Text key={day} style={styles.weekText}>{day}</Text>)}</View>
        <View style={[styles.grid, compact && styles.compactGrid]}>{cells.map((date, index) => {
          if (date === null) return <View key={`empty-${index}`} style={[styles.day, { height: dayHeight }]} />;
          const day = Number(date.slice(8, 10));
          const dateMonth = Number(date.slice(5, 7));
          const active = selected === date;
          const amount = totals.get(date) ?? 0;
          return <Pressable key={date} accessibilityRole="button"
            accessibilityLabel={`${dateMonth}月${day}日、${amount ? `${yen(amount)}円` : '支出なし'}`}
            accessibilityState={{ selected: active }} onPress={() => { if (selected !== date) { setDaily(null); setSelected(date); } }}
            style={[styles.day, { height: dayHeight }, active && styles.selectedDay]}>
            <Text style={[styles.dayNumber, active && styles.selectedText, (date === calendar?.periodStart || day === 1) && styles.monthDayNumber]}>{date === calendar?.periodStart || day === 1 ? `${dateMonth}/${day}` : day}</Text>
            {amount > 0 && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.35} style={[styles.dayAmount, active && styles.selectedAmount]}>¥{yen(amount)}</Text>}
          </Pressable>;
        })}</View>
      </View>
      <View pointerEvents={calendarLoaded ? 'auto' : 'none'}
        style={[styles.dailyCard, compact && styles.compactDailyCard]}>
        <View style={[styles.dailyCardBody, !calendarLoaded && styles.dailyCardPending]}>
        <View style={styles.dailyHeader}>
          <View style={styles.dailyIcon}><WalletCards size={20} color={colors.white} strokeWidth={1.8} /></View>
          <View style={styles.dailyHeading}><Text style={styles.dailyTitle}>{selected ? `${Number(selected.slice(5, 7))}月${Number(selected.slice(8, 10))}日` : '日付を選択'}</Text>
            <Text style={styles.dailyHint}>{selected ? daily?.expenses.length ? `${daily.expenses.length}件の支出` : '支出はありません' : '確認したい日をタップ'}</Text></View>
          {selected && <Pressable accessibilityRole="button" accessibilityLabel="支出を入力する" onPress={() => onExpense(selected)} style={styles.addButton}>
            <Plus size={20} color={colors.white} strokeWidth={2.2} />
          </Pressable>}
        </View>
        {selected && <ScrollView style={styles.expenseList} nestedScrollEnabled bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>{daily?.expenses.map(expense =>
          <SwipeableExpenseRow key={expense.id} expense={expense} open={openExpenseId === expense.id}
            deleting={deletingExpenseId === expense.id} onSwipe={setOpenExpenseId}
            onEdit={() => onExpense(selected, expense)} onDelete={() => void removeExpense(expense.id)} />)}</ScrollView>}
        </View>
      </View>
    </ScrollView>
    <SettingsButton onPress={onSettings} style={[styles.settingsButton, compact && styles.compactSettingsButton]} />
    <Modal visible={monthPickerOpen} transparent animationType="none" onRequestClose={() => closeMonthPicker()}>
      <View style={styles.pickerOverlay}>
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable style={[StyleSheet.absoluteFill, styles.pickerBackdrop]} onPress={() => closeMonthPicker()} accessibilityLabel="月度選択を閉じる" />
        </Animated.View>
        <Animated.View style={[styles.pickerSheet, sheetStyle]}>
          <View style={styles.pickerHeader}><Text style={styles.pickerTitle}>表示する月度</Text><Pressable accessibilityRole="button" accessibilityLabel="閉じる" onPress={() => closeMonthPicker()} style={styles.pickerClose}><X size={20} color={colors.ink} /></Pressable></View>
          <View style={styles.pickerYears}>{[2026, 2027, 2028, 2029, 2030].map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: pickerYear === option }} onPress={() => setPickerYear(option)} style={[styles.pickerYear, pickerYear === option && styles.pickerSelected]}><Text style={[styles.pickerText, pickerYear === option && styles.pickerSelectedText]}>{option}年</Text></Pressable>)}</View>
          <View style={styles.pickerMonths}>{Array.from({ length: 12 }, (_, index) => index + 1).map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: pickerYear === year && option === monthNumber }} onPress={() => chooseMonth(pickerYear, option)} style={[styles.pickerMonth, pickerYear === year && option === monthNumber && styles.pickerSelected]}><Text style={[styles.pickerText, pickerYear === year && option === monthNumber && styles.pickerSelectedText]}>{option}月</Text></Pressable>)}</View>
        </Animated.View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1, paddingTop: 16, paddingHorizontal: 20 },
  compactContent: { paddingHorizontal: 14, paddingTop: 10 },
  monthSwitcher: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 13 },
  settingsButton: { position: 'absolute', right: 20, top: 8 },
  compactSettingsButton: { right: 14 },
  compactMonthSwitcher: { height: 36, marginTop: 9 },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontFamily: 'ui-rounded', minWidth: 104, textAlign: 'center', color: colors.white, fontSize: 15, fontWeight: '600' },
  monthPickerTrigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 5 },
  periodRange: { fontFamily: 'ui-rounded', color: colors.white, opacity: 0.88, textAlign: 'center', fontSize: 11, fontWeight: '600', marginTop: 2 },
  calendarArea: { marginTop: 11, paddingHorizontal: 7, paddingTop: 12, paddingBottom: 4 },
  compactCalendarArea: { marginTop: 6, paddingTop: 4 },
  weekRow: { flexDirection: 'row', marginBottom: 9 },
  compactWeekRow: { marginBottom: 4 },
  weekText: { width: '14.28%', color: colors.white, textAlign: 'center', fontSize: 10, fontWeight: '600', opacity: 0.86 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  compactGrid: { rowGap: 2 },
  day: { width: '14.28%', height: 49, borderRadius: 8, alignItems: 'center', paddingTop: 5, gap: 4 },
  compactDay: { height: 44 },
  selectedDay: { backgroundColor: colors.white, shadowColor: '#075C61', shadowOpacity: 0.2,
    shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  disabledDay: { opacity: 0.28 },
  dayNumber: { fontFamily: 'ui-rounded', fontSize: 12, fontWeight: '600', color: colors.white },
  monthDayNumber: { fontSize: 10 },
  selectedText: { color: '#1479D9' },
  dayAmount: { fontFamily: 'ui-rounded', maxWidth: '100%', borderRadius: 10, backgroundColor: '#FFFFFFD9', color: '#07577A',
    fontSize: 10, fontWeight: '600', paddingHorizontal: 4, paddingVertical: 2 },
  selectedAmount: { backgroundColor: 'transparent', color: '#1479D9', paddingHorizontal: 0 },
  dailyCard: { flexGrow: 1, minHeight: 0, marginTop: 21, marginHorizontal: -20, borderTopLeftRadius: 28,
    borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.white, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 8,
    backgroundColor: colors.white, shadowColor: '#075C61', shadowOpacity: 0.13, shadowRadius: 15,
    shadowOffset: { width: 0, height: -8 }, elevation: 4 },
  dailyCardBody: { flex: 1, minHeight: 0 },
  dailyCardPending: { opacity: 0 },
  compactDailyCard: { marginTop: 8, marginHorizontal: -14, paddingHorizontal: 14, paddingTop: 14 },
  dailyHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dailyIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  dailyHeading: { flex: 1 },
  dailyTitle: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 13, fontWeight: '600' },
  dailyHint: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 9, fontWeight: '600', opacity: 0.5, marginTop: 3 },
  addButton: { width: 44, height: 30, borderRadius: 15, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  expenseList: { marginTop: 16, paddingTop: 8, borderTopWidth: 1, borderColor: '#E7ECEC' },
  expenseSwipeRow: { minHeight: 48, overflow: 'hidden', borderBottomWidth: 1 },
  expenseRow: { minHeight: 48 },
  expensePressable: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteButton: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 72, borderRadius: 27, backgroundColor: '#FF3640', alignItems: 'center', justifyContent: 'center' },
  deleteSymbol: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  expenseMemo: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' },
  expenseAmount: { maxWidth: '55%', flexShrink: 1, fontFamily: 'ui-rounded', color: colors.ink, fontSize: 16, fontWeight: '600' },
  error: { color: '#B33340', marginVertical: 8, fontSize: 13 },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerBackdrop: { backgroundColor: '#073F4566' },
  pickerSheet: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34, backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  pickerClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF5FA', alignItems: 'center', justifyContent: 'center' },
  pickerYears: { flexDirection: 'row', gap: 5, marginBottom: 18 },
  pickerMonths: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pickerYear: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#F2F7FB', alignItems: 'center', justifyContent: 'center' },
  pickerMonth: { width: '23%', height: 44, borderRadius: 10, backgroundColor: '#F2F7FB', alignItems: 'center', justifyContent: 'center' },
  pickerSelected: { backgroundColor: colors.blue },
  pickerText: { fontFamily: 'ui-rounded', fontSize: 13, color: '#24435A', fontWeight: '600' },
  pickerSelectedText: { color: colors.white },
});
