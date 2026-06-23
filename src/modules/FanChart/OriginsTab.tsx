import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useApp } from '../../context/AppContext';
import { Globe, MapPin, Milestone, Users } from 'lucide-react';

interface LocationStats {
  label: string;
  count: number;
  percentage: number;
  color: string;
  personIds: string[];
}

const getPlaceLand = (place: string | null): string | null => {
  if (!place) return null;
  const parts = place.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[0] || null;
};

export default function OriginsTab() {
  const { tree, graph, selectedPersonId, setSelectedPerson } = useApp();
  const [viewMode, setViewMode] = useState<'countries' | 'lands'>('countries');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Get all ancestors
  const ancestors = useMemo(() => {
    if (!graph || !selectedPersonId) return [];
    return graph.getAncestors(selectedPersonId, 50); // get all generations
  }, [graph, selectedPersonId]);

  // Compute statistics
  const stats = useMemo(() => {
    if (!tree || ancestors.length === 0) return { list: [], totalKnown: 0, totalUnknown: 0 };

    const locationCounts = new Map<string, string[]>();
    let unknownCount = 0;

    ancestors.forEach(a => {
      const p = tree.persons.get(a.personId);
      if (p) {
        const place = p.birth?.place;
        if (place) {
          const loc = viewMode === 'countries'
            ? place.split(',').pop()?.trim() || 'Nepoznato'
            : getPlaceLand(place) || 'Nepoznato';
          
          if (!locationCounts.has(loc)) locationCounts.set(loc, []);
          locationCounts.get(loc)!.push(p.id);
        } else {
          unknownCount++;
        }
      }
    });

    const totalKnown = Array.from(locationCounts.values()).reduce((sum, ids) => sum + ids.length, 0);

    // Color scales
    const colorScale = d3.scaleOrdinal(viewMode === 'countries' ? d3.schemeSet2 : d3.schemeSet3);

    const list: LocationStats[] = Array.from(locationCounts.entries())
      .map(([label, personIds]) => ({
        label,
        count: personIds.length,
        percentage: totalKnown > 0 ? Math.round((personIds.length / totalKnown) * 100) : 0,
        color: colorScale(label),
        personIds
      }))
      .sort((a, b) => b.count - a.count);

    return { list, totalKnown, totalUnknown: unknownCount };
  }, [tree, ancestors, viewMode]);

  // Donut chart path calculations
  const donutPaths = useMemo(() => {
    if (stats.list.length === 0) return [];
    const pie = d3.pie<LocationStats>().value(d => d.count)(stats.list);
    const arcGen = d3.arc<d3.PieArcDatum<LocationStats>>()
      .innerRadius(65)
      .outerRadius(100)
      .padAngle(0.02)
      .cornerRadius(4);

    return pie.map(p => ({
      path: arcGen(p)!,
      color: p.data.color,
      label: p.data.label,
      count: p.data.count,
      percentage: p.data.percentage,
    }));
  }, [stats]);

  // Get ancestors list for the selected location
  const locationAncestors = useMemo(() => {
    if (!selectedLocation || !tree) return [];
    const locStat = stats.list.find(s => s.label === selectedLocation);
    if (!locStat) return [];

    return locStat.personIds.map(id => {
      const p = tree.persons.get(id)!;
      return {
        id: p.id,
        name: p.names[0]?.full || 'Nepoznato',
        sex: p.sex,
        birthYear: p.birth?.date?.year ?? null,
        deathYear: p.death?.date?.year ?? null,
        place: p.birth?.place || ''
      };
    }).sort((a, b) => (a.birthYear || 0) - (b.birthYear || 0));
  }, [selectedLocation, stats, tree]);

  if (!selectedPersonId) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 animate-fade-in custom-scrollbar">
      
      {/* View mode toggle */}
      <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-teal-600" />
          <h3 className="font-extrabold text-slate-700 text-sm">Geografsko podrijetlo predaka</h3>
        </div>
        <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button
            onClick={() => { setViewMode('countries'); setSelectedLocation(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'countries'
                ? 'bg-teal-50 border border-teal-100 text-teal-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Države
          </button>
          <button
            onClick={() => { setViewMode('lands'); setSelectedLocation(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'lands'
                ? 'bg-teal-50 border border-teal-100 text-teal-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Krajevi (Regije)
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      {stats.totalKnown === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-200 p-8 h-80">
          <MapPin size={36} className="text-slate-300 mb-2" />
          <p className="font-semibold text-center">Nema upisanih mjesta rođenja za pretke ove osobe</p>
          <p className="text-xs text-center text-slate-500 mt-1">Upišite lokacije rođenja u GEDCOM kako biste vidjeli statistiku podrijetla.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Donut Chart - Left */}
          <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[300px]">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Pregled udjela lokacija</h4>
            
            <div className="relative w-56 h-56">
              <svg width="100%" height="100%" viewBox="0 0 220 220" className="-rotate-90">
                <g transform="translate(110, 110)">
                  {donutPaths.map((d, i) => (
                    <path
                      key={i}
                      d={d.path}
                      fill={d.color}
                      className="transition-transform duration-200 origin-center hover:scale-105 cursor-pointer"
                      onClick={() => setSelectedLocation(selectedLocation === d.label ? null : d.label)}
                    >
                      <title>{`${d.label}: ${d.count} (${d.percentage}%)`}</title>
                    </path>
                  ))}
                </g>
              </svg>
              
              {/* Donut inner text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800 leading-none">{stats.totalKnown}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lociranih</span>
                {stats.totalUnknown > 0 && (
                  <span className="text-[9px] text-slate-400 mt-1">({stats.totalUnknown} nepoznato)</span>
                )}
              </div>
            </div>
          </div>

          {/* Location details list - Right */}
          <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Distribucija podrijetla</h4>
            
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[320px] pr-2 custom-scrollbar">
              {stats.list.map(item => (
                <div
                  key={item.label}
                  onClick={() => setSelectedLocation(selectedLocation === item.label ? null : item.label)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    selectedLocation === item.label
                      ? 'border-teal-500 bg-teal-50/30'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-md shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                      <span className="font-extrabold text-slate-800">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-500">
                      {item.count} {item.count === 1 ? 'predak' : 'predaka'} · <span className="text-teal-600 font-extrabold">{item.percentage}%</span>
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Selected Location Ancestors List */}
      {selectedLocation && locationAncestors.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 animate-fade-in shrink-0">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-teal-600" />
              Predci podrijetlom iz: <span className="text-teal-700 font-extrabold">{selectedLocation}</span>
            </h4>
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Zatvori popis
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {locationAncestors.map(anc => (
              <div
                key={anc.id}
                onClick={() => setSelectedPerson(anc.id)}
                className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center gap-3 cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border
                  ${anc.sex === 'M' ? 'bg-blue-50 border-blue-100 text-blue-500' 
                  : anc.sex === 'F' ? 'bg-pink-50 border-pink-100 text-pink-500' 
                  : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                  {anc.sex === 'M' ? '♂' : anc.sex === 'F' ? '♀' : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-800 truncate">{anc.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {anc.birthYear ? `${anc.birthYear}–${anc.deathYear || ''}` : 'Nepoznate godine'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
