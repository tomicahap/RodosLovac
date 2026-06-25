import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { analyzePedigreeCollapse } from '../utils/pedigreeCollapseAnalyzer';
import { Search, AlertTriangle, Link as LinkIcon, Dna, ChevronDown, ChevronRight, GitMerge } from 'lucide-react';
import { GedcomPerson } from '../../../parser/gedcomTypes';
import { TabHeader } from '../components/TabHeader';

export default function PedigreeCollapseTab() {
  const { tree, selectedPersonId, setSelectedPerson, setComparePersonId, setActiveModule } = useApp();
  
  const [activeRelationshipFilter, setActiveRelationshipFilter] = useState<string>('Sve');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isFilteredMode, setIsFilteredMode] = useState<boolean>(false);

  const results = useMemo(() => {
    if (!tree) return null;
    return analyzePedigreeCollapse(tree);
  }, [tree]);

  const focusAncestors = useMemo(() => {
    if (!tree || !selectedPersonId || !isFilteredMode) return null;
    const ancestors = new Set<string>();
    const stack = [selectedPersonId];
    while(stack.length > 0) {
      const curr = stack.pop()!;
      if (!ancestors.has(curr)) {
        ancestors.add(curr);
        const p = tree.persons.get(curr);
        if (p && p._parents) {
          stack.push(...p._parents);
        }
      }
    }
    return ancestors;
  }, [tree, selectedPersonId]);

  if (!results) return null;

  const goToPerson = (id?: string) => {
    if (!id) return;
    setSelectedPerson(id);
    setActiveModule('person-stats');
  };

  const handleCompareTrees = (husbandId: string, wifeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPerson(husbandId);
    setComparePersonId(wifeId);
    setActiveModule('relationships');
  };

  let filteredMarriages = results.marriages;
  
  if (focusAncestors) {
    filteredMarriages = filteredMarriages.filter(m => 
      focusAncestors.has(m.husbandId) || focusAncestors.has(m.wifeId)
    );
  }

  const currentRelationshipCounts = filteredMarriages.reduce((acc, m) => {
    acc[m.relationshipName] = (acc[m.relationshipName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (activeRelationshipFilter !== 'Sve') {
    filteredMarriages = filteredMarriages.filter(m => m.relationshipName === activeRelationshipFilter);
  }

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const rows = filteredMarriages.map(m => [
      m.husbandName,
      m.wifeName,
      m.relationshipName,
      m.commonAncestorPairs.map((a: any) => a.ancestor1Name + (a.ancestor2Name ? ' & ' + a.ancestor2Name : '')).join(', ')
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [['Muz', 'Zena', 'Odnos', 'Zajednicki_Preci'], ...rows].map(e => e.join(";")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "gubitak_predaka.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 animate-fade-in overflow-hidden">
      
      <TabHeader 
        title="Gubitak predaka (Pedigree Collapse)"
        icon={<GitMerge size={24} className="text-purple-600" />}
        description="Računa postotak gubitka predaka i pronalazi endogamiju - brakove između rođaka unutar vašeg stabla."
        helpKey="collapse"
        onExportExcel={handleExport}
      />

      <div className="flex-1 overflow-y-auto p-6">
        
        {/* Selected Focus Person Indicator */}
        {selectedPersonId && isFilteredMode ? (
          <div className="max-w-2xl mb-8 p-4 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <div className="text-xs font-black text-purple-400 uppercase tracking-wider mb-0.5">FILTRIRANO ZA OSOBU:</div>
              <div className="font-bold text-purple-800 text-lg flex items-center gap-2">
                {tree?.persons.get(selectedPersonId)?.names[0]?.full}
              </div>
              <div className="text-xs text-purple-600/70 font-medium mt-1">Prikazuje se samo gubitak predaka u izravnom stablu ove osobe.</div>
            </div>
            <button 
              onClick={() => setIsFilteredMode(false)}
              className="px-3 py-1.5 bg-white border border-purple-200 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-100 transition-colors shadow-sm"
            >
              Prikaži cijelo stablo
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mb-8">
            <p className="text-sm font-medium text-slate-500 mb-3">
              Trenutno se prikazuje gubitak predaka za <span className="font-bold text-slate-700">cijelo stablo</span>.
            </p>
            {selectedPersonId && (
              <button 
                onClick={() => setIsFilteredMode(true)}
                className="px-4 py-2 bg-purple-50 border border-purple-200 text-purple-700 text-sm font-bold rounded-lg hover:bg-purple-100 transition-colors shadow-sm flex items-center gap-2"
              >
                <Search size={16} />
                Filtriraj rezultate za odabranu osobu ({tree?.persons.get(selectedPersonId)?.names[0]?.full})
              </button>
            )}
          </div>
        )}

        {/* Panel sa sažetkom */}
        <div className="flex flex-col lg:flex-row gap-6 mb-6">
          <div className="flex items-center gap-4 bg-teal-50 border border-teal-100 rounded-2xl p-6 min-w-[300px]">
            <div className="text-5xl font-black text-teal-600">
              {Object.values(currentRelationshipCounts).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-sm font-bold text-teal-800 leading-tight">
              pronađeno<br/>brakova u krvnom<br/>srodstvu
            </div>
          </div>
          
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-wrap gap-4 items-center">
            {Object.entries(currentRelationshipCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([relName, count]) => (
              <div key={relName} className="flex flex-col">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{relName}</span>
                <span className="text-xl font-black text-slate-800">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alert box */}
        <div className="bg-slate-100 border-l-4 border-slate-400 p-4 rounded-r-xl flex gap-3 text-slate-700 text-sm font-medium">
          <AlertTriangle className="text-slate-500 shrink-0" size={20} />
          <p>
            <span className="font-bold">⚠️ Detektiran gubitak predaka</span> — pojedini preci pojavljuju se s obje strane obitelji. Ovo je uobičajeno u endogamnim zajednicama (otočne populacije, izolirane seoske sredine, specifične vjerske ili etničke skupine).
          </p>
        </div>

      </div>

      {/* FILTRI PO SRODSTVU */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-2 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveRelationshipFilter('Sve')}
          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
            activeRelationshipFilter === 'Sve' 
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' 
              : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
          }`}
        >
          Sve [{Object.values(currentRelationshipCounts).reduce((a, b) => a + b, 0)}]
        </button>
        {Object.entries(currentRelationshipCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([relName, count]) => (
          <button 
            key={relName}
            onClick={() => setActiveRelationshipFilter(relName)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
              activeRelationshipFilter === relName 
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' 
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
            }`}
          >
            {relName} [{count}]
          </button>
        ))}
      </div>

      {/* POPIS PAROVA */}
      <div className="p-6 overflow-y-auto space-y-4">
        {filteredMarriages.map(m => {
          const isExpanded = expandedCards.has(m.familyId);
          
          return (
            <div key={m.familyId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-5">
                
                {/* Gornji red */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg">
                    <div className="flex items-center gap-2 text-slate-800">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">M</span>
                      <button onClick={() => goToPerson(m.husbandId)} className="font-black hover:text-blue-600 hover:underline transition-colors text-left">{m.husbandName}</button>
                      <span className="text-sm font-bold text-slate-400">({m.husbandYears})</span>
                    </div>
                    <span className="text-slate-300 font-bold px-1">×</span>
                    <div className="flex items-center gap-2 text-slate-800">
                      <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-black">Ž</span>
                      <button onClick={() => goToPerson(m.wifeId)} className="font-black hover:text-pink-600 hover:underline transition-colors text-left">{m.wifeName}</button>
                      <span className="text-sm font-bold text-slate-400">({m.wifeYears})</span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 inline-flex items-center justify-center px-4 py-1.5 bg-orange-100 text-orange-700 font-black text-xs uppercase tracking-wider rounded-full border border-orange-200">
                    {m.relationshipName}
                  </div>
                </div>

                {/* Srednji red */}
                <div className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2">
                  {m.marriageYear ? `Vjenčani ${m.marriageYear}.` : 'Vjenčani (nepoznata godina)'}
                  <span className="text-slate-300">•</span>
                  {m.childrenCount} djece
                </div>

                {/* Zajednički preci */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-3">
                  <LinkIcon size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-2">
                    {m.commonAncestorPairs.map((pair, idx) => (
                      <div key={idx} className="text-sm text-slate-600">
                        preko <button onClick={() => goToPerson(pair.ancestor1Id)} className="font-bold text-slate-800 hover:underline">{pair.ancestor1Name}</button>
                        {pair.ancestor2Name && (
                          <> &amp; <button onClick={() => goToPerson(pair.ancestor2Id)} className="font-bold text-slate-800 hover:underline">{pair.ancestor2Name}</button></>
                        )}
                        <span className="text-xs text-slate-400 ml-2 font-medium">(Udaljenost: ♂ {pair.distanceHusband} gen, ♀ {pair.distanceWife} gen)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {m.marriageYear && m.marriageYear < 1900 && m.sDegree >= 4 && m.sDegree <= 8 && (
                  <div className="mt-4 bg-orange-50/50 border border-orange-100 rounded-lg p-3 text-xs text-orange-800 flex gap-2 items-start">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 opacity-70" />
                    <span className="font-medium italic">
                      Napomena: Za ovaj brak je u matičnim knjigama tog vremena bila potrebna crkvena dispenza (odrješenje od zapreke krvnog srodstva).
                    </span>
                  </div>
                )}

              </div>

              {/* Donji red (Accordion) */}
              <div 
                className="border-t border-slate-100 bg-slate-50/50 p-4 cursor-pointer hover:bg-slate-50 transition-colors flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between select-none"
                onClick={() => toggleExpand(m.familyId)}
              >
                <div className="flex items-center gap-2 text-sm font-bold text-purple-700">
                  <Dna size={16} />
                  <span>🧬 Utjecaj DNK na potomke</span>
                </div>
                
                <div className="flex items-center gap-4 text-slate-400 self-end sm:self-auto">
                  <button 
                    onClick={(e) => handleCompareTrees(m.husbandId, m.wifeId, e)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200 flex items-center gap-1.5"
                  >
                    <GitMerge size={14} />
                    Usporedi stabla
                  </button>
                  {isExpanded && <span className="text-sm font-black text-slate-800">F = {(m.fValue * 100).toFixed(2)}%</span>}
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </div>

              {isExpanded && (
                <div className="p-6 border-t border-slate-100 bg-white animate-fade-in flex flex-col gap-6">
                  
                  {/* Tekstualno objašnjenje */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed shadow-sm">
                    Budući da su oba roditelja u srodstvu, njihova djeca nasljeđuju DNK od <span className="font-bold text-slate-900">{m.dnaImpact.commonAncestorNames}</span> kroz DVA puta umjesto jednog — noseći više DNK ove obitelji od tipičnog potomka na istoj generacijskoj razini.
                  </div>

                  {/* Usporedni pregled */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-sm">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Djeca iz ovog braka</span>
                      <span className="text-3xl font-black text-slate-800">~{m.dnaImpact.totalActualCm} cM</span>
                      <span className="text-xs font-medium text-slate-500 mt-1">od {m.dnaImpact.commonAncestorNames}</span>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Uobičajeno na ovoj razini</span>
                      <span className="text-3xl font-black text-slate-800">~{m.dnaImpact.totalTypicalCm} cM</span>
                      <span className="text-sm font-black text-emerald-600 mt-1">+{m.dnaImpact.totalExtraCm} cM ekstra</span>
                    </div>
                  </div>

                  {/* Tablica potomaka */}
                  {m.children.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 px-4 py-2 flex items-center justify-between text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <div className="flex-1">Potomak</div>
                        <div className="w-32 text-center">Očekivani cM</div>
                        <div className="w-24 text-right">Ekstra</div>
                      </div>
                      <div className="divide-y divide-slate-100 bg-white">
                        {m.children.map(child => (
                          <div key={child.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex-1 flex flex-col">
                              <button onClick={() => goToPerson(child.id)} className="font-bold text-slate-800 text-left hover:text-indigo-600 hover:underline">{child.name}</button>
                              <span className="text-xs font-medium text-slate-400 mt-0.5">b. {child.birthYear} · dijete iz ovog braka</span>
                            </div>
                            <div className="w-32 text-center flex flex-col items-center">
                              <span className="font-black text-slate-800 text-base">~{m.dnaImpact.totalActualCm} cM</span>
                              <span className="text-[10px] font-bold text-slate-400">uobičajeno ~{m.dnaImpact.totalTypicalCm} cM</span>
                            </div>
                            <div className="w-24 flex justify-end">
                              <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 font-black text-xs px-2.5 py-1 rounded-full">
                                +{m.dnaImpact.totalExtraCm} cM
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="text-[11px] font-medium text-slate-400 text-center px-4">
                    Dodatni cM se prepolovljuje sa svakom idućom generacijom. Ovo su statistička očekivanja — stvarni rezultati DNK testova variraju zbog nasumične rekombinacije.
                  </div>

                </div>
              )}

            </div>
          );
        })}

        {filteredMarriages.length === 0 && (
          <div className="text-center py-12 text-slate-400 font-medium">
            Nema pronađenih parova za trenutne kriterije.
          </div>
        )}
      </div>

    </div>
  );
}
