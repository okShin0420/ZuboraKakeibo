// Enabled only by the dedicated TestFlight diagnostic build profile.
// Do not record amounts, memos, database contents, or other user data here.
export const STARTUP_DIAGNOSTICS_ENABLED = process.env.EXPO_PUBLIC_STARTUP_DIAGNOSTICS === '1';

export type StartupDiagnosticSnapshot = {
  events: readonly string[];
  pending: readonly string[];
  error: string;
  ready: boolean;
};

const startedAt = Date.now();
const listeners = new Set<() => void>();
const pending = new Map<string, string>();
let stepId = 0;
let skipWidget = false;
let snapshot: StartupDiagnosticSnapshot = { events: [], pending: [], error: '', ready: false };

function publish(message: string, changes: Partial<StartupDiagnosticSnapshot> = {}) {
  if (!STARTUP_DIAGNOSTICS_ENABLED) return;
  const entry = `${((Date.now() - startedAt) / 1000).toFixed(1)}s ${message}`;
  snapshot = { ...snapshot, ...changes, events: [...snapshot.events.slice(-79), entry], pending: [...pending.values()] };
  console.info(`[StartupDiagnostics] ${message}`);
  listeners.forEach(listener => listener());
}

export const getStartupDiagnosticSnapshot = () => snapshot;
export function subscribeStartupDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function markStartupPhase(label: string) { publish(label); }

export function beginStartupStep(id: string, label: string) {
  if (!STARTUP_DIAGNOSTICS_ENABLED || pending.has(id)) return;
  pending.set(id, label);
  publish(`開始：${label}`);
}

export function endStartupStep(id: string) {
  if (!STARTUP_DIAGNOSTICS_ENABLED) return;
  const label = pending.get(id);
  if (!label) return;
  pending.delete(id);
  publish(`完了：${label}`);
}

export function recordStartupError(label: string, cause: unknown, fatal = true) {
  if (!STARTUP_DIAGNOSTICS_ENABLED) return;
  const detail = cause instanceof Error ? `${cause.message}\n${cause.stack ?? ''}` : String(cause);
  publish(`エラー：${label}\n${detail}`, fatal ? { error: `${label}\n${detail}` } : {});
}

export function traceStartup<T>(label: string, action: () => Promise<T>): Promise<T> {
  if (!STARTUP_DIAGNOSTICS_ENABLED) return action();
  const id = `async-${++stepId}`;
  beginStartupStep(id, label);
  return (async () => {
    try {
      const result = await action();
      endStartupStep(id);
      return result;
    } catch (cause) {
      pending.delete(id);
      recordStartupError(label, cause, false);
      throw cause;
    }
  })();
}

export function markStartupReady(screen: string) {
  if (snapshot.ready) return;
  publish(`画面表示：${screen}`, { ready: true });
}

export function setWidgetDiagnosticBypass(value: boolean) {
  skipWidget = STARTUP_DIAGNOSTICS_ENABLED && value;
}

export function isWidgetDiagnosticBypassed() {
  return STARTUP_DIAGNOSTICS_ENABLED && skipWidget;
}
