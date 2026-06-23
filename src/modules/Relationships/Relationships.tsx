import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, GitMerge, User, Users, ArrowRightLeft, X, Search } from 'lucide-react';
import { HelpButton, HelpModal } from '../../components/HelpModal';
import PersonSearch from '../../components/PersonSearch';
import PathFinderTab from './tabs/PathFinderTab';
import ComparePeopleTab from './tabs/ComparePeopleTab';
import CompareTreesTab from './tabs/CompareTreesTab';
import { analyzePath } from '../../parser/kinshipLogic';

export default function Relationships() {
  const { tree, graph, selectedPersonId, setActiveModule } = useApp();
  
  // Local state for the module
  const [personAId, setPersonAId] = useState<string | null>(selectedPersonId || null);
  const [personBId, setPersonBId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'path' | 'people' | 'trees'>('path');
  const [helpOpen, setHelpOpen] = useState(false);

  const personA = personAId ? tree?.persons.get(personAId) : null;
  const personB = personBId ? tree?.persons.get(personBId) : null;

  // Calculate path and analysis if both are selected
  const { path, analysis } = useMemo(() => {
    if (!graph || !personAId || !personBId) return { path: null, analysis: null };
    
    // findRelationshipPath returns { path: string[], description, distance }
    // We only need the raw path array for our advanced kinship logic.
    const res = graph.findRelationshipPath(personAId, personBId);
    if (!res) return { path: null, analysis: null };

    const pathArray = res.path;
    const pathAnalysis = analyzePath(pathArray, graph);

    return { path: pathArray, analysis: pathAnalysis };
  }, [graph, personAId, personBId]);

  if (!tree || !graph) return null;

  const handleSwap = () => {
    const temp = personAId;
    setPersonAId(personBId);
    setPersonBId(temp);
  };

  const handleClear = () => {
    setPersonAId(null);
    setPersonBId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="section-header mb-2">
        <div>
          <h2 className="section-title">Srodstva i usporedbe</h2>
          <p className="section-subtitle">Pronađite poveznicu između osoba, usporedite njihove živote ili stabla</p>
        </div>
      </div>

      {/* Top Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-[var(--border-color)]">
        
        {/* Back Button */}
        <button 
          onClick={() => setActiveModule('overview')}
          className="btn btn-ghost text-[var(--text-secondary)] hover:text-[var(--text-primary)] pl-2"
        >
          <ArrowLeft size={18} /> Natrag
        </button>

        {/* Tab Toggles */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 overflow-x-auto custom-scrollbar w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('path')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'path' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <GitMerge size={16} className="-rotate-90" /> Pronađi poveznicu
          </button>
          <button 
            onClick={() => setActiveTab('people')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'people' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={16} /> Usporedi osobe
          </button>
          <button 
            onClick={() => setActiveTab('trees')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'trees' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={16} /> Usporedi stabla
          </button>
        </div>

      </div>

      {/* Person Selection Bar */}
      <div className="bg-white">
        <div className="flex flex-col lg:flex-row items-end gap-4 lg:gap-8 max-w-4xl">
          
          <div className="w-full flex-1">
            <div className="text-[11px] font-bold tracking-widest uppercase text-slate-500 mb-2 ml-1">
              OSOBA A
            </div>
            <PersonSearch 
              value={personAId} 
              onSelect={(id) => setPersonAId(id)} 
              placeholder="Pretraži osobu A..." 
              className="bg-white border-slate-200"
            />
          </div>

          <button 
            onClick={handleSwap}
            className="pb-2 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            title="Zamijeni osobe"
          >
            <ArrowRightLeft size={18} strokeWidth={1.5} />
          </button>

          <div className="w-full flex-1">
            <div className="text-[11px] font-bold tracking-widest uppercase text-slate-500 mb-2 ml-1">
              OSOBA B
            </div>
            <PersonSearch 
              value={personBId} 
              onSelect={(id) => setPersonBId(id)} 
              placeholder="Pretraži osobu B..." 
              className="bg-white border-slate-200"
            />
          </div>

        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {!personAId || !personBId ? (
          <div className="card p-12 flex flex-col items-center justify-center text-center text-slate-400 border-dashed border-2 bg-slate-50/50">
            <Search className="w-16 h-16 mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-slate-600 mb-2">Odaberite dvije osobe</h3>
            <p className="max-w-md">Korištenjem tražilice iznad odaberite OSOBU A i OSOBU B kako biste otključali napredne alate za usporedbu i pronalazak poveznice.</p>
          </div>
        ) : (
          <>
            {activeTab === 'path' && (
              path && analysis ? (
                <PathFinderTab 
                  personA={personA!} 
                  personB={personB!} 
                  path={path} 
                  analysis={analysis} 
                  tree={tree} 
                  graph={graph} 
                />
              ) : (
                <div className="card p-12 flex flex-col items-center justify-center text-center text-amber-500 bg-amber-50/50 border-amber-200">
                  <X className="w-16 h-16 mb-4 opacity-30" />
                  <h3 className="text-xl font-bold text-amber-700 mb-2">Nema krvne poveznice</h3>
                  <p className="max-w-md text-amber-600">Nije pronađen direktan put srodnosti između ove dvije osobe u stablu. Pokušajte odabrati opciju "Usporedi osobe" za više detalja.</p>
                </div>
              )
            )}
            
            {activeTab === 'people' && (
              <ComparePeopleTab 
                personA={personA!} 
                personB={personB!} 
                tree={tree} 
                graph={graph}
                onJumpToPath={() => setActiveTab('path')}
              />
            )}
            
            {activeTab === 'trees' && (
              <CompareTreesTab 
                personA={personA!} 
                personB={personB!} 
                tree={tree} 
              />
            )}
          </>
        )}
      </div>

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Srodstva i usporedbe"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>Srodstva i usporedbe</strong> sadrži tri napredna alata za pronalaženje poveznica i komparaciju između osoba u vašem stablu:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Pronađi poveznicu:</strong> Pronalazi najkraći put srodstva između dvije odabrane osobe (Osoba A i Osoba B) i crta interaktivni grafički prikaz te linije. Također prepoznaje je li riječ o krvnom srodstvu i opisuje točan odnos (npr. "treće koljeno", "tetka").
            </li>
            <li>
              <strong>Usporedi osobe:</strong> Uspoređuje životne puteve i ključne događaje (rođenje, brak, smrt) dviju osoba na paralelnoj vremenskoj ljestvici, olakšavajući usporedbu generacijskih razlika.
            </li>
            <li>
              <strong>Usporedi stabla:</strong> Prikazuje preklapanje predaka i statistiku zajedničkih srodnika.
            </li>
          </ul>
        </div>
      </HelpModal>
    </div>
  );
}
