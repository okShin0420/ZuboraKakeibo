import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import type { Home } from '../repository/types';
import { AnimatedDog } from './animatedDog';
import { yen } from './format';
import { SettingsButton } from './settingsButton';
import { colors, PrimaryButton } from './theme';

export function HomeScreen({ home, onSettings, onExpense }: {
  home: Home; onSettings: () => void; onExpense: () => void;
}) {
  const windowSize = useWindowDimensions();
  // A temporary native window resize during reload must not switch the home layout.
  const { width, height } = Platform.OS === 'web' ? windowSize : Dimensions.get('screen');
  const compact = width <= 350 || height <= 700;
  const phoneHeight = !compact && height <= 900;
  const shortPhone = phoneHeight && height <= 830;
  const dogSize = compact ? 155 : shortPhone ? 186 : phoneHeight ? 212 : 237;
  const [balanceSize, setBalanceSize] = useState<{ width: number; height: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const onBalanceLayout = (event: LayoutChangeEvent) => {
    const { width: cardWidth, height: cardHeight } = event.nativeEvent.layout;
    if (cardWidth <= 0 || cardHeight <= 0) return;
    setBalanceSize(current => current?.width === cardWidth && current.height === cardHeight
      ? current : { width: cardWidth, height: cardHeight });
  };
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 100);
    return () => clearTimeout(timer);
  }, []);
  return <View style={styles.screen}>
    <LinearGradient pointerEvents="none" colors={['#FFFFFF00', '#FFFFFF22', '#FFFFFFCC', '#FFFFFF']}
      locations={[0, 0.35, 0.68, 0.88]} style={styles.fade} />
    <ScrollView ref={scrollRef} scrollEnabled={false} bounces={false} overScrollMode="never" contentContainerStyle={[styles.content, phoneHeight && styles.phoneContent, shortPhone && styles.shortContent, compact && styles.compactContent]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, phoneHeight && styles.phoneHeader, shortPhone && styles.shortHeader, compact && styles.compactHeader]}>
        <Text style={styles.month}><Text style={styles.monthNumber}>{Number(home.labelMonth.slice(5, 7))}</Text>月</Text>
      </View>
      <View style={[styles.dogStage, phoneHeight && styles.phoneDogStage, shortPhone && styles.shortDogStage, compact && styles.compactDogStage]}>
        <View style={[styles.speech, compact && styles.compactSpeech]}><Text style={[styles.speechText, compact && styles.compactSpeechText]}>{home.message}</Text></View>
        <View style={[styles.dogOverlap, phoneHeight && styles.phoneDogOverlap,
          shortPhone && styles.shortDogOverlap, compact && styles.compactDogOverlap,
          { width: dogSize, height: dogSize }]}>
          <Svg pointerEvents="none" style={styles.dogFootShadow} width={dogSize * 0.65} height={dogSize * 0.18}
            viewBox="0 0 200 50">
            <Defs>
              <RadialGradient id="dogFootShadow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor="#1C1C1C" stopOpacity="0.42" />
                <Stop offset="0.52" stopColor="#292929" stopOpacity="0.27" />
                <Stop offset="1" stopColor="#333333" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx="100" cy="25" rx="98" ry="24" fill="url(#dogFootShadow)" />
          </Svg>
          <AnimatedDog size={dogSize} />
        </View>
      </View>
      <View onLayout={onBalanceLayout} style={[styles.balance, phoneHeight && styles.phoneBalance,
        shortPhone && styles.shortBalance, compact && styles.compactBalance,
        balanceSize && styles.measuredBalance]}>
        {balanceSize && <Svg pointerEvents="none" style={styles.cardShape} width={balanceSize.width}
          height={balanceSize.height} viewBox={`0 0 ${balanceSize.width} ${balanceSize.height}`}>
          <Path d={`M28 13 C${balanceSize.width * 0.3} -4 ${balanceSize.width * 0.7} -4 ${balanceSize.width - 28} 13
            C${balanceSize.width - 10} 15 ${balanceSize.width} 25 ${balanceSize.width} 41
            L${balanceSize.width} ${balanceSize.height - 26}
            Q${balanceSize.width} ${balanceSize.height} ${balanceSize.width - 26} ${balanceSize.height}
            L26 ${balanceSize.height} Q0 ${balanceSize.height} 0 ${balanceSize.height - 26}
            L0 41 C0 25 10 15 28 13 Z`} fill="#FFFFFF" />
        </Svg>}
        <Text style={styles.balanceLabel}>今月あと使えるお金</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.42}
          style={[styles.amount, compact && styles.compactAmount]}><Text style={styles.currency}>¥</Text>{yen(home.remainingAmount)}</Text>
        <View style={styles.remainingDays} accessibilityLabel={`残${home.remainingDays}日`}>
          <Text style={styles.remainingDaysText}>残</Text>
          <Text style={styles.remainingDaysNumber}>{home.remainingDays}</Text>
          <Text style={styles.remainingDaysText}>日</Text>
        </View>
      </View>
      <View style={[styles.today, phoneHeight && styles.phoneToday, shortPhone && styles.shortToday, compact && styles.compactToday]}>
        <View style={styles.todayIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
              fill="none" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.todayLabel}>今日つかった</Text>
        <Text style={styles.todayAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.48}>¥{yen(home.todayExpense)}</Text>
      </View>
      <View style={[styles.buttonShadow, compact ? styles.compactButton : shortPhone ? styles.shortButton : phoneHeight ? styles.phoneButton : undefined]}>
        <PrimaryButton label="入力する" onPress={onExpense} style={styles.buttonInsideShadow} />
      </View>
    </ScrollView>
    <SettingsButton onPress={onSettings} style={[styles.settingsButton, compact && styles.compactSettingsButton]} />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent', overflow: 'hidden' },
  fade: { position: 'absolute', inset: 0 },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 },
  phoneContent: { paddingTop: 14 },
  shortContent: { paddingTop: 10 },
  compactContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  header: { height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  phoneHeader: { marginBottom: 14 },
  shortHeader: { marginBottom: 8 },
  compactHeader: { marginBottom: 5 },
  month: { fontFamily: 'ui-rounded', fontSize: 30, lineHeight: 36, color: 'rgba(255, 255, 255, 0.62)', fontWeight: '600', textAlign: 'center' },
  monthNumber: { fontFamily: 'ui-rounded', fontWeight: '600' },
  settingsButton: { position: 'absolute', right: 20, top: 8 },
  compactSettingsButton: { right: 16 },
  dogStage: { height: 306, alignItems: 'center', justifyContent: 'flex-end', zIndex: 2 },
  phoneDogStage: { height: 268 },
  shortDogStage: { height: 254 },
  compactDogStage: { height: 209 },
  dogOverlap: { marginBottom: 0, zIndex: 2 },
  phoneDogOverlap: { marginBottom: -4, transform: [{ translateX: -5 }] },
  shortDogOverlap: { marginBottom: 0 },
  compactDogOverlap: { marginBottom: -12 },
  dogFootShadow: { position: 'absolute', alignSelf: 'center', bottom: -6 },
  speech: { position: 'absolute', top: 10, zIndex: 2, borderRadius: 18, borderWidth: 1, borderColor: colors.white,
    backgroundColor: '#DDEFFF', paddingVertical: 10, paddingHorizontal: 17 },
  compactSpeech: { top: 13, paddingVertical: 8, paddingHorizontal: 13 },
  speechText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  compactSpeechText: { fontSize: 11 },
  cardShape: { position: 'absolute', inset: 0 },
  balance: { backgroundColor: colors.white, alignItems: 'center', marginTop: -24,
    paddingTop: 56, paddingBottom: 28, borderRadius: 26, zIndex: 1,
    shadowColor: '#175B98', shadowOpacity: 0.1,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  measuredBalance: { backgroundColor: 'transparent' },
  phoneBalance: { marginTop: -33, paddingTop: 49, paddingBottom: 18 },
  shortBalance: { paddingTop: 43, paddingBottom: 20 },
  compactBalance: { paddingTop: 36, paddingBottom: 20 },
  balanceLabel: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  amount: { width: '100%', textAlign: 'center', fontFamily: 'ui-rounded', fontSize: 62, fontWeight: '600', color: '#000000', letterSpacing: -3, marginTop: -3 },
  compactAmount: { fontSize: 48, marginTop: 4 },
  currency: { fontFamily: 'ui-rounded', fontSize: 36, fontWeight: '600', letterSpacing: 0 },
  remainingDays: { marginTop: 1, flexDirection: 'row', alignItems: 'baseline' },
  remainingDaysText: { color: colors.ink, fontSize: 12, fontWeight: '500' },
  remainingDaysNumber: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 22, fontWeight: '600' },
  today: { marginTop: 16, minHeight: 68, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 22, shadowColor: '#175B98', shadowOpacity: 0.16,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  todayIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1E90FF',
    alignItems: 'center', justifyContent: 'center', shadowColor: '#1E90FF', shadowOpacity: 0.2,
    shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  phoneToday: { marginTop: 12, minHeight: 62 },
  shortToday: { marginTop: 9 },
  compactToday: { marginTop: 8, minHeight: 60, paddingHorizontal: 12 },
  todayLabel: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 13 },
  todayAmount: { flexShrink: 1, marginRight: 8, fontFamily: 'ui-rounded', color: colors.ink, fontSize: 25, fontWeight: '600' },
  buttonShadow: { marginTop: 16, borderRadius: 28, backgroundColor: colors.blue,
    shadowColor: '#175B98', shadowOpacity: 0.16, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  buttonInsideShadow: { marginTop: 0, shadowOpacity: 0, elevation: 0 },
  compactButton: { minHeight: 54, marginTop: 8 },
  phoneButton: { marginTop: 12 },
  shortButton: { marginTop: 10 },
});
