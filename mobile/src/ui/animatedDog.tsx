import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { dogBlinkEyesImage, dogImage } from './imageAssets';

const imageCache = 'memory-disk';

export function AnimatedDog({ size }: { size: number }) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const breathing = useRef(new Animated.Value(0)).current;
  const headTilt = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      breathing.setValue(0);
      headTilt.setValue(0);
      blink.setValue(0);
      return;
    }
    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathing, { toValue: 1, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathing, { toValue: 0, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const tiltLoop = Animated.loop(Animated.sequence([
      Animated.delay(6120),
      Animated.timing(headTilt, { toValue: 1, duration: 630, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(1080),
      Animated.timing(headTilt, { toValue: 0, duration: 1170, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const blinkOnce = () => Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.delay(90),
      Animated.timing(blink, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]);
    const blinkLoop = Animated.loop(Animated.sequence([
      Animated.delay(3000), blinkOnce(), Animated.delay(3000), blinkOnce(), Animated.delay(240),
    ]));
    breatheLoop.start();
    tiltLoop.start();
    blinkLoop.start();
    return () => { breatheLoop.stop(); tiltLoop.stop(); blinkLoop.stop(); };
  }, [reduceMotion, breathing, headTilt, blink]);

  const imageSize = { width: size, height: size };
  return <Animated.View accessibilityRole="image" accessibilityLabel="青緑の服を着た黒い犬"
    style={[styles.dog, imageSize, {
      transform: [
        { scaleX: breathing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
        { scaleY: breathing.interpolate({ inputRange: [0, 1], outputRange: [1, 0.994] }) },
        { translateY: breathing },
      ],
    }]}>
    <Image source={dogImage} contentFit="contain" cachePolicy={imageCache} style={imageSize}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.head, imageSize, {
        transform: [{ rotate: headTilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '2.2deg'] }) }],
      }]}>
      <View style={{ width: size, height: size * 0.54, overflow: 'hidden' }}>
        <Image source={dogImage} contentFit="contain" cachePolicy={imageCache} style={imageSize} />
      </View>
      <Animated.View style={[styles.eyes, {
        left: size * 0.32, top: size * 0.12, width: size * 0.32, height: size * 0.17, opacity: blink,
      }]}>
        <Image source={dogBlinkEyesImage} contentFit="fill" cachePolicy={imageCache} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  dog: { zIndex: 2 },
  head: { position: 'absolute', left: 0, top: 0 },
  eyes: { position: 'absolute' },
});
