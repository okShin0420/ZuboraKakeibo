import { registerRootComponent } from 'expo';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// In the diagnostic profile, mount a minimal screen before evaluating App and
// its native module imports. Production keeps the same App entry point.
if (process.env.EXPO_PUBLIC_STARTUP_DIAGNOSTICS === '1') {
  registerRootComponent(require('./src/startup/StartupDiagnosticApp').default);
} else {
  registerRootComponent(require('./App').default);
}
