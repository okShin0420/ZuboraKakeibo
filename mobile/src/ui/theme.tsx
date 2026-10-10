import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Delete, ChartNoAxesColumnIncreasing, House } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { yen } from './format';

export const colors = {
  blue: '#1E90FF', sky: '#4E8BFA', ink: '#000000', muted: '#637073',
  line: '#DDE6E6', soft: '#F5F8F8', white: '#FFFFFF',
};
export type Tab = 'ホーム' | 'カレンダー' | 'グラフ';

export function AmountCaret({ color = colors.blue }: { color?: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const blink = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: 480, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 480, useNativeDriver: true }),
    ]));
    blink.start();
    return () => blink.stop();
  }, [opacity]);
  return <Animated.View accessibilityElementsHidden style={[styles.amountCaret, { backgroundColor: color, opacity }]} />;
}

export function PrimaryButton({ label, onPress, disabled = false, style }: {
  label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.primaryButton, disabled && styles.disabled, style]}>
    {!disabled && <LinearGradient colors={['#3189F8', '#1E90FF']} style={StyleSheet.absoluteFill} />}
    <Text style={styles.primaryText}>{label}</Text>
  </Pressable>;
}

function CalendarGridIcon({ color }: { color: string }) {
  return <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
    <Path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
      stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const tabs = [
    { label: 'ホーム' as Tab, Icon: House },
    { label: 'カレンダー' as Tab, Icon: CalendarGridIcon },
    { label: 'グラフ' as Tab, Icon: ChartNoAxesColumnIncreasing },
  ];
  return <View testID="tab-bar" style={styles.tabBar}>
    <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFill} />
    <View style={styles.tabTint} />
    {tabs.map(({ label, Icon }) => <Pressable key={label} accessibilityRole="tab" accessibilityLabel={label}
      accessibilityState={{ selected: active === label }} onPress={() => onChange(label)} style={styles.tabItem}>
      <View style={[styles.navIcon, active === label && styles.navIconActive]}>
        <Icon size={23} color={active === label ? colors.blue : '#748183'} strokeWidth={1.8} />
      </View>
      <Text style={[styles.tabText, active === label && styles.active]}>{label}</Text>
    </Pressable>)}
  </View>;
}

const keyRows = [
  [['1', ''], ['2', 'ABC'], ['3', 'DEF']],
  [['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO']],
  [['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']],
];

export function NumberPad({ value, onChange, sky = false, compact = false, quickAmounts = [5000, 1000, 2000] }: {
  value: string; onChange: (value: string) => void; sky?: boolean; compact?: boolean; quickAmounts?: number[];
}) {
  const append = (digit: string) => onChange(((value === '0' ? '' : value) + digit).slice(0, 9) || '0');
  return <View style={[styles.pad, compact && styles.compactPad, sky && styles.skyPad]}>
    <View style={[styles.quickRow, compact && styles.compactQuickRow, sky && styles.skyQuickRow]}>{quickAmounts.map(amount =>
      <Pressable key={amount} accessibilityRole="button" accessibilityLabel={`${yen(amount)}円を設定`}
        onPress={() => onChange(String(amount))} style={[styles.quickKey, sky && styles.skyQuickKey]}>
        <Text style={[styles.quickText, sky && styles.skyQuickText]}>¥{yen(amount)}</Text>
      </Pressable>)}</View>
    {keyRows.map((row, index) => <View key={index} style={[styles.keyRow, compact && styles.compactKeyRow]}>{row.map(([digit, letters]) =>
      <Pressable key={digit} accessibilityRole="button" accessibilityLabel={`${digit}を入力`}
        onPress={() => append(digit)} style={[styles.key, compact && styles.compactKey]}>
        <Text style={styles.keyText}>{digit}</Text>{!!letters && <Text style={styles.letters}>{letters}</Text>}
      </Pressable>)}</View>)}
    <View style={[styles.keyRow, compact && styles.compactKeyRow]}>
      <View style={[styles.blankKey, compact && styles.compactBlankKey]} />
      <Pressable accessibilityRole="button" accessibilityLabel="0を入力" onPress={() => append('0')} style={[styles.key, compact && styles.compactKey]}><Text style={styles.keyText}>0</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="削除" onPress={() => onChange(value.slice(0, -1) || '0')} style={[styles.blankKey, compact && styles.compactBlankKey]}>
        <Delete size={25} color={sky ? colors.white : colors.ink} strokeWidth={1.8} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  amountCaret: { width: 2, height: 42, borderRadius: 1 },
  primaryButton: { minHeight: 54, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.blue,
    alignItems: 'center', justifyContent: 'center', marginTop: 16, shadowColor: colors.blue,
    shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  disabled: { backgroundColor: '#A9B9C7', shadowOpacity: 0, elevation: 0 },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, height: 88,
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', overflow: 'hidden',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: '#FFFFFFB8' },
  tabTint: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFFC7' },
  tabItem: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navIcon: { minWidth: 57, minHeight: 31, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: '#E7F3FF' },
  tabText: { color: '#748183', fontSize: 10, fontWeight: '500' },
  active: { color: colors.blue },
  pad: { backgroundColor: '#DFE1E5', paddingHorizontal: 13, paddingTop: 10, paddingBottom: 27, gap: 7,
    borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  compactPad: { paddingTop: 6, paddingBottom: 19, gap: 4 },
  skyPad: { backgroundColor: '#017AF4', borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  quickRow: { flexDirection: 'row', height: 52, borderBottomWidth: 1, borderColor: '#C9CDD1' },
  compactQuickRow: { height: 44 },
  skyQuickRow: { borderColor: '#FFFFFF8A' },
  quickKey: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: '#C9CDD1' },
  skyQuickKey: { borderColor: '#FFFFFF8A' },
  quickText: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 16, fontWeight: '600' },
  skyQuickText: { color: colors.white },
  keyRow: { flexDirection: 'row', gap: 7 },
  compactKeyRow: { gap: 5 },
  key: { flex: 1, height: 52, borderRadius: 13, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },
  compactKey: { height: 44, borderRadius: 11 },
  blankKey: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  compactBlankKey: { height: 44 },
  keyText: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 25, fontWeight: '600', lineHeight: 27 },
  letters: { color: colors.ink, fontSize: 7, fontWeight: '700', letterSpacing: 1.2 },
});
