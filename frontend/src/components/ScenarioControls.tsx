import { SlidersHorizontal, RotateCcw, ArrowRight } from 'lucide-react';
import { actions, useScenarioStore } from '../store';
import useNowcast from '../features/useNowcast';
import type { ScenarioParameters } from '../types/nowcast';
import { Panel, number } from './common';
const controls: { key: keyof ScenarioParameters; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key:'intensity',label:'Radar intensity',min:0,max:2,step:0.05,unit:'×' },
  { key:'lightning',label:'Lightning density',min:0,max:2,step:0.05,unit:'×' },
  { key:'velocity',label:'Storm velocity',min:5,max:90,step:1,unit:'km/h' },
  { key:'direction',label:'Storm bearing',min:0,max:180,step:1,unit:'°' },
  { key:'cooling',label:'Cloud cooling',min:0,max:2,step:0.05,unit:'×' },
  { key:'noise',label:'Radar noise',min:0,max:60,step:1,unit:'%' },
  { key:'radarQuality',label:'Radar quality',min:0,max:100,step:1,unit:'%' },
  { key:'satelliteQuality',label:'Satellite quality',min:0,max:100,step:1,unit:'%' },
  { key:'lightningQuality',label:'Lightning quality',min:0,max:100,step:1,unit:'%' },
  { key:'confidenceThreshold',label:'Confidence gate',min:20,max:95,step:1,unit:'%' },
  { key:'warningThreshold',label:'High-risk threshold',min:35,max:95,step:1,unit:'/100' },
];
export default function ScenarioControls({ compact = false }: { compact?: boolean }) {
  const parameters = useScenarioStore(state => state.parameters);
  const snapshot = useNowcast();
  return <Panel title="SCENARIO PARAMETERS" eyebrow="CAUSE → EFFECT" action={<SlidersHorizontal size={16}/>} className="judge-panel"><p className="muted">Adjust a controlled input and inspect the recomputed evidence, risk and forecast.</p><div className={compact ? 'control-grid compact' : 'control-grid'}>{controls.filter((_,index) => !compact || [0,1,2,8].includes(index)).map(control => <label className="slider-control" key={control.key}><span>{control.label}<strong>{number(parameters[control.key],control.step < 1 ? 2 : 0)} <small>{control.unit}</small></strong></span><input type="range" min={control.min} max={control.max} step={control.step} value={parameters[control.key]} onChange={event => actions.adjust(control.key,Number(event.target.value))}/></label>)}</div><div className="causal-strip"><span>INPUT</span><ArrowRight size={12}/><span>FUSION {number(snapshot.fusion.signal)}</span><ArrowRight size={12}/><span>RISK {number(snapshot.hazards[0].risk)}</span><ArrowRight size={12}/><span>{snapshot.alerts.length} ALERTS</span></div><button className="subtle-button" onClick={actions.reset}><RotateCcw size={13}/>Restore scenario parameters</button></Panel>;
}
