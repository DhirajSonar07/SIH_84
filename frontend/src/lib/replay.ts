import type { NowcastState, ProviderRequest, ScenarioIntervention, ScenarioParameters, StormHistoryPoint } from '../types/nowcast';
import type LocalReplayProvider from '../providers/LocalReplayProvider';
export function parametersAt(minute: number, initial: ScenarioParameters, interventions: ScenarioIntervention[]) {
  return [...interventions].reverse().find(event => event.minute <= minute)?.parameters ?? initial;
}
export function replayFrames(provider: LocalReplayProvider, request: ProviderRequest) {
  const points = new Set([0, request.minute]);
  for (let minute = 5; minute < request.minute; minute += 5) points.add(minute);
  request.interventions?.filter(event => event.minute <= request.minute).forEach(event => points.add(event.minute));
  return [...points].sort((first, second) => first - second).map(minute => provider.getSnapshot({ ...request, minute, lead: 0,
    parameters: parametersAt(minute, request.initialParameters ?? request.parameters, request.interventions ?? []) }));
}
export function historyPoint(snapshot: NowcastState): StormHistoryPoint {
  return { minute: snapshot.minute, timestamp: snapshot.timestamp, reflectivity: snapshot.storm.intensity, area: snapshot.storm.area,
    lightning: snapshot.sources[2].metrics[0].value, cooling: snapshot.sources[1].metrics[1].value, speed: snapshot.storm.speed,
    growth: snapshot.storm.growth, confidence: snapshot.fusion.confidence, signal: snapshot.fusion.signal, state: snapshot.storm.state };
}
export function advectedPosition(request: ProviderRequest, futureMinute: number) {
  let longitude = 73.4, latitude = 18.36, previousMinute = 0;
  let parameters = request.initialParameters ?? request.parameters;
  const move = (minutes: number) => {
    const bearing = parameters.direction * Math.PI / 180;
    longitude += Math.sin(bearing) * parameters.velocity * minutes / 60 / 105;
    latitude += Math.cos(bearing) * parameters.velocity * minutes / 60 / 111;
  };
  for (const event of request.interventions ?? []) {
    if (event.minute > Math.min(request.minute, futureMinute)) break;
    move(event.minute - previousMinute);
    previousMinute = event.minute;
    parameters = event.parameters;
  }
  move(futureMinute - previousMinute);
  return { longitude, latitude };
}
