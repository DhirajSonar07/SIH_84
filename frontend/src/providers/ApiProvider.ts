import type { NowcastState, ProviderRequest } from '../types/nowcast';
import type { NowcastProvider } from './provider';
import { nowcastSchema } from '../lib/snapshotSchema';
import { healthCheckService } from '../lib/health';
export class StaleSnapshotError extends Error {}
export default class ApiProvider implements NowcastProvider {
  private sequence = -1;
  private timestamp = -1;
  constructor(private baseUrl: string) {}
  async getSnapshot(request?: ProviderRequest): Promise<NowcastState> {
    const baseUrl = this.baseUrl.replace(/\/$/, '');
    const response = request
      ? await fetch(`${baseUrl}/scenarios/${encodeURIComponent(request.scenarioId)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minute: request.minute, lead: request.lead, parameters: request.parameters }),
        signal: AbortSignal.timeout(2000),
        cache: 'no-store',
      })
      : await fetch(`${baseUrl}/nowcast/current`, { signal: AbortSignal.timeout(2000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Backend unavailable (${response.status})`);
    return this.accept(await response.json());
  }
  accept(data: unknown): NowcastState {
    const snapshot = nowcastSchema.parse(data);
    const time = Date.parse(snapshot.timestamp);
    if (snapshot.sequence <= this.sequence || time < this.timestamp) throw new StaleSnapshotError('Duplicate or out-of-order snapshot ignored');
    this.sequence = snapshot.sequence;
    this.timestamp = time;
    return { ...snapshot, mode: 'BACKEND' };
  }
  connect(onSnapshot: (snapshot: NowcastState) => void, onDisconnect: () => void, onStatus: (status: string) => void = () => {}) {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let failures = 0;
    let recovering = false;
    const clearSocket = () => {
      clearTimeout(openTimer);
      if (socket) { socket.onclose = null; socket.onerror = null; socket.onmessage = null; socket.onopen = null; socket.close(); socket = null; }
      healthCheckService.setWebSocketStatus('DISCONNECTED');
    };
    const retry = () => {
      if (disposed) return;
      clearSocket();
      failures++;
      if (failures > 3) { disposed = true; clearTimeout(timer); onDisconnect(); return; }
      onStatus(`BACKEND RECOVERING · ATTEMPT ${failures}/3`);
      clearTimeout(timer);
      timer = setTimeout(() => { if (!disposed) open(); }, 500 * Math.pow(2, failures - 1));
    };
    const recover = async () => {
      if (disposed || recovering) return;
      recovering = true;
      onStatus('BACKEND DEGRADED · FULL SNAPSHOT RECOVERY');
      try {
        const snapshot = await this.getSnapshot();
        if (!disposed) { onSnapshot(snapshot); failures = 0; onStatus('BACKEND CONNECTED · SNAPSHOT RECOVERED'); }
      } catch (error) {
        if (!disposed) { if (error instanceof StaleSnapshotError) onStatus('BACKEND CONNECTED · SNAPSHOT CURRENT'); else retry(); }
      } finally { recovering = false; }
    };
    const open = () => {
      if (disposed) return;
      try {
        const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
        const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/ws/nowcast`, origin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(url);
        openTimer = setTimeout(retry, 2500);
        socket.onopen = () => { clearTimeout(openTimer); healthCheckService.setWebSocketStatus('CONNECTED'); void recover(); };
        socket.onmessage = event => {
          if (disposed || recovering) return;
          try {
            const data = nowcastSchema.parse(JSON.parse(event.data));
            if (data.sequence > this.sequence + 1) { void recover(); return; }
            const snapshot = this.accept(data);
            onSnapshot(snapshot); failures = 0; onStatus('BACKEND CONNECTED');
          } catch (error) { if (!(error instanceof StaleSnapshotError)) void recover(); }
        };
        socket.onerror = retry;
        socket.onclose = retry;
      } catch { retry(); }
    };
    open();
    return () => { disposed = true; clearTimeout(timer); clearSocket(); };
  }
}
