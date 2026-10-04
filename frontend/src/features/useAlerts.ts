import { useMemo } from 'react';
import { selectAlertJournal, useNowcastStore } from '../store';
import { isOpenAlert, severityRank } from '../lib/alerts';
import type { AlertRecord } from '../types/nowcast';
export default function useAlerts() {
  const journal = useNowcastStore(selectAlertJournal);
  return useMemo(() => Object.values(journal), [journal]);
}
export function prioritizeAlerts(records: AlertRecord[]) {
  return [...records].sort((first, second) => Number(isOpenAlert(second.status)) - Number(isOpenAlert(first.status)) ||
    (severityRank[second.severity] ?? 0) - (severityRank[first.severity] ?? 0) || second.confidence - first.confidence);
}
