import assert from 'node:assert/strict';
import test from 'node:test';

let sequence = 0;
async function loadDiagnostics(enabled) {
  process.env.EXPO_PUBLIC_STARTUP_DIAGNOSTICS = enabled ? '1' : '0';
  return import(`./startupDiagnostics.ts?test=${++sequence}`);
}

test('通常ビルドでは記録とウィジェット除外を無効にし、元の非同期処理をそのまま返す', async () => {
  const diagnostics = await loadDiagnostics(false);
  const action = Promise.resolve('original');
  assert.equal(diagnostics.traceStartup('読み込み', () => action), action);
  diagnostics.markStartupPhase('開始');
  diagnostics.beginStartupStep('db', 'DB');
  diagnostics.recordStartupError('test', new Error('example'));
  diagnostics.setWidgetDiagnosticBypass(true);
  diagnostics.markStartupReady('ready');
  assert.equal(diagnostics.isWidgetDiagnosticBypassed(), false);
  assert.deepEqual(diagnostics.getStartupDiagnosticSnapshot(), { events: [], pending: [], error: '', ready: false });
});

test('完了しない処理を一覧に残し、別の処理が完了しても失わない', async () => {
  const diagnostics = await loadDiagnostics(true);
  let resolveImages;
  const images = diagnostics.traceStartup('画像先読み', () => new Promise(resolve => { resolveImages = resolve; }));
  await diagnostics.traceStartup('DB取得', async () => 'done');
  assert.deepEqual(diagnostics.getStartupDiagnosticSnapshot().pending, ['画像先読み']);
  resolveImages('done');
  await images;
  assert.deepEqual(diagnostics.getStartupDiagnosticSnapshot().pending, []);
});

test('起動エラーの内容とスタックを残し、呼び出し元にも同じエラーを返す', async () => {
  const diagnostics = await loadDiagnostics(true);
  const error = new Error('native initialization failed');
  await assert.rejects(diagnostics.traceStartup('DB初期化', async () => { throw error; }), value => value === error);
  assert.deepEqual(diagnostics.getStartupDiagnosticSnapshot().pending, []);
  assert.match(diagnostics.getStartupDiagnosticSnapshot().events.at(-1), /native initialization failed/);
  assert.equal(diagnostics.getStartupDiagnosticSnapshot().error, '');
  diagnostics.recordStartupError('起動', error);
  assert.match(diagnostics.getStartupDiagnosticSnapshot().error, /native initialization failed/);
});

test('ウィジェット除外は診断で明示選択したときだけ有効にする', async () => {
  const diagnostics = await loadDiagnostics(true);
  assert.equal(diagnostics.isWidgetDiagnosticBypassed(), false);
  diagnostics.setWidgetDiagnosticBypass(true);
  assert.equal(diagnostics.isWidgetDiagnosticBypassed(), true);
  diagnostics.setWidgetDiagnosticBypass(false);
  assert.equal(diagnostics.isWidgetDiagnosticBypassed(), false);
});
