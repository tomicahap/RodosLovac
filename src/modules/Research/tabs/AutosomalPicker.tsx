import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { analyzeBestTesters, analyzeTargetAncestor, AncestorGroup, TargetGenerationGroup, AutosomalTester } from '../utils/dnaAutosomalAnalyzer';
import { Network, Search, ChevronDown, ChevronRight, User, AlertTriangle, ArrowRight, Download, X } from 'lucide-react';
import PersonSearch from '../../../components/PersonSearch';
import { ConnectionModal } from './ConnectionModal';
import { TabHeader } from '../components/TabHeader';

export default function AutosomalPicker() {
  const { tree, graph, selectedPersonId, setSelectedPerson, setComparePersonId, setActiveModule } = useApp();
  
  const [atMode, setAtMode] = useState<'best' | 'target'>('best');
  const [targetId, setTargetId] = useState<string | null>(null);

  // Filters for Best Testers (Mod 1)
  const [filterGen, setFilterGen] = useState<string>('Sve');
  const [filterRel, setFilterRel] = useState<string>('Sve');
  const [filterSide, setFilterSide] = useState<string>('Sve');
  const [sortMode, setSortMode] = useState<'coverage' | 'gen' | 'count'>('coverage');
  
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  const [selectedConnection, setSelectedConnection] = useState<AutosomalTester | null>(null);

  // MOD 1: Best Testers Data
  const bestTestersGroups = useMemo(() => {
    if (!tree || !graph || !selectedPersonId) return [];
    return analyzeBestTesters(tree, graph, selectedPersonId);
  }, [tree, graph, selectedPersonId]);

  const filteredBestTesters = useMemo(() => {
    let result = [...bestTestersGroups];

    if (filterGen !== 'Sve') {
      const genNum = filterGen === 'Roditelj' ? 1 : filterGen === 'Djed/Baka' ? 2 : filterGen === 'Pradjed/Prabaka' ? 3 : 0;
      if (genNum) result = result.filter(g => g.generation === genNum);
    }

    if (filterSide !== 'Sve') {
      const targetSide = filterSide === 'Očeva strana' ? 'Paternal' : 'Maternal';
      result = result.filter(g => g.side === targetSide);
    }

    if (filterRel !== 'Sve') {
      result = result.map(g => {
        const filteredTesters = g.testers.filter(t => t.relationTitle.includes(filterRel));
        return { ...g, testers: filteredTesters, maxCm: filteredTesters.length > 0 ? filteredTesters[0].cmEstimate : 0 };
      }).filter(g => g.testers.length > 0);
    }

    if (sortMode === 'coverage') {
      result.sort((a, b) => b.maxCm - a.maxCm);
    } else if (sortMode === 'count') {
      result.sort((a, b) => b.testers.length - a.testers.length);
    } else if (sortMode === 'gen') {
      result.sort((a, b) => a.generation - b.generation);
    }

    return result;
  }, [bestTestersGroups, filterGen, filterRel, filterSide, sortMode]);

  // MOD 2: Target Ancestor Data
  const targetGroups = useMemo(() => {
    if (!tree || !graph || !targetId) return [];
    return analyzeTargetAncestor(tree, graph, targetId);
  }, [tree, graph, targetId]);

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCompare = (tester: AutosomalTester) => {
    if (!selectedPersonId) return;
    setSelectedConnection(tester);
  };

  const totalTargetDescendants = targetGroups.reduce((acc, g) => acc + g.descendants.length, 0);

  const totalFilteredTesters = filteredBestTesters.reduce((acc, g) => acc + g.testers.length, 0);
  const totalBranches = filteredBestTesters.length;

  const exportCSV = () => {
    // Implement export functionality
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabHeader 
        title="Odabir autosomalnog DNK"
        icon={<Network size={24} className="text-red-600" />}
        description="Stariji živući rođaci nose više DNK određenog pretka nego vi. Grupirani prema pretku čiju granu pomažu rekonstruirati, ovo su najvrjednije osobe za testiranje autosomalnog DNK."
        helpKey="dna"
        onExportExcel={exportCSV}
      />

      <div className="flex-1 overflow-y-auto bg-slate-50">
        
        {/* TABOVI MODA RADA */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 pt-4 bg-white shrink-0">
          <button 
            onClick={() => setAtMode('best')}
            className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all ${
              atMode === 'best' 
                ? 'bg-slate-50 text-red-700 border-t border-x border-slate-200' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Pronađi najbolje kandidate
          </button>

          <button 
            onClick={() => setAtMode('target')}
            className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all ${
              atMode === 'target' 
                ? 'bg-slate-50 text-red-700 border-t border-x border-slate-200' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Ciljaj pretka
          </button>
        </div>

      {atMode === 'best' && (
        <div className="flex-1 flex flex-col">
          {/* Info Panel & Stats */}
          <div className="p-6 border-b border-slate-200 bg-white shrink-0">
            <div className="max-w-3xl mb-6">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">FOKUSNA OSOBA</label>
              {selectedPersonId ? (
                <div>
                  <div className="text-lg font-bold text-red-700 mb-2">{tree?.persons.get(selectedPersonId)?.names[0]?.full}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setFilterSide('Očeva strana')} className="px-3 py-1 bg-cyan-50 text-cyan-700 text-xs font-bold rounded hover:bg-cyan-100">Očeva strana</button>
                    <button onClick={() => setFilterSide('Majčina strana')} className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded hover:bg-purple-100">Majčina strana</button>
                    <button onClick={() => setFilterSide('Sve')} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded hover:bg-slate-200">Sve strane</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Odaberite fokusnu osobu u glavnoj tražilici na vrhu ekrana.</p>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mr-2">Generacija:</label>
                <select value={filterGen} onChange={e => setFilterGen(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1 outline-none">
                  <option value="Sve">Sve</option>
                  <option value="Roditelj">Roditelj</option>
                  <option value="Djed/Baka">Djed/Baka</option>
                  <option value="Pradjed/Prabaka">Pradjed/Prabaka</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mr-2">Srodstvo:</label>
                <select value={filterRel} onChange={e => setFilterRel(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1 outline-none">
                  <option value="Sve">Sve</option>
                  <option value="Brat/Sestra">Brat/Sestra</option>
                  <option value="bratić">Bratić/Sestrična</option>
                  <option value="Ujak/Teta/Stric">Ujak/Teta/Stric</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mr-2">Sortiranje:</label>
                <select value={sortMode} onChange={e => setSortMode(e.target.value as any)} className="text-sm border border-slate-300 rounded-md px-2 py-1 outline-none">
                  <option value="coverage">Pokrivenost (Coverage)</option>
                  <option value="gen">Po generaciji</option>
                  <option value="count">Najviše kandidata</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6">
            {!selectedPersonId ? (
              <div className="text-center text-slate-400 mt-10">Odaberite fokusnu osobu za početak.</div>
            ) : filteredBestTesters.length === 0 ? (
              <div className="text-center text-slate-400 mt-10">Nema pronađenih kandidata za zadane filtre.</div>
            ) : (
              <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                <div className="flex justify-between items-end mb-2 border-b border-slate-200 pb-3">
                  <div className="text-lg font-black text-slate-700">
                    <span className="text-red-600">{totalFilteredTesters}</span> živućih kandidata kroz <span className="text-slate-500">{totalBranches}</span> grana predaka
                  </div>
                </div>

                {filteredBestTesters.map(group => {
                  const isExpanded = expandedCards.has(group.ancestor.id);
                  const sideColor = group.side === 'Paternal' ? 'text-cyan-600 bg-cyan-50' : group.side === 'Maternal' ? 'text-purple-600 bg-purple-50' : 'text-slate-600 bg-slate-50';
                  const sideText = group.side === 'Paternal' ? 'Očeva strana' : group.side === 'Maternal' ? 'Majčina strana' : '';

                  return (
                    <div key={group.ancestor.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div 
                        className="p-4 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors"
                        onClick={() => toggleExpand(group.ancestor.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-slate-400">
                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">{group.genTitle}</div>
                            <div className="text-lg font-black text-slate-800">
                              {group.ancestor.names[0]?.full} 
                              <span className="text-sm font-medium text-slate-500 ml-2">({group.ancestor.birth?.date?.year || '?'}–{group.ancestor.death?.date?.year || '?'})</span>
                            </div>
                            {sideText && <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${sideColor}`}>{sideText}</div>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-slate-700">{group.testers.length} <span className="text-sm font-bold text-slate-400 uppercase">Kandidata</span></div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 p-4">
                          <div className="flex flex-col gap-3">
                            {group.testers.map((t, idx) => {
                              return (
                                <div key={t.person.id + idx} className="bg-white border border-slate-200 p-4 rounded-lg flex items-center justify-between shadow-sm">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <User size={16} className={t.person.sex === 'M' ? 'text-cyan-500' : t.person.sex === 'F' ? 'text-pink-500' : 'text-slate-400'} />
                                      <span className="font-black text-cyan-700 text-lg">{t.person.names[0]?.full}</span>
                                      <span className="text-slate-400 font-medium">r. {t.person.birth?.date?.year || '?'}</span>
                                      {t.isHalf && <span className="bg-orange-100 text-orange-700 text-xs font-black px-2 py-0.5 rounded uppercase ml-2">Polu-</span>}
                                    </div>
                                    <div className="text-sm text-slate-500 font-medium tracking-wide mb-1">
                                      {t.relationTitle} od {tree?.persons.get(selectedPersonId)?.names[0]?.full} · <span className="font-bold text-slate-600">vaš {t.relationTitle.toLowerCase()}</span>
                                    </div>
                                    <div className="text-sm mt-1.5">
                                      {t.multiplier === 1 ? (
                                        <>Nosi <span className="text-red-500 font-bold">~{t.cmEstimate} cM</span> od predaka {group.ancestor.names[0]?.given} — <span className="text-slate-500">otprilike isto kao i vi</span></>
                                      ) : t.multiplier > 1 ? (
                                        <>vi <span className="text-red-500 font-bold">~{t.cmEstimate * t.multiplier} cM</span> · <span className="text-slate-600 font-bold">≈{t.multiplier}× više</span> od ove grane</>
                                      ) : (
                                        <>Nosi <span className="text-red-500 font-bold">~{t.cmEstimate} cM</span> od predaka {group.ancestor.names[0]?.given}</>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-2 items-end">
                                    <button onClick={() => handleCompare(t)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-black rounded-lg hover:bg-slate-50 hover:border-slate-400 flex items-center gap-1 shadow-sm transition-all">
                                      Prikaži vezu <ArrowRight size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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

      {atMode === 'target' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-white shrink-0">
            <div className="max-w-2xl mb-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">      
                <p className="text-sm text-slate-600">Odaberite pretka kako biste pronašli njegove najbliže živuće potomke — najbolje kandidate za DNK test. cM = centimorgani.</p>
            </div>

            <div className="max-w-md">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">CILJANI PREDAK</label>
              {!targetId ? (
                <div className="border-2 border-red-200 rounded-xl bg-red-50 p-2">
                  <PersonSearch onSelect={(id) => setTargetId(id)} />
                </div>
              ) : (
                <div className="border-2 border-red-400 bg-red-50 rounded-xl p-4 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="font-black text-red-700 text-lg mb-1">{tree?.persons.get(targetId)?.names[0]?.full}</div>
                    <div className="text-sm font-bold text-red-500 flex items-center gap-2">
                      <span>b. {tree?.persons.get(targetId)?.birth?.date?.year || '?'}</span>
                      {tree?.persons.get(targetId)?.death?.date?.year && <span>· d. {tree.persons.get(targetId)?.death?.date?.year}</span>}
                      {tree?.persons.get(targetId)?.birth?.place && <span className="truncate max-w-[150px]">· {tree.persons.get(targetId)?.birth?.place?.split(',')[0]}</span>}
                    </div>
                  </div>
                  <button onClick={() => setTargetId(null)} className="px-3 py-1.5 bg-white text-red-600 font-bold text-sm rounded-lg border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1 shadow-sm">
                    <X size={16} /> Očisti
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!targetId ? (
              <div className="text-center text-slate-400 mt-10">Upišite ime pretka iznad kako biste pretražili stablo.</div>
            ) : targetGroups.length === 0 ? (
              <div className="text-center text-slate-400 mt-10">Osoba nema zabilježenih živućih potomaka u stablu.</div>
            ) : (
              <div className="max-w-4xl mx-auto">
                <div className="text-lg font-black text-slate-700 mb-6 border-b border-slate-200 pb-2">
                  <span className="text-red-600">{totalTargetDescendants}</span> živućih potomaka od <span className="text-slate-500">{tree?.persons.get(targetId)?.names[0]?.full}</span>
                </div>

                <div className="flex flex-col gap-6">
                  {targetGroups.map(group => (
                    <div key={group.generation} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-slate-100 p-4 flex justify-between items-center border-b border-slate-200">
                        <div className="font-black text-slate-600 uppercase tracking-widest text-sm">GENERACIJA {group.generation} — {group.title}</div>
                        <div className="text-right text-xs font-bold text-slate-500">
                          prosjek <span className="text-red-500 font-black">~{group.avgCm} cM</span> · raspon {group.rangeCm} cM
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {group.descendants.map((d, idx) => (
                          <div key={d.person.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                            <div className="flex items-start gap-3">
                              <span className="text-slate-400 font-black text-xs mt-1 w-4 text-right">{idx + 1}.</span>
                              <User size={16} className={`mt-1 shrink-0 ${d.person.sex === 'M' ? 'text-cyan-500' : d.person.sex === 'F' ? 'text-pink-500' : 'text-slate-400'}`} />
                              <div>
                                <div className="font-bold text-slate-800">{d.person.names[0]?.full}</div>
                                <div className="text-xs text-slate-500 font-medium">
                                  b. {d.person.birth?.date?.year || '?'}
                                  {d.person.birth?.place && <span> · {d.person.birth.place.split(',')[0]}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="font-black text-red-500 ml-2 whitespace-nowrap">~{d.cmEstimate} cM</div>
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
      )}

      </div>

      {selectedConnection && (
        <ConnectionModal 
          tester={selectedConnection}
          onClose={() => setSelectedConnection(null)} 
        />
      )}
    </div>
  );
}
