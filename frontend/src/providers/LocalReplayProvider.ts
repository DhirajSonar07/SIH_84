import { compute } from '../lib/engine';
import type { ProviderRequest } from '../types/nowcast';
import type { NowcastProvider } from './provider';
export default class LocalReplayProvider implements NowcastProvider { getSnapshot(request: ProviderRequest) { return compute(request); } }
