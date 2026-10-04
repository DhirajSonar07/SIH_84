import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { GeoJSONSource, Map as MapInstance } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Layers, Maximize2, Minus, Plus, Navigation, Search, X, MapPin } from 'lucide-react';
import { stormGeography } from '../lib/geography';
import { districtFeatures, districtSearch, getDistrictLabel, majorCities, maharashtraBounds, maharashtraBoundary } from '../lib/maharashtra';
import useNowcast from '../features/useNowcast';
import { actions, useMapStore } from '../store';
import type { BackendMapState } from '../types/nowcast';
import { API_BASE_URL } from '../lib/config';
import { number, Badge } from './common';
import OfflineMapFallback from './OfflineMapFallback';

setWorkerUrl(workerUrl);

function fitMaharashtra(instance: MapInstance, duration = 0) {
  const bounds = new LngLatBounds([maharashtraBounds.west, maharashtraBounds.south], [maharashtraBounds.east, maharashtraBounds.north]);
  instance.fitBounds(bounds, { padding: 42, duration });
}

export default function OperationsMap({ tall = false }: { tall?: boolean }) {
  const snapshot = useNowcast();
  const layers = useMapStore(state => state.layers);
  const focus = useMapStore(state => state.focus);
  const host = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const cellMarkers = useRef(new Map<string, Marker>());
  const cityMarkers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [layerPanel, setLayerPanel] = useState(false);
  const [districtQuery, setDistrictQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [backendMapState, setBackendMapState] = useState<BackendMapState | null>(null);
  const [zoom, setZoom] = useState(5.5);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    let instance: MapInstance | undefined;
    try {
      instance = new MapLibreMap({ container: host.current, center: [76.2, 19.2], zoom: 5.5, attributionControl: false, style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#101d29' } }] } });
      map.current = instance;
      instance.on('load', () => {
        if (!instance) return;
        instance.addControl(new ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-right');
        instance.addSource('maharashtra-admin', { type: 'geojson', data: maharashtraBoundary });
        instance.addSource('storm', { type: 'geojson', data: stormGeography(snapshot) });
        instance.addLayer({ id: 'state-fill', type: 'fill', source: 'maharashtra-admin', filter: ['==', ['get', 'kind'], 'state'], paint: { 'fill-color': '#18323b', 'fill-opacity': 0.72 } });
        instance.addLayer({ id: 'district-fill', type: 'fill', source: 'maharashtra-admin', filter: ['==', ['get', 'kind'], 'district'], paint: { 'fill-color': '#18313b', 'fill-opacity': 0.28 } });
        instance.addLayer({ id: 'district-line', type: 'line', source: 'maharashtra-admin', filter: ['==', ['get', 'kind'], 'district'], paint: { 'line-color': '#526d78', 'line-width': 0.7, 'line-opacity': 0.85 } });
        instance.addLayer({ id: 'state-line', type: 'line', source: 'maharashtra-admin', filter: ['==', ['get', 'kind'], 'state'], paint: { 'line-color': '#76c9c2', 'line-width': 2, 'line-opacity': 0.9 } });
        instance.addLayer({
          id: 'district-labels',
          type: 'symbol',
          source: 'maharashtra-admin',
          minzoom: 6,
          maxzoom: 7.5,
          filter: ['==', ['get', 'kind'], 'district'],
          layout: {
            'text-field': [
              'case',
              ['==', ['get', 'name'], 'Pune'], 'PUNE',
              ['==', ['get', 'name'], 'Nagpur'], 'NAG',
              ['==', ['get', 'name'], 'Nashik'], 'NASH',
              ['==', ['get', 'name'], 'Aurangabad'], 'AUR',
              ['==', ['get', 'name'], 'Kolhapur'], 'KOL',
              ['==', ['get', 'name'], 'Solapur'], 'SOL',
              ['==', ['get', 'name'], 'Amravati'], 'AMR',
              ['==', ['get', 'name'], 'Nanded'], 'NDD',
              ['==', ['get', 'name'], 'Sangli'], 'SAN',
              ['==', ['get', 'name'], 'Satara'], 'SAT',
              ['==', ['get', 'name'], 'Latur'], 'LAT',
              ['==', ['get', 'name'], 'Jalgaon'], 'JAL',
              ['==', ['get', 'name'], 'Dhule'], 'DHL',
              ['==', ['get', 'name'], 'Akola'], 'AKL',
              ['==', ['get', 'name'], 'Buldhana'], 'BLD',
              ['==', ['get', 'name'], 'Washim'], 'WSH',
              ['==', ['get', 'name'], 'Yavatmal'], 'YAV',
              ['==', ['get', 'name'], 'Chandrapur'], 'CHD',
              ['==', ['get', 'name'], 'Gondia'], 'GON',
              ['==', ['get', 'name'], 'Bhandara'], 'BND',
              ['==', ['get', 'name'], 'Wardha'], 'WRD',
              ['==', ['get', 'name'], 'Gadchiroli'], 'GAD',
              ['==', ['get', 'name'], 'Raigad'], 'RAI',
              ['==', ['get', 'name'], 'Ratnagiri'], 'RAT',
              ['==', ['get', 'name'], 'Sindhudurg'], 'SIN',
              ['==', ['get', 'name'], 'Thane'], 'THN',
              ['==', ['get', 'name'], 'Mumbai'], 'MUM',
              ['==', ['get', 'name'], 'Mumbai Suburban'], 'MUM-S',
              ['==', ['get', 'name'], 'Palghar'], 'PLG',
              ['==', ['get', 'name'], 'Ahmednagar'], 'AHM',
              ['==', ['get', 'name'], 'Jalna'], 'JLN',
              ['==', ['get', 'name'], 'Parbhani'], 'PRB',
              ['==', ['get', 'name'], 'Hingoli'], 'HIN',
              ['==', ['get', 'name'], 'Beed'], 'BED',
              ['==', ['get', 'name'], 'Osmanabad'], 'OSM',
              ['==', ['get', 'name'], 'Nandurbar'], 'NDB',
              ['slice', ['get', 'name'], 0, 3]
            ],
            'text-size': 8,
            'text-allow-overlap': false,
            'text-padding': 2,
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.5,
          },
          paint: {
            'text-color': '#b8ccd1',
            'text-halo-color': '#10202b',
            'text-halo-width': 1.2,
          }
        });
        instance.addLayer({
          id: 'district-labels-detailed',
          type: 'symbol',
          source: 'maharashtra-admin',
          minzoom: 7.5,
          filter: ['==', ['get', 'kind'], 'district'],
          layout: {
            'text-field': ['get', 'name'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 7.5, 10, 9, 12],
            'text-allow-overlap': false,
            'text-padding': 2,
          },
          paint: {
            'text-color': '#b8ccd1',
            'text-halo-color': '#10202b',
            'text-halo-width': 1.2,
          }
        });
        for (const [id, kind, color, opacity] of [['satellite', 'satellite', '#b7c7d5', 0.15], ['uncertainty', 'uncertainty', '#38bfc0', 0.1], ['hazard', 'hazard', '#f4a944', 0.07], ['radar', 'radar', '#f39936', 0.65]] as const) instance.addLayer({ id, type: 'fill', source: 'storm', filter: ['==', ['get', 'kind'], kind], paint: { 'fill-color': id === 'radar' ? ['get', 'color'] : color, 'fill-opacity': id === 'radar' ? ['get', 'opacity'] : opacity } });
        instance.addLayer({ id: 'hazard-outline', type: 'line', source: 'storm', filter: ['==', ['get', 'kind'], 'hazard'], paint: { 'line-color': '#e6ae56', 'line-width': 1, 'line-dasharray': [4, 3], 'line-opacity': 0.8 } });
        instance.addLayer({ id: 'observed', type: 'line', source: 'storm', filter: ['==', ['get', 'kind'], 'observed'], paint: { 'line-color': '#50babc', 'line-width': 2 } });
        instance.addLayer({ id: 'trajectory', type: 'line', source: 'storm', filter: ['==', ['get', 'kind'], 'trajectory'], paint: { 'line-color': '#72e1db', 'line-width': 2, 'line-dasharray': [3, 3] } });
        instance.addLayer({ id: 'lightning', type: 'circle', source: 'storm', filter: ['==', ['get', 'kind'], 'lightning'], paint: { 'circle-color': '#fff3a2', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 9, 4], 'circle-stroke-color': '#ffb83d', 'circle-stroke-width': 1 } });
        instance.addLayer({ id: 'alert', type: 'circle', source: 'storm', filter: ['==', ['get', 'kind'], 'alert'], paint: { 'circle-color': '#ec6d4e', 'circle-radius': 8, 'circle-opacity': 0.25, 'circle-stroke-color': '#ff9e70', 'circle-stroke-width': 2 } });
        instance.addLayer({ id: 'core', type: 'circle', source: 'storm', filter: ['==', ['get', 'kind'], 'core'], paint: { 'circle-radius': 8, 'circle-color': '#f45c41', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
        majorCities.forEach(city => {
          const element = document.createElement('button');
          element.className = `town-label ${city.name === 'PUNE' || city.name === 'MUMBAI' ? 'major' : ''}`;
          element.textContent = city.name;
          element.title = `${city.name} · Maharashtra reference city`;
          element.onclick = () => actions.inspect('location', city.name);
          const marker = new Marker({ element, anchor: 'center' }).setLngLat([city.longitude, city.latitude]).addTo(instance!);
          cityMarkers.current.push(marker);
        });
        const initialCells = snapshot.stormCells?.length ? snapshot.stormCells : [snapshot.storm];
        initialCells.forEach(cellState => {
          const element = document.createElement('button');
          element.className = 'cell-label';
          element.textContent = `${cellState.id} ↗`;
          element.onclick = () => actions.inspect('storm', cellState.id);
          cellMarkers.current.set(cellState.id, new Marker({ element, anchor: 'bottom', offset: [0, -18] }).setLngLat([cellState.longitude, cellState.latitude]).addTo(instance!));
        });
        instance.on('click', 'core', event => actions.inspect('storm', String(event.features?.[0]?.properties?.cellId ?? snapshot.storm.id)));
        instance.on('click', 'alert', event => actions.inspect('alert', String(event.features?.[0]?.properties?.alertId ?? '')));
        instance.on('click', 'district-fill', event => {
          const feature = event.features?.[0];
          const districtId = String(feature?.properties?.id ?? '');
          if (districtId) setSelectedDistrict(districtId);
        });
        instance.on('mousemove', 'district-fill', () => { instance!.getCanvas().style.cursor = 'pointer'; });
        instance.on('mouseleave', 'district-fill', () => { instance!.getCanvas().style.cursor = ''; });
        instance.on('zoomend', () => setZoom(instance!.getZoom()));
        fitMaharashtra(instance);
        setReady(true);
      });
      instance.on('error', () => setFailed(true));
    } catch {
      setFailed(true);
    }
    return () => {
      cityMarkers.current.forEach(marker => marker.remove());
      cellMarkers.current.forEach(marker => marker.remove());
      cellMarkers.current.clear();
      cityMarkers.current = [];
      instance?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    (instance.getSource('storm') as GeoJSONSource).setData(stormGeography(snapshot));
    const cells = snapshot.stormCells?.length ? snapshot.stormCells : [snapshot.storm];
    const activeIds = new Set(cells.map(cell => cell.id));
    cellMarkers.current.forEach((marker, id) => { if (!activeIds.has(id)) { marker.remove(); cellMarkers.current.delete(id); } });
    cells.forEach(cell => {
      let marker = cellMarkers.current.get(cell.id);
      if (!marker) {
        const element = document.createElement('button');
        element.className = 'cell-label';
        element.onclick = () => actions.inspect('storm', cell.id);
        marker = new Marker({ element, anchor: 'bottom', offset: [0, -18] }).setLngLat([cell.longitude, cell.latitude]).addTo(instance);
        cellMarkers.current.set(cell.id, marker);
      }
      marker.getElement().textContent = `${cell.id} ↗`;
      marker.setLngLat([cell.longitude, cell.latitude]);
    });
    const visibility: Record<string, boolean> = {
      'state-fill': layers.Districts !== false,
      'state-line': layers.Districts !== false,
      'district-fill': layers.Districts !== false,
      'district-line': layers.Districts !== false,
      'district-labels': layers.Districts !== false,
      radar: layers.Radar && layers.Convective !== false,
      satellite: layers.Satellite,
      lightning: layers.Lightning,
      trajectory: layers.Trajectory && layers.Tracks !== false,
      uncertainty: layers.Trajectory && layers.Tracks !== false,
      observed: layers.Trajectory && layers.Tracks !== false,
      hazard: layers.Hazards,
      'hazard-outline': layers.Hazards,
      alert: layers.Alerts !== false,
    };
    Object.entries(visibility).forEach(([id, visible]) => instance.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'));
  }, [snapshot, layers, ready]);

  useEffect(() => {
    if (!ready || !map.current || !map.current.getLayer('district-fill')) return;
    map.current.setPaintProperty('district-fill', 'fill-color', ['case', ['==', ['get', 'id'], selectedDistrict ?? ''], '#28616a', '#18313b']);
  }, [selectedDistrict, ready]);

  useEffect(() => {
    if (focus && map.current) map.current.flyTo({ center: [snapshot.storm.longitude, snapshot.storm.latitude], zoom: 8.2, duration: 600 });
  }, [focus, snapshot.storm.latitude, snapshot.storm.longitude]);

  useEffect(() => { map.current?.resize(); }, [fullscreen]);

  useEffect(() => {
    if (snapshot.mode !== 'BACKEND') { setBackendMapState(null); return; }
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/v1/map/state`, { signal: controller.signal, cache: 'no-store' }).then(response => response.ok ? response.json() as Promise<BackendMapState> : null).then(state => { if (state) setBackendMapState(state); }).catch(() => undefined);
    return () => controller.abort();
  }, [snapshot.mode, snapshot.sequence]);

  const searchResults = districtSearch(districtQuery).slice(0, 6);
  const selected = districtFeatures.find(feature => feature.properties.id === selectedDistrict);
  const selectedRisk = backendMapState?.districtRisks.find(item => item.districtId === selectedDistrict);
  return <section className={`operations-map ${tall ? 'tall' : ''} ${fullscreen ? 'expanded-map' : ''}`} ref={wrapper} aria-label="Maharashtra convective nowcast map">
    <div className="map-top"><div><span className="map-title"><MapPin size={14}/> MAHARASHTRA CONVECTIVE NOWCAST</span><span className="map-subtitle">WGS84 / EPSG:4326 <span>ADMINISTRATIVE BOUNDARY + SYNTHETIC WEATHER OVERLAYS</span></span></div><div className="map-search"><Search size={13}/><input value={districtQuery} onChange={event => setDistrictQuery(event.target.value)} placeholder="Search district" aria-label="Search Maharashtra district"/>{districtQuery && searchResults.length > 0 && <div className="map-search-results">{searchResults.map(feature => <button key={feature.properties.id} onClick={() => { setSelectedDistrict(feature.properties.id); setDistrictQuery(feature.properties.name); }}>{feature.properties.name}</button>)}</div>}</div><Badge tone="amber">{snapshot.mode}</Badge></div>
    <div ref={host} className={`map-canvas ${failed ? 'hidden' : ''}`}/>
    {failed && <OfflineMapFallback snapshot={snapshot} layers={layers} zoom={zoom}/>} 
    {selected && <div className="district-card"><span className="eyebrow">SELECTED DISTRICT</span><strong>{selected.properties.name.toUpperCase()}</strong><span>Boundary: Census 2011 · {selectedRisk?.region ?? 'Maharashtra'}</span>{selectedRisk ? <><span>Active cells: {selectedRisk.activeCells.length}</span><span>Highest hazard: {selectedRisk.highestHazard ?? 'None'}</span><span>Risk {number(selectedRisk.risk)}% · confidence {number(selectedRisk.confidence)}%</span><span>Active alerts: {selectedRisk.activeAlerts}</span></> : <span>{snapshot.mode === 'BACKEND' ? 'Waiting for backend district risk.' : 'Backend district risk is available in backend mode.'}</span>}<button onClick={() => setSelectedDistrict(null)}>Clear selection</button></div>}
    <div className="map-layer-tabs">{['Radar', 'Satellite', 'Lightning', 'Hazards'].map(layer => <button key={layer} className={layers[layer] ? 'active' : ''} onClick={() => actions.toggleLayer(layer)} aria-pressed={layers[layer]}>{layer === 'Radar' && <span className="cyan-dot"/>}{layer}</button>)}</div>
    <div className="map-tools"><button title="Zoom in" aria-label="Zoom in" onClick={() => failed ? setZoom(Math.min(9, zoom + 0.5)) : map.current?.zoomIn()}><Plus size={17}/></button><button title="Zoom out" aria-label="Zoom out" onClick={() => failed ? setZoom(Math.max(4, zoom - 0.5)) : map.current?.zoomOut()}><span>−</span></button><span/><button title="Focus active storm" aria-label="Focus active storm" onClick={() => actions.focus()}><Crosshair size={17}/></button><button title="Reset Maharashtra view" aria-label="Reset Maharashtra view" onClick={() => { setSelectedDistrict(null); setDistrictQuery(''); if (map.current) fitMaharashtra(map.current, 500); }}><Navigation size={16}/></button><button title="Map layers" aria-label="Map layers" onClick={() => setLayerPanel(!layerPanel)}><Layers size={17}/></button><button title="Expand map" aria-label="Expand map" onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? <X size={17}/> : <Maximize2 size={17}/>}</button></div>
    {layerPanel && <div className="layer-popover"><h3>Map layers</h3>{Object.entries(layers).filter(([layer]) => !['Infrastructure', 'Grid'].includes(layer)).map(([layer, enabled]) => <label key={layer}><input type="checkbox" checked={enabled} onChange={() => actions.toggleLayer(layer)}/>{layer}<span>{enabled ? 'ON' : 'OFF'}</span></label>)}<small>Boundary geometry is bundled locally. Weather overlays are backend/replay state.</small></div>}
    <div className="map-coordinate"><Crosshair size={11}/>{number(snapshot.storm.latitude, 4)}° N / {number(snapshot.storm.longitude, 4)}° E <span>Z {number(zoom, 1)}</span></div>
    <div className="map-legend"><div><span>MAHARASHTRA OPERATIONS MAP <small>35 districts</small></span><div className="radar-scale"/><div className="scale-numbers"><span>LOW</span><span>WATCH</span><span>ACTIVE</span><span>SEVERE</span></div></div>{layers.Trajectory && <div className="track-key"><span><i/>Observed</span><span><i className="dashed"/>Forecast</span><span><i className="uncertainty"/>Uncertainty</span></div>}{layers.Lightning && <small className="legend-extra">● Backend lightning proxy</small>}{layers.Hazards && <small className="legend-extra amber-text">- - Backend hazard extent</small>}<small className="legend-extra">District boundaries · WGS84</small></div>
    {failed && <span className="fallback-badge">WEBGL UNAVAILABLE · ADMINISTRATIVE FALLBACK</span>}
  </section>;
}
