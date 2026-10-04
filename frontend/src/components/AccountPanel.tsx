import { useState } from 'react';
import { User, Settings, LogOut, X, CheckCircle, Activity, Database } from 'lucide-react';
import { useNowcastStore, useScenarioStore, useUiStore } from '../store';

export default function AccountPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const connection = useNowcastStore(state => state.connection);
  const mode = useScenarioStore(state => state.mode);
  const healthStatus = useNowcastStore(state => state.healthStatus);
  const notify = (message: string) => useUiStore.setState({ notice: message });

  if (!isOpen) {
    return (
      <button
        className="rail-avatar"
        onClick={() => setIsOpen(true)}
        title="Account"
        aria-label="Account"
      >
        NX
      </button>
    );
  }

  return (
    <div className="account-panel-overlay" onClick={() => setIsOpen(false)}>
      <div className="account-panel" onClick={e => e.stopPropagation()}>
        <header>
          <div className="account-header-content">
            <div className="account-avatar">
              <User size={24} />
            </div>
            <div>
              <strong>NOVEXA Operations</strong>
              <span>Weather Analyst</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} aria-label="Close account panel">
            <X size={18} />
          </button>
        </header>

        <div className="account-section">
          <span className="section-label">SESSION</span>
          <div className="account-row">
            <Activity size={16} />
            <span>Status</span>
            <strong className="green-text">Active</strong>
          </div>
          <div className="account-row">
            <Database size={16} />
            <span>Environment</span>
            <strong>Demo / Local</strong>
          </div>
          <div className="account-row">
            <CheckCircle size={16} />
            <span>Backend</span>
            <strong className={mode === 'BACKEND' ? 'green-text' : 'amber-text'}>
              {mode === 'BACKEND' ? 'Connected' : 'Local Mode'}
            </strong>
          </div>
        </div>

        <div className="account-section">
          <span className="section-label">CONNECTION</span>
          <div className="account-row">
            <span>Mode</span>
            <strong>{mode}</strong>
          </div>
          <div className="account-row">
            <span>Status</span>
            <strong>{connection}</strong>
          </div>
          {mode === 'BACKEND' && (
            <>
              <div className="account-row">
                <span>Overall</span>
                <strong className={
                  healthStatus.overall === 'CONNECTED' ? 'green-text' :
                  healthStatus.overall === 'DEGRADED' ? 'amber-text' :
                  'red-text'
                }>{healthStatus.overall}</strong>
              </div>
              <div className="account-row">
                <span>API</span>
                <strong className={healthStatus.api === 'REACHABLE' ? 'green-text' : 'red-text'}>
                  {healthStatus.api}
                </strong>
              </div>
              <div className="account-row">
                <span>Health</span>
                <strong className={healthStatus.health === 'OK' ? 'green-text' : 'red-text'}>
                  {healthStatus.health}
                </strong>
              </div>
            </>
          )}
        </div>

        <div className="account-section">
          <span className="section-label">OPTIONS</span>
          <button className="account-menu-item" onClick={() => notify('Operator profile: NOVEXA Operations · Weather Analyst')}>
            <User size={16} />
            <span>Profile</span>
          </button>
          <button className="account-menu-item" onClick={() => notify('Preferences are managed for this browser session.')}>
            <Settings size={16} />
            <span>Preferences</span>
          </button>
          <button className="account-menu-item" onClick={() => notify('System settings: use the Technical page for health and integration diagnostics.')}>
            <Activity size={16} />
            <span>System Settings</span>
          </button>
        </div>

        <footer>
          <button className="account-signout" onClick={() => setIsOpen(false)}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
