import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router';
import { Radar, LayoutDashboard, ScanLine, Zap, FlaskConical, ChartNoAxesCombined, Network, Play, RotateCcw, ChevronDown, MapPin, CircleHelp, Bell } from 'lucide-react';
import useNowcast, { useReplayClock } from '../features/useNowcast';
import { actions, useScenarioStore, useNowcastStore, useUiStore } from '../store';
import { Badge, time } from './common';
import InspectionDrawer from './InspectionDrawer';
import ReplayControl from './ReplayControl';
import ConnectionStatus from './ConnectionStatus';
import AccountPanel from './AccountPanel';
import ServerDownPopup from './ServerDownPopup';
import useAlerts from '../features/useAlerts';
import { isOpenAlert } from '../lib/alerts';
import type { Mode } from '../types/nowcast';

const navigation = [
  { to: '/', label: 'Command Center', icon: LayoutDashboard },
  { to: '/nowcast', label: 'Nowcast', icon: ScanLine },
  { to: '/radar', label: 'Radar', icon: Radar },
  { to: '/hazards', label: 'Hazards', icon: Zap },
  { to: '/scenarios', label: 'Scenario Lab', icon: FlaskConical },
  { to: '/performance', label: 'Performance', icon: ChartNoAxesCombined },
  { to: '/technical', label: 'Technical', icon: Network }
];

export default function Shell() {
  const snapshot = useNowcast();
  const mode = useScenarioStore(state => state.mode);
  const connection = useNowcastStore(state => state.connection);
  const notice = useUiStore(state => state.notice);
  const records = useAlerts();
  const openAlertCount = records.filter(record => isOpenAlert(record.status)).length;
  const navigate = useNavigate();
  const location = useLocation();
  const showScenarioReplay = location.pathname === '/scenarios';

  useReplayClock();

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,button,[contenteditable]') || event.ctrlKey || event.metaKey || event.altKey || useUiStore.getState().inspection) return;
      const key = event.key.toLowerCase();
      if (key === ' ') { event.preventDefault(); actions.play(); }
      if (key === 'r') actions.reset();
      if (key === 'n') actions.next();
      if (key === 'f') actions.focus();
      if (key === 'h') navigate('/hazards');
      if (key === 't') actions.inspect('alert');
      if (key === 'p') navigate('/performance');
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [navigate]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to command content</a>
      <aside className="rail">
        <NavLink to="/" className="brand-icon" aria-label="NOVEXA home">
          <Radar size={30} />
        </NavLink>
        <div className="rail-links">
          {navigation.map(item => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} title={item.label} aria-label={item.label}>
                <Icon size={21} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
        <div className="rail-bottom">
          <button title="Technical documentation" aria-label="Technical documentation" onClick={() => navigate('/technical')}>
            <CircleHelp size={20} />
          </button>
          <AccountPanel />
        </div>
      </aside>
      <div className={`app-content ${showScenarioReplay ? 'with-persistent-replay' : ''}`}>
        <header className="global-header">
          <div className="brand">
            <strong>NOVEXA<span>NOWCAST</span></strong>
            <span>CONVECTIVE INTELLIGENCE SYSTEM</span>
          </div>
          <div className="header-region">
            <MapPin size={15} />
            <div>
              <strong>MAHARASHTRA</strong>
              <span>INDIA</span>
            </div>
            <ChevronDown size={12} />
          </div>
          <div className="header-mode">
            <span className="label">MODE</span>
            <select aria-label="Data provider mode" value={mode} onChange={event => void actions.setMode(event.target.value as Mode)}>
              <option value="REPLAY">REPLAY</option>
              <option value="SIMULATION">SIMULATION</option>
              <option value="BACKEND">LIVE / API</option>
            </select>
          </div>
          <div className="header-clock">
            <span className="label">{mode === 'BACKEND' ? 'OBSERVATION · LIVE' : mode === 'SIMULATION' ? 'SIMULATION · SYNTHETIC' : 'REPLAY · SYNTHETIC'}</span>
            <strong>{time(snapshot.observationTime)}<small> IST</small></strong>
          </div>
          <ConnectionStatus />
          <div className="header-actions">
            <button className="primary-button" onClick={() => navigate('/scenarios')}>
              <Play size={13} fill="currentColor" />Open Scenario Lab
            </button>
            <button className="icon-button" aria-label="Reset demo" onClick={actions.reset}>
              <RotateCcw size={13} />
            </button>
            <button className="alert-count" onClick={() => actions.inspect('alerts')}>
              <Bell size={14} />
              <span>{openAlertCount}</span>
            </button>
          </div>
        </header>
        <div className="mission-strip">
          <div>
            <span className="scenario-code">SCENARIO <span>{snapshot.scenarioId}</span></span>
            <div className="divider" />
            <span>{snapshot.storm.state}</span>
            <div className="divider" />
            <span>FUSION {snapshot.fusion.confidence}% CONFIDENCE</span>
          </div>
          <div>{notice && <span className="notice-text">{notice}</span>}</div>
        </div>
        <main id="main-content">
          <Outlet />
        </main>
        {showScenarioReplay && <ReplayControl />}
        {useUiStore(state => state.inspection) && <InspectionDrawer />}
        <ServerDownPopup />
      </div>
    </div>
  );
}
