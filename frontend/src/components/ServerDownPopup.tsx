import { useState, useEffect } from 'react';
import { X, RefreshCw, AlertTriangle, WifiOff, Server, Clock } from 'lucide-react';
import { actions, useNowcastStore } from '../store';
import { healthCheckService } from '../lib/health';

export default function ServerDownPopup() {
  const healthStatus = useNowcastStore(state => state.healthStatus);
  const [showDetails, setShowDetails] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isOffline = healthStatus.overall === 'OFFLINE';
  const isBackendMode = useNowcastStore(state => state.connection).includes('BACKEND');

  useEffect(() => {
    if (isOffline && isBackendMode) {
      setShowDetails(false);
    }
  }, [isOffline, isBackendMode]);

  if (!isOffline || !isBackendMode) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    await healthCheckService.performCheck();
    if (healthCheckService.getStatus().overall !== 'OFFLINE') {
      await actions.setMode('BACKEND');
    }
    setIsRetrying(false);
  };

  const getDiagnosticItems = () => {
    const items = [
      { label: 'Overall', value: healthStatus.overall, status: healthStatus.overall === 'CONNECTED' ? 'ok' : 'error' },
      { label: 'API', value: healthStatus.api, status: healthStatus.api === 'REACHABLE' ? 'ok' : 'error' },
      { label: 'Health', value: healthStatus.health, status: healthStatus.health === 'OK' ? 'ok' : 'error' },
      { label: 'Readiness', value: healthStatus.readiness, status: healthStatus.readiness === 'READY' ? 'ok' : 'error' },
      { label: 'WebSocket', value: healthStatus.websocket, status: healthStatus.websocket === 'CONNECTED' ? 'ok' : 'error' },
      { label: 'Engine', value: healthStatus.engine, status: healthStatus.engine === 'AVAILABLE' ? 'ok' : 'error' },
    ];

    return items;
  };

  const getRecommendedAction = () => {
    if (healthStatus.api === 'UNREACHABLE') {
      return 'Start the backend server and retry.';
    }
    if (healthStatus.health === 'FAILED') {
      return 'Check backend logs for errors.';
    }
    if (healthStatus.readiness === 'NOT_READY') {
      return 'Verify backend initialization is complete.';
    }
    if (healthStatus.websocket === 'DISCONNECTED') {
      return 'WebSocket connection failed. Check network configuration.';
    }
    return 'Verify backend is running and accessible.';
  };

  return (
    <div className="server-down-overlay">
      <div className="server-down-popup">
        {!showDetails ? (
          <>
            <header>
              <div className="server-down-header-content">
                <div className="server-down-icon red-bg">
                  <WifiOff size={24} />
                </div>
                <div>
                  <strong>NOVEXA CORE OFFLINE</strong>
                  <span>Backend server is not responding</span>
                </div>
              </div>
            </header>

            <div className="server-down-body">
              <p>Live nowcasting is unavailable. The system is operating in local replay mode with synthetic data.</p>
            </div>

            <footer className="server-down-footer">
              <button
                className="secondary-button"
                onClick={() => setShowDetails(true)}
              >
                View Details
              </button>
              <button
                className="primary-button"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Retry
                  </>
                )}
              </button>
            </footer>
          </>
        ) : (
          <>
            <header>
              <div className="server-down-header-content">
                <div className="server-down-icon red-bg">
                  <Server size={24} />
                </div>
                <div>
                  <strong>NOVEXA SYSTEM DIAGNOSTICS</strong>
                  <span>Backend connection status</span>
                </div>
              </div>
              <button onClick={() => setShowDetails(false)} aria-label="Close diagnostics">
                <X size={18} />
              </button>
            </header>

            <div className="server-down-body">
              <div className="diagnostics-overview">
                <div className={`diagnostic-status ${healthStatus.overall.toLowerCase()}`}>
                  <AlertTriangle size={20} />
                  <strong>{healthStatus.overall}</strong>
                </div>
                <p className="diagnostic-reason">{healthStatus.reason}</p>
              </div>

              <div className="diagnostics-grid">
                {getDiagnosticItems().map((item) => (
                  <div key={item.label} className="diagnostic-item">
                    <span>{item.label}</span>
                    <strong className={item.status === 'ok' ? 'green-text' : 'red-text'}>
                      {item.value === 'NOT_CHECKED' ? '—' : item.value}
                    </strong>
                  </div>
                ))}
              </div>

              {healthStatus.lastUpdate && (
                <div className="diagnostic-timestamp">
                  <Clock size={14} />
                  <span>Last successful update: {new Date(healthStatus.lastUpdate).toLocaleString()}</span>
                </div>
              )}

              <div className="diagnostic-recommendation">
                <span className="recommendation-label">Recommended action:</span>
                <p>{getRecommendedAction()}</p>
              </div>
            </div>

            <footer className="server-down-footer">
              <button
                className="secondary-button"
                onClick={() => setShowDetails(false)}
              >
                Close
              </button>
              <button
                className="primary-button"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Retry
                  </>
                )}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
