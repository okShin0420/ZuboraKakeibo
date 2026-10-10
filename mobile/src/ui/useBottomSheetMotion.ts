import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/** Keep the dimmer and the sheet on separate animation tracks. */
export function useBottomSheetMotion(visible: boolean, onDismiss: () => void, travelDistance: number) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(travelDistance)).current;
  const dismissRef = useRef(onDismiss);
  const closing = useRef(false);
  const enterFrame = useRef<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  dismissRef.current = onDismiss;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(reduceMotion ? 0 : travelDistance);
    enterFrame.current = requestAnimationFrame(() => {
      enterFrame.current = null;
      Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: reduceMotion ? 120 : 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 0, duration: reduceMotion ? 0 : 260,
        easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
    return () => {
      if (enterFrame.current !== null) cancelAnimationFrame(enterFrame.current);
      backdropOpacity.stopAnimation();
      sheetTranslateY.stopAnimation();
    };
    // The distance is fixed for each presentation; a device rotation must not replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = useCallback((afterClose?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    if (enterFrame.current !== null) {
      cancelAnimationFrame(enterFrame.current);
      enterFrame.current = null;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: reduceMotion ? 100 : 160, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: reduceMotion ? 0 : travelDistance,
        duration: reduceMotion ? 0 : 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) (afterClose ?? dismissRef.current)();
      closing.current = false;
    });
  }, [backdropOpacity, reduceMotion, sheetTranslateY, travelDistance]);

  return { backdropStyle: { opacity: backdropOpacity }, sheetStyle: { transform: [{ translateY: sheetTranslateY }] }, close };
}
