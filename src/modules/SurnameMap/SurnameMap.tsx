// ============================================================
// Surname Map Module
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

export default function SurnameMap() {
  const { tree } = useApp();
  const [selectedSurname, setSelectedSurname] = useState<string>('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [geoMap, setGeoMap] = useState<Map<string, GeoLocation>>(new Map());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [centuryFilter, setCenturyFilter] = useState<number | null>(null);
  const [useNominatim, setUseNominatim] = useState(true);

  const surnames = useMemo(() => {
    if (!tree) return [];
    const counts = new Map<string, number>();
    for (const p of tree.persons.values()) {
      const s = p.names[0]?.surname;
      if (s) counts.set(s, (counts.get(s) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([s, c]) => ({ surname: s, count: c }));
  }, [tree]);

  useEffect(() => {
    if (surnames.length > 0 && !selectedSurname) {
      setSelectedSurname(surnames[0].surname);
    }
  }, [surnames]);

  const filteredPersons = useMemo(() => {
    if (!tree || !selectedSurname) return [];
    const persons = [];
    for (const p of tree.persons.values()) {
      if (p.names[0]?.surname !== selectedSurname) continue;
      if (!p.birth?.place) continue;
      const birthYear = p.birth?.date?.year;
      if (centuryFilter && birthYear) {
        const century = Math.floor(birthYear / 100) * 100;
        if (century !== centuryFilter) continue;
      }
      persons.push(p);
    }
    return persons;
  }, [tree, selectedSurname, centuryFilter]);

  const placeGroups = useMemo(() => {
    const groups = new Map<string, typeof filteredPersons>();
    for (const p of filteredPersons) {
      const place = p.birth!.place!;
      if (!groups.has(place)) groups.set(place, []);
      groups.get(place)!.push(p);
    }
    return groups;
  }, [filteredPersons]);

  useEffect(() => {
    if (placeGroups.size === 0) return;
    setLoading(true);
    const places = Array.from(placeGroups.keys());
    batchGeocode(places, useNominatim, (done, total) => setProgress(Math.round((done / total) * 100)))
      .then(m => { setGeoMap(m); setLoading(false); });
  }, [placeGroups, useNominatim]);

  const centuries = useMemo(() => {
    if (!tree || !selectedSurname) return [];
    const cs = new Set<number>();
    for (const p of tree.persons.values()) {
      if (p.names[0]?.surname !== selectedSurname) continue;
      const y = p.birth?.date?.year;
      if (y) cs.add(Math.floor(y / 100) * 100);
    }
    return Array.from(cs).sort();
  }, [tree, selectedSurname]);

  if (!tree) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Karta prezimena</h2>
          <p className="section-subtitle">Prikaz mjesta gdje su osobe s odabranim prezimenom rođene</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-secondary)]">Prezime:</label>
          <select className="input w-48" value={selectedSurname} onChange={e => setSelectedSurname(e.target.value)}>
            {surnames.map(s => <option key={s.surname} value={s.surname}>{s.surname} ({s.count})</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-secondary)]">Stoljeće:</label>
          <select className="input w-32" value={centuryFilter ?? ''} onChange={e => setCenturyFilter(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Sva</option>
            {centuries.map(c => <option key={c} value={c}>{c}.-ih</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={useNominatim} onChange={e => setUseNominatim(e.target.checked)} />
          <span className="text-[var(--text-secondary)]">Online fallback</span>
        </label>
        <span className="text-sm text-[var(--text-muted)]">{filteredPersons.length} osoba · {placeGroups.size} lokacija</span>
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

      <div className="card overflow-hidden" style={{ height: 520 }}>
        <MapContainer center={[48, 16]} zoom={5} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {Array.from(placeGroups.entries()).map(([place, persons]) => {
            const geo = geoMap.get(place);
            if (!geo) return null;
            return (
              <CircleMarker key={place} center={[geo.lat, geo.lng]}
                radius={Math.max(5, Math.min(22, persons.length * 4))}
                pathOptions={{ color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.7, weight: 2 }}>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong>{place}</strong>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{persons.length} osobu s prezimenom {selectedSurname}</div>
                    <ul style={{ marginTop: 6, padding: 0, listStyle: 'none', fontSize: 11 }}>
                      {persons.slice(0, 8).map(p => (
                        <li key={p.id}>{p.names[0]?.full}{p.birth?.date?.year ? ` (${p.birth.date.year})` : ''}</li>
                      ))}
                      {persons.length > 8 && <li style={{ color: '#888' }}>...i {persons.length - 8} više</li>}
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
        title="Karta prezimena"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>Karta prezimena</strong> omogućuje vam geografsku i vremensku vizualizaciju distribucije određenog prezimena u vašem obiteljskom stablu. Pomaže vam prepoznati ishodište (kolijevku) određenog roda.
          </p>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kako koristiti kartu:</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Odabir prezimena:</strong> Izbornik prikazuje sva prezimena u stablu poredana po učestalosti (broj osoba u zagradi). Odaberite prezime za osvježavanje karte.
            </li>
            <li>
              <strong>Filter stoljeća:</strong> Možete suziti prikaz samo na osobe rođene u određenom stoljeću (npr. 1800.-ih). To vam omogućuje da vidite kako su se obitelji kretale i širile geografski kroz stoljeća.
            </li>
            <li>
              <strong>Markeri na karti:</strong> Ljubičasti krugovi predstavljaju mjesta rođenja osoba s odabranim prezimenom. Veličina kruga je proporcionalna broju osoba rođenih na toj lokaciji. Kliknite na krug za popis osoba i godine rođenja.
            </li>
          </ul>
        </div>
      </HelpModal>
    </div>
  );
}
