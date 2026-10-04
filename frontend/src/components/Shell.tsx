import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router';
import { Radar, LayoutDashboard, ScanLine, Zap, FlaskConical, ChartNoAxesCombined, Network, Play, RotateCcw, ChevronDown, MapPin, CircleHelp, WifiOff, Settings2, Bell, ArrowUpRight } from 'lucide-react';
import useNowcast, { useReplayClock } from '../features/useNowcast';
import { actions, useScenarioStore, useNowcastStore, useUiStore } from '../store';
import { Badge, time } from './common';
import InspectionDrawer from './InspectionDrawer';
import ReplayControl from './ReplayControl';
import useAlerts from '../features/useAlerts';
import { isOpenAlert } from '../lib/alerts';
import type { Mode } from '../types/nowcast';
const navigation = [ { to:'/',label:'Command Center',icon:LayoutDashboard }, { to:'/nowcast',label:'Nowcast',icon:ScanLine }, { to:'/radar',label:'Radar',icon:Radar }, { to:'/hazards',label:'Hazards',icon:Zap }, { to:'/scenarios',label:'Scenario Lab',icon:FlaskConical }, { to:'/performance',label:'Performance',icon:ChartNoAxesCombined }, { to:'/technical',label:'Technical',icon:Network } ];
export default function Shell() {
  const snapshot = useNowcast();
  const mode = useScenarioStore(state => state.mode);
  const connection = useNowcastStore(state => state.connection);
  const notice = useUiStore(state => state.notice);
  const records = useAlerts();
  const openAlertCount = records.filter(record => isOpenAlert(record.status)).length;
  const navigate = useNavigate();
  const location = useLocation();
  const persistentReplay = location.pathname !== '/';
  useReplayClock();
  useEffect(() => {
    const listener = (event:KeyboardEvent) => {
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
    window.addEventListener('keydown',listener); return () => window.removeEventListener('keydown',listener);
  }, [navigate]);
  return <div className="app-shell"><a href="#main-content" className="skip-link">Skip to command content</a><aside className="rail"><NavLink to="/" className="brand-icon" aria-label="NOVEXA home"><Radar size={30}/></NavLink><div className="rail-links">{navigation.map(item => { const Icon=item.icon; return <NavLink key={item.to} to={item.to} end={item.to === '/'} title={item.label} aria-label={item.label}><Icon size={21}/><span>{item.label}</span></NavLink>; })}</div><div className="rail-bottom"><button title="Technical documentation" aria-label="Technical documentation" onClick={() => navigate('/technical')}><CircleHelp size={20}/></button><button title="Judge scenario controls" aria-label="Judge scenario controls" onClick={() => actions.inspect('controls')}><Settings2 size={20}/></button><span className="rail-avatar">NX</span></div></aside><div className={`app-content ${persistentReplay ? 'with-persistent-replay' : ''}`}><header className="global-header"><div className="brand"><strong>NOVEXA<span>NOWCAST</span></strong><span>CONVECTIVE INTELLIGENCE SYSTEM</span></div><div className="header-region"><MapPin size={15}/><div><strong>PUNE REGION</strong><span>INDIA / MAHARASHTRA</span></div><ChevronDown size={12}/></div><div className="header-mode"><span className="label">DATA MODE</span><select aria-label="Data provider mode" value={mode} onChange={event => void actions.setMode(event.target.value as Mode)}><option value="REPLAY">LOCAL REPLAY</option><option value="SIMULATION">SIMULATION</option><option value="BACKEND">BACKEND / API</option></select></div><div className="header-clock"><span className="label">OBSERVATION · SYNTHETIC</span><strong>{time(snapshot.observationTime)}<small> IST</small></strong></div><div className="header-actions"><button className="primary-button" onClick={() => { navigate('/'); actions.selectScenario('SC-001'); actions.play(); }}><Play size={13} fill="currentColor"/>Start demo</button><button className="icon-button" aria-label="Reset demo" title="Reset demo (R)" onClick={actions.reset}><RotateCcw size={17}/></button><button className="alert-count" title="Inspect scenario alerts" aria-label="Inspect alerts" onClick={() => actions.inspect('alerts')}><Bell size={18}/><span>{openAlertCount}</span></button></div></header><div className="mission-strip"><div><Badge tone="green">LOCAL ENGINE READY</Badge><span className="divider"/>SIH 2026 <span className="muted">/</span> PS 26084 <span className="divider"/><span className="ministry">Ministry of Earth Sciences · NCMRWF</span></div><div><span className="scenario-code">{snapshot.scenarioId} <span>v{snapshot.scenarioVersion}</span></span><span className="divider"/><WifiOff size={12}/><span>{connection}</span></div></div><nav className="top-nav" aria-label="Main navigation">{navigation.map(item => { const Icon=item.icon; return <NavLink key={item.to} to={item.to} end={item.to === '/'}><Icon size={14}/>{item.label}{item.to === '/' && <span className="nav-count">01</span>}</NavLink>; })}<a className="technical-shortcut" href="/technical" onClick={event => { event.preventDefault(); navigate('/technical'); }}>System architecture<ArrowUpRight size={13}/></a></nav>{notice && <div className="notice" role="status">{notice}<button onClick={() => useUiStore.setState({notice:''})}>Dismiss</button></div>}<main id="main-content"><Outlet/></main>{persistentReplay && <div className="global-replay"><ReplayControl/></div>}<div className="trust-footer"><span>SIMULATED OBSERVATIONS · UNVALIDATED HEURISTICS · NOT AN OFFICIAL WARNING SYSTEM</span><span>FROM MULTI-SOURCE DATA TO EARLY WARNING.</span></div></div><InspectionDrawer/></div>;
}
