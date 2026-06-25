import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { batchGeocode } from '../../utils/geocoder';
import type { GeoLocation, GedcomPerson } from '../../parser/gedcomTypes';
import { Search, Download, Users, ArrowLeft, Lock, Layers } from 'lucide-react';
import { extractPersonEvents, getBestBirthLikeEvent } from '../AdvancedMap/utils/mapEventUtils';

const { BaseLayer } = LayersControl;

const ERAS = [
  { id: 'pre1700', label: '<1700', min: 0, max: 1699, color: '#64748b' }, // slate
  { id: '1700_1749', label: '1700-1749', min: 1700, max: 1749, color: '#10b981' }, // emerald
  { id: '1750_1799', label: '1750-1799', min: 1750, max: 1799, color: '#14b8a6' }, // teal
  { id: '1800_1849', label: '1800-1849', min: 1800, max: 1849, color: '#3b82f6' }, // blue
  { id: '1850_1899', label: '1850-1899', min: 1850, max: 1899, color: '#4f46e5' }, // indigo
  { id: '1900_1949', label: '1900-1949', min: 1900, max: 1949, color: '#9333ea' }, // purple
  { id: '1950_1999', label: '1950-1999', min: 1950, max: 1999, color: '#ec4899' }, // pink
  { id: 'post2000', label: '2000+', min: 2000, max: 9999, color: '#f43f5e' }, // rose
];

function getEraForYear(year: number) {
  return ERAS.find(e => year >= e.min && year <= e.max) || ERAS[0];
}

export default function SurnameMap() {
  const { tree } = useApp();
  
  // Phase 1 States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurname, setSelectedSurname] = useState<string | null>(null);

  // Phase 2 States
  const [selectedEras, setSelectedEras] = useState<Set<string>>(new Set(ERAS.map(e => e.id)));
  const [geoMap, setGeoMap] = useState<Map<string, GeoLocation>>(new Map());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Surnames calculation for Phase 1
  const surnamesList = useMemo(() => {
    if (!tree) return [];
    const counts = new Map<string, number>();
    for (const p of tree.persons.values()) {
      const s = p.names[0]?.surname;
      if (s) counts.set(s, (counts.get(s) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([s, c]) => ({ surname: s, count: c }));
  }, [tree]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return surnamesList.filter(s => s.surname.toLowerCase().includes(q)).slice(0, 10);
  }, [surnamesList, searchQuery]);

  // Phase 2 Data extraction
  const surnamePersons = useMemo(() => {
    if (!tree || !selectedSurname) return [];
    const persons: Array<{
      person: GedcomPerson;
      birthYear: number | null;
      deathYear: number | null;
      birthPlace: string | null;
      era: typeof ERAS[0] | null;
    }> = [];

    for (const p of tree.persons.values()) {
      if (p.names[0]?.surname !== selectedSurname) continue;
      
      const events = extractPersonEvents(tree, p);
      const birthEv = getBestBirthLikeEvent(events);
      const birthYear = birthEv?.year || p.birth?.date?.year || null;
      const deathYear = p.death?.date?.year || null;
      const birthPlace = birthEv?.place || null;
      
      const era = birthYear ? getEraForYear(birthYear) : null;

      persons.push({ person: p, birthYear, deathYear, birthPlace, era });
    }

    // Sort by birth year ascending
    return persons.sort((a, b) => (a.birthYear || 9999) - (b.birthYear || 9999));
  }, [tree, selectedSurname]);

  // Stats for Header
  const stats = useMemo(() => {
    const total = surnamePersons.length;
    const males = surnamePersons.filter(p => p.person.sex === 'M').length;
    const females = surnamePersons.filter(p => p.person.sex === 'F').length;
    const knownYears = surnamePersons.map(p => p.birthYear).filter(Boolean) as number[];
    const minYear = knownYears.length > 0 ? Math.min(...knownYears) : null;
    const maxYear = knownYears.length > 0 ? Math.max(...knownYears) : null;
    const placesWithBirth = surnamePersons.filter(p => p.birthPlace).length;

    return { total, males, females, minYear, maxYear, placesWithBirth };
  }, [surnamePersons]);

  // Geocoding logic
  useEffect(() => {
    if (!selectedSurname || surnamePersons.length === 0) return;
    
    const places = new Set<string>();
    surnamePersons.forEach(p => {
      if (p.birthPlace) places.add(p.birthPlace);
    });

    if (places.size === 0) {
      setGeoMap(new Map());
      return;
    }

    let isMounted = true;
    setLoading(true);
    setProgress(0);

    batchGeocode(Array.from(places), false, (done, total) => {
      if (isMounted) setProgress(Math.round((done / total) * 100));
    }).then(map => {
      if (isMounted) {
        setGeoMap(map);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [selectedSurname, surnamePersons]);

  // Bubble Map Data Prep
  const mapData = useMemo(() => {
    const groups = new Map<string, { lat: number, lng: number, eraCounts: Record<string, number>, total: number, place: string }>();
    
    surnamePersons.forEach(p => {
      if (!p.birthPlace || !p.era) return;
      if (!selectedEras.has(p.era.id)) return; // Filtered out

      const geo = geoMap.get(p.birthPlace);
      if (!geo) return;

      const key = `${geo.lat},${geo.lng}`;
      if (!groups.has(key)) {
        groups.set(key, { lat: geo.lat, lng: geo.lng, eraCounts: {}, total: 0, place: p.birthPlace });
      }

      const g = groups.get(key)!;
      g.eraCounts[p.era.id] = (g.eraCounts[p.era.id] || 0) + 1;
      g.total += 1;
    });

    return Array.from(groups.values());
  }, [surnamePersons, geoMap, selectedEras]);

  // Export to Excel (CSV)
  const handleExportCSV = () => {
    if (!selectedSurname) return;
    const headers = ['Ime i prezime', 'Spol', 'Rođen/a', 'Umro/la', 'Mjesto rođenja'];
    const rows = surnamePersons.map(p => [
      p.person.names[0]?.full || '',
      p.person.sex,
      p.birthYear?.toString() || '',
      p.deathYear?.toString() || '',
      p.birthPlace || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Prezime_${selectedSurname}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleEra = (eraId: string) => {
    const next = new Set(selectedEras);
    if (next.has(eraId)) {
      // Don't allow deselecting the last one
      if (next.size > 1) next.delete(eraId);
    } else {
      next.add(eraId);
    }
    setSelectedEras(next);
  };

  if (!tree) return null;

  // ==========================================
  // PHASE 1: INITIAL SEARCH & CLOUD VIEW
  // ==========================================
  if (!selectedSurname) {
    return (
      <div className="absolute inset-0 overflow-y-auto bg-slate-50 custom-scrollbar">
        <div className="flex flex-col items-center justify-center min-h-full p-6">
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 py-10">
            
            <div className="w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
              <input
                type="text"
                placeholder="Pretraži prezime..."
                className="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-xl font-bold text-slate-700 shadow-sm focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  {searchResults.map(s => (
                    <button
                      key={s.surname}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center justify-between transition-colors"
                      onClick={() => setSelectedSurname(s.surname)}
                    >
                      <span className="font-bold text-slate-700 text-lg">{s.surname}</span>
                      <span className="text-slate-400 font-medium text-sm">{s.count} osoba</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-slate-800">Najčešća prezimena</h2>
                <p className="text-slate-500 font-medium mt-1">Klikni na prezime kako bi vidio mjesto rođenja na karti</p>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-3">
                {surnamesList.slice(0, 50).map(s => (
                  <button
                    key={s.surname}
                    onClick={() => setSelectedSurname(s.surname)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-all flex items-center gap-2 group shadow-sm"
                  >
                    <span className="font-bold text-slate-700 group-hover:text-teal-700">{s.surname}</span>
                    <span className="text-xs font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100">{s.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PHASE 2: SURNAME DASHBOARD
  // ==========================================
  return (
    <div className="absolute inset-0 overflow-y-auto bg-slate-50 custom-scrollbar">
      <div className="flex flex-col min-h-full relative">
        
        {/* 1. Header Area */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedSurname(null)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors shrink-0"
            title="Povratak na pretragu"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-teal-600 leading-tight">{selectedSurname}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500 mt-1">
              <span className="flex items-center gap-1 font-bold text-slate-700"><Users size={14} className="text-slate-400" /> {stats.total} osoba</span>
              <span className="text-slate-300">•</span>
              <span><span className="text-blue-500 font-bold">♂</span> {stats.males} muškaraca</span>
              <span className="text-slate-300">•</span>
              <span><span className="text-pink-500 font-bold">♀</span> {stats.females} žena</span>
              <span className="text-slate-300">•</span>
              <span className="font-bold">godine rođenja {stats.minYear || '?'}.–{stats.maxYear || '?'}.</span>
              <span className="text-slate-300">•</span>
              <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md border border-teal-100 font-bold">{stats.placesWithBirth} s mjestom rođenja · {geoMap.size} mapirano</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 gap-4">
        
        {/* 2. Era Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto custom-scrollbar no-scrollbar pb-1 md:pb-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 px-2">EPOHA:</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {ERAS.map(era => {
                const isActive = selectedEras.has(era.id);
                return (
                  <button
                    key={era.id}
                    onClick={() => toggleEra(era.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm flex items-center gap-1.5`}
                    style={{ 
                      backgroundColor: isActive ? era.color : '#f8fafc', 
                      color: isActive ? '#fff' : '#64748b',
                      borderColor: isActive ? era.color : '#e2e8f0'
                    }}
                  >
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />}
                    {era.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="text-xs font-medium text-slate-400 shrink-0 hidden md:block">
            · klikni za kombiniranje epoha · veća točka = više ljudi
          </div>
        </div>

        {/* 3. Map Container */}
        <div className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col shrink-0" style={{ height: 450 }}>
          <div className="flex-1 relative">
            {loading && (
              <div className="absolute inset-0 z-[2000] bg-white/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-100">
                  <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-bold text-slate-700">Tražim lokacije na karti... {progress}%</span>
                </div>
              </div>
            )}
            
            <MapContainer center={[48, 16]} zoom={5} zoomControl={false} scrollWheelZoom={false} className="w-full h-full z-0">
              <ZoomControl position="topleft" />
              <LayersControl position="topright">
                <BaseLayer checked name="CARTO Positron (Zadano)">
                  <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                </BaseLayer>
                <BaseLayer name="Satelit">
                  <TileLayer attribution='&copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                </BaseLayer>
              </LayersControl>

              {mapData.map((data, i) => {
                const erasPresent = Object.entries(data.eraCounts).sort((a, b) => b[1] - a[1]);
                return erasPresent.map(([eraId, count], eIdx) => {
                  const eraObj = ERAS.find(e => e.id === eraId)!;
                  const radius = Math.max(6, Math.min(30, 4 + count * 2));
                  return (
                    <CircleMarker 
                      key={`m-${i}-${eraId}`}
                      center={[data.lat, data.lng]}
                      radius={radius}
                      pathOptions={{ 
                        color: eraObj.color, 
                        fillColor: eraObj.color, 
                        fillOpacity: 0.6, 
                        weight: 2 
                      }}
                    >
                      <Popup className="rounded-xl overflow-hidden shadow-xl border-0">
                        <div className="p-2 min-w-[200px]">
                          <div className="font-black text-slate-800 border-b border-slate-100 pb-2 mb-2 text-sm">
                            📍 {data.place}
                          </div>
                          <div className="text-xs text-slate-600 mb-1 font-bold">
                            Rođenih s prezimenom {selectedSurname}:
                          </div>
                          {erasPresent.map(([eid, c]) => {
                            const eObj = ERAS.find(e => e.id === eid)!;
                            return (
                              <div key={eid} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                                <span className="font-bold" style={{ color: eObj.color }}>{eObj.label}</span>
                                <span className="font-bold bg-slate-100 px-2 rounded-md">{c} osoba</span>
                              </div>
                            );
                          })}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                });
              })}
            </MapContainer>
          </div>
          
          {/* Map Footer */}
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-500">
            <span>Sva mjesta razriješena preko OpenStreetMap</span>
            <span className="text-teal-600">{mapData.length} lokacija mapirano na osnovu filtera</span>
          </div>
        </div>

        {/* 4. Table Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col shrink-0">
          
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
            <h3 className="font-extrabold text-slate-700 text-lg">
              Osobe s prezimenom <span className="text-teal-600">{selectedSurname}</span> ({stats.total})
            </h3>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-xl font-bold text-sm transition-colors shadow-sm"
            >
              <Download size={16} /> Excel izvoz
            </button>
          </div>

          <div className="relative">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-xs border-b border-slate-200">Ime i prezime</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-xs border-b border-slate-200">Rođen/a</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-xs border-b border-slate-200">Umro/la</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-xs border-b border-slate-200">Mjesto rođenja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {surnamePersons.map(({ person, birthYear, deathYear, birthPlace }, idx) => (
                  <tr key={person.id + idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3 flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                        ${person.sex === 'M' ? 'bg-blue-50 text-blue-500 border border-blue-100' : 
                          person.sex === 'F' ? 'bg-pink-50 text-pink-500 border border-pink-100' : 
                          'bg-slate-100 text-slate-400 border border-slate-200'}`}
                      >
                        {person.sex === 'M' ? '♂' : person.sex === 'F' ? '♀' : '?'}
                      </span>
                      <span className="font-bold text-slate-700 group-hover:text-teal-600 transition-colors">
                        {person.names[0]?.full || 'Nepoznato'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-600">
                      {birthYear ? <span className="bg-slate-100 px-2 py-0.5 rounded-md">{birthYear}.</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-600">
                      {deathYear ? <span className="bg-slate-100 px-2 py-0.5 rounded-md">{deathYear}.</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-500 max-w-[250px] truncate" title={birthPlace || ''}>
                      {birthPlace || <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
    </div>
  );
}
