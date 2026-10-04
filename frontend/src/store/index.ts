import { create } from 'zustand';
import { defaultParameters, scenarios } from '../data/scenarios';
import LocalReplayProvider from '../providers/LocalReplayProvider';
import SimulationProvider from '../providers/SimulationProvider';
import ApiProvider from '../providers/ApiProvider';
import { reconcileAlerts } from '../lib/alerts';
import { historyPoint, parametersAt, replayFrames } from '../lib/replay';
import { healthCheckService, type HealthStatus } from '../lib/health';
import type { AlertRecord, NowcastState, ScenarioParameters, Mode, ScenarioIntervention, StormHistoryPoint, ProviderRequest } from '../types/nowcast';
const replay = new LocalReplayProvider();
const simulation = new SimulationProvider();
const initialRequest: ProviderRequest = { scenarioId: 'SC-001', minute: 45, lead: 0, parameters: { ...defaultParameters }, initialParameters: { ...defaultParameters }, interventions: [] };
const initialFrames = replayFrames(replay, initialRequest);
const initial = initialFrames[initialFrames.length - 1];
const initialJournal = initialFrames.reduce<Record<string, AlertRecord>>(reconcileAlerts, {});
interface ScenarioStore { scenarioId: string; scenarios: typeof scenarios; parameters: ScenarioParameters; initialParameters: ScenarioParameters; interventions: ScenarioIntervention[]; minute: number; lead: number; playing: boolean; speed: number; mode: Mode; }
export const useScenarioStore = create<ScenarioStore>(() => ({ ...initialRequest, scenarios, initialParameters: { ...defaultParameters }, interventions: [], playing: false, speed: 1, mode: 'REPLAY' }));
interface NowcastStore { snapshot: NowcastState; observedSnapshot: NowcastState; history: StormHistoryPoint[]; alertJournal: Record<string, AlertRecord>; stableRequest: ProviderRequest; connection: string; healthStatus: HealthStatus; audit: { time: string; action: string }[]; }
export const useNowcastStore = create<NowcastStore>(() => ({ snapshot: initial, observedSnapshot: initial, history: initialFrames.map(historyPoint), alertJournal: initialJournal, stableRequest: initialRequest, connection: 'LOCAL REPLAY', healthStatus: healthCheckService.getStatus(), audit: [] }));
const recoveredJournals = new WeakMap<NowcastState, Record<string, AlertRecord>>();
export function selectAlertJournal(state: NowcastStore): Record<string, AlertRecord> {
  if (state.alertJournal) return state.alertJournal;
  const observed = state.observedSnapshot;
  const cached = recoveredJournals.get(observed);
  if (cached) return cached;
  const frames = observed.mode === 'BACKEND' ? [observed] : replayFrames(
    observed.mode === 'SIMULATION' ? simulation : replay,
    { ...state.stableRequest, scenarioId: observed.scenarioId, minute: observed.minute, lead: 0 },
  );
  const journal = frames.reduce<Record<string, AlertRecord>>(reconcileAlerts, {});
  recoveredJournals.set(observed, journal);
  return journal;
}
interface MapStore { layers: Record<string, boolean>; focus: number; selectedStorm: string; }
export const useMapStore = create<MapStore>(() => ({ layers: { Radar: true, Satellite: false, Lightning: false, Trajectory: true, Hazards: true, Grid: false, Infrastructure: false, Districts: true, Convective: true, Tracks: true, Alerts: true }, focus: 0, selectedStorm: 'CELL-001' }));
interface UiStore { inspection: { kind: string; id: string } | null; notice: string; }
export const useUiStore = create<UiStore>(() => ({ inspection: null, notice: '' }));
let generation = 0;
let disconnect: (() => void) | undefined;
let healthUnsubscribe: (() => void) | undefined;
function stopBackend() {
  generation++;
  disconnect?.();
  disconnect = undefined;
  healthUnsubscribe?.();
  healthUnsubscribe = undefined;
  healthCheckService.stop();
}
function restoreLocalRequest() {
  const saved = useNowcastStore.getState().stableRequest;
  useScenarioStore.setState({ ...saved, initialParameters: saved.initialParameters ?? saved.parameters, interventions: saved.interventions ?? [], mode: 'REPLAY', playing: false });
}
function commit(snapshot: NowcastState, reason: string, resetJournal = false) {
  const previous = useNowcastStore.getState();
  const local = snapshot.mode !== 'BACKEND';
  const state = useScenarioStore.getState();
  const frames = local ? replayFrames(snapshot.mode === 'SIMULATION' ? simulation : replay, state) : [snapshot];
  const observedSnapshot = frames[frames.length - 1];
  const rewound = observedSnapshot.minute < previous.observedSnapshot.minute;
  const newScenario = observedSnapshot.scenarioId !== previous.observedSnapshot.scenarioId;
  const reset = resetJournal || rewound || newScenario || (!local && previous.snapshot.mode !== 'BACKEND');
  let alertJournal = reset ? {} : selectAlertJournal(previous);
  const journalFrames = reset ? frames : frames.filter(frame => frame.minute > previous.observedSnapshot.minute || frame.minute === observedSnapshot.minute);
  for (const frame of journalFrames) alertJournal = reconcileAlerts(alertJournal, frame);
  if (local && reason.startsWith('Judge changed')) {
    alertJournal = Object.fromEntries(Object.entries(alertJournal).map(([id, record]) => [id, record.qualified ? { ...record,
      audit: [...record.audit, { time: observedSnapshot.timestamp, action: `FORECAST REVISED · ${reason}` }].slice(-80) } : record]));
  }
  const revision = local ? reset ? null : reason.startsWith('Forecast horizon') ? previous.observedSnapshot.revision : {
    previousEta: previous.observedSnapshot.storm.eta, eta: observedSnapshot.storm.eta,
    previousRisk: previous.observedSnapshot.hazards[0].risk, risk: observedSnapshot.hazards[0].risk,
    previousConfidence: previous.observedSnapshot.fusion.confidence, confidence: observedSnapshot.fusion.confidence, reason,
  } : snapshot.revision;
  const updatedObserved = { ...observedSnapshot, revision };
  const history = local ? frames.map(historyPoint) : [...previous.history.filter(point => point.timestamp !== snapshot.timestamp), historyPoint(snapshot)].slice(-120);
  useNowcastStore.setState({ snapshot: { ...snapshot, revision }, observedSnapshot: updatedObserved, history, alertJournal,
    stableRequest: local ? { scenarioId: state.scenarioId, minute: state.minute, lead: state.lead, parameters: state.parameters, initialParameters: state.initialParameters, interventions: state.interventions } : previous.stableRequest,
    audit: reset ? [] : previous.audit,
  });
}
function fallback() {
  stopBackend();
  healthCheckService.markOffline('Backend unavailable after recovery attempts');
  useNowcastStore.setState({ connection: 'BACKEND OFFLINE' });
  useUiStore.setState({ notice: 'Live data paused. Displaying the last valid backend snapshot; no synthetic updates are being generated.' });
}
export const actions = {
  runNowcast(reason = 'New replay observation', resetJournal = false) {
    const state = useScenarioStore.getState();
    if (state.mode === 'BACKEND') return;
    commit((state.mode === 'SIMULATION' ? simulation : replay).getSnapshot(state), reason, resetJournal);
  },
  selectScenario(scenarioId: string) {
    stopBackend();
    const scenario = scenarios.find(item => item.id === scenarioId) ?? scenarios[0];
    const parameters = { ...defaultParameters, ...scenario.parameters };
    useScenarioStore.setState({ scenarioId: scenario.id, minute: 45, lead: 0, playing: false, mode: 'REPLAY', parameters, initialParameters: parameters, interventions: [] });
    useNowcastStore.setState({ audit: [], connection: 'LOCAL REPLAY' });
    actions.runNowcast('Scenario loaded', true);
  },
  play() { if (useScenarioStore.getState().mode !== 'BACKEND') useScenarioStore.setState({ playing: !useScenarioStore.getState().playing }); },
  reset() { actions.selectScenario(useScenarioStore.getState().scenarioId); },
  seek(minute: number) {
    const state = useScenarioStore.getState();
    if (state.mode === 'BACKEND' || !Number.isFinite(minute)) return;
    const bounded = Math.max(0, Math.min(240, minute));
    const rewound = bounded < state.minute;
    useScenarioStore.setState({ minute: bounded, parameters: parametersAt(bounded, state.initialParameters, state.interventions) });
    actions.runNowcast('Replay seek', rewound);
    if (rewound) useUiStore.setState({ notice: 'Replay rewound. The alert journal was reconstructed and operator review actions cleared for this timeline branch.' });
  },
  next() { const minute = useScenarioStore.getState().minute; actions.seek([0, 10, 20, 30, 45, 60, 90, 120, 180, 240].find(value => value > minute) ?? 240); },
  setLead(lead: number) {
    if (useScenarioStore.getState().mode === 'BACKEND') { useUiStore.setState({ notice: 'Backend forecast selection requires authoritative forecast snapshots. Local extrapolation is disabled in backend mode.' }); return; }
    if (!Number.isFinite(lead)) return;
    useScenarioStore.setState({ lead: Math.max(0, Math.min(360, lead)) });
    actions.runNowcast(`Forecast horizon +${lead} min`);
  },
  adjust(key: keyof ScenarioParameters, value: number) {
    if (!Number.isFinite(value)) return;
    if (useScenarioStore.getState().mode === 'BACKEND') { stopBackend(); restoreLocalRequest(); useUiStore.setState({ notice: 'Judge intervention switched to local simulation. Backend output is no longer authoritative for this branch.' }); }
    const state = useScenarioStore.getState();
    const parameters = { ...state.parameters, [key]: value };
    const interventions = [...state.interventions.filter(event => event.minute < state.minute), { minute: state.minute, parameters }];
    useScenarioStore.setState({ mode: 'SIMULATION', parameters, interventions });
    useNowcastStore.setState({ connection: 'LOCAL SIMULATION' });
    actions.runNowcast(`Judge changed ${key} to ${value}`);
  },
  async setMode(mode: Mode) {
    const previousMode = useScenarioStore.getState().mode;
    stopBackend();
    const requestId = generation;
    if (mode !== 'BACKEND' && previousMode === 'BACKEND') restoreLocalRequest();
    useScenarioStore.setState({ mode, playing: false });
    if (mode !== 'BACKEND') { useNowcastStore.setState({ connection: mode === 'REPLAY' ? 'LOCAL REPLAY' : 'LOCAL SIMULATION' }); actions.runNowcast('Provider changed', previousMode === 'BACKEND'); return; }
    useNowcastStore.setState({ connection: 'CONNECTING TO BACKEND' });
    healthCheckService.start();
    healthUnsubscribe = healthCheckService.subscribe(status => { if (requestId === generation) useNowcastStore.setState({ healthStatus: status }); });
    const provider = new ApiProvider('/api');
    try {
      const snapshot = await provider.getSnapshot(useScenarioStore.getState());
      if (requestId !== generation) return;
      useNowcastStore.setState({ history: [] });
      commit(snapshot, 'Authoritative backend snapshot', true);
      useNowcastStore.setState({ connection: 'BACKEND CONNECTED' });
      disconnect = provider.connect(state => { if (requestId === generation) commit(state, 'Backend update'); },
        () => { if (requestId === generation) fallback(); },
        connection => { if (requestId === generation) useNowcastStore.setState({ connection }); });
    } catch { if (requestId === generation) fallback(); }
  },
  acknowledge(alertId: string, resolve = false) {
    const current = useNowcastStore.getState();
    if (current.snapshot.mode === 'BACKEND') { useUiStore.setState({ notice: 'Authoritative alert review endpoints are not connected. No backend alert status was changed.' }); return; }
    const journal = selectAlertJournal(current);
    const record = journal[alertId];
    if (!record || ['RESOLVED', 'EXPIRED'].includes(record.status) || (!resolve && record.status === 'ACKNOWLEDGED')) return;
    const time = current.observedSnapshot.timestamp;
    const event = { time, action: `${resolve ? 'RESOLVED' : 'ACKNOWLEDGED'} · demo operator review; not an official warning` };
    const next: AlertRecord = { ...record, status: resolve ? 'RESOLVED' : 'ACKNOWLEDGED', lastUpdated: time, audit: [...record.audit, event].slice(-80) };
    useNowcastStore.setState({ alertJournal: { ...journal, [alertId]: next }, audit: [...current.audit, event].slice(-200) });
  },
  restoreStable() { stopBackend(); restoreLocalRequest(); useNowcastStore.setState({ connection: 'LOCAL REPLAY' }); actions.runNowcast('Last stable local state restored', true); useUiStore.setState({ notice: 'Last stable local state restored. Operator review journal restarted.' }); },
  safeState() { actions.selectScenario('SC-001'); actions.seek(0); useUiStore.setState({ notice: 'Safe state loaded: SC-001 at T+0. No significant convection; local replay is ready.' }); },
  inspect(kind: string, id = '') { useUiStore.setState({ inspection: { kind, id } }); },
  close() { useUiStore.setState({ inspection: null }); },
  toggleLayer(layer: string) { const layers = useMapStore.getState().layers; useMapStore.setState({ layers: { ...layers, [layer]: !layers[layer] } }); },
  focus() { useMapStore.setState({ focus: useMapStore.getState().focus + 1 }); },
};
