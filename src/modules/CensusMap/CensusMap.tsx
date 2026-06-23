// ============================================================
// Census Map Module — residence events on map by year
// ============================================================

import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { batchGeocode } from '../../utils/geocoder';
import type { GeoLocation } from '../../parser/gedcomTypes';
import { HelpButton, HelpModal } from '../../components/HelpModal';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Standard US census years
const CENSUS_YEARS = [1790, 1800, 1810, 1820, 1830, 1840, 1850, 1860, 1870, 1880, 1900, 1910, 1920, 1930, 1940, 1950];

interface ResidenceEntry {
  personId: string;
  personName: string;
  place: string;
  geo?: GeoLocation;
  year: number;
  eventType: 'RESI' | 'CENS' | 'BIRT' | 'DEAT';
}

export default function CensusMap() {
  const { tree } = useApp();
  const [selectedYear, setSelectedYear] = useState(1900);
  const [helpOpen, setHelpOpen] = useState(false);
  const [geoMap, setGeoMap] = useState<Map<string, GeoLocation>>(new Map());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [useNominatim, setUseNominatim] = useState(true);
  const [yearTolerance, setYearTolerance] = useState(5);

  const allEntries = useMemo(() => {
    if (!tree) return [];
    const entries: ResidenceEntry[] = [];
    for (const p of tree.persons.values()) {
      const name = p.names[0]?.full || 'Nepoznato';
      // Residence events
      for (const ev of p.events) {
        if ((ev.tag === 'RESI' || ev.tag === 'CENS') && ev.place && ev.date?.year) {
          entries.push({ personId: p.id, personName: name, place: ev.place, year: ev.date.year, eventType: ev.tag as any });
        }
      }
      // Birth location as proxy for early years
      if (p.birth?.place && p.birth.date?.year) {
        entries.push({ personId: p.id, personName: name, place: p.birth.place, year: p.birth.date.year, eventType: 'BIRT' });
      }
    }
    return entries;
  }, [tree]);

  const allPlaces = useMemo(() => Array.from(new Set(allEntries.map(e => e.place))), [allEntries]);

  useEffect(() => {
    if (allPlaces.length === 0) return;
    setLoading(true);
    batchGeocode(allPlaces, useNominatim, (done, total) => setProgress(Math.round((done / total) * 100)))
      .then(m => { setGeoMap(m); setLoading(false); });
  }, [allPlaces, useNominatim]);

  const filtered = useMemo(() =>
    allEntries.filter(e => Math.abs(e.year - selectedYear) <= yearTolerance),
    [allEntries, selectedYear, yearTolerance]
  );

  const byPlace = useMemo(() => {
    const groups = new Map<string, ResidenceEntry[]>();
    for (const e of filtered) {
      if (!geoMap.has(e.place)) continue;
      if (!groups.has(e.place)) groups.set(e.place, []);
      groups.get(e.place)!.push(e);
    }
    return groups;
  }, [filtered, geoMap]);

  const eventColor = (type: string) => {
    if (type === 'CENS') return '#10b981';
    if (type === 'RESI') return '#f59e0b';
    if (type === 'BIRT') return '#60a5fa';
    return '#94a3b8';
  };

  if (!tree) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Popisna karta</h2>
          <p className="section-subtitle">Gdje je obitelj živjela u odabranom razdoblju · fokus 1790–1950</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-secondary)]">Godina:</label>
          <input
            type="range" min={1700} max={2020} step={1}
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="w-40"
          />
          <span className="text-sm font-semibold text-[var(--text-primary)] w-12">{selectedYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-secondary)]">Tolerancija ±:</label>
          <select className="input w-24" value={yearTolerance} onChange={e => setYearTolerance(Number(e.target.value))}>
            {[1, 2, 5, 10, 15, 20].map(t => <option key={t} value={t}>{t} god.</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={useNominatim} onChange={e => setUseNominatim(e.target.checked)} />
          <span className="text-[var(--text-secondary)]">Online fallback</span>
        </label>
        <span className="text-sm text-[var(--text-muted)]">{filtered.length} evidencija · {byPlace.size} lokacija</span>
      </div>

      {/* Quick year jumps */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-[var(--text-muted)] self-center">Brzi odabir:</span>
        {CENSUS_YEARS.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              Math.abs(selectedYear - y) <= yearTolerance
                ? 'bg-[var(--brand-light)] border-[var(--brand-color)] text-[var(--brand-color)]'
                : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
            }`}>
            {y}
          </button>
        ))}
      </div>

      {loading && (
        <div className="card p-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-4 h-4 border-2 border-[var(--brand-color)] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-[var(--text-secondary)]">Geokodiranje... {progress}%</span>
          </div>
          <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        {[['CENS', '#10b981', 'Popis'], ['RESI', '#f59e0b', 'Stanovanje'], ['BIRT', '#60a5fa', 'Rodno mjesto']].map(([t, c, l]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, display: 'inline-block' }}></span>
            <span style={{ color: c }}>{l}</span>
          </span>
        ))}
      </div>

      <div className="card overflow-hidden" style={{ height: 520 }}>
        <MapContainer center={[40, -20]} zoom={3} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {Array.from(byPlace.entries()).map(([place, entries]) => {
            const geo = geoMap.get(place)!;
            const dominantType = entries[0].eventType;
            return (
              <CircleMarker key={place} center={[geo.lat, geo.lng]}
                radius={Math.max(5, Math.min(18, entries.length * 3))}
                pathOptions={{ color: eventColor(dominantType), fillColor: eventColor(dominantType), fillOpacity: 0.75, weight: 2 }}>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong>{place}</strong>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{entries.length} evidencija oko {selectedYear}</div>
                    <ul style={{ marginTop: 6, padding: 0, listStyle: 'none', fontSize: 11 }}>
                      {entries.slice(0, 8).map((e, i) => (
                        <li key={i}>{e.personName} · {e.year} ({e.eventType})</li>
                      ))}
                      {entries.length > 8 && <li style={{ color: '#888' }}>...i {entries.length - 8} više</li>}
                    </ul>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Popisna karta"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>Popisna karta</strong> koristi se za pretragu i prikaz mjesta prebivališta predaka u točno određenom povijesnom razdoblju. To je izuzetno korisno za usporedbu s povijesnim popisima stanovništva (Census).
          </p>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kako koristiti:</h4>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Odabir godine:</strong> Koristite klizač za odabir željene godine, ili kliknite na gumbe za brzi odabir godina (od 1790. do 1950.) koji odgovaraju povijesnim godinama popisa stanovništva.
            </li>
            <li>
              <strong>Tolerancija:</strong> Podesite vremensku toleranciju (npr. ± 5 godina). Karta će prikazati sve događaje koji su se zbili u tom rasponu (npr. za godinu 1900. i toleranciju ± 5, prikazat će se događaji od 1895. do 1905.).
            </li>
          </ul>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Značenje boja (tip događaja):</h4>
          <ul className="list-none pl-1 space-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#10b981] inline-block"></span>
              <strong>Zelena (CENS):</strong> Popis stanovništva (Census)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#f59e0b] inline-block"></span>
              <strong>Narančasta (RESI):</strong> Boravište/prebivalište (Residence)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[#60a5fa] inline-block"></span>
              <strong>Plava (BIRT):</strong> Mjesto rođenja (koristi se kao indikator boravka u ranom životu)
            </li>
          </ul>
        </div>
      </HelpModal>
    </div>
  );
}
