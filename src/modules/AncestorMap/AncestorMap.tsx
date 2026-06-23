import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { batchGeocode } from '../../utils/geocoder';
import type { GeoLocation } from '../../parser/gedcomTypes';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PlaceData {
  placeName: string;
  geo: GeoLocation;
  persons: Array<{ id: string; name: string; year?: number; generation: number }>;
  generation: number;
}

const GEN_COLORS = ['#3b5bfc','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f97316','#6366f1','#a855f7','#14b8a6','#eab308','#ef4444'];
const getColor = (gen: number) => GEN_COLORS[gen % GEN_COLORS.length];

function MapBounds({ places }: { places: PlaceData[] }) {
  const map = useMap();
  useEffect(() => {
    if (places.length > 0) {
      const bounds = L.latLngBounds(places.map(p => [p.geo.lat, p.geo.lng]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
      }
    }
  }, [places, map]);
  return null;
}

interface Props {
  mini?: boolean;
  maxGenerations?: number;
}

export default function AncestorMap({ mini, maxGenerations = 8 }: Props) {
  const { tree, graph, selectedPersonId } = useApp();
  const [placeData, setPlaceData] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [maxGen, setMaxGen] = useState(maxGenerations);
  const [useNominatim, setUseNominatim] = useState(true);
  const [selectedGen, setSelectedGen] = useState<number | null>(null);

  useEffect(() => {
    if (!tree || !graph || !selectedPersonId) {
      setPlaceData([]);
      return;
    }

    const loadPlaces = async () => {
      setLoading(true);
      setProgress(0);

      const ancestors = graph.getAncestors(selectedPersonId, maxGen);
      // Include the root person
      ancestors.push({ personId: selectedPersonId, generation: 0, ahnentafelNumber: 1 });

      const byPlace = new Map<string, PlaceData>();
      const placeNamesToGeocode = new Set<string>();

      for (const a of ancestors) {
        const p = tree.persons.get(a.personId);
        if (!p) continue;

        let placeName = p.birth?.place;
        if (!placeName && p.events) {
          const firstPlac = p.events.find(e => e.place);
          if (firstPlac) placeName = firstPlac.place;
        }

        if (placeName) {
          placeNamesToGeocode.add(placeName);
          if (!byPlace.has(placeName)) {
            byPlace.set(placeName, {
              placeName, geo: { lat: 0, lng: 0, placeName, confidence: 'unknown' }, persons: [], generation: a.generation
            });
          }
          const entry = byPlace.get(placeName)!;
          entry.persons.push({
            id: p.id,
            name: p.names[0]?.full || 'Nepoznato',
            year: p.birth?.date?.year,
            generation: a.generation
          });
          if (a.generation < entry.generation) {
            entry.generation = a.generation;
          }
        }
      }

      const results = await batchGeocode(Array.from(placeNamesToGeocode), useNominatim, (done, total) => {
        setProgress(Math.round((done / total) * 100));
      });

      const finalData: PlaceData[] = [];
      for (const [place, geo] of results) {
        if (geo) {
          const entry = byPlace.get(place);
          if (entry) {
            entry.geo = geo;
            finalData.push(entry);
          }
        }
      }

      setPlaceData(finalData);
      setLoading(false);
    };

    loadPlaces();
  }, [selectedPersonId, tree, graph, maxGen, useNominatim]);

  const filtered = useMemo(() => {
    if (selectedGen === null) return placeData;
    return placeData.filter(p => p.generation === selectedGen);
  }, [placeData, selectedGen]);

  const maxGens = useMemo(() => Array.from(new Set(placeData.map(p => p.generation))).sort((a,b) => a-b), [placeData]);
  const totalPersons = useMemo(() => filtered.reduce((s,p) => s+p.persons.length,0), [filtered]);

  if (!tree || !graph) return null;

  if (mini) {
    return (
      <div className="w-full h-full relative z-0" style={{ minHeight: '300px' }}>
        <MapContainer center={[45, 15]} zoom={3} style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false}>
          <MapBounds places={placeData} />
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {placeData.map((pd, i) => (
            <CircleMarker key={i} center={[pd.geo.lat, pd.geo.lng]} radius={6 + Math.min(pd.persons.length, 10)} pathOptions={{ color: '#fff', fillColor: getColor(pd.generation), fillOpacity: 0.8, weight: 1 }}>
              <Popup>
                <div className="text-sm max-h-48 overflow-y-auto">
                  <div className="font-bold border-b pb-1 mb-1">{pd.placeName}</div>
                  {pd.persons.slice(0, 20).map(p => (
                    <div key={p.id} className="whitespace-nowrap">
                      {p.name} <span className="text-gray-500 text-xs">(Gen {p.generation})</span>
                    </div>
                  ))}
                  {pd.persons.length > 20 && <div className="text-xs text-gray-500 mt-1">i još {pd.persons.length - 20}...</div>}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        {!selectedPersonId && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 backdrop-blur-[2px]">
            <div className="bg-[var(--bg-card)] p-4 rounded-xl shadow-lg text-sm font-medium text-amber-600 text-center">
              Odaberite osobu u navigaciji iznad kako biste učitali kartu predaka.
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in flex flex-col h-full min-h-[700px] max-w-7xl mx-auto">
      <div className="section-header">
        <div>
          <h2 className="section-title">Karta predaka</h2>
          <p className="section-subtitle">Prikaz lokacija rođenja vaših predaka na interaktivnoj karti.</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-secondary)]">Max generacija:</label>
          <select className="input w-24" value={maxGen} onChange={e => setMaxGen(Number(e.target.value))}>
            {[3,5,8,10,12,15].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-secondary)]">Prikaži samo Gen:</label>
          <select className="input w-36" value={selectedGen ?? ''} onChange={e => setSelectedGen(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Sve generacije</option>
            {maxGens.map(g => <option key={g} value={g}>Gen {g}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={useNominatim} onChange={e => setUseNominatim(e.target.checked)} className="rounded text-teal-600" />
          <span className="text-[var(--text-secondary)]">Koristi online Geocoding (preciznije ali sporije)</span>
        </label>
        <span className="text-sm font-medium text-[var(--text-muted)] ml-auto">
          {filtered.length} lokacija · {totalPersons} predaka
        </span>
      </div>

      {maxGens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {maxGens.map(g => (
            <button key={g} onClick={() => setSelectedGen(selectedGen === g ? null : g)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                selectedGen === g ? 'opacity-100 border-current' : 'opacity-60 border-transparent hover:opacity-100'}`}
              style={{ color: getColor(g), backgroundColor: getColor(g)+'20' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(g) }}></span>
              Gen {g} ({placeData.filter(p=>p.generation===g).reduce((s,p)=>s+p.persons.length,0)})
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">Učitavanje lokacija s karte... {progress}%</span>
          </div>
          <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="card flex-1 relative overflow-hidden z-0 shadow-lg min-h-[500px]">
        <MapContainer center={[45, 16]} zoom={4} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <MapBounds places={filtered} />
          <TileLayer attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {filtered.map((place, i) => (
            <CircleMarker key={`${place.placeName}-${i}`} center={[place.geo.lat, place.geo.lng]}
              radius={Math.max(6, Math.min(20, place.persons.length * 3))}
              pathOptions={{ color: '#fff', fillColor: getColor(place.generation), fillOpacity: 0.8, weight: 1 }}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong className="text-[var(--text-primary)]">{place.placeName}</strong>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, paddingBottom: 4, borderBottom: '1px solid var(--border-color)' }}>{place.persons.length} predaka</div>
                  <ul style={{ marginTop: 6, padding: 0, listStyle: 'none', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {place.persons.slice(0,8).map(p => <li key={p.id}>{p.name}{p.year ? ` (${p.year})` : ''} · Gen {p.generation}</li>)}
                    {place.persons.length > 8 && <li style={{ color: 'var(--text-muted)', marginTop: 4 }}>...i {place.persons.length-8} više</li>}
                  </ul>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {!selectedPersonId && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 backdrop-blur-[2px]">
            <div className="bg-[var(--bg-card)] p-4 rounded-xl shadow-lg font-medium text-amber-600">
              Odaberite osobu u navigaciji iznad kako biste učitali njezine pretke na karti.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
