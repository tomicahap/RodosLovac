import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useApp } from '../../context/AppContext';
import { Download, X, ChevronDown, ChevronRight, MapPin, Users } from 'lucide-react';
import { getCountryFromPlace, getHistoricalState } from '../../utils/countryHelper';

interface LocationStats {
  label: string;
  count: number;
  percentage: number;
  color: string;
  personIds: string[];
  isModernFallback: boolean;
}

export default function OriginsTab() {
  const { tree, graph, selectedPersonId, setSelectedPerson } = useApp();
  
  const [viewMode, setViewMode] = useState<'countries' | 'lands'>('lands');
  const [analysisType, setAnalysisType] = useState<'overall' | 'over_time'>('overall');
  const [depth, setDepth] = useState<number>(4);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);

  const selectedPerson = selectedPersonId && tree ? tree.persons.get(selectedPersonId) : null;

  // Get ancestors up to specified depth
  const ancestors = useMemo(() => {
    if (!graph || !selectedPersonId) return [];
    return graph.getAncestors(selectedPersonId, depth === 99 ? 50 : depth);
  }, [graph, selectedPersonId, depth]);

  // Compute overall statistics
  const stats = useMemo(() => {
    if (!tree || ancestors.length === 0) return { list: [], unknownCount: 0, total: 0, totalKnown: 0 };

    const locationCounts = new Map<string, { ids: string[], isModern: boolean }>();
    let unknownCount = 0;

    ancestors.forEach(a => {
      // Don't count the focal person in origins if we only want ancestors, but usually getAncestors includes focal person at gen 0. 
      // If we want to skip focal person, we could check a.distance > 0. Let's include all returned.
      const p = tree.persons.get(a.personId);
      if (p) {
        const place = p.birth?.place;
        if (place) {
          let loc = '';
          let isModern = false;
          if (viewMode === 'countries') {
            loc = getCountryFromPlace(place);
          } else {
            const modern = getCountryFromPlace(place);
            const year = p.birth?.date?.year || null;
            loc = getHistoricalState(modern, year);
            if (loc === modern && year !== null) {
               // It's the modern country because no specific mapping was found or it was post-1991
               isModern = true;
            } else if (!year) {
               isModern = true;
            }
          }
          if (!loc) loc = 'Nepoznato';
          
          if (!locationCounts.has(loc)) locationCounts.set(loc, { ids: [], isModern: false });
          const entry = locationCounts.get(loc)!;
          entry.ids.push(p.id);
          if (isModern) entry.isModern = true;
        } else {
          unknownCount++;
        }
      }
    });

    const total = ancestors.length;
    const totalKnown = total - unknownCount;

    // We use a clean pastel color palette for regions
    const colorScale = d3.scaleOrdinal([
      '#2dd4bf', '#3b82f6', '#f97316', '#a855f7', 
      '#ec4899', '#eab308', '#84cc16', '#0ea5e9',
      '#6366f1', '#f43f5e', '#14b8a6', '#d946ef'
    ]);

    const list: LocationStats[] = Array.from(locationCounts.entries())
      .map(([label, data]) => ({
        label,
        count: data.ids.length,
        percentage: total > 0 ? Math.round((data.ids.length / total) * 100) : 0,
        color: colorScale(label),
        personIds: data.ids,
        isModernFallback: data.isModern
      }))
      .sort((a, b) => b.count - a.count);

    return { list, unknownCount, total, totalKnown };
  }, [tree, ancestors, viewMode]);

  // Compute "Over time" statistics
  const overTimeStats = useMemo(() => {
    if (analysisType !== 'over_time' || !tree || ancestors.length === 0) return [];

    const gens = new Map<number, { total: number, unknown: number, locs: Map<string, number> }>();
    
    ancestors.forEach(a => {
      const gen = a.generation;
      if (!gens.has(gen)) gens.set(gen, { total: 0, unknown: 0, locs: new Map() });
      const g = gens.get(gen)!;
      g.total++;
      
      const p = tree.persons.get(a.personId);
      const place = p?.birth?.place;
      if (place) {
        let loc = '';
        if (viewMode === 'countries') {
          loc = getCountryFromPlace(place);
        } else {
          const modern = getCountryFromPlace(place);
          const year = p?.birth?.date?.year || null;
          loc = getHistoricalState(modern, year);
        }
        if (!loc) loc = 'Nepoznato';
        g.locs.set(loc, (g.locs.get(loc) || 0) + 1);
      } else {
        g.unknown++;
      }
    });

    return Array.from(gens.entries()).sort((a, b) => a[0] - b[0]).map(([gen, data]) => {
      const segments = Array.from(data.locs.entries()).map(([label, count]) => {
        const globalStat = stats.list.find(s => s.label === label);
        return {
          label,
          count,
          percentage: Math.round((count / data.total) * 100),
          color: globalStat?.color || '#ccc'
        };
      }).sort((a, b) => b.count - a.count);
      
      return {
        generation: gen,
        total: data.total,
        unknown: data.unknown,
        unknownPercentage: Math.round((data.unknown / data.total) * 100),
        segments
      };
    });
  }, [analysisType, tree, ancestors, viewMode, stats.list]);

  // Summary Text
  const summaryText = useMemo(() => {
    if (stats.list.length === 0) return "Nema dovoljno podataka za analizu podrijetla.";
    const topRegions = stats.list.slice(0, 3);
    const topPercent = topRegions.reduce((sum, l) => sum + l.percentage, 0);
    const names = topRegions.map(l => l.label);
    
    let regionsStr = names[0];
    if (names.length === 2) regionsStr = `${names[0]} i ${names[1]}`;
    if (names.length >= 3) regionsStr = `${names.slice(0, -1).join(', ')} i ${names[names.length - 1]}`;

    return `${topPercent}% praćenog podrijetla (do odabrane dubine) dolazi iz regija: ${regionsStr}.`;
  }, [stats]);

  const toggleLocation = (label: string) => {
    setExpandedLocation(prev => prev === label ? null : label);
  };

  const renderExpandedList = (personIds: string[]) => {
    const persons = personIds.map(id => tree?.persons.get(id)).filter(Boolean) as any[];
    persons.sort((a, b) => (a.birth?.date?.year || 0) - (b.birth?.date?.year || 0));

    return (
      <div className="mt-3 pl-6 pr-2 py-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border-l-2 border-slate-100 ml-2">
        {persons.map(p => (
          <div key={p.id} onClick={() => setSelectedPerson(p.id)} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border
              ${p.sex === 'M' ? 'bg-blue-50 border-blue-100 text-blue-500' : p.sex === 'F' ? 'bg-pink-50 border-pink-100 text-pink-500' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
              {p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs text-slate-700 truncate">{p.names[0]?.full}</div>
              <div className="text-[9px] text-slate-500 truncate">{p.birth?.date?.year ? `${p.birth.date.year}.` : 'Nepoznato'}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!selectedPersonId) return null;

  return (
    <div className="flex-1 flex flex-col px-4 pb-4 overflow-hidden min-h-0 bg-slate-50 gap-4">
      
      {/* UI Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0 flex flex-col gap-4 print:hidden">
        {/* Top Row: Person & Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {selectedPerson && (
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-4 shadow-sm shrink-0
                  ${selectedPerson.sex === 'M' ? 'bg-teal-50 border-teal-200 text-teal-600'
                  : selectedPerson.sex === 'F' ? 'bg-pink-50 border-pink-200 text-pink-500'
                  : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                  {selectedPerson.sex === 'M' ? '♂' : selectedPerson.sex === 'F' ? '♀' : '?'}
                </div>
                <div>
                  <h2 className="font-extrabold text-lg text-slate-800 leading-tight">{selectedPerson.names[0]?.full || 'Nepoznato'}</h2>
                  <div className="text-xs text-slate-500 font-medium">
                    {selectedPerson.birth?.date?.year ? `Rođen/a ${selectedPerson.birth.date.year}.` : 'Nepoznata godina rođenja'}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm">
              <Download size={14} /> PDF
            </button>
            <button onClick={() => setSelectedPerson(null)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors">
              <X size={14} /> Zatvori
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3">
          
          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setViewMode('lands')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${viewMode === 'lands' ? 'bg-white text-teal-600 shadow-sm border border-teal-100' : 'text-slate-500 hover:text-slate-700'}`}>Povijesno</button>
            <button onClick={() => setViewMode('countries')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${viewMode === 'countries' ? 'bg-white text-teal-600 shadow-sm border border-teal-100' : 'text-slate-500 hover:text-slate-700'}`}>Moderno</button>
          </div>

          <div className="w-px h-6 bg-slate-200" />

          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setAnalysisType('overall')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${analysisType === 'overall' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}>Overall</button>
            <button onClick={() => setAnalysisType('over_time')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${analysisType === 'over_time' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}>Over time</button>
          </div>

          <div className="w-px h-6 bg-slate-200" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Dubina:</span>
            <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200">
              {[4, 6, 99].map(d => (
                <button key={d} onClick={() => setDepth(d)} className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${depth === d ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  {d === 99 ? 'Sve' : `${d}G`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
        
        {analysisType === 'overall' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
            
            {/* Stacked Bar Chart */}
            <div className="flex flex-col gap-3">
              <div className="h-8 w-full flex rounded-xl overflow-hidden shadow-sm border border-slate-200/50">
                {stats.list.map(s => s.percentage > 0 && (
                  <div key={s.label} style={{ width: `${s.percentage}%`, backgroundColor: s.color }} className="h-full group relative cursor-pointer hover:brightness-110 transition-all border-r border-white/20 last:border-0" title={`${s.label}: ${s.percentage}%`}></div>
                ))}
                {stats.total > 0 && stats.unknownCount > 0 && (
                  <div style={{ width: `${Math.round((stats.unknownCount / stats.total) * 100)}%` }} className="h-full bg-slate-200 border-l border-white/50" title={`Nepoznato: ${Math.round((stats.unknownCount / stats.total) * 100)}%`} />
                )}
              </div>
              <p className="text-slate-600 font-medium text-sm leading-relaxed px-1">
                <MapPin className="inline text-teal-500 mr-1.5 -mt-0.5" size={16} />
                {summaryText}
              </p>
            </div>

            {/* Detailed Progress Bars List */}
            <div className="flex flex-col gap-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">Detaljni popis regija</h3>
              
              {stats.list.map(s => (
                <div key={s.label} className="flex flex-col bg-white border border-slate-100 rounded-xl overflow-hidden transition-all hover:border-slate-300 hover:shadow-sm">
                  <div onClick={() => toggleLocation(s.label)} className="flex items-center gap-3 p-3 cursor-pointer bg-slate-50/30">
                    <div className="w-4 h-4 rounded shadow-sm shrink-0" style={{ backgroundColor: s.color }} />
                    <div className="flex-1 min-w-0 font-bold text-slate-700 text-sm flex items-center gap-1.5">
                      {s.label}
                      {s.isModernFallback && <span className="text-amber-500 text-xs" title="Moderna država (nema povijesnog podatka)">*</span>}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full rounded-full" style={{ width: `${s.percentage}%`, backgroundColor: s.color }} />
                      </div>
                      <div className="text-right min-w-[60px]">
                        <span className="font-extrabold text-slate-800">{s.percentage}%</span>
                        <span className="text-slate-400 text-xs font-medium ml-1">· {s.count}</span>
                      </div>
                      <div className="text-slate-400">
                        {expandedLocation === s.label ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                  </div>
                  
                  {expandedLocation === s.label && renderExpandedList(s.personIds)}
                </div>
              ))}

              {/* Missing Birthplaces Row */}
              {stats.unknownCount > 0 && (
                <div className="mt-2 flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-100/50 text-slate-500">
                  <div className="w-4 h-4 rounded bg-slate-300 shrink-0" />
                  <div className="flex-1 min-w-0 font-bold text-sm flex items-center gap-1.5">
                    Nepoznata mjesta rođenja
                  </div>
                  <div className="text-right text-sm">
                    <span className="italic text-xs mr-3">Potrebno istražiti {stats.unknownCount} predaka</span>
                    <span className="font-extrabold">{Math.round((stats.unknownCount / stats.total) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Promjena podrijetla kroz generacije</h3>
            
            <div className="flex flex-col gap-6">
              {overTimeStats.map(genData => (
                <div key={genData.generation} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end text-xs font-bold text-slate-600 mb-1 px-1">
                    <span>Generacija {genData.generation}</span>
                    <span className="text-slate-400">{genData.total} osoba</span>
                  </div>
                  <div className="h-6 w-full flex rounded-lg overflow-hidden shadow-sm border border-slate-200/50">
                    {genData.segments.map(s => s.percentage > 0 && (
                      <div key={s.label} style={{ width: `${s.percentage}%`, backgroundColor: s.color }} className="h-full group relative cursor-pointer hover:brightness-110 transition-all border-r border-white/20 last:border-0" title={`${s.label}: ${s.percentage}%`}></div>
                    ))}
                    {genData.unknownPercentage > 0 && (
                      <div style={{ width: `${genData.unknownPercentage}%` }} className="h-full bg-slate-200 border-l border-white/50" title={`Nepoznato: ${genData.unknownPercentage}%`} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 px-1">
                    {genData.segments.map(s => s.percentage > 4 && (
                      <div key={s.label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                        {s.label} {s.percentage}%
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
