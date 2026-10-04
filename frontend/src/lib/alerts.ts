import type { AlertRecord, AlertStatus, NowcastState } from '../types/nowcast';
export const severityRank: Record<string, number> = { LOW: 1, MODERATE: 2, HIGH: 3, SEVERE: 4, CRITICAL: 5 };
export const isOpenAlert = (status: AlertStatus) => !['RESOLVED', 'EXPIRED'].includes(status);
export function reconcileAlerts(previous: Record<string, AlertRecord>, snapshot: NowcastState): Record<string, AlertRecord> {
  if (snapshot.mode === 'BACKEND') return Object.fromEntries(snapshot.alerts.map(alert => [alert.alertId, {
    ...alert, lastUpdated: snapshot.timestamp, qualified: isOpenAlert(alert.status),
    risk: snapshot.hazards.find(hazard => hazard.type === alert.hazardType)?.risk ?? 0,
    eta: snapshot.storm.eta, originTrace: previous[alert.alertId]?.originTrace ?? alert.trace,
  }]));
  const next = { ...previous };
  const incomingIds = new Set(snapshot.alerts.map(alert => alert.alertId));
  for (const alert of snapshot.alerts) {
    const existing = previous[alert.alertId];
    const risk = snapshot.hazards.find(hazard => hazard.type === alert.hazardType)?.risk ?? 0;
    if (!existing) {
      next[alert.alertId] = { ...alert, status: 'ACTIVE', lastUpdated: snapshot.timestamp, qualified: true, risk, eta: snapshot.storm.eta, originTrace: alert.trace,
        audit: [{ time: snapshot.timestamp, action: 'GENERATED · controlled evidence met the confidence and risk gates' }, { time: snapshot.timestamp, action: 'ACTIVE · pending controlled operator review' }] };
      continue;
    }
    const escalated = (severityRank[alert.severity] ?? 0) > (severityRank[existing.severity] ?? 0);
    const reactivated = !existing.qualified;
    const downgraded = (severityRank[alert.severity] ?? 0) < (severityRank[existing.severity] ?? 0);
    const status = escalated ? 'ESCALATED' : reactivated ? 'ACTIVE' : existing.status;
    const audit = [...existing.audit];
    if (reactivated) audit.push({ time: snapshot.timestamp, action: 'REACTIVATED · evidence again meets the configured gates' });
    if (escalated) audit.push({ time: snapshot.timestamp, action: `ESCALATED · ${existing.severity} → ${alert.severity}; review required again` });
    if (downgraded) audit.push({ time: snapshot.timestamp, action: `DOWNGRADED · ${existing.severity} → ${alert.severity}` });
    next[alert.alertId] = { ...alert, timestamp: existing.timestamp, status, lastUpdated: snapshot.timestamp, qualified: true, risk, eta: snapshot.storm.eta, originTrace: existing.originTrace, audit: audit.slice(-80) };
  }
  for (const existing of Object.values(previous)) {
    if (incomingIds.has(existing.alertId) || !existing.qualified) continue;
    const hazard = snapshot.hazards.find(item => item.type === existing.hazardType);
    const expired = hazard?.severity === 'REVIEW';
    next[existing.alertId] = { ...existing, qualified: false, status: expired ? 'EXPIRED' : 'RESOLVED', lastUpdated: snapshot.timestamp,
      risk: hazard?.risk ?? existing.risk, confidence: hazard?.confidence ?? existing.confidence, eta: snapshot.storm.eta,
      audit: [...existing.audit, { time: snapshot.timestamp, action: expired ? 'EXPIRED · insufficient evidence / confidence gate failed; not an all-clear' : 'RESOLVED · risk fell below the scenario advisory gate' }].slice(-80) };
  }
  return next;
}
