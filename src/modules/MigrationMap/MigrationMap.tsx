import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
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

interface MigrationRoute {
  personId: string; personName: string;
  fromGeo: GeoLocation; toGeo: GeoLocation;
  fromPlace: string; toPlace: string;
  year?: number;
  type: 'birth-death' | 'residence' | 'immigration';
}

const TYPE_COLORS: Record<string, string> = { 'birth-death': '#608bff', 'residence': '#f59e0b', 'immigration': '#10b981' };
const TYPE_LABELS: Record<string, string> = { 'birth-death': 'Rođenje → Smrt', 'residence': 'Prebivanje', 'immigration': 'Imigracija' };

export default function MigrationMap() {
  const { tree } = useApp();
  const [routes, setRoutes] = useState<MigrationRoute[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentYear, setCurrentYear] = useState(1800);
  const [useNominatim, setUseNominatim] = useState(true);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allYears = useMemo(() => routes.map(r=>r.year).filter((y): y is number => !!y).sort((a,b)=>a-b), [routes]);
  const minYear = allYears[0] || 1700;
  const maxYear = allYears[allYears.length-1] || new Date().getFullYear();

  useEffect(() => {
    if (!tree) return;
    setLoading(true);
    const places: string[] = [];
    const migrations: Array<{ personId: string; personName: string; fromPlace: string; toPlace: string; year?: number; type: MigrationRoute['type'] }> = [];
    for (const p of tree.persons.values()) {
      const name = p.names[0]?.full || 'Nepoznato';
      const birthPlace = p.birth?.place;
      const deathPlace = p.death?.place;
      const birthYear = p.birth?.date?.year;
      if (birthPlace && deathPlace && birthPlace !== deathPlace) {
        places.push(birthPlace, deathPlace);
        migrations.push({ personId: p.id, personName: name, fromPlace: birthPlace, toPlace: deathPlace, year: birthYear, type: 'birth-death' });
      }
      for (const ev of p.events) {
        if ((ev.tag === 'RESI' || ev.tag === 'IMMI' || ev.tag === 'EMIG') && ev.place && birthPlace && ev.place !== birthPlace) {
          places.push(birthPlace, ev.place);
          migrations.push({ personId: p.id, personName: name, fromPlace: birthPlace, toPlace: ev.place, year: ev.date?.year, type: ev.tag === 'IMMI' ? 'immigration' : 'residence' });
        }
      }
    }
    batchGeocode(places, useNominatim, (done, total) => setProgress(Math.round((done/total)*100))).then(geoMap => {
      const result: MigrationRoute[] = [];
      for (const m of migrations) {
        const fromGeo = geoMap.get(m.fromPlace);
        const toGeo = geoMap.get(m.toPlace);
        if (fromGeo && toGeo) result.push({ ...m, fromGeo, toGeo });
      }
      setRoutes(result);
      setLoading(false);
    });
  }, [tree, useNominatim]);

  const visibleRoutes = useMemo(() => routes.filter(r => !r.year || r.year <= currentYear), [routes, currentYear]);

  const startPlay = useCallback(() => {
    setPlaying(true); setCurrentYear(minYear);
    playRef.current = setInterval(() => {
      setCurrentYear(y => {
        if (y >= maxYear) { clearInterval(playRef.current!); setPlaying(false); return maxYear; }
        return y + 5;
      });
    }, 200);
  }, [minYear, maxYear]);

  const stopPlay = useCallback(() => { if (playRef.current) clearInterval(playRef.current); setPlaying(false); }, []);

  if (!tree) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Karta migracija</h2>
          <p className="section-subtitle">Rute preseljenja između mjesta rođenja i mjesta smrti/prebivanja</p>
        </div>
      </div>
      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <button className={`btn ${playing ? 'btn-danger' : 'btn-primary'}`}
          onClick={playing ? stopPlay : startPlay} disabled={routes.length===0||loading}>
          {playing ? '⏹ Zaustavi' : '▶ Animiraj'}
        </button>
        <div className="flex-1 min-w-48">
          <input type="range" min={minYear} max={maxYear} value={currentYear}
            onChange={e => { stopPlay(); setCurrentYear(Number(e.target.value)); }} className="w-full" />
          <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>{minYear}</span>
            <span className="font-semibold text-[var(--text-primary)]">{currentYear}</span>
            <span>{maxYear}</span>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={useNominatim} onChange={e => setUseNominatim(e.target.checked)} />
          <span className="text-[var(--text-secondary)]">Online fallback</span>
        </label>
        <span className="text-sm text-[var(--text-muted)]">{visibleRoutes.length} od {routes.length} ruta</span>
      </div>
      <div className="flex gap-4 flex-wrap text-xs">
        {Object.entries(TYPE_LABELS).map(([type, label]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="w-8 h-0.5 rounded" style={{ backgroundColor: TYPE_COLORS[type], display:'inline-block'}}></span>
            <span style={{ color: TYPE_COLORS[type] }} className="font-medium">{label}</span>
          </span>
        ))}
      </div>
      {loading && (
        <div className="card p-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-4 h-4 border-2 border-[var(--brand-color)] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Geokodiranje... {progress}%</span>
          </div>
          <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      <div className="card overflow-hidden" style={{ height: 520 }}>
        <MapContainer center={[48,12]} zoom={4} style={{ height:'100%', width:'100%' }} scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {visibleRoutes.map((route, i) => (
            <React.Fragment key={`${route.personId}-${i}`}>
              <Polyline positions={[[route.fromGeo.lat,route.fromGeo.lng],[route.toGeo.lat,route.toGeo.lng]]}
                pathOptions={{ color: TYPE_COLORS[route.type], weight: 2, opacity: 0.6, dashArray: '6 4' }}>
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <strong>{route.personName}</strong><br/>
                    {route.fromPlace} → {route.toPlace}<br/>
                    {route.year && <span>{route.year}</span>}
                  </div>
                </Popup>
              </Polyline>
              <CircleMarker center={[route.toGeo.lat,route.toGeo.lng]} radius={4}
                pathOptions={{ color: TYPE_COLORS[route.type], fillColor: TYPE_COLORS[route.type], fillOpacity: 0.8, weight: 1 }} />
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Karta migracija"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>Karta migracija</strong> služi za prostorno-vremensku vizualizaciju selidbi članova vaše obitelji kroz povijest. Povezuje točke rođenja s točkama smrti ili boravišta kako bi se stvorila jasna slika kretanja.
          </p>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kazalo rute (boje):</h4>
          <ul className="list-none pl-1 space-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <span className="w-8 h-0.5 rounded bg-[#608bff] inline-block"></span>
              <strong>Rođenje → Smrt (Plavo):</strong> Poveznica između mjesta rođenja i mjesta smrti pojedinca (najčešća životna migracija).
            </li>
            <li className="flex items-center gap-2">
              <span className="w-8 h-0.5 rounded bg-[#f59e0b] inline-block"></span>
              <strong>Prebivanje (Žuto):</strong> Selidba ili promjena prebivališta (Residence) tijekom života.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-8 h-0.5 rounded bg-[#10b981] inline-block"></span>
              <strong>Imigracija (Zeleno):</strong> Službeni događaj useljavanja ili iseljavanja zabilježen u stablom.
            </li>
          </ul>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kako koristiti:</h4>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Animacija migracije:</strong> Kliknite na gumb <strong>▶ Animiraj</strong> kako biste automatski pokrenuli kronološki slijed selidbi. Karta će prikazivati linije kako se koja povijesna godina doseže, vizualizirajući tok naseljavanja obitelji.
            </li>
            <li>
              <strong>Klizač vremena:</strong> Povucite klizač na vrhu kako biste ručno filtrirali rute koje su se dogodile do te godine.
            </li>
          </ul>
        </div>
      </HelpModal>
    </div>
  );
}
