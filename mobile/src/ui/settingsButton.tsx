import { Settings } from 'lucide-react-native';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export function SettingsButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="設定" onPress={onPress}
    style={[styles.button, style]}>
    <Settings size={23} color="#FFFFFF" strokeWidth={1.7} />
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: '#FFFFFF88',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF22' },
});
