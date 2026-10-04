export type Mode = 'REPLAY' | 'SIMULATION' | 'BACKEND';
export type SourceName = 'DWR RADAR' | 'INSAT-3DR' | 'LIGHTNING';
export type HazardType = 'Lightning' | 'Hail' | 'Downburst' | 'Cloudburst';
export type ConvectiveState = 'NORMAL' | 'WATCH' | 'INITIATING' | 'ACTIVE' | 'SEVERE' | 'DISSIPATING';
export interface DataQuality { coverage: number; completeness: number; freshness: number; alignment: number; score: number; state: 'GOOD' | 'DEGRADED' | 'FAILED'; }
export interface SourceState { name: SourceName; frameId: string; timestamp: string; quality: DataQuality; signal: number; contribution: number; latency: number; metrics: { label: string; value: number; unit: string }[]; }
export interface FeatureEvidence { source: SourceName; feature: string; value: number; unit: string; frameId: string; quality: number; derivation: string; }
export interface TrajectoryPoint { longitude: number; latitude: number; leadMinutes: number; uncertaintyKm: number; }
export interface StormCell { id: string; longitude: number; latitude: number; intensity: number; area: number; growth: number; speed: number; direction: number; confidence: number; state: ConvectiveState; distance: number; eta: number | null; trajectory: TrajectoryPoint[]; observedTrack?: { longitude: number; latitude: number; minute: number }[]; hazards?: HazardType[]; }
export interface HazardState { type: HazardType; risk: number; confidence: number; severity: string; evidence: FeatureEvidence[]; forecast: { minute: number; risk: number; confidence: number }[]; }
export interface FusionState { signal: number; agreement: number; confidence: number; quality: number; weights: number[]; }
export interface AlertTrace { stage: string; detail: string; }
export type AlertStatus = 'GENERATED' | 'ACTIVE' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED' | 'EXPIRED';
export interface AlertState { alertId: string; scenarioId: string; stormCellId: string; hazardType: HazardType; timestamp: string; severity: string; confidence: number; status: AlertStatus; trace: AlertTrace[]; audit: { time: string; action: string }[]; }
export interface AlertRecord extends AlertState { lastUpdated: string; qualified: boolean; risk: number; eta: number | null; originTrace: AlertTrace[]; }
export interface StormHistoryPoint { minute: number; timestamp: string; reflectivity: number; area: number; lightning: number; cooling: number; speed: number; growth: number; confidence: number; signal: number; state: ConvectiveState; }
export interface ProcessingStage { name: string; status: string; records: number; }
export interface ForecastRevision { previousEta: number | null; eta: number | null; previousRisk: number; risk: number; previousConfidence: number; confidence: number; reason: string; }
export interface PerformanceState { computationMs: number; frames: number; stages: ProcessingStage[]; }
export interface InferenceMetadata { predictionId: string; modelId: string; modelVersion: string; inputWindow: string; featuresUsed: string[]; convectiveProbability: number; modelConfidence: number; latencyMs: number; horizonMinutes: number; featureVector: { reflectivityMean: number; reflectivityMax: number; reflectivityGradient: number; cloudTopTemperature: number; cloudCoolingRate: number; lightningDensity: number; lightningGrowth: number; stormGrowthRate: number; motionX: number; motionY: number; dataQuality: number; sourceAgreement: number; temporalConsistency: number; spatialConsistency: number; }; }
export interface NowcastState { schemaVersion: '1.0'; snapshotId?: string; analysisTimestamp?: string; generatedAt?: string; sequence: number; timestamp: string; observationTime: string; processingTime: string; mode: Mode; scenarioId: string; scenarioVersion: string; engineVersion: string; minute: number; lead: number; sources: SourceState[]; storm: StormCell; stormCells?: StormCell[]; fusion: FusionState; hazards: HazardState[]; alerts: AlertState[]; evidence: FeatureEvidence[]; performance: PerformanceState; revision: ForecastRevision | null; truth: boolean; inference?: InferenceMetadata | null; }
export interface ScenarioParameters { intensity: number; lightning: number; velocity: number; cooling: number; noise: number; radarQuality: number; satelliteQuality: number; lightningQuality: number; confidenceThreshold: number; warningThreshold: number; direction: number; }
export interface Scenario { id: string; name: string; description: string; duration: number; seed: number; truth: boolean; parameters: Partial<ScenarioParameters>; }
export interface ScenarioIntervention { minute: number; parameters: ScenarioParameters; }
export interface ProviderRequest { scenarioId: string; minute: number; lead: number; parameters: ScenarioParameters; initialParameters?: ScenarioParameters; interventions?: ScenarioIntervention[]; }
export interface DistrictRisk { districtId: string; districtName: string; region: string; activeCells: string[]; highestHazard: HazardType | null; risk: number; confidence: number; eta: number | null; activeAlerts: number; }
export interface BackendMapState { region: 'Maharashtra'; scope: string; resolutionKm: number; districtRisks: DistrictRisk[]; regionalRisks: { region: string; activeCells: number; risk: number; activeAlerts: number }[]; }
