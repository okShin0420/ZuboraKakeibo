import { LinearGradient } from 'expo-linear-gradient';
import { PawPrint } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
  const scrollRef = useRef<ScrollView>(null);
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
      <View style={[styles.glass, phoneHeight && styles.phoneGlass, shortPhone && styles.shortGlass, compact && styles.compactGlass]}>
        <View style={[styles.speech, compact && styles.compactSpeech]}><Text style={[styles.speechText, compact && styles.compactSpeechText]}>{home.message}</Text></View>
        <AnimatedDog size={compact ? 155 : shortPhone ? 186 : phoneHeight ? 200 : 237} />
        <Svg style={styles.ground} width="100%" height={45} viewBox="0 0 350 45" preserveAspectRatio="none">
          <Path d="M0 32 Q175 9 350 32 L350 45 H0 Z" fill="#FFFFFF" />
        </Svg>
      </View>
      <View style={[styles.balance, phoneHeight && styles.phoneBalance, shortPhone && styles.shortBalance, compact && styles.compactBalance]}>
        {!compact && <View pointerEvents="none" style={styles.paws}>
          <PawPrint size={15} color="#087E88" fill="#087E88" style={styles.pawLeft} />
          <PawPrint size={12} color="#087E88" fill="#087E88" style={styles.pawRight} />
          <PawPrint size={9} color="#087E88" fill="#087E88" style={styles.pawFarRight} />
        </View>}
        <Text style={styles.balanceLabel}>今月あとつかえるお金</Text>
        <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false}
          style={styles.amountScroll} contentContainerStyle={styles.amountScrollContent}>
          <Text style={[styles.amount, compact && styles.compactAmount]}><Text style={styles.currency}>¥</Text>{yen(home.remainingAmount)}</Text>
        </ScrollView>
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
        <Text style={styles.todayAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>¥{yen(home.todayExpense)}</Text>
      </View>
      <PrimaryButton label="入力する" onPress={onExpense} style={compact ? styles.compactButton : shortPhone ? styles.shortButton : phoneHeight ? styles.phoneButton : undefined} />
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
  month: { fontSize: 26, color: colors.white, fontWeight: '600', textShadowColor: '#15517A66', textShadowRadius: 3 },
  monthNumber: { fontFamily: 'ui-rounded', fontWeight: '600' },
  settingsButton: { position: 'absolute', right: 20, top: 8 },
  compactSettingsButton: { right: 16 },
  glass: { height: 306, borderWidth: 1, borderBottomWidth: 0, borderColor: '#FFFFFFBB', borderTopLeftRadius: 26,
    borderTopRightRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  phoneGlass: { height: 268 },
  shortGlass: { height: 254 },
  compactGlass: { height: 209 },
  speech: { position: 'absolute', top: 18, zIndex: 2, borderRadius: 18, borderWidth: 1, borderColor: colors.white,
    backgroundColor: '#F4FAFFF0', paddingVertical: 10, paddingHorizontal: 17 },
  compactSpeech: { top: 13, paddingVertical: 8, paddingHorizontal: 13 },
  speechText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  compactSpeechText: { fontSize: 11 },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1 },
  balance: { backgroundColor: colors.white, alignItems: 'center', paddingTop: 24, paddingBottom: 16,
    marginTop: -1, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  phoneBalance: { paddingTop: 14, paddingBottom: 12 },
  shortBalance: { paddingTop: 11, paddingBottom: 8 },
  compactBalance: { paddingTop: 4, paddingBottom: 8 },
  paws: { position: 'absolute', left: 22, right: 22, top: 4, height: 22, opacity: 0.55 },
  pawLeft: { position: 'absolute', left: 0, top: 2, transform: [{ rotate: '-22deg' }] },
  pawRight: { position: 'absolute', right: 24, top: 0, transform: [{ rotate: '18deg' }] },
  pawFarRight: { position: 'absolute', right: 0, top: 9, transform: [{ rotate: '35deg' }] },
  balanceLabel: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  amountScroll: { width: '100%', flexGrow: 0 },
  amountScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  amount: { fontFamily: 'ui-rounded', fontSize: 57, fontWeight: '600', color: '#000000', letterSpacing: -3, marginTop: 7 },
  compactAmount: { fontSize: 48, marginTop: 4 },
  currency: { fontFamily: 'ui-rounded', fontSize: 36, fontWeight: '600', letterSpacing: 0 },
  remainingDays: { marginTop: 8, flexDirection: 'row', alignItems: 'baseline' },
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
  todayAmount: { flexShrink: 1, fontFamily: 'ui-rounded', color: colors.ink, fontSize: 25, fontWeight: '600' },
  compactButton: { minHeight: 54, marginTop: 8 },
  phoneButton: { marginTop: 12 },
  shortButton: { marginTop: 10 },
});
