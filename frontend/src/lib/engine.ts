import { evolution, scenarios } from '../data/scenarios';
import type { NowcastState, ProviderRequest, SourceName, FeatureEvidence, HazardType } from '../types/nowcast';
import { advectedPosition } from './replay';
export const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
export function growthAt(minute: number) {
  const bounded = clamp(minute, 0, 240);
  const index = evolution.findIndex(point => point.minute >= bounded);
  if (index <= 0) return evolution[0].value;
  const before = evolution[index - 1], after = evolution[index];
  return before.value + (after.value - before.value) * (bounded - before.minute) / (after.minute - before.minute);
}
export function compute(request: ProviderRequest): NowcastState {
  const start = performance.now();
  const { parameters: inputs, scenarioId, minute, lead } = request;
  const scenario = scenarios.find(item => item.id === scenarioId) ?? scenarios[0];
  const futureMinute = minute + lead;
  let growth = growthAt(futureMinute);
  if (scenarioId === 'SC-007') growth *= Math.max(0.08, 1 - futureMinute / 110);
  if (scenarioId === 'SC-006') growth *= Math.max(0.05, 1 - futureMinute / 150);
  const radar = clamp(growth * inputs.intensity * 100);
  const satellite = clamp(growth * inputs.cooling * 100);
  const lightning = clamp(growth * inputs.lightning * 100);
  const qualities = [inputs.radarQuality, inputs.satelliteQuality, inputs.lightningQuality];
  const baseWeights = [0.42, 0.31, 0.27];
  const total = qualities.reduce((sum, quality, index) => sum + quality * baseWeights[index], 0);
  const weights = qualities.map((quality, index) => total > 0 ? quality * baseWeights[index] / total : 0);
  const signals = [radar, satellite, lightning];
  const signal = signals.reduce((sum, value, index) => sum + value * weights[index], 0) * (1 - inputs.noise / 200);
  const availableSignals = signals.filter((_, index) => qualities[index] > 0);
  const agreement = availableSignals.length > 1 ? clamp(100 - Math.max(...availableSignals) + Math.min(...availableSignals) - inputs.noise) : 0;
  const confidence = clamp(total * (0.35 + agreement * 0.0065) * (1 - lead / 600) - inputs.noise * 0.2);
  const state = futureMinute > 185 ? 'DISSIPATING' : signal > 74 ? 'SEVERE' : signal > 48 ? 'ACTIVE' : signal > 32 ? 'INITIATING' : signal > 17 ? 'WATCH' : 'NORMAL';
  const time = new Date(Date.UTC(2026, 5, 15, 9, 0) + minute * 60000).toISOString();
  const bearing = inputs.direction * Math.PI / 180;
  const { longitude, latitude } = advectedPosition(request, futureMinute);
  const trackStart = Math.max(0, minute - 30);
  const trackMinutes = new Set([trackStart, Math.max(0, minute - 15), minute]);
  request.interventions?.filter(event => event.minute >= trackStart && event.minute <= minute).forEach(event => trackMinutes.add(event.minute));
  const observedTrack = [...trackMinutes].sort((first, second) => first - second).map(trackMinute => ({ ...advectedPosition(request, trackMinute), minute: trackMinute }));
  const east = (73.8567 - longitude) * 105, north = (18.5204 - latitude) * 111;
  const along = east * Math.sin(bearing) + north * Math.cos(bearing);
  const cross = Math.abs(east * Math.cos(bearing) - north * Math.sin(bearing));
  const eta = along >= 0 && cross < 12 && inputs.velocity > 0 ? along / inputs.velocity * 60 : null;
  const names: SourceName[] = ['DWR RADAR', 'INSAT-3DR', 'LIGHTNING'];
  const featureValues = [18 + radar * 0.45, -22 - satellite * 0.48, Math.round(lightning * 0.48)];
  const features = ['Reflectivity', 'Cloud-top temperature', 'Strike rate'];
  const units = ['dBZ', '°C', '/min'];
  const evidence: FeatureEvidence[] = names.map((source, index) => ({ source, feature: features[index], value: featureValues[index], unit: units[index], frameId: `${scenarioId}-${index}-${Math.round(minute * 10)}`, quality: qualities[index], derivation: ['18 + radar signal × 0.45', '−22 − cooling signal × 0.48', 'round(lightning signal × 0.48)'][index] }));
  const risks = [lightning * 0.85 + radar * 0.15, radar * 0.6 + satellite * 0.4, radar * 0.55 + clamp(inputs.velocity * 1.3) * growth * 0.45, radar * 0.6 + satellite * 0.25 + clamp(80 - inputs.velocity) * growth * 0.15];
  const hazardNames: HazardType[] = ['Lightning', 'Hail', 'Downburst', 'Cloudburst'];
  const severity = (risk: number) => risk >= 85 ? 'SEVERE' : risk >= inputs.warningThreshold ? 'HIGH' : risk >= 35 ? 'MODERATE' : 'LOW';
  const hazards = hazardNames.map((type, index) => {
    const relevantQuality = index === 0 ? inputs.lightningQuality : index === 1 ? Math.min(inputs.radarQuality, inputs.satelliteQuality) : inputs.radarQuality;
    const hazardConfidence = confidence * (0.5 + relevantQuality / 200);
    const risk = clamp(risks[index] * (0.75 + relevantQuality / 400));
    return { type, risk, confidence: hazardConfidence, severity: hazardConfidence < inputs.confidenceThreshold ? 'REVIEW' : severity(risk), evidence: index === 0 ? [evidence[2], evidence[0]] : [evidence[0], evidence[1]], forecast: [0, 15, 30, 60, 120, 180, 360].map(forecastLead => ({ minute: forecastLead, risk: clamp(risk * growthAt(futureMinute + forecastLead) / Math.max(0.08, growth)), confidence: clamp(hazardConfidence * (1 - forecastLead / 600)) })) };
  });
  const alerts = hazards.filter(hazard => hazard.risk > 35 && hazard.confidence >= inputs.confidenceThreshold).map(hazard => ({ alertId: `${scenarioId}-${hazard.type.toUpperCase()}-017`, scenarioId, stormCellId: 'CELL-017', hazardType: hazard.type, timestamp: time, severity: hazard.severity, confidence: hazard.confidence, status: 'ACTIVE' as const, trace: [
    { stage: '01 / SOURCE', detail: hazard.evidence.map(item => `${item.source} frame ${item.frameId}: ${item.value.toFixed(1)} ${item.unit}`).join(' · ') },
    { stage: '02 / QUALITY', detail: `Weighted source quality ${total.toFixed(1)}%. Missing inputs reduce confidence; no imputed observations.` },
    { stage: '03 / FEATURE', detail: hazard.evidence.map(item => `${item.feature}: ${item.derivation}`).join(' · ') },
    { stage: '04 / FUSION', detail: `Quality-adjusted weights ${weights.map(value => `${Math.round(value * 100)}%`).join(' / ')}; agreement ${agreement.toFixed(1)}%; fused signal ${signal.toFixed(1)}.` },
    { stage: '05 / DETECTION & TRACK', detail: `${state}; ${inputs.velocity} km/h at ${inputs.direction}°. Linear controlled advection, not a meteorological tracking model.` },
    { stage: '06 / HAZARD', detail: `${hazard.type} illustrative risk index ${hazard.risk.toFixed(1)}/100; confidence ${hazard.confidence.toFixed(1)}%. Engine heuristic-1.0.` },
    { stage: '07 / DECISION', detail: `Risk >35; confidence ≥${inputs.confidenceThreshold}%. High threshold ${inputs.warningThreshold}. Pending human review; not an official warning.` },
  ], audit: [{ time, action: 'System-generated scenario advisory' }] }));
  const stageNames = ['Ingestion', 'Quality gate', 'Alignment', 'Features', 'Fusion', 'Detection', 'Tracking', 'Hazards', 'Nowcast', 'Alert'];
  return { schemaVersion: '1.0', sequence: Math.round(minute * 10), timestamp: time, observationTime: time, processingTime: time, mode: 'REPLAY', scenarioId, scenarioVersion: '1.0', engineVersion: 'heuristic-1.0', minute, lead,
    sources: names.map((name, index) => ({ name, frameId: evidence[index].frameId, timestamp: time, signal: signals[index], contribution: weights[index] * 100, latency: 0, quality: { coverage: qualities[index], completeness: qualities[index], freshness: 100, alignment: 100, score: qualities[index], state: qualities[index] === 0 ? 'FAILED' : qualities[index] < 75 ? 'DEGRADED' : 'GOOD' }, metrics: [
      { label: features[index], value: featureValues[index], unit: units[index] },
      index === 0 ? { label: 'Radial velocity proxy', value: inputs.velocity / 3.6, unit: 'm/s' } : index === 1 ? { label: 'Cloud cooling', value: -satellite * 0.085, unit: '°C/15m' } : { label: 'Density', value: lightning * 0.045, unit: '/km²' },
      { label: 'Coverage', value: qualities[index], unit: '%' },
    ] })),
    storm: { id: 'CELL-017', longitude, latitude, intensity: featureValues[0], area: 24 + radar * 1.25, growth: futureMinute > 180 ? -32 : radar * 0.4, speed: inputs.velocity, direction: inputs.direction, confidence, state, observedTrack, distance: Math.hypot(east, north), eta, trajectory: [0, 15, 30, 60, 120, 180, 360].map(leadMinutes => ({ longitude: longitude + Math.sin(bearing) * inputs.velocity * leadMinutes / 60 / 105, latitude: latitude + Math.cos(bearing) * inputs.velocity * leadMinutes / 60 / 111, leadMinutes, uncertaintyKm: 1.5 + (100 - confidence) * 0.05 + leadMinutes * 0.035 })) },
    fusion: { signal, agreement, confidence, quality: total, weights }, hazards, alerts, evidence, truth: scenario.truth && growth > 0.35,
    performance: { computationMs: performance.now() - start, frames: Math.floor(minute) + 1, stages: stageNames.map(name => ({ name, status: total === 0 ? 'ABSTAIN' : total < 65 ? 'DEGRADED' : 'READY', records: name === 'Ingestion' ? qualities.filter(value => value > 0).length : evidence.filter(item => item.quality > 0).length })) }, revision: null };
}
