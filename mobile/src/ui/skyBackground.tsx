import { StyleSheet, View } from 'react-native';

// Place the blue surface outside SafeAreaView so the status-bar area has no seam.
export function CalendarSkyBackground() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#017AF4' }]} />;
}

export function GraphSkyBackground() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#017AF4' }]} />;
}
