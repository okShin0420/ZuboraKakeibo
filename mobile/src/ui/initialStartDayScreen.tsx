import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export function InitialStartDayScreen({ day, onChange, onNext }: {
  day: number; onChange: (day: number) => void; onNext: () => void;
}) {
  const wheelRef = useRef<ScrollViewInstance>(null);
  const initialOffset = useRef({ x: 0, y: (day - 1) * 48 });
  const dragEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { height } = useWindowDimensions();
  const compact = height <= 700;
  const clearDragEndTimer = () => {
    if (dragEndTimer.current !== null) clearTimeout(dragEndTimer.current);
    dragEndTimer.current = null;
  };
  useEffect(() => clearDragEndTimer, []);
  const selectNearestDay = (offsetY: number) => {
    const nextDay = Math.max(1, Math.min(31, Math.round(offsetY / 48) + 1));
    if (nextDay !== day) onChange(nextDay);
  };

  return <View testID="initial-start-day" style={styles.root}>
    <View style={[styles.top, compact && styles.topCompact]}>
      <Text style={styles.eyebrow}>さあ、はじめてみよう</Text>
    </View>
    <View style={styles.center}>
      <Text style={styles.label}>毎月度の開始日を設定</Text>
      <View style={styles.wheelFrame}>
        <ScrollView ref={wheelRef} style={styles.wheel} contentContainerStyle={styles.wheelContent}
          contentOffset={initialOffset.current}
          showsVerticalScrollIndicator={false} snapToInterval={48} decelerationRate="fast"
          onScrollBeginDrag={clearDragEndTimer}
          onScrollEndDrag={event => {
            const offsetY = event.nativeEvent.contentOffset.y;
            clearDragEndTimer();
            dragEndTimer.current = setTimeout(() => selectNearestDay(offsetY), 150);
          }}
          onMomentumScrollBegin={clearDragEndTimer}
          onMomentumScrollEnd={event => {
            clearDragEndTimer();
            selectNearestDay(event.nativeEvent.contentOffset.y);
          }}>
          {Array.from({ length: 31 }, (_, index) => {
            const value = index + 1;
            return <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value}日`}
              accessibilityState={{ selected: day === value }}
              onPress={() => { clearDragEndTimer(); onChange(value); wheelRef.current?.scrollTo({ y: index * 48, animated: true }); }}
              style={styles.wheelItem}>
              <Text style={[styles.wheelText, day === value && styles.wheelSelected]}>{value}日</Text>
            </Pressable>;
          })}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={['#017AF4', '#017AF400']} style={styles.wheelFadeTop} />
        <LinearGradient pointerEvents="none" colors={['#017AF400', '#017AF4']} style={styles.wheelFadeBottom} />
      </View>
    </View>
    <View style={[styles.bottom, compact && styles.bottomCompact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="今月の予算を決めよう" onPress={onNext}
        style={[styles.nextButton, compact && styles.nextButtonCompact]}>
        <Text style={styles.nextText}>今月の予算を決めよう</Text>
        <ArrowRight size={20} color="#017AF4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#017AF4' },
  top: { paddingTop: 82, alignItems: 'center' },
  topCompact: { paddingTop: 68 },
  eyebrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26 },
  label: { color: '#FFFFFFE8', fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  wheelFrame: { width: '100%', maxWidth: 260, height: 256, position: 'relative', overflow: 'hidden' },
  wheel: { height: 256 },
  wheelContent: { paddingVertical: 104 },
  wheelItem: { height: 48, alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontFamily: 'ui-rounded', color: '#FFFFFFA3', fontSize: 18, fontWeight: '600' },
  wheelSelected: { color: '#FFFFFF', fontSize: 21, fontWeight: '600' },
  wheelFadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  wheelFadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  bottom: { paddingHorizontal: 26, paddingBottom: 30 },
  bottomCompact: { paddingBottom: 20 },
  nextButton: { minHeight: 60, borderRadius: 30, backgroundColor: '#FFFFFF', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: '#034C9D', shadowOpacity: 0.18,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  nextButtonCompact: { minHeight: 52 },
  nextText: { color: '#017AF4', fontSize: 17, fontWeight: '700' },
});
