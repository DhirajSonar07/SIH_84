import type { FeatureCollection, Feature, Geometry } from 'geojson';
import type { NowcastState } from '../types/nowcast';
export const towns = [ { name: 'PUNE', longitude: 73.8567, latitude: 18.5204 }, { name: 'Pimpri-Chinchwad', longitude: 73.79, latitude: 18.63 }, { name: 'Hinjawadi', longitude: 73.735, latitude: 18.595 }, { name: 'Wagholi', longitude: 73.98, latitude: 18.58 }, { name: 'Kothrud', longitude: 73.805, latitude: 18.51 }, { name: 'Hadapsar', longitude: 73.932, latitude: 18.497 }, { name: 'Pirangut', longitude: 73.68, latitude: 18.51 }, { name: 'Mulshi', longitude: 73.52, latitude: 18.51 }, { name: 'Saswad', longitude: 74.03, latitude: 18.34 }, { name: 'Talegaon', longitude: 73.68, latitude: 18.73 } ];
const line = (coordinates: number[][], kind: string): Feature => ({ type: 'Feature', properties: { kind }, geometry: { type: 'LineString', coordinates } });
const polygon = (coordinates: number[][], properties: Record<string, string | number>): Feature => ({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [coordinates] } });
export function ellipse(longitude: number, latitude: number, radius: number, phase = 0, irregularity = 0.1) {
  return Array.from({ length: 65 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 5 + phase) * irregularity + Math.cos(angle * 9) * (irregularity * 0.5);
    return [longitude + Math.cos(angle) * radius / 105 * wobble, latitude + Math.sin(angle) * radius / 111 * 0.7 * wobble];
  });
}
const roads = [ [[73.4, 18.51], [73.61,18.52], [73.74,18.5], [73.86,18.52], [74.05,18.57], [74.25,18.6]], [[73.6,18.85],[73.7,18.73],[73.79,18.64],[73.86,18.52],[73.97,18.42],[74.1,18.28]], [[73.45,18.29],[73.64,18.4],[73.8,18.47],[73.9,18.52],[73.95,18.69]], [[73.75,18.7],[73.74,18.59],[73.76,18.5],[73.81,18.44],[73.91,18.43],[74.05,18.5],[74.06,18.62]] ];
export const baseGeography: FeatureCollection = { type: 'FeatureCollection', features: [
  ...roads.map(coordinates => line(coordinates, 'road')),
  line([[73.44,18.55],[73.52,18.57],[73.64,18.52],[73.71,18.53],[73.8,18.52],[73.88,18.54],[73.91,18.53],[74.02,18.48],[74.2,18.46]], 'river'),
  ...Array.from({ length: 22 }, (_, index) => polygon(ellipse(73.36 + index % 5 * 0.055, 18.25 + Math.floor(index / 5) * 0.135, 5 + index % 4 * 2, index), { kind: 'terrain', opacity: 0.3 })),
  ...towns.map(town => polygon(ellipse(town.longitude, town.latitude, town.name === 'PUNE' ? 8 : 3), { kind: 'urban' })),
  ...Array.from({ length: 51 }, (_, index) => line([[73.35 + index * 2/105,18.2],[73.35 + index * 2/105,18.85]], 'grid')),
  ...Array.from({ length: 37 }, (_, index) => line([[73.35,18.2 + index * 2/111],[74.3,18.2 + index * 2/111]], 'grid')),
] };
export function stormGeography(snapshot: NowcastState): FeatureCollection {
  const cells = snapshot.stormCells?.length ? snapshot.stormCells : [snapshot.storm];
  const features: Feature<Geometry>[] = [];
  const colors = ['#087377','#159887','#57bc64','#bec642','#f8b53d','#f47731','#e3423b','#bf3e69'];
  cells.forEach((storm, cellIndex) => {
    const radius = Math.sqrt(storm.area / Math.PI);
    // Scenario coverage is regional by design; it is not an assertion of a real DWR footprint.
    const radarRange = Math.min(250, Math.max(150, radius * 12));
    const phase = snapshot.minute * 0.1;
    
    // Radar field with multiple concentric rings showing intensity gradients
    for (let index = 0; index < 8; index++) {
      const ringRadius = radarRange * (1 - index * 0.1);
      const ringIrregularity = 0.15 + index * 0.02;
      features.push(polygon(ellipse(storm.longitude, storm.latitude, ringRadius, phase + index * 0.5, ringIrregularity), {
        kind: 'radar',
        cellId: storm.id,
        color: colors[(cellIndex + index) % colors.length],
        opacity: 0.15 + index * 0.03
      }));
    }
    
    // Satellite cloud envelope (larger than radar)
    features.push(polygon(ellipse(storm.longitude, storm.latitude, radarRange * 1.4, phase, 0.2), {
      kind: 'satellite',
      cellId: storm.id,
      color: '#c8d9ee',
      opacity: 0.1
    }));
    
    const trajectory = storm.trajectory;
    const observed = storm.observedTrack?.map(point => [point.longitude, point.latitude]) ?? [];
    const forecastOrigin = observed.length ? [observed[observed.length - 1]] : [];
    features.push(line([...forecastOrigin, ...trajectory.map(point => [point.longitude, point.latitude])], 'trajectory'));
    if (observed.length > 1) features.push(line(observed, 'observed'));
    features.push(polygon([...trajectory.map(point => [point.longitude, point.latitude + point.uncertaintyKm / 111]), ...[...trajectory].reverse().map(point => [point.longitude, point.latitude - point.uncertaintyKm / 111]), [trajectory[0].longitude, trajectory[0].latitude + trajectory[0].uncertaintyKm / 111]], { kind: 'uncertainty', cellId: storm.id }));
    const hazard = snapshot.hazards[0];
    features.push(polygon(ellipse(storm.longitude + 0.04, storm.latitude + 0.01, radius * (1 + (hazard?.risk ?? 0) / 100), phase, 0.08), { kind: 'hazard', cellId: storm.id }));
    
    // Lightning distributed across the radar field - deterministic placement based on storm state
    const lightningCount = Math.round((snapshot.sources[2].signal * (storm.intensity / 100)) * 0.25);
    for (let index = 0; index < lightningCount; index++) {
      // Deterministic seed: use minute + cellIndex + index to make placement stable
      const seed = (snapshot.minute * 31 + cellIndex * 97 + index * 53) % 1000 / 1000;
      const seed2 = ((snapshot.minute * 53 + cellIndex * 31 + index * 97) % 1000) / 1000;
      const angle = (index / lightningCount) * Math.PI * 2;
      const distance = radarRange * 0.6 * (0.3 + seed * 0.7);
      features.push({
        type: 'Feature',
        properties: { kind: 'lightning', cellId: storm.id },
        geometry: {
          type: 'Point',
          coordinates: [
            storm.longitude + Math.cos(angle + seed2 * 0.5) * distance / 105,
            storm.latitude + Math.sin(angle + seed2 * 0.5) * distance / 111 * 0.7
          ]
        }
      });
    }

    
    features.push({ type: 'Feature', properties: { kind: 'core', cellId: storm.id }, geometry: { type: 'Point', coordinates: [storm.longitude, storm.latitude] } });
  });
  const cellsById = new Map(cells.map(cell => [cell.id, cell]));
  snapshot.alerts.forEach(alert => { const storm = cellsById.get(alert.stormCellId) ?? snapshot.storm; features.push({ type: 'Feature', properties: { kind: 'alert', alertId: alert.alertId, cellId: storm.id, severity: alert.severity }, geometry: { type: 'Point', coordinates: [storm.longitude, storm.latitude] } }); });
  return { type: 'FeatureCollection', features };
}
