import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import rawBoundary from '../data/geo/maharashtra-districts.json';

export interface MaharashtraProperties {
  kind: 'state' | 'district';
  id: string;
  name: string;
  officialName?: string;
  districtCode?: string;
  censusCode?: string;
  state?: string;
}

export type MaharashtraFeature = Feature<Polygon | MultiPolygon, MaharashtraProperties>;
export type MaharashtraBoundary = FeatureCollection<Polygon | MultiPolygon, MaharashtraProperties>;

export const maharashtraBoundary = rawBoundary as unknown as MaharashtraBoundary;
export const stateFeature = maharashtraBoundary.features.find(feature => feature.properties.kind === 'state') as MaharashtraFeature;
export const districtFeatures = maharashtraBoundary.features.filter(feature => feature.properties.kind === 'district') as MaharashtraFeature[];

function visitCoordinates(coordinates: unknown, visit: (longitude: number, latitude: number) => void) {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    visit(coordinates[0], coordinates[1]);
    return;
  }
  coordinates.forEach(child => visitCoordinates(child, visit));
}

const bounds = { west: 180, south: 90, east: -180, north: -90 };
maharashtraBoundary.features.forEach(feature => visitCoordinates(feature.geometry.coordinates, (longitude, latitude) => {
  bounds.west = Math.min(bounds.west, longitude);
  bounds.south = Math.min(bounds.south, latitude);
  bounds.east = Math.max(bounds.east, longitude);
  bounds.north = Math.max(bounds.north, latitude);
}));

export const maharashtraBounds = bounds;

export const majorCities = [
  { name: 'MUMBAI', longitude: 72.8777, latitude: 19.076 },
  { name: 'PUNE', longitude: 73.8567, latitude: 18.5204 },
  { name: 'NAGPUR', longitude: 79.0882, latitude: 21.1458 },
  { name: 'NASHIK', longitude: 73.7898, latitude: 19.9975 },
  { name: 'CHH. SAMBHAJINAGAR', longitude: 75.3433, latitude: 19.8762 },
  { name: 'KOLHAPUR', longitude: 74.2433, latitude: 16.705 },
  { name: 'SOLAPUR', longitude: 75.9064, latitude: 17.6599 },
  { name: 'AMRAVATI', longitude: 77.7523, latitude: 20.9374 },
  { name: 'NANDED', longitude: 77.321, latitude: 19.1383 },
  { name: 'RATNAGIRI', longitude: 73.312, latitude: 16.9902 },
];

export function districtSearch(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return districtFeatures;
  return districtFeatures.filter(feature => feature.properties.name.toLowerCase().includes(normalized));
}