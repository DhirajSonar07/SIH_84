export interface HealthStatus {
  overall: 'CONNECTED' | 'DEGRADED' | 'OFFLINE' | 'CONNECTING';
  api: 'REACHABLE' | 'UNREACHABLE' | 'NOT_CHECKED';
  health: 'OK' | 'FAILED' | 'NOT_CHECKED';
  readiness: 'READY' | 'NOT_READY' | 'NOT_CHECKED';
  websocket: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CHECKED';
  engine: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_CHECKED';
  lastUpdate: string | null;
  reason: string;
}

import { API_BASE_URL } from './config';

export interface HealthResponse {
  status: string;
  backendVersion: string;
  engineVersion: string;
  mode: string;
}

export interface ReadyResponse {
  status: string;
  checks: Record<string, boolean>;
}

const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds
const HEALTH_TIMEOUT = 3000; // 3 seconds

class HealthCheckService {
  private status: HealthStatus = {
    overall: 'CONNECTING',
    api: 'NOT_CHECKED',
    health: 'NOT_CHECKED',
    readiness: 'NOT_CHECKED',
    websocket: 'NOT_CHECKED',
    engine: 'NOT_CHECKED',
    lastUpdate: null,
    reason: 'Initializing health check...'
  };

  private listeners: Set<(status: HealthStatus) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  subscribe(listener: (status: HealthStatus) => void) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.status));
  }

  private async checkHealth(): Promise<{ health: 'OK' | 'FAILED'; response: HealthResponse | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as HealthResponse;
      return { health: 'OK', response: data };
    } catch (error) {
      return { health: 'FAILED', response: null };
    }
  }

  private async checkReadiness(): Promise<{ readiness: 'READY' | 'NOT_READY'; response: ReadyResponse | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/ready`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as ReadyResponse;
      return { readiness: data.status === 'ready' ? 'READY' : 'NOT_READY', response: data };
    } catch (error) {
      return { readiness: 'NOT_READY', response: null };
    }
  }

  private computeOverall(health: 'OK' | 'FAILED' | 'NOT_CHECKED', readiness: 'READY' | 'NOT_READY' | 'NOT_CHECKED', websocket: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CHECKED'): HealthStatus['overall'] {
    if (health === 'FAILED' || health === 'NOT_CHECKED') return 'OFFLINE';
    if (readiness === 'NOT_READY' || readiness === 'NOT_CHECKED') return 'DEGRADED';
    if (websocket === 'DISCONNECTED') return 'DEGRADED';
    if (websocket === 'NOT_CHECKED') return 'CONNECTING';
    return 'CONNECTED';
  }

  private determineReason(health: 'OK' | 'FAILED' | 'NOT_CHECKED', readiness: 'READY' | 'NOT_READY' | 'NOT_CHECKED', websocket: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CHECKED'): string {
    if (health === 'FAILED') return 'Backend health check failed';
    if (health === 'NOT_CHECKED') return 'Health check not yet performed';
    if (readiness === 'NOT_READY') return 'Backend readiness check failed';
    if (readiness === 'NOT_CHECKED') return 'Readiness check not yet performed';
    if (websocket === 'DISCONNECTED') return 'WebSocket disconnected';
    if (websocket === 'NOT_CHECKED') return 'WebSocket not yet connected';
    return 'All systems operational';
  }

  async performCheck() {
    const [healthResult, readinessResult] = await Promise.all([
      this.checkHealth(),
      this.checkReadiness()
    ]);

    this.status.api = healthResult.health === 'OK' ? 'REACHABLE' : 'UNREACHABLE';
    this.status.health = healthResult.health;
    this.status.readiness = readinessResult.readiness;
    this.status.engine = healthResult.health === 'OK' && readinessResult.readiness === 'READY'
      ? 'AVAILABLE'
      : 'UNAVAILABLE';
    this.status.lastUpdate = new Date().toISOString();

    this.status.overall = this.computeOverall(
      healthResult.health,
      readinessResult.readiness,
      this.status.websocket
    );
    this.status.reason = this.determineReason(
      healthResult.health,
      readinessResult.readiness,
      this.status.websocket
    );

    this.notify();
  }

  setWebSocketStatus(status: 'CONNECTED' | 'DISCONNECTED') {
    this.status.websocket = status;
    this.status.overall = this.computeOverall(
      this.status.health,
      this.status.readiness,
      status
    );
    this.status.reason = this.determineReason(
      this.status.health,
      this.status.readiness,
      status
    );
    this.notify();
  }

  markOffline(reason = 'Backend server is not responding') {
    this.status = {
      ...this.status,
      overall: 'OFFLINE',
      api: 'UNREACHABLE',
      health: 'FAILED',
      readiness: 'NOT_CHECKED',
      websocket: 'DISCONNECTED',
      engine: 'UNAVAILABLE',
      reason,
      lastUpdate: this.status.lastUpdate,
    };
    this.notify();
  }

  start() {
    if (this.intervalId) return;
    this.performCheck();
    this.intervalId = setInterval(() => this.performCheck(), HEALTH_CHECK_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getStatus(): HealthStatus {
    return { ...this.status };
  }
}

export const healthCheckService = new HealthCheckService();
