import LocalReplayProvider from './LocalReplayProvider';
import type { ProviderRequest } from '../types/nowcast';
export default class SimulationProvider extends LocalReplayProvider { getSnapshot(request: ProviderRequest) { return { ...super.getSnapshot(request), mode: 'SIMULATION' as const }; } }
