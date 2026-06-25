import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { Download, ChevronDown, ChevronUp, ArrowRightLeft, Copy } from 'lucide-react';
import { DuplicateCandidate } from '../../../parser/treeGraph';
import { TabHeader } from '../components/TabHeader';

export default function DuplicatesTab() {
  const { tree, graph, setSelectedPerson, setComparePersonId, setActiveModule } = useApp();

  const handleCompare = (aId: string, bId: string) => {
    setSelectedPerson(aId);
    setComparePersonId(bId);
    setActiveModule('relationships');
  };
  const [filter, setFilter] = useState<'All' | 'High' | 'Medium' | 'Low' | 'Processed'>('All');
  const [processedPairs, setProcessedPairs] = useState<Record<string, 'ignore' | 'merge'>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('predci_processed_duplicates');
    if (saved) {
      try { setProcessedPairs(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const saveProcessed = (newPairs: Record<string, 'ignore' | 'merge'>) => {
    setProcessedPairs(newPairs);
    localStorage.setItem('predci_processed_duplicates', JSON.stringify(newPairs));
  };

  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [isCalculating, setIsCalculating] = useState(true);
  const [calcProgress, setCalcProgress] = useState(0);
  const [calcStatus, setCalcStatus] = useState('Priprema stabla...');
  const [totalStats, setTotalStats] = useState({ total: 0, high: 0, medium: 0, low: 0 });

  useEffect(() => {
    if (!tree) return;
    setIsCalculating(true);
    setCalcStatus('Serijalizacija podataka...');
    
    // Pripremi array za slanje u worker
    const rawPersons = Array.from(tree.persons.values());
    const workerPersons = rawPersons.map(p => {
      let surname = p.names[0]?.surname?.toLowerCase() || '';
      let given = p.names[0]?.given?.toLowerCase() || '';
      let bYear = p.birth?.date?.year;
      let dYear = p.death?.date?.year;
      let bPlace = p.birth?.place?.toLowerCase() || '';
      
      const parentIdsLength = (p._parents || []).length;
      const parentNames = parentIdsLength > 0 
        ? p._parents!.map(pid => tree.persons.get(pid)?.names[0]?.given?.toLowerCase() || '').sort()
        : [];

      const allYears: number[] = [];
      if (bYear) allYears.push(bYear);
      if (dYear) allYears.push(dYear);
      if (p.events) {
        for (const e of p.events) {
          if (e.date?.year) allYears.push(e.date.year);
        }
      }
      if (p.familiesAsSpouse) {
        for (const fId of p.familiesAsSpouse) {
          const fam = tree.families.get(fId);
          if (fam?.marriage?.date?.year) allYears.push(fam.marriage.date.year);
        }
      }
      
      let firstEventYear: number | undefined;
      let lastEventYear: number | undefined;
      if (allYears.length > 0) {
        firstEventYear = Math.min(...allYears);
        lastEventYear = Math.max(...allYears);
      }

      return { id: p.id, sex: p.sex, surname, given, bYear, dYear, firstEventYear, lastEventYear, bPlace, parentNames, parentIdsLength };
    });

    const worker = new Worker(new URL('../workers/duplicateWorker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setCalcProgress(e.data.progress);
        setCalcStatus(e.data.status);
      } else if (e.data.type === 'done') {
        setDuplicates(e.data.results);
        setTotalStats({ 
          total: e.data.totalFound, 
          high: e.data.totalHigh, 
          medium: e.data.totalMedium, 
          low: e.data.totalLow 
        });
        setIsCalculating(false);
      }
    };

    worker.postMessage(workerPersons);

    return () => {
      worker.terminate();
    };
  }, [tree]);

  const filteredDuplicates = useMemo(() => {
    return duplicates.filter(d => {
      const hash = `${d.personA}_${d.personB}`;
      const isProcessed = processedPairs[hash];
      
      if (filter === 'Processed') return !!isProcessed;
      if (isProcessed) return false;
      
      if (filter === 'All') return true;
      return d.confidence === filter;
    });
  }, [duplicates, filter, processedPairs]);

  const stats = useMemo(() => {
    let all = 0, high = 0, medium = 0, low = 0, processed = 0;
    duplicates.forEach(d => {
      const hash = `${d.personA}_${d.personB}`;
      if (processedPairs[hash]) {
        processed++;
      } else {
        all++;
        if (d.confidence === 'High') high++;
        else if (d.confidence === 'Medium') medium++;
        else low++;
      }
    });
    return { all, high, medium, low, processed };
  }, [duplicates, processedPairs]);

  const handleMark = (hash: string, action: 'ignore' | 'merge') => {
    const n = { ...processedPairs, [hash]: action };
    saveProcessed(n);
  };

  const handleUnmark = (hash: string) => {
    const n = { ...processedPairs };
    delete n[hash];
    saveProcessed(n);
  };

  const toggleExpand = (hash: string) => {
    setExpandedCards(prev => {
      const n = new Set(prev);
      if (n.has(hash)) n.delete(hash);
      else n.add(hash);
      return n;
    });
  };

  const collapseAll = () => setExpandedCards(new Set());

  const exportExcel = () => {
    const rows = [['OSI_ID', 'OSOBA_A', 'RODJENJE_A', 'OSI_ID_B', 'OSOBA_B', 'RODJENJE_B', 'POUZDANOST', 'RAZLOZI']];
    filteredDuplicates.forEach(d => {
      const pA = tree?.persons.get(d.personA);
      const pB = tree?.persons.get(d.personB);
      if(!pA || !pB) return;
      rows.push([
        pA.id, pA.names[0]?.full || '', pA.birth?.date?.display || '',
        pB.id, pB.names[0]?.full || '', pB.birth?.date?.display || '',
        d.confidence,
        d.reasons.join(', ')
      ]);
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "detektor_duplikata.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!tree) return null;

  if (isCalculating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-slate-800 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center animate-fade-in">
          <div className="mb-4">
            <svg className="animate-spin w-10 h-10 text-emerald-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Napredna analiza duplikata</h2>
          <p className="text-sm font-medium text-slate-500 mb-6">{calcStatus}</p>
          
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-emerald-500 transition-all duration-300 ease-out rounded-full" style={{ width: `${calcProgress}%` }}></div>
          </div>
          <div className="text-xs font-bold text-slate-400 mt-2">{calcProgress}%</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50">
      
      {/* 1. GORNJI PANEL I FILTRI */}
      <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm print:hidden">
        <TabHeader 
          title="Detektor duplikata"
          icon={<Copy size={24} className="text-teal-600" />}
          description="Skenira pojedince koji bi mogli biti ista osoba unesena dvaput — usklađujući prezime, sličnost imena, godinu rođenja i mjesto rođenja. Pregledajte svaki par i donesite vlastitu procjenu; očekuju se lažno pozitivni rezultati, posebno za česta prezimena."
          helpKey="duplicates"
          onExportExcel={exportExcel}
        />
        
        <div className="p-6 pt-0 mt-4">

        {totalStats.total > 1000 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium shadow-sm">
            <span className="font-bold text-amber-900">⚠️ Velik broj potencijalnih duplikata:</span> Algoritam je u bazi pronašao ukupno {totalStats.total} sumnjivih parova ({totalStats.high} visoke, {totalStats.medium} srednje i {totalStats.low} niske pouzdanosti). Prikazano je samo {duplicates.length} najvjerojatnijih kako se aplikacija ne bi usporila.
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-xl shadow-inner">
            <button 
              onClick={() => setFilter('All')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'All' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sve ({stats.all})
            </button>
            <button 
              onClick={() => setFilter('High')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'High' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Visoka pouzdanost ({stats.high})
            </button>
            <button 
              onClick={() => setFilter('Medium')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'Medium' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Srednja pouzdanost ({stats.medium})
            </button>
            <button 
              onClick={() => setFilter('Low')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'Low' ? 'bg-slate-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Slične osobe ({stats.low})
            </button>
            <button 
              onClick={() => setFilter('Processed')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ml-2 ${filter === 'Processed' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Obrađeno ({stats.processed})
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 border-r border-slate-200 pr-6">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-red-100 border border-red-200 rounded-sm inline-block"></span>
                <span>Konfliktna vrijednost</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-blue-50 border border-blue-200 rounded-sm inline-block"></span>
                <span>Pronađeno samo na jednoj strani</span>
              </div>
            </div>

            <button onClick={collapseAll} className="text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors">
              Skupi sav obiteljski kontekst
            </button>
          </div>
        </div>
      </div>

      {/* 2. LISTA DUPLIKATA */}
      <div className="p-6 space-y-6">
        {filteredDuplicates.length === 0 && (
          <div className="text-center py-12 text-slate-400 font-medium">Nema preostalih rezultata za ovaj filtar.</div>
        )}
        
        {filteredDuplicates.map(d => {
          const hash = `${d.personA}_${d.personB}`;
          const pA = tree.persons.get(d.personA);
          const pB = tree.persons.get(d.personB);
          if (!pA || !pB) return null;

          const borderColor = d.confidence === 'High' ? 'border-green-400' : d.confidence === 'Medium' ? 'border-orange-400' : 'border-slate-300';
          const headerBg = d.confidence === 'High' ? 'bg-green-50/50 border-green-100' : d.confidence === 'Medium' ? 'bg-orange-50/50 border-orange-100' : 'bg-slate-50 border-slate-200';
          const badgeClass = d.confidence === 'High' ? 'bg-green-100 text-green-700' : d.confidence === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600';
          const badgeText = d.confidence === 'High' ? 'VISOKA POUZDANOST' : d.confidence === 'Medium' ? 'SREDNJA POUZDANOST' : 'SLIČNE OSOBE';
          
          const isExpanded = expandedCards.has(hash);
          
          const getLifeStr = (p: typeof pA) => {
            const b = p.birth?.date?.year ? `b. ${p.birth.date.year}` : '';
            const bp = p.birth?.place ? ` — ${p.birth.place}` : '';
            return `${b}${bp}`;
          };

          return (
            <div key={hash} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-colors ${borderColor}`}>
              {/* Gornji header unutar kartice */}
              <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 ${headerBg}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black tracking-widest uppercase px-2 py-1 rounded-md ${badgeClass}`}>
                    {badgeText}
                  </span>
                  <span className="text-sm font-bold text-slate-500">Score: {d.score}</span>
                  <button onClick={() => handleCompare(pA.id, pB.id)} className="text-xs font-bold text-blue-600 hover:text-blue-800 underline decoration-blue-200 underline-offset-4">
                    Usporedi stabla
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.reasons.map((r, i) => (
                    <span key={i} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${r === 'Upisani različiti roditelji' ? 'bg-red-100 text-red-700 border border-red-200' : 'text-slate-600 bg-slate-100'}`}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Centralni prikaz */}
              <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-8">
                
                {/* Osoba A */}
                <div className="flex-1 w-full text-right flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-800">{pA.names[0]?.full || 'Nepoznato'}</h3>
                    <span className="text-slate-400 font-bold">{pA.sex === 'M' ? '♂' : pA.sex === 'F' ? '♀' : '?'}</span>
                  </div>
                  <div className={`mt-1 text-sm font-medium px-2 py-0.5 rounded-md ${d.conflicts.birthYear || d.conflicts.birthPlace ? 'bg-red-50 text-red-700' : 'text-slate-500'}`}>
                    {getLifeStr(pA) || 'Nema podataka rođenja'}
                  </div>
                  <div className="text-xs font-bold text-slate-400 mt-2 uppercase">{pA.id}</div>
                </div>

                {/* Strelice */}
                <div className="shrink-0 text-slate-300">
                  <ArrowRightLeft size={32} strokeWidth={1.5} />
                </div>

                {/* Osoba B */}
                <div className="flex-1 w-full text-left flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold">{pB.sex === 'M' ? '♂' : pB.sex === 'F' ? '♀' : '?'}</span>
                    <h3 className="text-xl font-black text-slate-800">{pB.names[0]?.full || 'Nepoznato'}</h3>
                  </div>
                  <div className={`mt-1 text-sm font-medium px-2 py-0.5 rounded-md ${d.conflicts.birthYear || d.conflicts.birthPlace ? 'bg-red-50 text-red-700' : 'text-slate-500'}`}>
                    {getLifeStr(pB) || 'Nema podataka rođenja'}
                  </div>
                  <div className="text-xs font-bold text-slate-400 mt-2 uppercase">{pB.id}</div>
                </div>

              </div>

              {/* Obiteljski kontekst izbornik */}
              <div className="bg-slate-50 border-t border-slate-200">
                <button onClick={() => toggleExpand(hash)} className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-100 transition-colors">
                  <span className="text-sm font-bold text-slate-600 flex items-center gap-2">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {isExpanded ? 'Sakrij obiteljski kontekst' : 'Prikaži obiteljski kontekst'}
                  </span>
                  
                  {/* Akcijski gumbi */}
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {!processedPairs[hash] ? (
                      <>
                        <span className="text-xs font-bold text-slate-400 uppercase mr-2 hidden sm:inline">Ista osoba?</span>
                        <button onClick={() => handleMark(hash, 'ignore')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 shadow-sm">
                          Nije duplikat
                        </button>
                        <button onClick={() => handleMark(hash, 'merge')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
                          Spajanje potrebno
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase mr-2 ${processedPairs[hash] === 'ignore' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-800'}`}>
                          {processedPairs[hash] === 'ignore' ? 'Odbijeno' : 'Za spajanje'}
                        </span>
                        <button onClick={() => handleUnmark(hash)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 shadow-sm">
                          Poništi
                        </button>
                      </>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 grid grid-cols-2 gap-8 relative">
                    <div className="absolute left-1/2 top-0 bottom-6 w-px bg-slate-200"></div>
                    
                    {/* LIJEVA OSOBA (A) RODBINA */}
                    <div className="text-right space-y-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Roditelji</h4>
                        {pA._parents && pA._parents.length > 0 ? (
                          pA._parents.map(pid => {
                            const par = tree.persons.get(pid);
                            return <div key={pid} className={`text-sm font-medium ${d.conflicts.parents ? 'text-red-600 bg-red-50 inline-block px-1 rounded' : 'text-slate-700'}`}>{par?.names[0]?.full || 'Nepoznato'}</div>
                          })
                        ) : <div className="text-sm text-slate-400 italic">Nije zabilježeno</div>}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Djeca</h4>
                        {pA._children && pA._children.length > 0 ? (
                          pA._children.map(cid => {
                            const ch = tree.persons.get(cid);
                            const y = ch?.birth?.date?.year;
                            return <div key={cid} className="text-sm font-medium text-slate-600">{ch?.names[0]?.full || 'Nepoznato'} {y ? `(${y})` : ''}</div>
                          })
                        ) : <div className="text-sm text-slate-400 italic">Nije zabilježeno</div>}
                      </div>
                    </div>

                    {/* DESNA OSOBA (B) RODBINA */}
                    <div className="text-left space-y-4">
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Roditelji</h4>
                        {pB._parents && pB._parents.length > 0 ? (
                          pB._parents.map(pid => {
                            const par = tree.persons.get(pid);
                            return <div key={pid} className={`text-sm font-medium ${d.conflicts.parents ? 'text-red-600 bg-red-50 inline-block px-1 rounded' : 'text-slate-700'}`}>{par?.names[0]?.full || 'Nepoznato'}</div>
                          })
                        ) : <div className="text-sm text-slate-400 italic">Nije zabilježeno</div>}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Djeca</h4>
                        {pB._children && pB._children.length > 0 ? (
                          pB._children.map(cid => {
                            const ch = tree.persons.get(cid);
                            const y = ch?.birth?.date?.year;
                            return <div key={cid} className="text-sm font-medium text-slate-600">{ch?.names[0]?.full || 'Nepoznato'} {y ? `(${y})` : ''}</div>
                          })
                        ) : <div className="text-sm text-slate-400 italic">Nije zabilježeno</div>}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          );
        })}

      </div>
      </div>
    </div>
  );
}
