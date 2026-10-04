import { useNowcastStore } from '../store';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';

export default function ConnectionStatus() {
  const healthStatus = useNowcastStore(state => state.healthStatus);
  const connection = useNowcastStore(state => state.connection);

  const getStatusIcon = () => {
    switch (healthStatus.overall) {
      case 'CONNECTED':
        return <Wifi size={14} className="green-text" />;
      case 'DEGRADED':
        return <AlertTriangle size={14} className="amber-text" />;
      case 'OFFLINE':
        return <WifiOff size={14} className="red-text" />;
      case 'CONNECTING':
        return <Loader2 size={14} className="cyan-text animate-spin" />;
      default:
        return <WifiOff size={14} />;
    }
  };

  const getStatusColor = () => {
    switch (healthStatus.overall) {
      case 'CONNECTED': return 'green';
      case 'DEGRADED': return 'amber';
      case 'OFFLINE': return 'red';
      case 'CONNECTING': return 'cyan';
      default: return 'red';
    }
  };

  const isBackendMode = connection.includes('BACKEND') || connection.includes('CONNECTING');

  if (!isBackendMode) {
    const isSimulation = connection.includes('SIMULATION');
    return (
      <div className="connection-status">
        <div className={`status-indicator ${isSimulation ? 'amber' : 'cyan'}`}>
          <Wifi size={14} />
        </div>
        <span className="status-text">{isSimulation ? 'SIMULATION' : 'LOCAL REPLAY'}</span>
      </div>
    );
  }

  const getStatusText = () => {
    switch (healthStatus.overall) {
      case 'CONNECTED': return 'CORE CONNECTED';
      case 'DEGRADED': return 'SYSTEM DEGRADED';
      case 'OFFLINE': return 'CORE OFFLINE';
      case 'CONNECTING': return 'CONNECTING...';
      default: return 'UNKNOWN';
    }
  };

  return (
    <div className="connection-status">
      <div className={`status-indicator ${getStatusColor()}`}>
        {getStatusIcon()}
      </div>
      <span className="status-text">{getStatusText()}</span>
    </div>
  );
}
