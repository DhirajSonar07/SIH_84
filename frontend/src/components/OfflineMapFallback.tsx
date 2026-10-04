import type { Feature, Geometry } from 'geojson';
import { districtFeatures, majorCities, maharashtraBounds, stateFeature } from '../lib/maharashtra';
import { stormGeography } from '../lib/geography';
import type { NowcastState } from '../types/nowcast';
import { actions } from '../store';

type FallbackFeature = Feature<Geometry, any>;
const width = 1000;
const height = 650;
const padding = 24;

function project(longitude: number, latitude: number) {
  const x = padding + ((longitude - maharashtraBounds.west) / (maharashtraBounds.east - maharashtraBounds.west)) * (width - padding * 2);
  const y = height - padding - ((latitude - maharashtraBounds.south) / (maharashtraBounds.north - maharashtraBounds.south)) * (height - padding * 2);
  return `${x},${y}`;
}

function pathForGeometry(geometry: Geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates.map(ring => `${ring.map(([longitude, latitude]) => project(longitude, latitude)).join(' ')} Z`).join(' ');
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap(polygon => polygon.map(ring => `${ring.map(([longitude, latitude]) => project(longitude, latitude)).join(' ')} Z`)).join(' ');
  if (geometry.type === 'LineString') return geometry.coordinates.map(([longitude, latitude]) => project(longitude, latitude)).join(' ');
  return '';
}

function renderFeature(feature: FallbackFeature, index: number, layers: Record<string, boolean>) {
  const kind = String(feature.properties?.kind ?? '');
  if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
    return <path key={`${kind}-${index}`} d={pathForGeometry(feature.geometry)} fill={kind === 'state' ? '#18323b' : '#142c36'} fillOpacity={kind === 'state' ? 0.8 : 0.46} stroke={kind === 'state' ? '#76c9c2' : '#526d78'} strokeWidth={kind === 'state' ? 2 : 0.7} onClick={kind === 'district' ? () => actions.inspect('location', String(feature.properties?.name ?? 'District')) : undefined}/>;
  }
  if (feature.geometry.type === 'LineString') return <polyline key={`${kind}-${index}`} points={pathForGeometry(feature.geometry)} fill="none" stroke={kind === 'observed' ? '#50babc' : '#72e1db'} strokeWidth={2} strokeDasharray={kind === 'observed' ? undefined : '6 5'} opacity={layers.Trajectory ? 1 : 0}/>;
  if (feature.geometry.type === 'Point') {
    const [longitude, latitude] = feature.geometry.coordinates;
    return <circle key={`${kind}-${index}`} cx={project(longitude, latitude).split(',')[0]} cy={project(longitude, latitude).split(',')[1]} r={kind === 'core' ? 8 : kind === 'alert' ? 10 : 2.5} fill={kind === 'alert' ? '#ec6d4e' : kind === 'core' ? '#fa7c59' : '#ffe18c'} stroke={kind === 'core' ? 'white' : kind === 'alert' ? '#ffb18b' : 'none'} strokeWidth={kind === 'core' || kind === 'alert' ? 2 : 0} opacity={kind === 'lightning' && !layers.Lightning ? 0 : 1} onClick={kind === 'core' || kind === 'alert' ? () => actions.inspect(kind === 'alert' ? 'alert' : 'storm') : undefined}/>;
  }
  return null;
}

export default function OfflineMapFallback({ snapshot, layers }: { snapshot: NowcastState; layers: Record<string, boolean>; zoom: number }) {
  const stormFeatures = stormGeography(snapshot).features as FallbackFeature[];
  return <svg className="map-fallback" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Offline Maharashtra administrative map with backend storm overlays">
    {layers.Districts !== false && renderFeature(stateFeature as FallbackFeature, 0, layers)}
    {layers.Districts !== false && districtFeatures.map((feature, index) => renderFeature(feature as FallbackFeature, index + 1, layers))}
    {majorCities.map(city => <text key={city.name} x={project(city.longitude, city.latitude).split(',')[0]} y={project(city.longitude, city.latitude).split(',')[1]} fill={city.name === 'PUNE' || city.name === 'MUMBAI' ? '#ecf4fa' : '#9cb2c2'} fontSize={city.name === 'PUNE' || city.name === 'MUMBAI' ? 14 : 10}>{city.name}</text>)}
    {stormFeatures.filter(feature => feature.properties?.kind !== 'radar' || layers.Radar).filter(feature => feature.properties?.kind !== 'hazard' || layers.Hazards).filter(feature => feature.properties?.kind !== 'satellite' || layers.Satellite).map((feature, index) => renderFeature(feature, index + 100, layers))}
  </svg>;
}
