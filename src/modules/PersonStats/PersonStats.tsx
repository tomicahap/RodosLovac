// ============================================================
// Person Stats Module
// ============================================================

import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import PersonSearch from '../../components/PersonSearch';
import { computePersonDeepStats } from '../../utils/personStatsEngine';
import { 
  Calendar, GitBranch, ArrowUp, ArrowDown, UserMinus, FileText, ChevronRight, User, Users, Clock
} from 'lucide-react';
import TimelineView from './TimelineView';
import CousinsView from './CousinsView';
import { analyzePath } from '../../parser/kinshipLogic';
import RelationshipPathVisualizer from '../../components/RelationshipPathVisualizer';
import { HelpButton, HelpModal } from '../../components/HelpModal';

export default function PersonStats() {
  const { tree, graph, selectedPersonId, setSelectedPerson } = useApp();
  
  // Main Tabs
  const [mainTab, setMainTab] = useState<'osoba' | 'vremeplov' | 'rodaci'>('osoba');
  // Sub Tabs for Osoba
  const [activeTab, setActiveTab] = useState<'overview' | 'relatives' | 'missing' | 'dossier'>('overview');
  
  const [helpOpen, setHelpOpen] = useState(false);
  
  const [expandedCousins, setExpandedCousins] = useState<Record<string, boolean>>({});
  const [maxGenerations, setMaxGenerations] = useState<number>(100);

  // Path Modal State
  const [pathModalResult, setPathModalResult] = useState<{ path: string[]; description: string; isBlood: boolean; targetId: string } | null>(null);
  const [pathOrientation, setPathOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  const person = useMemo(() => {
    if (!tree || !selectedPersonId) return null;
    return tree.persons.get(selectedPersonId) || null;
  }, [tree, selectedPersonId]);

  const deepStats = useMemo(() => {
    if (!tree || !graph || !selectedPersonId) return null;
    return computePersonDeepStats(selectedPersonId, tree, graph, maxGenerations);
  }, [tree, graph, selectedPersonId, maxGenerations]);

  const ancestorDepth = useMemo(() => {
    if (!graph || !selectedPersonId) return 0;
    return graph.getAncestorDepth(selectedPersonId);
  }, [graph, selectedPersonId]);

  const descendantDepth = useMemo(() => {
    if (!graph || !selectedPersonId) return 0;
    return graph.getDescendantDepth(selectedPersonId);
  }, [graph, selectedPersonId]);

  const toggleCousinRow = (key: string) => {
    setExpandedCousins(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openPathModal = (targetId: string) => {
    if (!graph || !selectedPersonId) return;
    if (selectedPersonId === targetId) return; // Same person
    const result = graph.findRelationshipPath(selectedPersonId, targetId);
    if (!result) {
      setPathModalResult({ path: [], description: "Osobe nije moguće povezati ni na koji način.", isBlood: false, targetId });
    } else {
      const analysis = analyzePath(result.path, graph);
      setPathModalResult({ path: result.path, description: result.description, isBlood: analysis.isBlood, targetId });
    }
  };

  if (!tree || !graph) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="section-header mb-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="section-title">Dubinska statistika pojedinca</h2>
          <p className="section-subtitle">Pregled detaljne statistike, ekstremnih zapisa i matrice srodstava</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-col md:flex-row gap-6">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Odabrana (fokalna) osoba
          </label>
          <PersonSearch className="w-full" />
        </div>
        
        {deepStats && deepStats.absoluteMaxGenerations > 0 && mainTab === 'osoba' && (
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Prikaz kroz generacije
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMaxGenerations(100)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  maxGenerations === 100 ? 'bg-teal-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Sve
              </button>
              {Array.from({ length: deepStats.absoluteMaxGenerations }, (_, i) => i + 1).map(gen => (
                <button
                  key={gen}
                  onClick={() => setMaxGenerations(gen)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
                    maxGenerations === gen ? 'bg-teal-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  G{gen}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!person || !deepStats ? (
        <div className="card p-8 text-center text-[var(--text-muted)]">
          <p className="text-4xl mb-3">👤</p>
          <p className="font-medium">Odaberite osobu za prikaz statistike</p>
        </div>
      ) : (
        <>
          {/* MAIN TABS */}
          <div className="flex gap-4 border-b border-gray-200 mt-8 mb-6 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setMainTab('osoba')}
              className={`pb-3 font-semibold text-sm transition-colors whitespace-nowrap flex items-center gap-2 relative ${
                mainTab === 'osoba' ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User size={16} />
              Osoba (Individua)
              {mainTab === 'osoba' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-t-full" />}
            </button>
            <button
              onClick={() => setMainTab('vremeplov')}
              className={`pb-3 font-semibold text-sm transition-colors whitespace-nowrap flex items-center gap-2 relative ${
                mainTab === 'vremeplov' ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock size={16} />
              Vremeplov (Timeline)
              {mainTab === 'vremeplov' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-t-full" />}
            </button>
            <button
              onClick={() => setMainTab('rodaci')}
              className={`pb-3 font-semibold text-sm transition-colors whitespace-nowrap flex items-center gap-2 relative ${
                mainTab === 'rodaci' ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={16} />
              Rođaci (Cousins)
              {mainTab === 'rodaci' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-t-full" />}
            </button>
          </div>

          {mainTab === 'osoba' && (
            <div className="space-y-6 animate-fade-in">
              {/* Person Title Card */}
              <div className="card p-5">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${
                    person.sex === 'M' ? 'bg-blue-500/10' : person.sex === 'F' ? 'bg-pink-500/10' : 'bg-gray-500/10'
                  }`}>
                    {person.sex === 'M' ? '♂' : person.sex === 'F' ? '♀' : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] mb-1">{person.names[0]?.full}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[var(--text-secondary)]">
                      {person.birth?.date?.display && (
                        <span className="flex items-center gap-1.5"><span className="text-gray-400">Rođen/a:</span> <strong>{person.birth.date.display}</strong>{person.birth.place ? `, ${person.birth.place.split(',')[0]}` : ''}</span>
                      )}
                      {person.death?.date?.display && (
                        <span className="flex items-center gap-1.5"><span className="text-gray-400">Umro/la:</span> <strong>{person.death.date.display}</strong>{person.death.place ? `, ${person.death.place.split(',')[0]}` : ''}</span>
                      )}
                      <span className="text-slate-300 hidden sm:inline">|</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-gray-400">Generacije:</span>
                        <strong>gore (predci) {ancestorDepth}</strong>
                        <span className="text-gray-400">/</span>
                        <strong>dolje (potomci) {descendantDepth}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="w-full md:w-1/2 lg:w-auto flex flex-col gap-3 flex-shrink-0 bg-slate-50 p-4 rounded-xl border border-gray-100">
                    
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-teal-600 leading-none">{deepStats.treeAtAGlance.totalAncestors}</span>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Predaka</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {deepStats.treeAtAGlance.ancestorsBreakdown.map((b, i) => (
                          <span key={i} className="text-[10px] font-semibold bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md whitespace-nowrap shadow-sm">
                            <span className="text-teal-600 font-bold">{b.found}{b.expected ? `/${b.expected}` : ''}</span> {b.label.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="w-full h-px bg-gray-200"></div>

                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-teal-600 leading-none">{deepStats.treeAtAGlance.totalDescendants}</span>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Potomaka</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {deepStats.treeAtAGlance.descendantsBreakdown.map((b, i) => (
                          <span key={i} className="text-[10px] font-semibold bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md whitespace-nowrap shadow-sm">
                            <span className="text-teal-600 font-bold">{b.found}</span> {b.label.toLowerCase()}
                          </span>
                        ))}
                        {deepStats.treeAtAGlance.descendantsBreakdown.length === 0 && (
                          <span className="text-[10px] text-gray-400 italic">Nema zabilježenih potomaka</span>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* On This Date Banner */}
              {deepStats.onThisDate.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-sm">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                    <Calendar size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-amber-900">Na današnji dan u užoj obitelji</h4>
                    <div className="text-sm text-amber-800 mt-1 flex flex-wrap gap-x-4 gap-y-2">
                      {deepStats.onThisDate.map((ev, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="font-semibold">{ev.eventType} ({ev.yearsAgo} god.):</span>
                          <button 
                            onClick={() => openPathModal(ev.personId)}
                            className="underline hover:text-amber-950 font-medium"
                          >
                            {ev.name}
                          </button>
                          <span className="text-xs opacity-75">({ev.relation})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TREE AT A GLANCE (Grid) */}
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-8 mb-4">STATISTIKA</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                
                <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Bake i djedovi</div>
                  <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.grandparentsKnown}<span className="text-sm text-gray-400">/4</span></div>
                  <div className="text-xs text-gray-400 mt-1">poznato u stablu</div>
                </div>

                <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Geografija</div>
                  <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.uniqueCountries}</div>
                  <div className="text-xs text-gray-400 mt-1">država rođenja predaka</div>
                </div>

                {deepStats.treeAtAGlance.earliestAncestor && (
                  <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Najraniji predak</div>
                    <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.earliestAncestor.value}</div>
                    <button onClick={() => openPathModal(deepStats.treeAtAGlance.earliestAncestor!.id)} className="text-xs font-medium text-gray-700 hover:text-teal-700 text-left mt-1 truncate">
                      {deepStats.treeAtAGlance.earliestAncestor.name}
                    </button>
                  </div>
                )}

                {deepStats.treeAtAGlance.longestLived && (
                  <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Najdulji život</div>
                    <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.longestLived.value} <span className="text-sm font-normal text-gray-400">god</span></div>
                    <button onClick={() => openPathModal(deepStats.treeAtAGlance.longestLived!.id)} className="text-xs font-medium text-gray-700 hover:text-teal-700 text-left mt-1 truncate">
                      {deepStats.treeAtAGlance.longestLived.name}
                    </button>
                  </div>
                )}

                {deepStats.treeAtAGlance.largestFamily && (
                  <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Najveća obitelj</div>
                    <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.largestFamily.value} <span className="text-sm font-normal text-gray-400">djece</span></div>
                    <div className="text-xs font-medium text-gray-700 mt-1 truncate" title={deepStats.treeAtAGlance.largestFamily.name}>
                      {deepStats.treeAtAGlance.largestFamily.name}
                    </div>
                  </div>
                )}

                {deepStats.treeAtAGlance.youngestMother && (
                  <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Najmlađa majka</div>
                    <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.youngestMother.value} <span className="text-sm font-normal text-gray-400">god</span></div>
                    <button onClick={() => openPathModal(deepStats.treeAtAGlance.youngestMother!.id)} className="text-xs font-medium text-gray-700 hover:text-teal-700 text-left mt-1 truncate">
                      {deepStats.treeAtAGlance.youngestMother.name}
                    </button>
                  </div>
                )}

                {deepStats.treeAtAGlance.oldestFather && (
                  <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Najstariji otac</div>
                    <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.oldestFather.value} <span className="text-sm font-normal text-gray-400">god</span></div>
                    <button onClick={() => openPathModal(deepStats.treeAtAGlance.oldestFather!.id)} className="text-xs font-medium text-gray-700 hover:text-teal-700 text-left mt-1 truncate">
                      {deepStats.treeAtAGlance.oldestFather.name}
                    </button>
                  </div>
                )}

                {deepStats.treeAtAGlance.deepestLine && (
                  <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Najdublja linija</div>
                    <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.deepestLine.value} <span className="text-sm font-normal text-gray-400">gen.</span></div>
                    <div className="text-xs font-medium text-gray-700 mt-1 truncate">
                      {deepStats.treeAtAGlance.deepestLine.name}
                    </div>
                  </div>
                )}

                <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Imigranti</div>
                  <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.immigrants}</div>
                  <div className="text-xs text-gray-400 mt-1">promijenili državu rođenja</div>
                </div>

                <div className="card p-4 flex flex-col justify-between hover:border-teal-300 transition-colors">
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-2">Endogamija</div>
                  <div className="text-2xl font-black text-teal-600">{deepStats.treeAtAGlance.repeatedAncestors}</div>
                  <div className="text-xs text-gray-400 mt-1">ponovljenih predaka</div>
                </div>

              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2 border-b border-gray-200 mt-8 mb-6 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setActiveTab('dossier')}
                  className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'dossier' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                >
                  <FileText size={16} /> Dosje osobe
                </button>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                >
                  Direktna linija
                </button>
                <button
                  onClick={() => setActiveTab('missing')}
                  className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'missing' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                >
                  <UserMinus size={16} /> Nedostajući preci
                </button>
                <button
                  onClick={() => setActiveTab('relatives')}
                  className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'relatives' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                >
                  Matrica rođaka
                </button>
              </div>

              {/* DOSSIER TAB */}
              {activeTab === 'dossier' && (
                <div className="space-y-6">
                  
                  {/* Detailed Events Table */}
                  <div className="card overflow-hidden border border-gray-200 shadow-sm">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <h4 className="font-bold text-gray-900">Svi zabilježeni događaji</h4>
                    </div>
                    {deepStats.dossier.events.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">Nema zabilježenih događaja.</div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400">
                          <tr>
                            <th className="px-6 py-3 w-1/5">Događaj</th>
                            <th className="px-6 py-3 w-1/5">Datum</th>
                            <th className="px-6 py-3 w-1/4">Lokacija</th>
                            <th className="px-6 py-3">Dodatni detalji</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {deepStats.dossier.events.map((ev, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-3 font-semibold text-teal-700">{ev.title}</td>
                              <td className="px-6 py-3 text-gray-700">{ev.date || '—'}</td>
                              <td className="px-6 py-3 text-gray-700">{ev.place || '—'}</td>
                              <td className="px-6 py-3 text-gray-500">{ev.description || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Family Box */}
                    <div className="card p-6 border border-gray-200 shadow-sm">
                      <h4 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Uža obitelj</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-gray-400 uppercase">Roditelji</span>
                          {deepStats.dossier.parents.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {deepStats.dossier.parents.map((p, i) => <li key={i} className="text-gray-800 font-medium">{p}</li>)}
                            </ul>
                          ) : <div className="text-gray-400 italic text-sm mt-1">Nepoznati</div>}
                        </div>
                        
                        <div>
                          <span className="text-xs font-bold text-gray-400 uppercase">Supružnici</span>
                          {deepStats.dossier.spouses.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {deepStats.dossier.spouses.map((s, i) => <li key={i} className="text-gray-800 font-medium">{s}</li>)}
                            </ul>
                          ) : <div className="text-gray-400 italic text-sm mt-1">Nema zapisa</div>}
                        </div>

                        <div>
                          <span className="text-xs font-bold text-gray-400 uppercase">Djeca</span>
                          {deepStats.dossier.children.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {deepStats.dossier.children.map((c, i) => <li key={i} className="text-gray-800 text-sm">{c}</li>)}
                            </ul>
                          ) : <div className="text-gray-400 italic text-sm mt-1">Nema zapisa</div>}
                        </div>
                      </div>
                    </div>

                    {/* Notes Box */}
                    <div className="card p-6 border border-gray-200 shadow-sm">
                      <h4 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Osobne bilješke (Notes)</h4>
                      {deepStats.dossier.notes.length === 0 ? (
                        <div className="text-gray-400 italic text-center py-8">Nema spremljenih bilješki u GEDCOM datoteci.</div>
                      ) : (
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {deepStats.dossier.notes.map((note, i) => (
                            <div key={i} className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-sm text-gray-800 whitespace-pre-wrap">
                              {note}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* MISSING ANCESTORS TAB */}
              {activeTab === 'missing' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm flex gap-3 items-start">
                    <UserMinus className="shrink-0 mt-0.5 text-amber-600" />
                    <p>
                      Ovo je popis svih predaka koje morate istražiti u maticama kako biste popunili stablo do <strong>{maxGenerations === 100 ? 'kraja' : `${maxGenerations}. generacije`}</strong>.
                      Lista pokazuje prvu osobu (Zid / Brick Wall) kod koje nedostaju roditelji.
                    </p>
                  </div>

                  <div className="card overflow-hidden border border-gray-200 shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-6 py-4">Generacija Praznine</th>
                          <th className="px-6 py-4">Tko nedostaje?</th>
                          <th className="px-6 py-4">Linija istraživanja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {deepStats.missingAncestors.length === 0 ? (
                          <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Stablo je potpuno ispunjeno unutar odabranog limita!</td></tr>
                        ) : (
                          deepStats.missingAncestors.map((miss, idx) => (
                            <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-500">{miss.generation}. Gen</td>
                              <td className="px-6 py-4 font-bold text-amber-700">{miss.relation}</td>
                              <td className="px-6 py-4">
                                <span className={`badge ${miss.missingSide === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                                  {miss.missingSide === 'M' ? 'Muška linija' : 'Ženska linija'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DIRECT LINE TAB */}
              {activeTab === 'overview' && (
                <div className="card overflow-hidden border border-gray-200 shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-4 w-12"></th>
                        <th className="px-4 py-4">Generacija</th>
                        <th className="px-4 py-4">Pronađeno predaka</th>
                        <th className="px-4 py-4">Teoretski maksimum</th>
                        <th className="px-4 py-4 w-1/4">Pokrivenost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deepStats.cousinBreakdown.directLine.map(row => {
                        const maxCount = Math.pow(2, row.gen);
                        const pct = Math.min(100, Math.round((row.count / maxCount) * 100));
                        const rowKey = `direct-${row.gen}`;
                        const isExpanded = !!expandedCousins[rowKey];
                        return (
                          <React.Fragment key={rowKey}>
                            <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => toggleCousinRow(rowKey)}>
                              <td className="px-4 py-4 text-center text-gray-400">
                                {isExpanded ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                              </td>
                              <td className="px-4 py-4 font-medium text-gray-900">
                                {row.gen === 1 ? '1. Roditelji' : row.gen === 2 ? '2. Bake i Djedovi' : row.gen === 3 ? '3. Pradjedovi' : row.gen === 4 ? '4. Šukundjedovi' : `${row.gen}. Generacija`}
                              </td>
                              <td className="px-4 py-4 font-bold text-teal-700">{row.count}</td>
                              <td className="px-4 py-4 text-gray-500">{maxCount}</td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                                    <div className="bg-teal-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                  </div>
                                  <span className="text-xs font-semibold text-gray-500 w-8">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && row.persons && row.persons.length > 0 && (
                              <tr className="bg-slate-50 border-b border-gray-200">
                                <td colSpan={5} className="px-8 py-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {row.persons.map(cp => (
                                      <button 
                                        key={cp.id} 
                                        onClick={() => openPathModal(cp.id)}
                                        className="text-left px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-teal-500 hover:text-teal-700 transition-colors truncate shadow-sm flex items-center justify-between group"
                                      >
                                        <span>{cp.name}</span>
                                        <GitBranch size={14} className="opacity-0 group-hover:opacity-100 text-teal-500 transition-opacity" />
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* COUSIN MATRIX TAB */}
              {activeTab === 'relatives' && (
                <div className="space-y-6">
                  <div className="card overflow-hidden border border-gray-200 shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-4 w-12"></th>
                          <th className="px-4 py-4">Koljeno (Degree)</th>
                          <th className="px-4 py-4">Udaljenost (Removal)</th>
                          <th className="px-4 py-4">Strana obitelji</th>
                          <th className="px-4 py-4 text-right">Broj osoba</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {deepStats.cousinBreakdown.cousinMatrix.length === 0 && (
                          <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nema pronađenih rođaka unutar {maxGenerations === 100 ? '5' : maxGenerations} koljena.</td></tr>
                        )}
                        {deepStats.cousinBreakdown.cousinMatrix.map((group, idx) => {
                          const rowKey = `cousin-${idx}`;
                          const isExpanded = !!expandedCousins[rowKey];
                          return (
                            <React.Fragment key={rowKey}>
                              <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => toggleCousinRow(rowKey)}>
                                <td className="px-4 py-4 text-center text-gray-400">
                                  {isExpanded ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                                </td>
                                <td className="px-4 py-4 font-bold text-gray-900">
                                  {group.degree}. koljeno (Cousin)
                                </td>
                                <td className="px-4 py-4">
                                  {group.removal === 0 ? (
                                    <span className="badge badge-gray">Ista generacija</span>
                                  ) : (
                                    <span className={`badge ${group.direction === 'Ascending' ? 'badge-amber' : 'badge-purple'}`}>
                                      {group.removal}x Udaljeno ({group.direction === 'Ascending' ? 'Stariji' : 'Mlađi'})
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  <span className={`badge ${group.side === 'Paternal' ? 'bg-blue-50 text-blue-700' : group.side === 'Maternal' ? 'bg-pink-50 text-pink-700' : 'badge-gray'}`}>
                                    {group.side === 'Paternal' ? 'Očeva' : group.side === 'Maternal' ? 'Majčina' : 'Obje strane'}
                                  </span>
                                </td>
                                <td className="px-4 py-4 font-black text-teal-600 text-right text-lg">
                                  {group.count}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-50 border-b border-gray-200">
                                  <td colSpan={5} className="px-8 py-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {group.persons.map(cp => (
                                        <button 
                                          key={cp.id} 
                                          onClick={() => openPathModal(cp.id)}
                                          className="text-left px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:border-teal-500 hover:text-teal-700 transition-colors truncate shadow-sm flex items-center justify-between group"
                                        >
                                          <span>{cp.name}</span>
                                          <GitBranch size={14} className="opacity-0 group-hover:opacity-100 text-teal-500 transition-opacity" />
                                        </button>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {mainTab === 'vremeplov' && (
             <TimelineView />
          )}

          {mainTab === 'rodaci' && (
             <CousinsView openPathModal={openPathModal} />
          )}

        </>
      )}

      {/* RELATIONSHIP PATH MODAL */}
      {pathModalResult && (() => {
        const pathArray = pathModalResult.path;
        
        if (pathArray.length === 0) {
          return (
            <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 overflow-auto animate-fade-in custom-scrollbar">
              <div className="min-w-fit md:min-w-[1000px] w-full min-h-screen p-4 md:p-12 relative flex flex-col items-center">
                {/* Top Bar Controls */}
                <div className="w-full flex justify-between items-center mb-8 sticky left-0 right-0 max-w-5xl mx-auto">
                  <div></div>
                  <div className="flex gap-3">
                    <button onClick={() => setPathModalResult(null)} className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 px-6">
                      Zatvori
                    </button>
                  </div>
                </div>
                {/* Header */}
                <div className="w-full text-left mb-12 max-w-5xl mx-auto">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Relationship Path</div>
                  <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
                    {tree.persons.get(selectedPersonId || '')?.names[0]?.full} 
                    <span className="text-gray-300 mx-3">↔</span> 
                    {tree.persons.get(pathModalResult.targetId)?.names[0]?.full}
                  </h2>
                  <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-xl text-center text-red-700 font-medium">
                    {pathModalResult.description}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 overflow-auto animate-fade-in custom-scrollbar">
            <div className="min-w-fit md:min-w-[1000px] w-full min-h-screen p-4 md:p-12 relative flex flex-col items-center">
              
              {/* Top Bar Controls */}
              <div className="w-full flex justify-between items-center mb-8 sticky left-0 right-0 max-w-5xl mx-auto">
                <div></div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setSelectedPerson(pathArray[pathArray.length - 1]);
                      setPathModalResult(null);
                    }} 
                    className="btn bg-teal-50 text-teal-700 hover:bg-teal-100 px-4"
                  >
                    Postavi kao fokalnu osobu
                  </button>
                  <button 
                    onClick={() => setPathModalResult(null)} 
                    className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 px-6"
                  >
                    Zatvori
                  </button>
                </div>
              </div>

              {/* Header */}
              <div className="w-full text-left mb-12 max-w-5xl mx-auto">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Relationship Path</div>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
                  {tree.persons.get(pathArray[0])?.names[0]?.full} 
                  <span className="text-gray-300 mx-3">↔</span> 
                  {tree.persons.get(pathArray[pathArray.length-1])?.names[0]?.full}
                </h2>

                {/* Blood Relationship Badge */}
                <div className="mt-4 flex">
                  {pathModalResult.isBlood ? (
                    <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-800 px-4 py-2 rounded-lg font-bold">
                      <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                      Krvno srodstvo
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Moguće je prikazati srodstvo, ali to nije krvno srodstvo
                    </div>
                  )}
                </div>

                <div className="text-gray-600 mt-4">{pathModalResult.description}</div>
              </div>
              
              <div className="w-full flex justify-center pb-16">
                <RelationshipPathVisualizer path={pathArray} tree={tree} graph={graph} />
              </div>
            </div>
          </div>
        );
      })()}

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Statistika pojedinca"
      >
        <div className="space-y-4">
          <p>
            Ovaj modul pruža detaljan i dubinski pregled odabrane osobe u obiteljskom stablu. Sastoji se od tri glavne kartice:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Osoba:</strong> Sadrži opće demografske informacije, analizu predaka i potomaka po koljenima, popis rodbine te automatsku detekciju praznina u podacima (što još trebate istražiti za tu osobu).
            </li>
            <li>
              <strong>Vremeplov:</strong> Kronološki prikaz svih važnih životnih događaja odabrane osobe i njezine uže obitelji (rođenja, brakovi, selidbe, smrti) na grafički privlačnoj vremenskoj traci.
            </li>
            <li>
              <strong>Rođaci:</strong> Kompletna matrica srodstava s točnim izračunom stupnja i linije srodstva. Klikom na bilo kojeg rođaka možete pokrenuti <strong>vizualizator putanje srodstva</strong> koji grafički crta točnu liniju povezivanja dviju osoba.
            </li>
          </ul>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kako koristiti pretragu:</h4>
          <p className="text-xs text-slate-500">
            Pomoću polja za pretragu na vrhu možete brzo promijeniti osobu koja je u fokusu analize. Sve statistike i vremenske trake automatski će se prilagoditi novoj odabranoj osobi.
          </p>
        </div>
      </HelpModal>

    </div>
  );
}
