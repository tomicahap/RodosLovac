import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, ZoomControl, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { batchGeocode } from '../../utils/geocoder';
import { extractAncestralMigrations, MigrationRoute } from './utils/migrationLogic';
import { ChevronDown, Download, Filter, MapPin, Play, Pause, Ship, FileText, ChevronRight } from 'lucide-react';

const { BaseLayer } = LayersControl;

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface GeocodedRoute extends MigrationRoute {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

export default function MigrationMap() {
  const { tree, selectedPersonId } = useApp();
  
  const [routes, setRoutes] = useState<GeocodedRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Filters
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Accordion state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const selectedPerson = useMemo(() => {
    if (!tree || !selectedPersonId) return null;
    return tree.persons.get(selectedPersonId) || null;
  }, [tree, selectedPersonId]);

  // Compute migrations
  useEffect(() => {
    if (!tree || !selectedPersonId) return;

    setLoading(true);
    setProgress(0);
    
    // 1. Extract raw migrations
    const rawRoutes = extractAncestralMigrations(tree, selectedPersonId);
    
    // 2. Gather unique places for batch geocoding
    const uniquePlaces = new Set<string>();
    for (const r of rawRoutes) {
      if (r.fromPlace) uniquePlaces.add(r.fromPlace);
      if (r.toPlace) uniquePlaces.add(r.toPlace);
    }
    
    // 3. Geocode
    batchGeocode(Array.from(uniquePlaces), true, (prog) => {
      setProgress(prog);
    }).then(geoMap => {
      // 4. Map back
      const valid: GeocodedRoute[] = [];
      for (const r of rawRoutes) {
        const fromGeo = geoMap.get(r.fromPlace);
        const toGeo = geoMap.get(r.toPlace);
        if (fromGeo?.lat && fromGeo?.lng && toGeo?.lat && toGeo?.lng) {
          valid.push({
            ...r,
            fromLat: fromGeo.lat,
            fromLng: fromGeo.lng,
            toLat: toGeo.lat,
            toLng: toGeo.lng
          });
        }
      }
      setRoutes(valid);
      setLoading(false);
    });
    
  }, [tree, selectedPersonId]);

  // Derived data
  const allYears = useMemo(() => routes.map(r => r.year).filter((y): y is number => !!y).sort((a,b)=>a-b), [routes]);
  const minYear = allYears[0] || 1700;
  const maxYear = allYears[allYears.length-1] || new Date().getFullYear();
  
  const [currentYear, setCurrentYear] = useState<number>(maxYear);

  useEffect(() => {
    if (routes.length > 0) {
      setCurrentYear(maxYear);
    }
  }, [routes, maxYear]);

  // Countries dropdown
  const countries = useMemo(() => {
    const c = new Set<string>();
    for (const r of routes) {
      const parts = r.toPlace.split(',');
      const country = parts[parts.length - 1].trim();
      if (country) c.add(country);
    }
    return Array.from(c).sort();
  }, [routes]);

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    return routes.filter(r => {
      if (r.year && r.year > currentYear) return false;
      if (selectedCountry) {
        const parts = r.toPlace.split(',');
        const country = parts[parts.length - 1].trim();
        if (country !== selectedCountry) return false;
      }
      return true;
    });
  }, [routes, currentYear, selectedCountry]);

  // Top paths
  const topPaths = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const r of filteredRoutes) {
      const p1 = r.fromPlace.split(',')[0].trim();
      const p2 = r.toPlace.split(',')[0].trim();
      const key = `${p1} → ${p2}`;
      const entry = counts.get(key) || { label: key, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
    return Array.from(counts.values()).sort((a,b)=>b.count - a.count).slice(0, 4);
  }, [filteredRoutes]);

  // Player controls
  const togglePlay = () => {
    if (playing) {
      if (playRef.current) clearInterval(playRef.current);
      setPlaying(false);
    } else {
      let y = currentYear >= maxYear ? minYear : currentYear;
      setCurrentYear(y);
      setPlaying(true);
      playRef.current = setInterval(() => {
        y += 2;
        if (y > maxYear) {
          y = maxYear;
          if (playRef.current) clearInterval(playRef.current);
          setPlaying(false);
        }
        setCurrentYear(y);
      }, 100);
    }
  };

  useEffect(() => {
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, []);

  const handleExportCSV = () => {
    const rows = [
      ['Predak', 'Generacija', 'Polaziste', 'Odrediste', 'Godina', 'Status', 'Izvor']
    ];
    filteredRoutes.forEach(r => {
      rows.push([
        r.person.names[0]?.full || 'Nepoznato',
        r.generation.toString(),
        r.fromPlace,
        r.toPlace,
        r.year?.toString() || 'Nepoznato',
        r.isDocumented ? 'Dokumentirano' : 'Pretpostavljeno',
        r.sourceText
      ]);
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `migracije_${selectedPerson?.names[0]?.full || 'izvoz'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedPerson) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-medium">
        <MapPin size={48} className="mb-4 text-slate-200" />
        <p>Odaberite osobu za prikaz karte migracija</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-slate-50 custom-scrollbar">
      <div className="flex flex-col min-h-full relative max-w-7xl mx-auto w-full p-4 gap-4">
        
        {/* 1. TOP HEADER & STATS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mb-1">Osoba</span>
                <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700">
                  {selectedPerson.names[0]?.full}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mb-1">Migracija u</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      className="appearance-none bg-white border border-slate-300 rounded-xl py-2 pl-4 pr-10 font-bold text-slate-700 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      value={selectedCountry}
                      onChange={e => setSelectedCountry(e.target.value)}
                    >
                      <option value="">Sve države</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                  {selectedCountry && (
                    <button onClick={() => setSelectedCountry('')} className="text-sm font-bold text-slate-400 hover:text-slate-600">Očisti</button>
                  )}
                </div>
              </div>
            </div>
            
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-teal-600">
                {filteredRoutes.length} predaka migriralo{selectedCountry ? ` u ${selectedCountry}` : ''}
              </h2>
              <p className="text-sm font-bold text-slate-500 mt-1">
                Pregledano {routes.length} predaka · klasificirano po lokaciji rođenja i doseljenja.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 transition-colors flex items-center gap-2">
                <Filter size={16} /> Filteri
              </button>
              <button 
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl text-sm font-bold text-green-700 transition-colors flex items-center gap-2"
              >
                <Download size={16} /> Excel
              </button>
            </div>
          </div>
        </div>

        {/* 2. TIMELINE SLIDER */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0 flex items-center gap-4">
          <button 
            onClick={togglePlay}
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${playing ? 'bg-amber-100 text-amber-600' : 'bg-teal-50 hover:bg-teal-100 text-teal-600'}`}
          >
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          
          <div className="flex-1">
            <input 
              type="range" 
              min={minYear} 
              max={maxYear} 
              value={currentYear}
              onChange={e => {
                setCurrentYear(parseInt(e.target.value));
                if (playing) togglePlay();
              }}
              className="w-full accent-teal-500 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
              <span>{minYear}.</span>
              <span>{maxYear}.</span>
            </div>
          </div>

          <div className="shrink-0 w-32 text-right">
            <div className="text-xs font-bold text-slate-400 uppercase">Prikaz do godine</div>
            <div className="text-xl font-black text-slate-700">{currentYear}.</div>
          </div>
        </div>

        {/* 3. MAP & ACCORDION SPLIT */}
        <div className="flex flex-col lg:flex-row gap-4 h-[600px] shrink-0">
          
          {/* MAP */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
            {loading && (
              <div className="absolute inset-0 z-[2000] bg-white/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-100">
                  <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-bold text-slate-700">Analiziram rute... {progress}%</span>
                </div>
              </div>
            )}

            <div className="flex-1 relative z-0">
              <MapContainer center={[45.8, 16]} zoom={5} zoomControl={false} scrollWheelZoom={false} className="w-full h-full">
                <ZoomControl position="topleft" />
                <LayersControl position="topright">
                  <BaseLayer checked name="CARTO Positron">
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  </BaseLayer>
                  <BaseLayer name="Satelit">
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                  </BaseLayer>
                </LayersControl>

                {filteredRoutes.map((r, i) => (
                  <React.Fragment key={`${r.person.id}-${i}`}>
                    {/* Migration Line */}
                    <Polyline 
                      positions={[[r.fromLat, r.fromLng], [r.toLat, r.toLng]]} 
                      color={r.isDocumented ? '#0ea5e9' : '#f59e0b'} 
                      weight={2} 
                      opacity={0.6}
                      dashArray={r.isDocumented ? undefined : '5, 5'}
                    />
                    
                    {/* Origin Dot (Hollow) */}
                    <CircleMarker center={[r.fromLat, r.fromLng]} radius={4} pathOptions={{ color: '#64748b', fillColor: '#fff', fillOpacity: 1, weight: 2 }}>
                      <Popup>Mjesto rođenja: {r.fromPlace}</Popup>
                    </CircleMarker>

                    {/* Destination Dot (Filled) */}
                    <CircleMarker center={[r.toLat, r.toLng]} radius={4} pathOptions={{ color: r.isDocumented ? '#0ea5e9' : '#f59e0b', fillColor: r.isDocumented ? '#0ea5e9' : '#f59e0b', fillOpacity: 1, weight: 0 }}>
                      <Popup>Mjesto doseljenja: {r.toPlace}</Popup>
                    </CircleMarker>
                  </React.Fragment>
                ))}
              </MapContainer>
            </div>

            {/* LEGEND */}
            <div className="bg-white border-t border-slate-200 px-4 py-3 flex flex-wrap items-center gap-6 text-xs font-bold text-slate-600 shrink-0">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-sky-500"></div> Dokumentirano (Roditelj)</div>
              <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-sky-500"></div> Puna linija = Dokumentirano</div>
              <div className="flex items-center gap-2"><div className="w-6 h-0.5 border-t-2 border-dashed border-amber-500"></div> Isprekidano = Pretpostavljeno</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-slate-500 bg-white"></div> Mjesto rođenja</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500"></div> Mjesto naseljenja</div>
            </div>
          </div>

          {/* LIST OF ANCESTORS */}
          <div className="w-full lg:w-96 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-700 flex items-center gap-2">
                <ChevronDown size={18} className="text-slate-400" />
                POPIS PREDAKA · {filteredRoutes.length}
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
              {filteredRoutes.map(r => {
                const isExpanded = expandedRow === r.person.id;
                return (
                  <div key={r.person.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button 
                      onClick={() => setExpandedRow(isExpanded ? null : r.person.id)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="mt-0.5 bg-slate-100 p-1.5 rounded-lg text-slate-500">
                        <Ship size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-slate-800 truncate">{r.person.names[0]?.full || 'Nepoznato'}</div>
                        <div className="text-xs font-bold text-slate-500 truncate mt-0.5">
                          {r.fromPlace.split(',')[0]} → {r.toPlace.split(',')[0]}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {r.isDocumented ? (
                          <span className="px-2 py-1 bg-sky-50 text-sky-600 rounded-md text-[10px] font-black uppercase tracking-wider">Dokaz</span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[10px] font-black uppercase tracking-wider">Pretpost.</span>
                        )}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-4 py-3 border-t border-slate-100 bg-white text-sm">
                        <div className="space-y-3">
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Mjesto rođenja</div>
                            <div className="font-bold text-slate-700">{r.fromPlace}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Naseljen/a</div>
                            <div className="font-bold text-slate-700">{r.toPlace}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Vrijeme</div>
                              <div className="font-bold text-slate-700">{r.year ? `oko ${r.year}.` : 'Nepoznato'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Generacija</div>
                              <div className="font-bold text-slate-700">{r.generation}. pretci</div>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-100">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Izvor / Dokaz</div>
                            <div className="text-xs font-medium text-slate-600 italic">"{r.sourceText}"</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredRoutes.length === 0 && (
                <div className="text-center py-8 text-slate-400 font-bold">
                  Nema migracija za odabrane filtere
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. TOP PATHS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 shrink-0">
          <h3 className="font-black text-slate-700 mb-4 uppercase tracking-wider text-sm">Najčešće migracijske rute</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topPaths.map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <span className="font-bold text-slate-600 text-sm truncate pr-4">{p.label}</span>
                <span className="shrink-0 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-black text-slate-500">
                  {p.count} {p.count === 1 ? 'predak' : 'predaka'}
                </span>
              </div>
            ))}
            {topPaths.length === 0 && <span className="text-slate-400 font-bold text-sm">Nema podataka za prikaz</span>}
          </div>
        </div>

      </div>
    </div>
  );
}
