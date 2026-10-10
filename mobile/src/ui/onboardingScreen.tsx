import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { onboardingCalendarGraphPhonesImage, onboardingExpensePhoneImage, onboardingOriginalPhoneImage } from './imageAssets';

type OnboardingProps = {
  page: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  busy: boolean;
  error: string;
};

const ARTBOARD_WIDTH = 393;
const ARTBOARD_HEIGHT = 852;
const SLIDE_DURATION = 420;

function PageIndicator({ page, progress, scale }: { page: number; progress: Animated.Value; scale: number }) {
  return <View accessible accessibilityLabel={`${page + 1} / 3ページ`}
    style={{ width: 46 * scale, height: 6 * scale, flexDirection: 'row', gap: 5 * scale }}>
    {[0, 1, 2].map(index => {
      const indicatorWidth = progress.interpolate({ inputRange: [0, 1, 2],
        outputRange: [0, 1, 2].map(step => (step === index ? 24 : 6) * scale) });
      const opacity = progress.interpolate({ inputRange: [0, 1, 2],
        outputRange: [0, 1, 2].map(step => step === index ? 1 : 0.7) });
      return <Animated.View key={index} style={{ width: indicatorWidth, height: 6 * scale,
        borderRadius: 3 * scale, backgroundColor: '#FFFFFF', opacity }} />;
    })}
  </View>;
}

type OnboardingPageProps = Pick<OnboardingProps, 'page' | 'onBack' | 'onSkip'> & {
  disabled: boolean; revealProgress: Animated.Value | number; reduceMotion: boolean;
};

function OnboardingPage({ page, onBack, onSkip, disabled, revealProgress, reduceMotion }: OnboardingPageProps) {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / ARTBOARD_WIDTH, height / ARTBOARD_HEIGHT);
  const frame = (left: number, top: number, frameWidth: number, frameHeight: number) => ({
    position: 'absolute' as const,
    left: left * scale,
    top: top * scale,
    width: frameWidth * scale,
    height: frameHeight * scale,
  });
  const textOpacity = typeof revealProgress === 'number' ? 1 : revealProgress.interpolate({
    inputRange: [0, 0.1, 0.78, 1], outputRange: [0, 0, 1, 1],
  });
  const imageOpacity = typeof revealProgress === 'number' ? 1 : revealProgress.interpolate({
    inputRange: [0, 0.26, 1], outputRange: [0, 0, 1],
  });
  const textRise = reduceMotion || typeof revealProgress === 'number' ? 0 : revealProgress.interpolate({
    inputRange: [0, 1], outputRange: [12 * scale, 0],
  });
  const imageRise = reduceMotion || typeof revealProgress === 'number' ? 0 : revealProgress.interpolate({
    inputRange: [0, 1], outputRange: [18 * scale, 0],
  });

  return <View testID={`onboarding-${page + 1}`} style={styles.root}>
    <View style={{ position: 'absolute', left: (width - ARTBOARD_WIDTH * scale) / 2,
      top: (height - ARTBOARD_HEIGHT * scale) / 2, width: ARTBOARD_WIDTH * scale,
      height: ARTBOARD_HEIGHT * scale, overflow: 'hidden' }}>
      {page === 0 ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="説明をスキップ" disabled={disabled}
          onPress={onSkip} style={[frame(291, 48, 66, 44), styles.skip, styles.skipRight]}>
          <Text style={[styles.skipText, { fontSize: 15 * scale, lineHeight: 22 * scale }]}>スキップ</Text>
        </Pressable>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,
          { opacity: textOpacity, transform: [{ translateY: textRise }] }]}>
        <Text style={[styles.heading, frame(40, 139, 320, 88), {
          fontSize: 30 * scale, lineHeight: 42 * scale,
        }]}>今月使えるお金を{'\n'}決めよう</Text>
        <Text style={[styles.description, frame(40, 242, 320, 48), {
          fontSize: 14 * scale, lineHeight: 24 * scale,
        }]}>今月あといくら？がひと目でわかります。</Text>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,
          { opacity: imageOpacity, transform: [{ translateY: imageRise }] }]}>
        <Image source={onboardingOriginalPhoneImage} contentFit="contain" cachePolicy="memory-disk"
          accessibilityLabel="犬と今月あと使えるお金を表示したスマホ画面の見本"
          style={frame(50, 307, 280, 584)} />
        <Svg pointerEvents="none" width={48 * 280 / 595 * scale} height={30 * 280 / 595 * scale}
          viewBox="0 0 48 30"
          style={frame(50 + 477 * 280 / 595, 307 + 70 * 280 / 595,
            48 * 280 / 595, 30 * 280 / 595)}>
          <Defs>
            <SvgLinearGradient id="batterySky" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#0075ED" />
              <Stop offset="1" stopColor="#0179F3" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={48} height={30} fill="url(#batterySky)" />
          <Rect x={3} y={4} width={39} height={22} rx={5} fill="none" stroke="#FFFFFF" strokeWidth={2} />
          <Rect x={6} y={7} width={33} height={16} rx={3} fill="#FFFFFF" />
          <Rect x={44} y={10} width={3} height={10} rx={1.5} fill="#FFFFFF" />
        </Svg>
        </Animated.View>

      </> : page === 1 ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="前の説明へ戻る" disabled={disabled}
          onPress={onBack} style={[frame(40, 48, 70, 44), styles.skip]}>
          <Text style={[styles.skipText, { fontSize: 15 * scale, lineHeight: 22 * scale }]}>戻る</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="説明をスキップ"
          disabled={disabled} onPress={onSkip} style={[frame(291, 48, 66, 44), styles.skip, styles.skipRight]}>
          <Text style={[styles.skipText, { fontSize: 15 * scale, lineHeight: 22 * scale }]}>スキップ</Text>
        </Pressable>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,
          { opacity: textOpacity, transform: [{ translateY: textRise }] }]}>
        <Text style={[styles.heading, frame(40, 142, 320, 88), {
          fontSize: 30 * scale, lineHeight: 42 * scale,
        }]}>使ったら、{'\n'}金額を入れるだけ</Text>
        <Text style={[styles.description, frame(40, 246, 320, 48), {
          fontSize: 14 * scale, lineHeight: 24 * scale,
        }]}>面倒なカテゴリ分けは不要です。{'\n'}残りのお金にすぐ反映されます。</Text>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,
          { opacity: imageOpacity, transform: [{ translateY: imageRise }] }]}>
        <Image source={onboardingExpensePhoneImage} contentFit="contain" cachePolicy="memory-disk"
          accessibilityLabel="金額だけで記録できる支出入力画面の見本"
          style={frame(53, 307, 286, 584)} />
        </Animated.View>

      </> : <>
        <Pressable accessibilityRole="button" accessibilityLabel="前の説明へ戻る" disabled={disabled}
          onPress={onBack} style={[frame(40, 48, 70, 44), styles.skip]}>
          <Text style={[styles.skipText, { fontSize: 15 * scale, lineHeight: 22 * scale }]}>戻る</Text>
        </Pressable>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,
          { opacity: textOpacity, transform: [{ translateY: textRise }] }]}>
        <Text style={[styles.heading, frame(40, 142, 320, 88), {
          fontSize: 30 * scale, lineHeight: 42 * scale,
        }]}>カレンダーとグラフで{'\n'}振り返る</Text>
        <Text style={[styles.description, frame(40, 245, 320, 55), {
          fontSize: 14 * scale, lineHeight: 24 * scale,
        }]}>カレンダーで支出を確認・編集。{'\n'}グラフで月ごとのやりくりを振り返れます。</Text>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,
          { opacity: imageOpacity, transform: [{ translateY: imageRise }] }]}>
        <Image source={onboardingCalendarGraphPhonesImage} contentFit="contain" cachePolicy="memory-disk"
          accessibilityLabel="カレンダーと月別グラフを表示した2台のスマートフォンの見本"
          style={frame(-75, 278, 550, 413)} />
        </Animated.View>

      </>}
    </View>
  </View>;
}

function OnboardingFooter({ page, width, height, scale, error, busy, disabled, onNext }: {
  page: number; width: number; height: number; scale: number; error: string; busy: boolean;
  disabled: boolean; onNext: () => void;
}) {
  const artboardLeft = (width - ARTBOARD_WIDTH * scale) / 2;
  const artboardTop = (height - ARTBOARD_HEIGHT * scale) / 2;
  const frame = (left: number, top: number, frameWidth: number, frameHeight: number) => ({
    position: 'absolute' as const,
    left: left * scale,
    top: top * scale,
    width: frameWidth * scale,
    height: frameHeight * scale,
  });
  return <View pointerEvents="box-none" style={{ position: 'absolute', left: artboardLeft, top: artboardTop,
    width: ARTBOARD_WIDTH * scale, height: ARTBOARD_HEIGHT * scale }}>
    {error ? <Text accessibilityRole="alert" style={[styles.error,
      frame(28, page === 2 ? 718 : 715, 337, 20)]}>{error}</Text> : null}
    {page === 2 ? <Pressable accessibilityRole="button" accessibilityLabel="今月使えるお金を決めよう"
      disabled={disabled} accessibilityState={{ disabled }} onPress={onNext}
      style={[frame(31, 750, 331, 52), styles.nextButton, { borderRadius: 18 * scale }]}>
      <Text style={[styles.finishText, { fontSize: 17 * scale, lineHeight: 25 * scale }]}>
        {busy ? '保存中…' : '今月使えるお金を決めよう'}
      </Text>
    </Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="次の説明へ"
      disabled={disabled} accessibilityState={{ disabled }} onPress={onNext}
      style={[frame(154, 740, 74, 50), styles.nextButton, { borderRadius: 16 * scale }]}>
      <Text style={[styles.arrow, { fontSize: 23 * scale, lineHeight: 27 * scale }]}>{busy ? '…' : '→'}</Text>
    </Pressable>}
  </View>;
}

export function OnboardingScreen(props: OnboardingProps) {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / ARTBOARD_WIDTH, height / ARTBOARD_HEIGHT);
  const [visiblePage, setVisiblePage] = useState(props.page);
  const [leavingPage, setLeavingPage] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const previousPage = useRef(props.page);
  const transitionId = useRef(0);
  const slide = useRef(new Animated.Value(1)).current;
  const indicator = useRef(new Animated.Value(props.page)).current;
  const reveal = useRef(new Animated.Value(1)).current;
  const reducedFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (props.page === previousPage.current) return;
    const fromPage = previousPage.current;
    previousPage.current = props.page;
    const currentId = ++transitionId.current;
    slide.stopAnimation();
    indicator.stopAnimation();
    reveal.stopAnimation();
    reducedFade.stopAnimation();
    setVisiblePage(props.page);

    if (reduceMotion) {
      setLeavingPage(null);
      setTransitioning(false);
      slide.setValue(1);
      indicator.setValue(props.page);
      reveal.setValue(1);
      reducedFade.setValue(0);
      Animated.timing(reducedFade, { toValue: 1, duration: 150,
        easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
      return;
    }

    reducedFade.setValue(1);
    setDirection(props.page > fromPage ? 1 : -1);
    setLeavingPage(fromPage);
    setTransitioning(true);
    slide.setValue(0);
    reveal.setValue(0);
    Animated.timing(indicator, { toValue: props.page, duration: SLIDE_DURATION,
      easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    Animated.timing(reveal, { toValue: 1, delay: 130, duration: 600,
      easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
    Animated.timing(slide, { toValue: 1, duration: SLIDE_DURATION,
      easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
      if (finished && currentId === transitionId.current) {
        setLeavingPage(null);
        setTransitioning(false);
      }
    });
  }, [props.page, reduceMotion, slide, indicator, reveal, reducedFade]);

  useEffect(() => () => {
    transitionId.current++;
    slide.stopAnimation();
    indicator.stopAnimation();
    reveal.stopAnimation();
    reducedFade.stopAnimation();
  }, [slide, indicator, reveal, reducedFade]);

  const incomingX = slide.interpolate({ inputRange: [0, 1], outputRange: [direction * width, 0] });
  const leavingX = slide.interpolate({ inputRange: [0, 1], outputRange: [0, -direction * width] });
  const artboardLeft = (width - ARTBOARD_WIDTH * scale) / 2;
  const artboardTop = (height - ARTBOARD_HEIGHT * scale) / 2;
  const pageProps = { onBack: props.onBack, onSkip: props.onSkip,
    disabled: props.busy || transitioning, reduceMotion };
  const footerProps = { width, height, scale, error: props.error, busy: props.busy,
    disabled: props.busy || transitioning, onNext: props.onNext };

  return <View style={styles.root}>
    <LinearGradient colors={['#017AF4', '#017AF4', '#3D9BF9']} locations={[0, 0.495, 1]}
      style={StyleSheet.absoluteFill} />
    {leavingPage !== null && <Animated.View pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { transform: [{ translateX: leavingX }] }]}>
      <OnboardingPage {...pageProps} page={leavingPage} revealProgress={1} />
    </Animated.View>}
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: incomingX }] }]}>
      <OnboardingPage {...pageProps} page={visiblePage}
        revealProgress={reduceMotion ? reducedFade : reveal} />
    </Animated.View>
    <Svg pointerEvents="none" width={393 * scale} height={194 * scale} viewBox="0 0 393 194"
      style={{ position: 'absolute', left: artboardLeft, top: artboardTop + 658 * scale }}>
      <Path d="M0 66 C69 19 129 7 194 9 C267 9 340 26 393 66 L393 194 L0 194 Z" fill="#017AF4" />
    </Svg>
    {leavingPage !== null && <Animated.View pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { transform: [{ translateX: leavingX }] }]}>
      <OnboardingFooter {...footerProps} page={leavingPage} />
    </Animated.View>}
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { transform: [{ translateX: incomingX }] }]}>
      <OnboardingFooter {...footerProps} page={visiblePage} />
    </Animated.View>
    <View pointerEvents="none" style={{ position: 'absolute', left: artboardLeft + 173.5 * scale,
      top: artboardTop + 704 * scale }}>
      <PageIndicator page={visiblePage} progress={indicator} scale={scale} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  skip: { justifyContent: 'center' },
  skipRight: { alignItems: 'flex-end' },
  skipText: { color: '#FFFFFF', fontWeight: '600' },
  heading: { color: '#FFFFFF', fontWeight: '700', textAlign: 'left' },
  description: { color: '#FFFFFF', fontWeight: '700', textAlign: 'left' },
  nextButton: { backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  arrow: { color: '#017AF4', fontFamily: 'ui-rounded', fontWeight: '600' },
  finishText: { color: '#017AF4', fontWeight: '700' },
  error: { color: '#FFFFFF', fontSize: 12, textAlign: 'center' },
});
