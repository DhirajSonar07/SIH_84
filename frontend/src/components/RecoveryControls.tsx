import { LifeBuoy, RotateCcw, ShieldCheck, Database, ArrowRight } from 'lucide-react';
import { actions, useNowcastStore, useScenarioStore } from '../store';
import { Panel, Badge, number } from './common';
import { backendJsonSchema } from '../lib/snapshotSchema';
export default function RecoveryControls() {
  const connection = useNowcastStore(state => state.connection);
  const stable = useNowcastStore(state => state.stableRequest);
  const mode = useScenarioStore(state => state.mode);
  function exportSchema() {
    const blob = new Blob([JSON.stringify(backendJsonSchema(),null,2)],{ type:'application/schema+json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href=url; anchor.download='nowcast.schema.json'; anchor.click(); URL.revokeObjectURL(url);
  }
  return <div className="two-grid"><Panel title="DEMO RECOVERY / SAFE OPERATIONS" action={<LifeBuoy size={16}/>}><div className="recovery-state"><Badge tone={mode === 'BACKEND' ? 'cyan' : 'green'}>{connection}</Badge><p className="muted">Last stable local checkpoint: {stable.scenarioId} · T+{number(stable.minute)} min. Recovery actions explicitly leave backend mode.</p></div><div className="recovery-actions"><button className="subtle-button" onClick={() => actions.selectScenario('SC-001')}><RotateCcw size={13}/>Load primary scenario</button><button className="subtle-button" onClick={actions.restoreStable}><Database size={13}/>Restore stable local state</button><button className="subtle-button" onClick={actions.safeState}><ShieldCheck size={13}/>Load safe state / T+0</button></div><p className="muted">Safe state, reset and rewind clear operator review actions. They do not erase scientific uncertainty or claim an operational all-clear.</p></Panel><Panel title="BACKEND CONTRACT / RUNTIME GATE" action={<Badge>SCHEMA 1.0</Badge>}><div className="causal-vertical"><div><ShieldCheck size={14}/>Deep validation of sources, evidence, risks, coordinates, timestamps and alerts</div><div><ShieldCheck size={14}/>Duplicate / out-of-order rejection and REST recovery of sequence gaps</div><div><ShieldCheck size={14}/>Bounded reconnect attempts, then explicit local replay fallback</div></div><p className="muted">WebSocket messages are complete schema-1.0 snapshots, not partial deltas. Sequences must increase monotonically within an engine stream; same-sequence REST recovery leaves the current snapshot untouched.</p><button className="text-button" onClick={exportSchema}>Download JSON Schema contract<ArrowRight size={13}/></button></Panel></div>;
}
