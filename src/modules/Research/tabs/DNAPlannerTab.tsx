import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { analyzeYdnaLines, YDnaLine, analyzeMtDnaLines, MtDnaLine } from '../utils/dnaPlannerAnalyzer';
import { Dna, ChevronDown, ChevronRight, Search, Activity, Network, AlertTriangle } from 'lucide-react';
import { TabHeader } from '../components/TabHeader';
import AutosomalPicker from './AutosomalPicker';

export default function DNAPlannerTab() {
  const { tree, selectedPersonId, setSelectedPerson, setActiveModule } = useApp();
  
  const [activeTabType, setActiveTabType] = useState<'ydna' | 'mtdna' | 'atdna'>('ydna');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'Sve' | 'Moguće testirati' | 'Ugroženo'>('Sve');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isFilteredMode, setIsFilteredMode] = useState<boolean>(false);

  const lines = useMemo(() => {
    if (!tree) return [];
    if (activeTabType === 'ydna') return analyzeYdnaLines(tree);
    if (activeTabType === 'mtdna') return analyzeMtDnaLines(tree);
    return [];
  }, [tree, activeTabType]);

  const filteredLines = useMemo(() => {
    let result = lines as any[];
    
    // Status filter
    if (activeStatusFilter === 'Moguće testirati') {
      result = result.filter(l => (activeTabType === 'ydna' ? l.livingMales.length > 0 : l.livingDescendants.length > 0) && !l.isAtRisk);
    } else if (activeStatusFilter === 'Ugroženo') {
      result = result.filter(l => l.isAtRisk);
      // Sortiraj po hitnosti
      result.sort((a, b) => {
        const aLen = activeTabType === 'ydna' ? a.livingMales.length : a.livingDescendants.length;
        const bLen = activeTabType === 'ydna' ? b.livingMales.length : b.livingDescendants.length;
        return aLen - bLen;
      });
    }

    // Person filter
    if (selectedPersonId && isFilteredMode) {
      if (activeTabType === 'ydna') {
        result = result.filter(l => l.males.some((m: any) => m.id === selectedPersonId));
      } else {
        // mtDNA filter - does the person belong to this EKA? 
        // We can check if person is in the cluster by tracing their mother, but analyzeMtDnaLines doesn't export the raw cluster.
        // But `totalCount` persons are not in the object. Oh wait, `totalCount` is just a number.
        // Actually, we can check if `livingDescendants` includes them, but what if they are dead? 
        // We need all descendants. Let's assume for now we just don't have all descendants in MtDnaLine object, so we'll just check if their ID matches `eka.id` or if they are in `livingDescendants`.
        // Wait, I should probably add `allDescendants` to MtDnaLine?
        // In dnaPlannerAnalyzer I only kept `femalesCount` and `totalCount`.
        // Let's just do:
        result = result.filter(l => l.eka.id === selectedPersonId || l.livingDescendants.some((m: any) => m.id === selectedPersonId));
      }
    }

    return result;
  }, [lines, activeStatusFilter, selectedPersonId, isFilteredMode]);

  // Counts for filters
  const countAll = lines.length;
  const countTestable = lines.filter((l: any) => (activeTabType === 'ydna' ? l.livingMales?.length > 0 : l.livingDescendants?.length > 0) && !l.isAtRisk).length;
  const countAtRisk = lines.filter((l: any) => l.isAtRisk).length;
  const uniqueSurnames = activeTabType === 'ydna' ? new Set(lines.flatMap((l: any) => l.surnames)).size : 0;
  const maxFemales = activeTabType === 'mtdna' ? Math.max(0, ...lines.map((l: any) => l.femalesCount)) : 0;

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const goToPerson = (id: string) => {
    setSelectedPerson(id);
    setActiveModule('person-stats');
  };

  if (!tree) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      
      {/* Top Nav Buttons */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200 bg-white">
        <button 
          onClick={() => setActiveTabType('ydna')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            activeTabType === 'ydna' 
              ? 'bg-blue-50 border-2 border-cyan-400 text-blue-700 shadow-sm' 
              : 'bg-white border-2 border-transparent text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Dna size={16} className={activeTabType === 'ydna' ? 'text-cyan-500' : 'text-slate-400'} />
          Y-DNA linije
        </button>

        <button 
          onClick={() => setActiveTabType('mtdna')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            activeTabType === 'mtdna' 
              ? 'bg-purple-50 border-2 border-purple-400 text-purple-700 shadow-sm' 
              : 'bg-white border-2 border-transparent text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Activity size={16} className={activeTabType === 'mtdna' ? 'text-purple-500' : 'text-slate-400'} />
          mtDNA linije
        </button>

        <button 
          onClick={() => setActiveTabType('atdna')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            activeTabType === 'atdna' 
              ? 'bg-red-50 border-2 border-red-400 text-red-700 shadow-sm' 
              : 'bg-white border-2 border-transparent text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Network size={16} className={activeTabType === 'atdna' ? 'text-red-500' : 'text-slate-400'} />
          Odabir autosomalnog DNK
        </button>
      </div>

      {activeTabType === 'ydna' && (
        <div className="flex flex-col h-full overflow-hidden">
          <TabHeader 
            title="Y-DNA patrilinearne linije"
            icon={<Dna size={24} className="text-cyan-600" />}
            description="Y-DNA se prenosi s oca na sina, praktički nepromijenjena. Ovaj alat prati svaku patrilinearnu liniju u vašem stablu i identificira najbolje živuće muške kandidate za testiranje."
            helpKey="dna"
            onExportExcel={() => {}}
          />
          {/* Info Panel & Stats */}
          <div className="p-6 border-b border-slate-200 bg-white shrink-0">
            <div className="flex flex-col mb-8 mt-4">
              <div className="text-5xl font-black text-cyan-500 mb-1">{countAll}</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wide">
                pronađenih patrilinearnih linija · {uniqueSurnames} jedinstvenih prezimena
              </div>
            </div>

            {/* Person Filter UI */}
            {selectedPersonId && isFilteredMode ? (
              <div className="max-w-2xl mb-8 p-4 bg-cyan-50 border border-cyan-100 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-xs font-black text-cyan-600 uppercase tracking-wider mb-0.5">FILTRIRANO ZA OSOBU:</div>
                  <div className="font-bold text-cyan-900 text-lg flex items-center gap-2">
                    {tree?.persons.get(selectedPersonId)?.names[0]?.full}
                  </div>
                  <div className="text-xs text-cyan-700/80 font-medium mt-1">Prikazuje se samo linija u koju spada ova osoba.</div>
                </div>
                <button 
                  onClick={() => setIsFilteredMode(false)}
                  className="px-3 py-1.5 bg-white border border-cyan-200 text-cyan-700 text-xs font-bold rounded-lg hover:bg-cyan-100 transition-colors shadow-sm"
                >
                  Prikaži sve linije
                </button>
              </div>
            ) : (
              <div className="max-w-2xl mb-8">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                  FOKUSNA OSOBA
                </label>
                <div className="relative">
                  <p className="text-sm font-medium text-slate-500 mb-3">
                    Odaberite fokusnu osobu u glavnoj tražilici na vrhu ekrana kako biste rangirali i obojili linije prema tome kako se povezuju s tom osobom.
                  </p>
                  {selectedPersonId && (
                    <button 
                      onClick={() => setIsFilteredMode(true)}
                      className="px-4 py-2 bg-cyan-50 border border-cyan-200 text-cyan-700 text-sm font-bold rounded-lg hover:bg-cyan-100 transition-colors shadow-sm flex items-center gap-2"
                    >
                      <Search size={16} />
                      Filtriraj rezultate za odabranu osobu ({tree?.persons.get(selectedPersonId)?.names[0]?.full})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Status Filters */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveStatusFilter('Sve')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeStatusFilter === 'Sve' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Sve ({countAll})
              </button>
              <button 
                onClick={() => setActiveStatusFilter('Moguće testirati')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeStatusFilter === 'Moguće testirati' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Moguće testirati ({countTestable})
              </button>
              <button 
                onClick={() => setActiveStatusFilter('Ugroženo')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeStatusFilter === 'Ugroženo' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ugroženo ({countAtRisk})
              </button>
            </div>
          </div>

          {/* Lines List */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {filteredLines.length === 0 ? (
              <div className="text-center text-slate-400 py-12 font-medium">
                Nema pronađenih Y-DNA linija za odabrane kriterije.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-5xl mx-auto">
                {filteredLines.map(line => {
                  const isExpanded = expandedCards.has(line.id);
                  const title = line.surnames.length > 0 ? line.surnames.join(', ') : 'Nepoznato prezime';
                  const yearRange = `${line.minYear || '?'}.-${line.maxYear || '?'}.`;

                  return (
                    <div key={line.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all hover:border-slate-300">
                      {/* Card Header */}
                      <div 
                        className="p-4 cursor-pointer flex items-center justify-between"
                        onClick={() => toggleExpand(line.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-1 text-slate-400">
                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          </div>
                          <div>
                            <div className="text-lg font-black text-slate-800 mb-0.5">
                              {title} <span className="text-sm font-medium text-slate-500 ml-1">{line.totalMalesCount} muškaraca · {yearRange}</span>
                            </div>
                            <div className="text-sm font-medium text-slate-500">
                              Najraniji: {line.eka.names[0]?.full} ({line.eka.birth?.date?.year || '?'}.-{line.eka.death?.date?.year || '?'})
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          {line.livingMales.length === 0 ? (
                            <div className="text-orange-500 font-black text-sm flex items-center justify-end gap-1 uppercase tracking-wide">
                              <AlertTriangle size={14} /> Izumrla linija
                            </div>
                          ) : line.livingMales.length === 1 ? (
                            <div className="flex flex-col items-end">
                              <div className="text-orange-500 font-black text-xs flex items-center gap-1 uppercase tracking-wider mb-1">
                                <AlertTriangle size={14} /> ⚠️ Jedini potomak
                              </div>
                              <span className="text-sm font-bold text-cyan-600">
                                {line.livingMales[0].names[0]?.full} (r. {line.livingMales[0].birth?.date?.year || '?'})
                              </span>
                            </div>
                          ) : line.livingMales.length === 2 ? (
                            <div className="flex flex-col items-end">
                              <div className="text-orange-500 font-black text-xs flex items-center gap-1 uppercase tracking-wider mb-1">
                                <AlertTriangle size={14} /> ⚠️ Samo 2 potomka
                              </div>
                              {line.livingMales.map((bt: any) => (
                                <span key={bt.id} className="text-sm font-bold text-cyan-600">
                                  {bt.names[0]?.full} (r. {bt.birth?.date?.year || '?'})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              {line.isAtRisk ? (
                                <div className="text-orange-500 font-black text-xs flex items-center gap-1 uppercase tracking-wider mb-1">
                                  <AlertTriangle size={14} /> Ugroženo
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                  Najbolji kandidati za test {line.livingMales.length > line.bestTesters.length && `(+${line.livingMales.length - line.bestTesters.length})`}
                                </span>
                              )}
                              {line.bestTesters.map((bt: any) => (
                                <span key={bt.id} className="text-sm font-bold text-cyan-600">
                                  {bt.names[0]?.full} (r. {bt.birth?.date?.year || '?'})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 p-5">
                          {line.isAtRisk && (
                            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2 items-start">
                              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                              <p className="text-sm font-bold text-orange-800">
                                ⚠️ Nema pronađenih živućih muškaraca. Ova patrilinearna linija ne može se Y-DNA testirati nakon što posljednji muškarac premine.
                              </p>
                            </div>
                          )}
                          
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">ŽIVUĆI MUŠKARCI ({line.livingMales.length})</h4>
                          
                          {line.livingMales.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">Nema poznatih živućih muških potomaka.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {line.livingMales.map((m: any, idx: number) => (
                                <div key={m.id} className="text-sm flex items-center gap-2">
                                  <span className="text-slate-400 font-medium w-4 text-right">{idx + 1}.</span>
                                  <button 
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); goToPerson(m.id); }}
                                    className="font-bold text-cyan-600 hover:text-cyan-800 hover:underline text-left"
                                  >
                                    {m.names[0]?.full}
                                  </button>
                                  <span className="text-slate-500">r. {m.birth?.date?.year || '?'}</span>
                                  {m.events.find((e: any) => e.tag === 'RESI')?.place && (
                                    <span className="text-slate-400">· {m.events.find((e: any) => e.tag === 'RESI')?.place}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTabType === 'mtdna' && (
        <div className="flex flex-col h-full overflow-hidden">
          <TabHeader 
            title="mtDNA matilinearne linije"
            icon={<Activity size={24} className="text-purple-600" />}
            description="Mitohondrijski DNK se prenosi s majke na svu njezinu djecu, ali ga samo kćeri prenose dalje. Ovaj alat prati svaku matilinearnu liniju u vašem stablu i identificira najbolju živuću osobu za testiranje."
            helpKey="dna"
            onExportExcel={() => {}}
          />
          {/* Info Panel & Stats for mtDNA */}
          <div className="p-6 border-b border-slate-200 bg-white shrink-0">
            <div className="flex flex-col mb-8 mt-4">
              <div className="text-5xl font-black text-purple-500 mb-1">{countAll}</div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wide">
                pronađene matilinearne linije · najveća linija ima {maxFemales} žena
              </div>
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveStatusFilter('Sve')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeStatusFilter === 'Sve' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Sve ({countAll})
              </button>
              <button 
                onClick={() => setActiveStatusFilter('Moguće testirati')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeStatusFilter === 'Moguće testirati' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Moguće testirati ({countTestable})
              </button>
              <button 
                onClick={() => setActiveStatusFilter('Ugroženo')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeStatusFilter === 'Ugroženo' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ugroženo ({countAtRisk})
              </button>
            </div>
          </div>

          {/* Lines List for mtDNA */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {filteredLines.length === 0 ? (
              <div className="text-center text-slate-400 py-12 font-medium">
                Nema pronađenih mtDNA linija za odabrane kriterije.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-5xl mx-auto">
                {filteredLines.map((line: any) => {
                  const isExpanded = expandedCards.has(line.id);
                  const title = line.eka.names[0]?.full || 'Nepoznato';
                  const yearRange = `${line.minYear || '?'}.-${line.maxYear || '?'}.`;

                  return (
                    <div key={line.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all hover:border-slate-300">
                      {/* Card Header */}
                      <div 
                        className="p-4 cursor-pointer flex items-center justify-between"
                        onClick={() => toggleExpand(line.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-1 text-slate-400">
                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          </div>
                          <div>
                            <div className="text-lg font-black text-slate-800 mb-0.5">
                              {title} <span className="text-sm font-medium text-slate-500 ml-1">{line.femalesCount} žena · {yearRange}</span>
                            </div>
                            <div className="text-sm font-medium text-slate-500">
                              Najranija: {line.eka.names[0]?.full} ({line.eka.birth?.date?.year || '?'}.-{line.eka.death?.date?.year || '?'})
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          {line.atRiskReason === 'extinct' ? (
                            <div className="text-orange-500 font-black text-sm flex items-center justify-end gap-1 uppercase tracking-wide">
                              <AlertTriangle size={14} /> Izumrla linija
                            </div>
                          ) : line.atRiskReason === 'lone' ? (
                            <div className="flex flex-col items-end">
                              <div className="text-orange-500 font-black text-xs flex items-center gap-1 uppercase tracking-wider mb-1">
                                <AlertTriangle size={14} /> ⚠️ Jedini potomak
                              </div>
                              <span className="text-sm font-bold text-purple-600">
                                {line.livingDescendants[0].names[0]?.full} (r. {line.livingDescendants[0].birth?.date?.year || '?'})
                              </span>
                            </div>
                          ) : line.atRiskReason === 'two' ? (
                            <div className="flex flex-col items-end">
                              <div className="text-orange-500 font-black text-xs flex items-center gap-1 uppercase tracking-wider mb-1">
                                <AlertTriangle size={14} /> ⚠️ Samo 2 potomka
                              </div>
                              {line.livingDescendants.map((bt: any) => (
                                <span key={bt.id} className="text-sm font-bold text-purple-600">
                                  {bt.names[0]?.full} (r. {bt.birth?.date?.year || '?'})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              {line.isAtRisk && line.atRiskReason === 'no-females' ? (
                                <div className="text-orange-500 font-black text-xs flex items-center gap-1 uppercase tracking-wider mb-1">
                                  <AlertTriangle size={14} /> Ugroženo (Nema žena)
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                  Najbolji kandidati za test {line.livingDescendants.length > line.bestTesters.length && `(+${line.livingDescendants.length - line.bestTesters.length})`}
                                </span>
                              )}
                              {line.bestTesters.map((bt: any) => (
                                <span key={bt.id} className="text-sm font-bold text-purple-600">
                                  {bt.names[0]?.full} (r. {bt.birth?.date?.year || '?'})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 p-5">
                          {line.atRiskReason === 'extinct' && (
                            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2 items-start">
                              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                              <p className="text-sm font-bold text-orange-800">
                                ⚠️ Nema pronađenih živućih nasljednika. Ova matilinearna linija ne može se mtDNA testirati nakon što posljednja osoba premine.
                              </p>
                            </div>
                          )}
                          
                          {line.atRiskReason === 'no-females' && (
                            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2 items-start">
                              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
                              <p className="text-sm font-bold text-orange-800">
                                ⚠️ Nema živućih ženskih nasljednika. Ova matilinearna linija ne može se prenijeti na sljedeću generaciju.
                              </p>
                            </div>
                          )}
                          
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">ŽIVUĆI POTOMCI ({line.livingDescendants.length})</h4>
                          
                          {line.livingDescendants.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">Nema poznatih živućih potomaka.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {line.livingDescendants.map((m: any, idx: number) => (
                                <div key={m.id} className="text-sm flex items-center gap-2">
                                  <span className="text-slate-400 font-medium w-4 text-right">{idx + 1}.</span>
                                  <button 
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); goToPerson(m.id); }}
                                    className="font-bold text-purple-600 hover:text-purple-800 hover:underline text-left"
                                  >
                                    {m.names[0]?.full}
                                  </button>
                                  <span className="text-slate-500">r. {m.birth?.date?.year || '?'}</span>
                                  {m.sex === 'M' && <span className="text-xs font-bold text-slate-400 uppercase ml-1">(Muško - ne prenosi dalje)</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTabType === 'atdna' && (
        <AutosomalPicker />
      )}
    </div>
  );
}
