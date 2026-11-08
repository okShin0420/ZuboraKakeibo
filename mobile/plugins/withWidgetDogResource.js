const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');

const targetName = 'ExpoWidgetsTarget';
const imageName = 'jikkun-widget.png';

module.exports = function withWidgetDogResource(config) {
  config = withDangerousMod(config, ['ios', async config => {
    const destination = path.join(config.modRequest.platformProjectRoot, targetName, imageName);
    const source = path.join(__dirname, '..', 'assets', 'jikkun-optimized.png');
    if (!fs.existsSync(path.dirname(destination))) {
      throw new Error('expo-widgets must create its iOS target before copying the dog image');
    }
    fs.copyFileSync(source, destination);
    return config;
  }]);

  return withXcodeProject(config, config => {
    const project = config.modResults;
    const targetUuid = project.findTargetKey(targetName);
    if (!targetUuid) throw new Error('ExpoWidgetsTarget is missing from the iOS project');
    const resourcePath = `${targetName}/${imageName}`;
    const target = project.pbxNativeTargetSection()[targetUuid];
    const hasResourcePhase = target.buildPhases.some(phase => phase.comment === 'Resources');
    if (!hasResourcePhase) {
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
    }
    if (!project.hasFile(resourcePath)) {
      project.addResourceFile(resourcePath, { target: targetUuid });
    }
    return config;
  });
};
