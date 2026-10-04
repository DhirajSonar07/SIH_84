import { z } from 'zod';
const percentage = z.number().min(0).max(100);
const nonnegative = z.number().min(0);
const timestamp = z.iso.datetime();
const sourceName = z.enum(['DWR RADAR', 'INSAT-3DR', 'LIGHTNING']);
const hazardType = z.enum(['Lightning', 'Hail', 'Downburst', 'Cloudburst']);
const evidence = z.object({ source: sourceName, feature: z.string().min(1), value: z.number(), unit: z.string(), frameId: z.string().min(1), quality: percentage, derivation: z.string() });
const trace = z.object({ stage: z.string().min(1), detail: z.string() });
const quality = z.object({ coverage: percentage, completeness: percentage, freshness: percentage, alignment: percentage, score: percentage, state: z.enum(['GOOD', 'DEGRADED', 'FAILED']) });
const source = z.object({ name: sourceName, frameId: z.string().min(1), timestamp, quality, signal: percentage, contribution: percentage, latency: nonnegative,
  metrics: z.array(z.object({ label: z.string().min(1), value: z.number(), unit: z.string() })).min(3).max(32) });
const trajectory = z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), leadMinutes: nonnegative.max(360), uncertaintyKm: nonnegative });
const storm = z.object({ id: z.string().min(1), longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), intensity: z.number(), area: nonnegative,
  growth: z.number(), speed: nonnegative, direction: z.number().min(0).max(360), confidence: percentage,
  state: z.enum(['NORMAL', 'WATCH', 'INITIATING', 'ACTIVE', 'SEVERE', 'DISSIPATING']), distance: nonnegative, eta: nonnegative.nullable(), trajectory: z.array(trajectory).min(1).max(128),
  observedTrack: z.array(z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), minute: nonnegative })).max(128).optional(), hazards: z.array(hazardType).optional() });
const hazard = z.object({ type: hazardType, risk: percentage, confidence: percentage, severity: z.string().min(1), evidence: z.array(evidence).max(32),
  forecast: z.array(z.object({ minute: nonnegative.max(360), risk: percentage, confidence: percentage })).min(1).max(128) });
const alert = z.object({ alertId: z.string().min(1), scenarioId: z.string().min(1), stormCellId: z.string().min(1), hazardType, timestamp, severity: z.string().min(1), confidence: percentage,
  status: z.enum(['GENERATED', 'ACTIVE', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'EXPIRED']), trace: z.array(trace).min(1).max(32), audit: z.array(z.object({ time: timestamp, action: z.string() })).max(200) });
const revision = z.object({ previousEta: nonnegative.nullable(), eta: nonnegative.nullable(), previousRisk: percentage, risk: percentage, previousConfidence: percentage, confidence: percentage, reason: z.string() });
const inference = z.object({
  predictionId: z.string().min(1), modelId: z.string().min(1), modelVersion: z.string().min(1),
  inputWindow: z.string().min(1), featuresUsed: z.array(z.string().min(1)),
  convectiveProbability: percentage, modelConfidence: percentage, latencyMs: nonnegative,
  horizonMinutes: nonnegative.max(360),
  featureVector: z.object({
    reflectivityMean: z.number(), reflectivityMax: z.number(), reflectivityGradient: z.number(),
    cloudTopTemperature: z.number(), cloudCoolingRate: z.number(), lightningDensity: z.number(),
    lightningGrowth: z.number(), stormGrowthRate: z.number(), motionX: z.number(), motionY: z.number(),
    dataQuality: percentage, sourceAgreement: percentage, temporalConsistency: percentage, spatialConsistency: percentage,
  }),
});
export const nowcastSchema = z.object({
  schemaVersion: z.literal('1.0'), snapshotId: z.string().min(1).optional(), analysisTimestamp: timestamp.optional(), generatedAt: timestamp.optional(), sequence: z.number().int().nonnegative(), timestamp, observationTime: timestamp, processingTime: timestamp,
  mode: z.enum(['REPLAY', 'SIMULATION', 'BACKEND']), scenarioId: z.string().min(1), scenarioVersion: z.string().min(1), engineVersion: z.string().min(1), minute: nonnegative, lead: nonnegative.max(360),
  sources: z.array(source).length(3), storm, stormCells: z.array(storm).max(128).optional(), fusion: z.object({ signal: percentage, agreement: percentage, confidence: percentage, quality: percentage, weights: z.array(z.number().min(0).max(1)).length(3) }),
  hazards: z.array(hazard).length(4), alerts: z.array(alert).max(200), evidence: z.array(evidence).max(100),
  performance: z.object({ computationMs: nonnegative, frames: z.number().int().nonnegative(), stages: z.array(z.object({ name: z.string().min(1), status: z.string(), records: z.number().int().nonnegative() })).max(32) }),
  revision: revision.nullable(), truth: z.boolean(), inference: inference.nullable().optional(),
}).superRefine((snapshot, context) => {
  const names = ['DWR RADAR', 'INSAT-3DR', 'LIGHTNING'];
  if (snapshot.sources.some((item, index) => item.name !== names[index])) context.addIssue({ code: 'custom', path: ['sources'], message: 'Source order must be DWR, INSAT, LIGHTNING' });
  const hazards = ['Lightning', 'Hail', 'Downburst', 'Cloudburst'];
  if (snapshot.hazards.some((item, index) => item.type !== hazards[index])) context.addIssue({ code: 'custom', path: ['hazards'], message: 'Hazards must contain the four unique ordered outputs' });
  if (Date.parse(snapshot.observationTime) > Date.parse(snapshot.processingTime) || Date.parse(snapshot.processingTime) > Date.parse(snapshot.timestamp)) context.addIssue({ code: 'custom', path: ['timestamp'], message: 'Observation ≤ processing ≤ snapshot time required' });
  const weights = snapshot.fusion.weights.reduce((sum, value) => sum + value, 0);
  if (weights !== 0 && Math.abs(weights - 1) > 0.01) context.addIssue({ code: 'custom', path: ['fusion', 'weights'], message: 'Fusion weights must sum to one, or zero when unavailable' });
  const alertIds = new Set(snapshot.alerts.map(item => item.alertId));
  if (alertIds.size !== snapshot.alerts.length) context.addIssue({ code: 'custom', path: ['alerts'], message: 'Duplicate alert identifiers' });
  const cellIds = new Set([snapshot.storm.id, ...(snapshot.stormCells ?? []).map(cell => cell.id)]);
  snapshot.alerts.forEach((item, index) => {
    if (item.scenarioId !== snapshot.scenarioId || !cellIds.has(item.stormCellId)) context.addIssue({ code: 'custom', path: ['alerts', index], message: 'Alert origin must match the scenario and detected cells' });
  });
});
export function backendJsonSchema() { return z.toJSONSchema(nowcastSchema, { target: 'draft-2020-12' }); }
