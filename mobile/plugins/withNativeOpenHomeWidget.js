const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withNativeOpenHomeWidget(config) {
  return withDangerousMod(config, ['ios', async config => {
    const target = path.join(config.modRequest.platformProjectRoot, 'ExpoWidgetsTarget', 'OpenHomeWidgetV2.swift');
    if (!fs.existsSync(target)) {
      throw new Error(`expo-widgets did not generate ${target}`);
    }
    const source = process.env.EXPO_WIDGET_STATIC_DIAGNOSTIC === '1'
      ? 'StaticDiagnosticOpenHomeWidget.swift'
      : process.env.EXPO_WIDGET_TEXT_DIAGNOSTIC === '1'
        ? 'TextDiagnosticOpenHomeWidget.swift'
        : 'NativeOpenHomeWidget.swift';
    fs.copyFileSync(path.join(__dirname, source), target);
    return config;
  }]);
};
