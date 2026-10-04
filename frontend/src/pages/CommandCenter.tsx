import { ArrowUpRight, GitCompareArrows, Activity, Radio } from 'lucide-react';
import { Link } from 'react-router';
import useNowcast from '../features/useNowcast';
import { actions, useNowcastStore } from '../store';
import OperationsMap from '../components/OperationsMap';
import { Sources, Threat, Fusion, Pipeline, EvolutionChart, AlertCenter, AIInference } from '../components/Intelligence';
import { ForecastTimeline } from '../components/ReplayControl';
import { Panel, number, Badge, eta, InspectButton } from '../components/common';
export default function CommandCenter() {
  const snapshot = useNowcast();
  const revision = snapshot.revision;
  const healthStatus = useNowcastStore(state => state.healthStatus);
  const engineBadge = snapshot.mode === 'BACKEND' 
    ? (healthStatus.overall === 'CONNECTED' ? { tone: 'green' as const, label: 'LIVE · ENGINE READY' }
       : healthStatus.overall === 'DEGRADED' ? { tone: 'amber' as const, label: 'ENGINE DEGRADED' }
       : { tone: 'red' as const, label: 'ENGINE OFFLINE' })
    : { tone: 'cyan' as const, label: `${snapshot.mode} · ENGINE READY` };
  return <><div className="page-heading"><div><span className="eyebrow">OPERATIONS / MAHARASHTRA</span><h1>Command Center<span className="heading-slash">/</span><span className="heading-caption">Convective intelligence &amp; early warning</span></h1></div><div className="page-heading-actions"><Badge tone={engineBadge.tone}>{engineBadge.label}</Badge></div></div>
    <div className="command-grid"><Sources/><div className="map-column"><OperationsMap/><ForecastTimeline/><Fusion/></div><Threat/></div>
    <Pipeline/>
    <AIInference/>
    <div className="command-bottom"><Panel title="HAZARD EVOLUTION" action={<Link className="text-button" to="/nowcast">0–6h outlook<ArrowUpRight size={13}/></Link>}><div className="chart-subheading"><span><i className="cyan-dot"/>Lightning risk index /100</span><span className="muted">- - Confidence %</span></div><EvolutionChart height={132}/></Panel>
      <Panel title="SINCE LAST NOWCAST" action={<GitCompareArrows size={15}/>} className="revision-panel"><div className="revision-grid"><div><span>Lightning risk</span><strong>{revision ? `${revision.risk-revision.previousRisk >= 0 ? '+' : ''}${number(revision.risk-revision.previousRisk,1)}` : '—'}<small> pts</small></strong></div><div><span>Arrival estimate</span><strong>{revision?.previousEta != null && revision.eta != null ? `${number(revision.eta-revision.previousEta,1)} min` : eta(snapshot.storm.eta)}</strong></div><div><span>Confidence</span><strong>{revision ? `${number(revision.confidence-revision.previousConfidence,1)} pp` : `${number(snapshot.fusion.confidence)}%`}</strong></div><div><span>Current state</span><strong className="cyan-text">{snapshot.storm.state}</strong></div></div><div className="revision-reason"><Radio size={13}/>{revision?.reason ?? 'SC-001 loaded · T+45 developing storm'}</div><button className="text-button" onClick={() => actions.inspect('fusion')}>Inspect forecast evidence<ArrowUpRight size={13}/></button></Panel><AlertCenter/></div>
    <footer className="operations-footer"><span><Activity size={12}/>{snapshot.mode === 'BACKEND' ? 'BACKEND ENGINE' : 'LOCAL ENGINE'} · {snapshot.engineVersion}</span><span>Source quality {number(snapshot.fusion.quality)}% · {snapshot.performance.frames} indexed replay frames</span><span>TARGET: 0–6H / 1–3 KM · NOT YET VALIDATED</span></footer>
  </>;
}
