import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { parseAllPlaces, getPlacesStats, PlaceInfo } from './utils/placeParser';
import { ChevronDown, Search, MapPin } from 'lucide-react';
import PlaceModal from './PlaceModal';

type SortOption = 'people' | 'alpha' | 'earliest' | 'latest' | 'span';

export default function PlacesIndex() {
  const { tree, selectedPersonId } = useApp();

  const [scope, setScope] = useState<'all' | 'ancestors'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [historicalFilter, setHistoricalFilter] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceInfo | null>(null);

  const selectedPersonName = useMemo(() => {
    if (!tree || !selectedPersonId) return null;
    return tree.persons.get(selectedPersonId)?.names[0]?.full || null;
  }, [tree, selectedPersonId]);

  // Parse Data — fully synchronous, no API calls, instant
  const placesList = useMemo(() => {
    if (!tree) return [];
    const placesMap = parseAllPlaces(tree, scope === 'ancestors' ? selectedPersonId : null);
    return Array.from(placesMap.values());
  }, [tree, scope, selectedPersonId]);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    placesList.forEach(p => counts.set(p.country, (counts.get(p.country) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [placesList]);

  const historicalLands = useMemo(() => {
    const counts = new Map<string, number>();
    placesList.forEach(p => {
      if (p.historicalLand) counts.set(p.historicalLand, (counts.get(p.historicalLand) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [placesList]);

  const filteredPlaces = useMemo(() => {
    let result = placesList;
    if (countryFilter) result = result.filter(p => p.country === countryFilter);
    if (historicalFilter) result = result.filter(p => p.historicalLand === historicalFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }
    return result.sort((a, b) => {
      switch (sortOption) {
        case 'alpha': return a.name.localeCompare(b.name);
        case 'earliest': return (a.minYear || 9999) - (b.minYear || 9999);
        case 'latest': return (b.maxYear || 0) - (a.maxYear || 0);
        case 'span': {
          const spanA = a.minYear && a.maxYear ? a.maxYear - a.minYear : 0;
          const spanB = b.minYear && b.maxYear ? b.maxYear - b.minYear : 0;
          return spanB - spanA;
        }
        case 'people':
        default:
          return b.people.size - a.people.size;
      }
    });
  }, [placesList, countryFilter, historicalFilter, searchQuery, sortOption]);

  const stats = useMemo(() => getPlacesStats(filteredPlaces), [filteredPlaces]);

  if (!tree) return null;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-slate-50 custom-scrollbar">
      <div className="flex flex-col min-h-full max-w-7xl mx-auto w-full p-4 gap-4">

        {/* UPPER FILTER BAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1 w-full sm:w-auto">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setScope('ancestors')}
                  disabled={!selectedPersonId}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${scope === 'ancestors' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50'}`}
                >
                  {selectedPersonName ? `Preci: ${selectedPersonName.split(' ')[0]}` : 'Preci'}
                </button>
                <button
                  onClick={() => setScope('all')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${scope === 'all' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Cijelo stablo
                </button>
              </div>

              <div className="relative shrink-0">
                <select
                  value={countryFilter}
                  onChange={e => setCountryFilter(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-xl py-2 pl-4 pr-10 text-sm font-bold text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 cursor-pointer"
                >
                  <option value="">Sve države ({countries.length})</option>
                  {countries.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative shrink-0">
                <select
                  value={historicalFilter}
                  onChange={e => setHistoricalFilter(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-xl py-2 pl-4 pr-10 text-sm font-bold text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 cursor-pointer max-w-[200px] truncate"
                >
                  <option value="">Sve regije ({historicalLands.length})</option>
                  {historicalLands.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative shrink-0">
                <select
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value as SortOption)}
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-xl py-2 pl-4 pr-10 text-sm font-bold text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 cursor-pointer"
                >
                  <option value="people">Najviše ljudi</option>
                  <option value="alpha">Mjesta A-Z</option>
                  <option value="earliest">Najranije prvo</option>
                  <option value="latest">Najnovije</option>
                  <option value="span">Najdulji raspon</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="relative w-full sm:w-auto shrink-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pretraži mjesta..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              {stats.totalPlaces} mjesta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {stats.totalPeople} osoba
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              {stats.totalCountries} država
            </span>
            <span className="text-slate-300">·</span>
            <span>Klikni na mjesto za detalje</span>
          </div>
        </div>

        {/* MAIN TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 shrink-0 flex flex-col">
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Mjesto</th>
                  <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Država</th>
                  <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">Oznaka</th>
                  <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      Ljudi {sortOption === 'people' && <ChevronDown size={12} />}
                    </div>
                  </th>
                  <th className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">Godine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlaces.map((place, idx) => {
                  const parts = place.name.split(',');
                  const mainName = parts[0].trim();
                  const subtext = parts.length > 1 ? parts.slice(1).join(', ').trim() : '';
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-teal-50/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedPlace(place)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-extrabold text-slate-800 text-sm group-hover:text-teal-600 transition-colors">{mainName}</div>
                        {subtext && <div className="text-[10px] font-medium text-slate-400 mt-0.5 truncate max-w-xs" title={subtext}>{subtext}</div>}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap text-xs">{place.country}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {place.badge && (
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow-sm border
                            ${place.badge === 'CORE' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                            {place.badge}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-black text-slate-700 text-sm whitespace-nowrap">{place.people.size}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-500 whitespace-nowrap text-xs">
                        {place.minYear ? `${place.minYear}.` : '—'} – {place.maxYear ? `${place.maxYear}.` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPlaces.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-bold">Nema rezultata za odabrane filtere</div>
            )}
          </div>
        </div>
      </div>

      {selectedPlace && (
        <PlaceModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      )}
    </div>
  );
}
