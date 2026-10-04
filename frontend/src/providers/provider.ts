import type { NowcastState, ProviderRequest } from '../types/nowcast';
export interface NowcastProvider { getSnapshot(request: ProviderRequest): NowcastState | Promise<NowcastState>; }
