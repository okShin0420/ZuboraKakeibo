import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useLocalRepository } from '../repository/useLocalRepository';
import type { MonthlyBudgetSummary, YearlyBudgetSummary } from '../repository/types';
import { yen } from './format';
import { dogImage } from './imageAssets';
import { SettingsButton } from './settingsButton';
import { colors } from './theme';
import { useBottomSheetMotion } from './useBottomSheetMotion';

const graphAmount = (month: MonthlyBudgetSummary): number => month.budgetAmount === 0 ? 0 : month.remainingAmount;
const availableYears = Array.from({ length: 5 }, (_, index) => 2026 + index);

function RisingBar({ height, delay, animate, reduceMotion }: {
  height: number; delay: number; animate: boolean; reduceMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const hasStarted = useRef(false);
  useEffect(() => {
    if (!animate || hasStarted.current) return;
    hasStarted.current = true;
    if (reduceMotion) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 360, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animate, delay, progress, reduceMotion]);
  const animatedHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  return <Animated.View style={[styles.bar, { height: animatedHeight }]} />;
}

export function GraphScreen({ revision, initialMonth, onSettings }: { revision: number; initialMonth: string; onSettings: () => void }) {
  const repo = useLocalRepository();
  const currentYear = Number(initialMonth.slice(0, 4));
  const currentMonth = Number(initialMonth.slice(5, 7));
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [data, setData] = useState<YearlyBudgetSummary | null>(null);
  const [error, setError] = useState('');
  const [yearOpen, setYearOpen] = useState(false);
  const [screenHeight, setScreenHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [motionPreferenceReady, setMotionPreferenceReady] = useState(false);
  const { width, height } = useWindowDimensions();
  const { backdropStyle, sheetStyle, close: closeYearPicker } = useBottomSheetMotion(
    yearOpen, () => setYearOpen(false), height,
  );
  const compact = width <= 350 || height <= 700;
  const chartWidth = width - (compact ? 28 : 40);
  const plotHeight = Math.max(144, (screenHeight || height - 90) - (compact ? 413 : 449));
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) { setReduceMotion(value); setMotionPreferenceReady(true); }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      setReduceMotion(value);
      setMotionPreferenceReady(true);
    });
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    let active = true;
    repo.getYearlySummary(year).then(value => { if (active) { setData(value); setError(''); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '読み込めませんでした'); });
    return () => { active = false; };
  }, [repo, year, revision]);
  const selected = data?.monthlySummaries[selectedMonth - 1];
  const selectedAmount = `¥${yen(selected ? graphAmount(selected) : 0)}`;
  const maxUnits = Math.max(3, Math.ceil(Math.max(0, ...(data?.monthlySummaries.map(graphAmount) ?? [0])) / 10_000));
  const center = (compact ? 32 : 36) + (selectedMonth - 0.5) * (chartWidth - (compact ? 40 : 48)) / 12;
  const cardWidth = Math.min(chartWidth, Math.max(120, 60 + selectedAmount.length * 9));
  const cardLeft = Math.max(0, Math.min(chartWidth - cardWidth, center - cardWidth / 2));
  const months = data?.monthlySummaries ?? Array.from({ length: 12 }, (_, index) => ({ month: index + 1, budgetAmount: 0, spentAmount: 0, remainingAmount: 0, expenseCount: 0 }));
  return <View style={styles.screen} onLayout={event => setScreenHeight(event.nativeEvent.layout.height)}>
    <View style={[styles.hero, compact && styles.compactHero]}>
      <SettingsButton onPress={onSettings} style={styles.settingsButton} />
      <View style={[styles.heroCopy, compact && styles.compactHeroCopy]}>
        <Text style={[styles.heroHeading, compact && styles.compactHeroHeading]}>やりくり金額</Text>
        <Text style={[styles.heroMonth, compact && styles.compactHeroMonth]}>{selectedMonth}月</Text>
        <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false} style={styles.heroAmountViewport}>
          <Text numberOfLines={1} style={[styles.heroAmount, compact && styles.compactHeroAmount]}>{selectedAmount}</Text>
        </ScrollView>
      </View>
      <Image source={dogImage} contentFit="contain" cachePolicy="memory-disk" style={[styles.heroDog, compact && styles.compactHeroDog]}
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    </View>
    <ScrollView style={styles.graphBody} scrollEnabled={false} bounces={false} overScrollMode="never" contentContainerStyle={[styles.content, compact && styles.compactContent]} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={`表示年 ${year}年`} onPress={() => setYearOpen(true)} style={[styles.yearButton, compact && styles.compactYearButton]}>
        <Text style={styles.yearText}>{year}年</Text><ChevronDown size={17} color={colors.blue} />
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={[styles.chart, compact && styles.compactChart]}>
        <Text style={[styles.unit, compact && styles.compactUnit]}>万円</Text>
        <View style={[styles.amountCard, { left: cardLeft, width: cardWidth }]}>
          <Text style={styles.cardMonth}>{selectedMonth}月</Text>
          <Text numberOfLines={1} style={styles.cardAmount}>{selectedAmount}</Text>
        </View>
        <View style={[styles.selectedLine, { left: center, height: plotHeight + 8 }]} />
        <View style={[styles.axisLabels, compact && styles.compactAxisLabels, { height: plotHeight }]}>
          {[maxUnits, Math.round(maxUnits * 2 / 3 * 10) / 10, Math.round(maxUnits / 3 * 10) / 10, 0]
            .map(value => <Text key={value} style={styles.axisLabel}>{value}</Text>)}
        </View>
        <View style={[styles.grid, compact && styles.compactGrid, { height: plotHeight }]}>
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: '33.33%' }]} />
          <View style={[styles.gridLine, { top: '66.66%' }]} />
          <View style={[styles.gridLine, { bottom: 0 }]} />
          <View style={[styles.bars, { height: plotHeight }]}>{months.map((item, index) =>
            <Pressable key={item.month} accessibilityRole="button"
              accessibilityLabel={`${item.month}月、${yen(graphAmount(item))}円`}
              accessibilityState={{ selected: selectedMonth === item.month }}
              onPress={() => setSelectedMonth(item.month)} style={[styles.barSlot, { height: plotHeight }]}>
              {graphAmount(item) > 0 && <RisingBar
                height={Math.min(plotHeight, graphAmount(item) / (maxUnits * 10_000) * (plotHeight + 28))}
                delay={index * 18} animate={motionPreferenceReady} reduceMotion={reduceMotion} />}
            </Pressable>)}</View>
        </View>
        <View testID="graph-month-labels" style={[styles.labels, compact && styles.compactLabels]}>{Array.from({ length: 12 }, (_, index) => <Text key={index} style={styles.label}>{index + 1}</Text>)}</View>
      </View>
    </ScrollView>
    <Modal visible={yearOpen} transparent animationType="none" onRequestClose={() => closeYearPicker()}>
      <View style={styles.modalFill}><Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.backdrop} onPress={() => closeYearPicker()} accessibilityLabel="年選択を閉じる" />
      </Animated.View>
        <Animated.View style={[styles.yearSheet, sheetStyle]} accessibilityRole="none">
          <View style={styles.yearSheetHeader}>
            <View><Text style={styles.sheetTitle}>表示する年</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="年選択を閉じる" onPress={() => closeYearPicker()} style={styles.yearClose}>
              <X size={19} color={colors.ink} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.yearOptions}>{availableYears.map(candidate => <Pressable key={candidate} accessibilityRole="radio"
            accessibilityState={{ checked: candidate === year }}
            onPress={() => { setYear(candidate); setSelectedMonth(candidate === currentYear ? currentMonth : 1); closeYearPicker(); }}
            style={styles.yearOption}><Text style={[styles.yearOptionText, candidate === year && styles.yearOptionActive]}>{candidate}年</Text>{candidate === year && <Check size={19} color={colors.blue} strokeWidth={2.4} />}</Pressable>)}</View>
        </Animated.View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  graphBody: { backgroundColor: colors.white },
  hero: { height: 208, overflow: 'hidden', paddingHorizontal: 24, paddingTop: 31 },
  settingsButton: { position: 'absolute', right: 20, top: 8, zIndex: 2 },
  compactHero: { height: 190, paddingHorizontal: 20, paddingTop: 25 },
  heroCopy: { position: 'absolute', zIndex: 1, left: 36, top: 68, width: '67%' },
  compactHeroCopy: { left: 30, top: 68, width: '70%' },
  heroDog: { position: 'absolute', right: -16, bottom: -22, width: 194, height: 194 },
  compactHeroDog: { right: -12, bottom: -18, width: 158, height: 158 },
  heroHeading: { color: colors.white, fontSize: 22, fontWeight: '600' },
  compactHeroHeading: { fontSize: 19 },
  heroMonth: { fontFamily: 'ui-rounded', color: colors.white, fontSize: 14, fontWeight: '600', marginTop: 14 },
  compactHeroMonth: { fontSize: 12, marginTop: 12 },
  heroAmountViewport: { width: '100%' },
  heroAmount: { fontFamily: 'ui-rounded', color: colors.white, fontSize: 40, fontWeight: '600', letterSpacing: -1.2, marginTop: 0 },
  compactHeroAmount: { fontSize: 32 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  compactContent: { paddingHorizontal: 14, paddingBottom: 20 },
  yearButton: { alignSelf: 'center', minHeight: 48, minWidth: 120, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, marginTop: 20 },
  compactYearButton: { minHeight: 44, marginTop: 14 },
  yearText: { fontFamily: 'ui-rounded', color: colors.blue, fontSize: 18, fontWeight: '600' },
  chart: { marginTop: 6 },
  compactChart: { marginTop: 4 },
  unit: { position: 'absolute', top: 18, left: 12, color: '#879AA6', fontSize: 9 },
  compactUnit: { left: 7 },
  amountCard: { position: 'absolute', top: 0, zIndex: 3, minWidth: 120, height: 40, borderRadius: 8,
    paddingHorizontal: 10, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cardMonth: { fontFamily: 'ui-rounded', color: colors.white, fontSize: 12, fontWeight: '600' },
  cardAmount: { fontFamily: 'ui-rounded', flexShrink: 1, color: colors.white, fontSize: 16, fontWeight: '600' },
  selectedLine: { position: 'absolute', top: 40, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#AEB8BA', zIndex: 0 },
  axisLabels: { position: 'absolute', left: 12, top: 44, justifyContent: 'space-between' },
  compactAxisLabels: { left: 7, top: 40 },
  axisLabel: { fontFamily: 'ui-rounded', color: '#8E9DA4', fontSize: 11, fontWeight: '600', width: 22, textAlign: 'left' },
  grid: { marginTop: 48, marginLeft: 36, marginRight: 12, position: 'relative', zIndex: 1 },
  compactGrid: { marginTop: 45, marginLeft: 32, marginRight: 8 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#E7EFF4' },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { width: '8.333%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 14, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: colors.blue },
  labels: { flexDirection: 'row', marginTop: 19, marginLeft: 36, marginRight: 12 },
  compactLabels: { marginTop: 16, marginLeft: 32, marginRight: 8 },
  label: { fontFamily: 'ui-rounded', width: '8.333%', textAlign: 'center', color: '#85939C', fontSize: 10, fontWeight: '600' },
  error: { color: '#B33340', marginVertical: 8 },
  modalFill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#073F4566' },
  yearSheet: { backgroundColor: colors.soft, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: '#FFFFFFB8', paddingHorizontal: 20, paddingBottom: 24 },
  yearSheetHeader: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  sheetHint: { color: '#637073', fontSize: 10, marginTop: 4 },
  yearClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center' },
  yearOptions: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.white, marginBottom: 2 },
  yearOption: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearOptionText: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 18, fontWeight: '600' },
  yearOptionActive: { color: colors.blue },
});
