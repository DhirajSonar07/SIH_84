import { useMemo, useState } from 'react';
import { ArrowRight, Crosshair, GitBranch, ShieldCheck, TriangleAlert } from 'lucide-react';
import { actions, useNowcastStore } from '../store';
import useAlerts from '../features/useAlerts';
import { isOpenAlert, severityRank } from '../lib/alerts';
import { Badge, eta, number, time } from './common';
export default function AlertLedger({ compact = false }: { compact?: boolean }) {
  const records = useAlerts();
  const mode = useNowcastStore(state => state.snapshot.mode);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('severity');
  const visible = useMemo(() => records.filter(record => filter === 'Open' ? isOpenAlert(record.status) : filter === 'Unreviewed' ? ['GENERATED', 'ACTIVE', 'ESCALATED'].includes(record.status) : filter === 'Closed' ? !isOpenAlert(record.status) : true).sort((first, second) => {
    if (sort === 'eta') return (first.eta ?? Infinity) - (second.eta ?? Infinity);
    if (sort === 'confidence') return second.confidence - first.confidence;
    if (sort === 'recency') return Date.parse(second.lastUpdated) - Date.parse(first.lastUpdated);
    return (severityRank[second.severity] ?? 0) - (severityRank[first.severity] ?? 0) || Date.parse(second.lastUpdated) - Date.parse(first.lastUpdated);
  }), [records, filter, sort]);
  const unreviewed = records.filter(record => ['GENERATED', 'ACTIVE', 'ESCALATED'].includes(record.status)).length;
  function exportJournal() {
    const snapshot = useNowcastStore.getState().observedSnapshot;
    const blob = new Blob([JSON.stringify({ schemaVersion:'1.0', scenarioId:snapshot.scenarioId, observationTime:snapshot.observationTime,
      disclaimer:'Controlled review journal. Controlled scenario observations, unvalidated risk indices and no official warnings.', alerts:records }, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${snapshot.scenarioId}-alert-journal.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <div className={`alert-ledger ${compact ? 'compact-ledger' : ''}`}><div className="ledger-summary"><span><strong>{records.filter(record => isOpenAlert(record.status)).length}</strong> open</span><span><strong>{unreviewed}</strong> awaiting review</span><span><strong>{records.filter(record => !isOpenAlert(record.status)).length}</strong> closed / expired</span></div><div className="ledger-controls"><div className="ledger-filter" role="group" aria-label="Filter advisory journal">{['All', 'Open', 'Unreviewed', 'Closed'].map(option => <button className={filter === option ? 'active' : ''} key={option} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}</div><select aria-label="Sort advisory journal" value={sort} onChange={event => setSort(event.target.value)}><option value="severity">Severity</option><option value="eta">Earliest ETA</option><option value="confidence">Confidence</option><option value="recency">Latest update</option></select></div>
    <div className="ledger-records">{visible.map(record => <article className={`ledger-record ${record.status.toLowerCase()}`} key={record.alertId}><header><div><span className="eyebrow">{record.alertId}</span><h3><TriangleAlert size={14}/>{record.hazardType} · {record.severity}</h3></div><Badge tone={record.status === 'ACKNOWLEDGED' || record.status === 'RESOLVED' ? 'green' : record.status === 'ESCALATED' ? 'red' : 'amber'}>{record.status}</Badge></header><div className="ledger-telemetry"><span>Risk <strong>{number(record.risk)}/100</strong></span><span>Confidence <strong>{number(record.confidence)}%</strong></span><span>ETA <strong>{eta(record.eta)}</strong></span></div><div className="ledger-timestamps"><span>Generated {time(record.timestamp)} IST</span><span>Updated {time(record.lastUpdated)} IST</span></div><div className="ledger-actions"><button onClick={() => actions.inspect('alert', record.alertId)}><GitBranch size={12}/>Evidence & audit<ArrowRight size={12}/></button><button aria-label={`Focus storm for ${record.hazardType} advisory`} onClick={actions.focus}><Crosshair size={12}/>Map</button>{isOpenAlert(record.status) && <><button disabled={record.status === 'ACKNOWLEDGED' || mode === 'BACKEND'} onClick={() => actions.acknowledge(record.alertId)}><ShieldCheck size={12}/>{record.status === 'ACKNOWLEDGED' ? 'Reviewed' : 'Acknowledge'}</button><button disabled={mode === 'BACKEND'} onClick={() => actions.acknowledge(record.alertId, true)}>Resolve</button></>}</div></article>)}</div>
    {!visible.length && <div className="empty-state"><ShieldCheck size={22}/><strong>No advisories in this view</strong><span>Closed advisories remain inspectable. Rewinding reconstructs the journal for that replay branch.</span></div>}
    <div className="ledger-footnote"><span>{mode === 'BACKEND' ? 'Backend-authoritative status. Review endpoints not connected.' : 'Operator acknowledgment records review only—not an official warning.'}</span><button className="text-button" disabled={!records.length} onClick={exportJournal}>Export journal<ArrowRight size={12}/></button></div>
  </div>;
}
