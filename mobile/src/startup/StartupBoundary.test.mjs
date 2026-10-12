import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const originalLoad = Module._load;
let hideCalls = 0;
Module._load = function (request, parent, isMain) {
  if (request === 'react-native') return {
    Pressable: 'Pressable', SafeAreaView: 'SafeAreaView', ScrollView: 'ScrollView', Text: 'Text',
    StyleSheet: { create: value => value },
  };
  if (request === 'expo-status-bar') return { StatusBar: 'StatusBar' };
  if (request === 'expo-splash-screen') return { hideAsync: async () => { hideCalls += 1; } };
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.tsx'] = (module, filename) => {
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  module._compile(code, filename);
};
const { StartupBoundary } = require('./StartupBoundary.tsx');

test('起動エラーではスプラッシュを閉じ、エラー画面から新しい子ツリーで再試行する', async () => {
  // Reactのエラー通知・state更新を再現する単体テスト。ネイティブ描画は実機で確認する。
  const boundary = new StartupBoundary({ children: 'database-provider' }, null, {
    enqueueSetState(instance, update) {
      instance.state = { ...instance.state, ...(typeof update === 'function' ? update(instance.state) : update) };
    },
  });
  const initial = boundary.render();
  assert.equal(initial.props.children, 'database-provider');
  boundary.state = { ...boundary.state, ...StartupBoundary.getDerivedStateFromError(new Error('DB破損')) };
  boundary.componentDidCatch();
  await Promise.resolve();
  assert.equal(hideCalls, 1);
  const errorScreen = boundary.render();
  assert.equal(errorScreen.type, 'SafeAreaView');
  const rows = errorScreen.props.children[1].props.children;
  assert.match(rows[1].props.children, /データは削除していません/);
  assert.equal(rows[2].props.accessibilityRole, 'button');
  rows[2].props.onPress();
  const retried = boundary.render();
  assert.equal(retried.props.children, 'database-provider');
  assert.notEqual(retried.key, initial.key);
});
