import type { ReactNode } from 'react';
import { ChevronRight, CircleHelp } from 'lucide-react';
export function Panel({ title, eyebrow, action, children, className = '' }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><header className="panel-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</header>{children}</section>;
}
export function Badge({ children, tone = 'cyan' }: { children: ReactNode; tone?: string }) { return <span className={`badge ${tone}`}><span className="status-dot" />{children}</span>; }
export function Metric({ label, value, unit, tone = '' }: { label: string; value: ReactNode; unit?: string; tone?: string }) { return <div className={`metric ${tone}`}><span className="label">{label}</span><strong>{value}<small>{unit}</small></strong></div>; }
export function InspectButton({ onClick, children = 'Inspect' }: { onClick: () => void; children?: ReactNode }) { return <button className="text-button" onClick={onClick}>{children}<ChevronRight size={13}/></button>; }
export function Info({ text }: { text: string }) { return <span title={text} tabIndex={0} aria-label={text}><CircleHelp size={13}/></span>; }
export const number = (value: number, decimals = 0) => Number.isFinite(value) ? value.toFixed(decimals) : '—';
export const time = (value: string) => new Date(value).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
export function eta(value: number | null) { if (value === null) return '—'; const seconds = Math.max(0, Math.round(value * 60)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
