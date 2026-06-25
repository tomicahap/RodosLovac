import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { analyzeNamingPatterns, Evidence, DeathPredictionInsight, Confidence } from '../utils/namingPatternsAnalyzer';
import { Download, ChevronDown, ChevronRight, Activity, Filter, Search, User, Link as LinkIcon, Star, CheckCircle, TrendingUp, Type } from 'lucide-react';
import { TabHeader } from '../components/TabHeader';

export default function NamingPatternsTab() {
  const { tree, setSelectedPerson, setActiveModule } = useApp();
  const [activeTab, setActiveTab] = useState<'OBRASCI' | 'DOKAZI' | 'SMRT'>('OBRASCI');
  
  // Obrasci state
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());

  // Dokazi filters
  const [evidenceFilter, setEvidenceFilter] = useState<'ALL' | Confidence>('ALL');
  const [sortOrder, setSortOrder] = useState<'CONFIDENCE' | 'YEAR'>('CONFIDENCE');

  // Smrt filters
  const [deathSearch, setDeathSearch] = useState('');
  const [deathSexFilter, setDeathSexFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [deathConfFilter, setDeathConfFilter] = useState<'ALL' | Confidence>('ALL');
  const [expandedDeathIds, setExpandedDeathIds] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    if (!tree) return null;
    return analyzeNamingPatterns(tree);
  }, [tree]);

  if (!results) return null;

  const { patterns, allEvidences, highlights, deathPredictions } = results;

  const goToPerson = (id?: string) => {
    if (!id) return;
    setSelectedPerson(id);
    setActiveModule('person-stats');
  };

  const exportToExcel = () => {
    const headers = ['Dijete', 'Godina rodenja', 'Nazvan(a) po', 'Godina rod. pretka', 'Uloga', 'Pouzdanost', 'Uzorak'];
    const rows = allEvidences.map(e => [
      `"${e.childName}"`, e.childBirthYear || '', `"${e.ancestorName}"`, e.ancestorBirthYear || '', `"${e.role}"`, e.confidence, `"${e.patternId}"`
    ]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tradicije_imenovanja.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExpand = (id: string) => {
    setExpandedPatterns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleDeathExpand = (id: string) => {
    setExpandedDeathIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredEvidences = useMemo(() => {
    let evs = [...allEvidences];
    if (evidenceFilter !== 'ALL') {
      evs = evs.filter(e => e.confidence === evidenceFilter);
    }
    evs.sort((a, b) => {
      if (sortOrder === 'YEAR') {
        return (a.childBirthYear || 0) - (b.childBirthYear || 0);
      }
      const order = { 'STRONG': 3, 'LIKELY': 2, 'POSSIBLE': 1 };
      return order[b.confidence] - order[a.confidence];
    });
    return evs;
  }, [allEvidences, evidenceFilter, sortOrder]);

  const filteredDeaths = useMemo(() => {
    let ds = [...deathPredictions];
    if (deathSexFilter !== 'ALL') ds = ds.filter(d => d.sex === deathSexFilter);
    if (deathConfFilter !== 'ALL') ds = ds.filter(d => d.confidence === deathConfFilter);
    if (deathSearch.trim()) {
      const s = deathSearch.toLowerCase();
      ds = ds.filter(d => d.ancestorName.toLowerCase().includes(s));
    }
    return ds;
  }, [deathPredictions, deathSearch, deathSexFilter, deathConfFilter]);

  const confBadge = (conf: Confidence) => {
    if (conf === 'STRONG') return <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">SNAŽNO</span>;
    if (conf === 'LIKELY') return <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-700">VJEROJATNO</span>;
    return <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-700">MOGUĆE</span>;
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col animate-fade-in overflow-hidden">
      
      <TabHeader 
        title="Obrasci imenovanja"
        icon={<Type size={24} className="text-pink-600" />}
        description="Otkriva kulturološke obrasce pri davanju imena u obiteljima. Često su se djeca nazivala po djedovima, bakama ili preminuloj braći."
        helpKey="naming"
        onExportExcel={exportToExcel}
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">

        {/* 1. MALA STATISTIKA I IZDVOJENI PODACI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Statistička polja */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <LinkIcon className="text-indigo-500 mb-2" size={24} />
            <div className="text-2xl font-black text-slate-800">{highlights.totalConnections}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">poveznica</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <Star className="text-emerald-500 mb-2" size={24} />
            <div className="text-2xl font-black text-slate-800">{highlights.strongConnections}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">snažnih</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <CheckCircle className="text-blue-500 mb-2" size={24} />
            <div className="text-2xl font-black text-slate-800">{highlights.likelyConnections}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">vjerojatnih</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <TrendingUp className="text-amber-500 mb-2" size={24} />
            <div className="text-2xl font-black text-slate-800">{highlights.coveragePercent.toFixed(1)}%</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">ima kandidata</div>
          </div>
        </div>

        {/* Izdvojeno */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-5 text-white shadow-md flex flex-col justify-center">
          <h3 className="text-sm font-black uppercase tracking-wider text-indigo-200 mb-3">Izdvojeno iz imenovanja</h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-indigo-300 font-bold mb-1">Najčešće reciklirana imena</div>
              <div className="text-sm font-medium">
                {highlights.mostReusedNames.map(n => `${n.name} ×${n.count}`).join(', ')}
              </div>
            </div>
            {highlights.mostCommemorated && (
              <div>
                <div className="text-xs text-indigo-300 font-bold mb-1">Najviše komemorirani</div>
                <div className="text-sm font-medium">
                  {highlights.mostCommemorated.name} — {highlights.mostCommemorated.count} ljudi nazvano po njemu/njoj
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button 
          onClick={() => setActiveTab('OBRASCI')}
          className={`px-4 py-2 font-bold text-sm rounded-t-lg border-b-2 transition-colors ${activeTab === 'OBRASCI' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Obrasci Imenovanja
        </button>
        <button 
          onClick={() => setActiveTab('DOKAZI')}
          className={`px-4 py-2 font-bold text-sm rounded-t-lg border-b-2 transition-colors ${activeTab === 'DOKAZI' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Dokazi o Imenovanju
        </button>
        <button 
          onClick={() => setActiveTab('SMRT')}
          className={`px-4 py-2 font-bold text-sm rounded-t-lg border-b-2 transition-colors ${activeTab === 'SMRT' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Pretpostavljene Godine Smrti
        </button>
      </div>

      {activeTab === 'OBRASCI' && (
        <div className="space-y-4">
          {patterns.map(p => {
            const isExpanded = expandedPatterns.has(p.id);
            const percentVal = p.eligibleFamilies > 0 ? (p.matches / p.eligibleFamilies) * 100 : 0;
            const percentStr = percentVal.toFixed(0);
            
            let frequencyBadge = 'RIJETKI OBRAZAC';
            let badgeColor = 'bg-slate-100 text-slate-500';
            if (percentVal > 40) { frequencyBadge = 'ČESTI OBRAZAC'; badgeColor = 'bg-teal-100 text-teal-700'; }
            else if (percentVal > 15) { frequencyBadge = 'POVREMENI OBRAZAC'; badgeColor = 'bg-indigo-100 text-indigo-600'; }

            const examplesToShow = p.examples.slice(0, 5);

            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6">
                  <div className="flex flex-wrap items-center justify-between mb-3 gap-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-black text-slate-800">{p.name}</h3>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${badgeColor}`}>
                        {frequencyBadge}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-400">
                      {p.matches} od {p.eligibleFamilies} prihvatljivih obitelji
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 font-medium mb-5">{p.desc}</p>

                  <div className="flex items-center gap-4 mb-5">
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 rounded-full transition-all duration-1000"
                        style={{ width: `${percentStr}%` }}
                      />
                    </div>
                    <div className="text-2xl font-black text-slate-800 w-16 text-right">{percentStr}%</div>
                  </div>

                  <button 
                    onClick={() => toggleExpand(p.id)}
                    className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none"
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {isExpanded ? 'Sakrij primjere' : `Prikaži ${examplesToShow.length} primjera`}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-2 animate-fade-in">
                    {examplesToShow.map((ex, i) => (
                      <div key={`${ex.childId}-${i}`} className="bg-white border border-slate-200 rounded-lg p-3 text-sm flex flex-col md:flex-row md:items-center gap-2">
                        <div className="flex-1 font-medium text-slate-600">
                          <button 
                            onClick={() => goToPerson(ex.childId)}
                            className="font-black text-teal-600 hover:text-teal-800 hover:underline focus:outline-none"
                          >
                            {ex.childName}
                          </button>
                          <span className="text-slate-400 ml-1 text-xs">
                            {ex.childBirthYear ? `(b. ${ex.childBirthYear})` : ''}
                          </span>
                          <span className="mx-2">nazvan/a po</span>
                          {ex.ancestorId ? (
                            <button 
                              onClick={() => goToPerson(ex.ancestorId)}
                              className="font-black text-teal-600 hover:text-teal-800 hover:underline focus:outline-none"
                            >
                              {ex.ancestorName}
                              {ex.ancestorBirthYear && <span className="text-teal-500 font-medium text-xs ml-1">(b.{ex.ancestorBirthYear})</span>}
                            </button>
                          ) : (
                            <span className="font-black text-slate-700">{ex.ancestorName}</span>
                          )}
                          <span className="text-slate-500 italic ml-1">({ex.role})</span>
                          <div className="inline-block ml-3">{confBadge(ex.confidence)}</div>
                        </div>
                      </div>
                    ))}
                    {p.examples.length > 5 && (
                      <div className="text-center pt-2 text-xs font-bold text-slate-400">
                        I još {p.examples.length - 5} ne prikazanih primjera...
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'DOKAZI' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-t-xl">
            <div>
              <h3 className="font-black text-slate-800">Vjerojatno nazvani po ({filteredEvidences.length})</h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1">
                {(['ALL', 'STRONG', 'LIKELY', 'POSSIBLE'] as const).map(f => (
                  <button 
                    key={f} onClick={() => setEvidenceFilter(f)}
                    className={`px-3 py-1 text-xs font-bold rounded-md ${evidenceFilter === f ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    {f === 'ALL' ? 'Sve' : f === 'STRONG' ? 'Snažno' : f === 'LIKELY' ? 'Vjerojatno' : 'Moguće'}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Sort:</span>
                <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSortOrder(sortOrder === 'CONFIDENCE' ? 'YEAR' : 'CONFIDENCE')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors bg-white"
                >
                  Poredaj po: {sortOrder === 'CONFIDENCE' ? 'Pouzdanost' : 'Godini'}
                </button>
              </div>
              </div>

              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
              >
                <Download size={16} /> Excel
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredEvidences.map((ex, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 text-sm">
                  <User size={16} className="text-slate-400" />
                  <button onClick={() => goToPerson(ex.childId)} className="font-black text-indigo-600 hover:underline">
                    {ex.childName}
                  </button>
                  <span className="text-slate-400 text-xs">b.{ex.childBirthYear || '?'}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="text-slate-500 italic text-xs mr-1">{ex.role}</span>
                  {ex.ancestorId ? (
                    <button onClick={() => goToPerson(ex.ancestorId)} className="font-black text-slate-700 hover:underline">
                      {ex.ancestorName}
                      {ex.ancestorBirthYear && <span className="text-slate-400 font-medium text-xs ml-1">(b.{ex.ancestorBirthYear})</span>}
                    </button>
                  ) : (
                    <span className="font-black text-slate-700">{ex.ancestorName}</span>
                  )}
                </div>
                <div>{confBadge(ex.confidence)}</div>
              </div>
            ))}
            {filteredEvidences.length === 0 && (
              <div className="p-8 text-center text-slate-400 font-medium text-sm">Nema rezultata za ove filtre.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'SMRT' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm font-medium leading-relaxed">
            <span className="font-bold">Pretpostavljanje godine smrti:</span> Računa se kada je predak umro na temelju 
            ponovnog pojavljivanja njegovog imena među potomcima. Ovi podaci su ponderirani prijedlozi za provjeru u matičnim knjigama, 
            a ne konačan povijesni dokaz.
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" placeholder="FOKUSNA OSOBA: Pretraži osobu za fokus..."
                value={deathSearch} onChange={e => setDeathSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-700"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1">
                {(['ALL', 'M', 'F'] as const).map(f => (
                  <button 
                    key={f} onClick={() => setDeathSexFilter(f)}
                    className={`px-4 py-1.5 text-sm font-bold rounded-lg ${deathSexFilter === f ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {f === 'ALL' ? 'Sve' : f === 'M' ? 'Muškarci' : 'Žene'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1">
                {(['ALL', 'STRONG', 'LIKELY', 'POSSIBLE'] as const).map(f => (
                  <button 
                    key={f} onClick={() => setDeathConfFilter(f)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg ${deathConfFilter === f ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {f === 'ALL' ? 'Sve' : f === 'STRONG' ? 'Snažno' : f === 'LIKELY' ? 'Vjerojatno' : 'Moguće'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {filteredDeaths.map(d => {
              const isExpanded = expandedDeathIds.has(d.ancestorId);
              return (
                <div key={d.ancestorId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none"
                    onClick={() => toggleDeathExpand(d.ancestorId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${d.sex === 'M' ? 'bg-blue-500' : d.sex === 'F' ? 'bg-pink-500' : 'bg-slate-400'}`}>
                        {d.sex === 'M' ? 'M' : d.sex === 'F' ? 'Ž' : '?'}
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-lg flex items-center gap-2">
                          <span className="hover:underline hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); goToPerson(d.ancestorId); }}>
                            {d.ancestorName}
                          </span>
                          <span className="text-slate-400 font-medium text-sm">→ vjerojatno umro/la NAKON {d.lastKnownYear} i DO {d.predictedDeathYearUpperBound}</span>
                          <span className="text-indigo-600 font-black">~{d.predictedYear}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {confBadge(d.confidence)}
                      {isExpanded ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 p-5 animate-fade-in space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-indigo-100 text-sm text-indigo-900 font-medium leading-relaxed">
                        {d.insightText}
                      </div>

                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Imenjaci koji ukazuju na ovo</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {d.descendantNamesakes.map(ns => (
                            <div key={ns.childId} className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center gap-2 text-sm">
                              <User size={14} className="text-slate-400" />
                              <button onClick={() => goToPerson(ns.childId)} className="font-bold text-slate-700 hover:text-indigo-600">
                                {ns.childName}
                              </button>
                              <span className="text-slate-400 text-xs">(b. {ns.childBirthYear})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredDeaths.length === 0 && (
              <div className="p-8 text-center text-slate-400 font-medium text-sm bg-white rounded-xl border border-slate-200">
                Nije pronađena niti jedna pretpostavka smrti za unesene kriterije.
              </div>
            )}
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
