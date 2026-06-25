import React, { useEffect, useState, useMemo } from 'react';
import { PlaceInfo } from './utils/placeParser';
import { X, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, ZoomControl } from 'react-leaflet';
import { batchGeocode } from '../../utils/geocoder';
import { useApp } from '../../context/AppContext';

interface PlaceModalProps {
  place: PlaceInfo;
  onClose: () => void;
}

export default function PlaceModal({ place, onClose }: PlaceModalProps) {
  const { setSelectedPerson, setActiveModule } = useApp();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  const mainName = place.name.split(',')[0].trim();
  const span = (place.minYear && place.maxYear) ? place.maxYear - place.minYear : 0;

  useEffect(() => {
    setMapLoading(true);
    batchGeocode([place.name], true).then(res => {
      const g = res.get(place.name);
      if (g && g.lat && g.lng) setCoords({ lat: g.lat, lng: g.lng });
      setMapLoading(false);
    });
  }, [place.name]);

  const peopleList = useMemo(() => {
    const map = new Map<string, { person: any; birthYear?: number; deathYear?: number; events: string[] }>();
    for (const ev of place.events) {
      if (!map.has(ev.person.id)) {
        map.set(ev.person.id, {
          person: ev.person,
          birthYear: ev.person.birth?.date?.year,
          deathYear: ev.person.death?.date?.year,
          events: [ev.type],
        });
      } else {
        const entry = map.get(ev.person.id)!;
        if (!entry.events.includes(ev.type)) entry.events.push(ev.type);
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.birthYear || 9999) - (b.birthYear || 9999));
  }, [place.events]);

  const handlePersonClick = (personId: string) => {
    setSelectedPerson(personId);
    setActiveModule('person-stats');
    onClose();
  };

  const birthPeople = peopleList.filter(p => p.events.includes('BIRT'));

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-50 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>

        <div className="bg-white px-8 py-6 border-b border-slate-200 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-3xl font-black text-slate-800">{mainName}</h2>
            <p className="text-slate-500 font-bold mt-2 text-sm max-w-2xl">
              {place.people.size} osoba · {span > 0 ? `${span} godina povijesti` : 'Pojedinačni zapis'}
              {place.country !== '—' && ` · ${place.country}`}
              <br />
              <span className="text-xs font-medium text-slate-400 mt-1 block">{place.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full flex items-center justify-center transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative min-h-[250px]">
              {mapLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 text-slate-400 font-bold">
                  <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Tražim lokaciju...
                </div>
              )}
              {!mapLoading && !coords && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 text-slate-400 font-bold">
                  Lokacija nije pronađena na karti.
                </div>
              )}
              {coords && (
                <MapContainer center={[coords.lat, coords.lng]} zoom={9} zoomControl={false} scrollWheelZoom={false} className="w-full h-full z-0">
                  <ZoomControl position="bottomleft" />
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <CircleMarker center={[coords.lat, coords.lng]} radius={8} pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.5, weight: 2 }} />
                </MapContainer>
              )}
            </div>

            <div className="w-full md:w-56 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 shrink-0 flex flex-col gap-5">
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Ukupno ljudi</div>
                <div className="text-3xl font-black text-teal-600">{place.people.size}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Rođenih ovdje</div>
                <div className="text-2xl font-black text-blue-600">{birthPeople.length}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Vremenski raspon</div>
                <div className="text-lg font-black text-slate-700">{place.minYear || '?'}. – {place.maxYear || '?'}.</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Država</div>
                <div className="text-lg font-black text-slate-700">{place.country}</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-extrabold text-slate-700 mb-4 uppercase tracking-wider text-sm flex items-center gap-2">
              <MapPin size={16} className="text-teal-500" />
              POPIS OSOBA ({place.people.size})
            </h3>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-black text-slate-400 uppercase">Ime i prezime</th>
                    <th className="px-4 py-2.5 text-center text-xs font-black text-slate-400 uppercase w-24">Rođenje</th>
                    <th className="px-4 py-2.5 text-center text-xs font-black text-slate-400 uppercase w-24">Smrt</th>
                    <th className="px-4 py-2.5 text-center text-xs font-black text-slate-400 uppercase w-24">Mjesto rođenja</th>
                    <th className="px-4 py-2.5 text-right text-xs font-black text-slate-400 uppercase w-28">Događaji</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {peopleList.map((p, i) => (
                    <tr key={i} className="hover:bg-teal-50/30 transition-colors group">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handlePersonClick(p.person.id)}
                          className="font-bold text-slate-700 hover:text-teal-600 transition-colors text-left whitespace-nowrap flex items-center gap-2"
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0
                            ${p.person.sex === 'M' ? 'bg-blue-50 text-blue-500 border border-blue-100' :
                              p.person.sex === 'F' ? 'bg-pink-50 text-pink-500 border border-pink-100' :
                              'bg-slate-100 text-slate-400 border border-slate-200'}`}
                          >
                            {p.person.sex === 'M' ? '♂' : p.person.sex === 'F' ? '♀' : '?'}
                          </span>
                          {p.person.names[0]?.full || 'Nepoznato'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-600 whitespace-nowrap">
                        {p.birthYear ? `${p.birthYear}.` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-600 whitespace-nowrap">
                        {p.deathYear ? `${p.deathYear}.` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400 whitespace-nowrap">
                        {p.person.birth?.place ? p.person.birth.place.split(',')[0].trim() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {p.events.map(e => (
                            <span key={e} className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">{e}</span>
                          ))}
                        </div>
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
