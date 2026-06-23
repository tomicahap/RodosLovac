import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, PieChart, ChevronsUp, ChevronsDown, Waypoints, Globe, Download, X } from 'lucide-react';
import FanChartTab from './FanChartTab';
import FamilyTreeTab from './FamilyTreeTab';
import OriginsTab from './OriginsTab';
import PersonSearch from '../../components/PersonSearch';

export type ColorMode = 'generation' | 'dob_roditelja' | 'obitelj' | 'drzava' | 'lands';
export type ChartTab = 'fanchart' | 'halffan' | 'ancestors' | 'descendants' | 'bowtie' | 'origins';

const HalfFanIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12A9 9 0 0 0 3 12h18Z" />
  </svg>
);

export default function FanChart() {
  const { tree, graph, selectedPersonId, setSelectedPerson, setActiveModule } = useApp();
  
  const [activeTab, setActiveTab] = useState<ChartTab>('fanchart');
  const [maxGen, setMaxGen] = useState<number>(4);
  const [colorMode, setColorMode] = useState<ColorMode>('generation');

  const focalPerson = useMemo(() => {
    if (!tree || !selectedPersonId) return null;
    return tree.persons.get(selectedPersonId) || null;
  }, [tree, selectedPersonId]);

  // Compute depths
  const ancestorDepth = useMemo(() => {
    if (!graph || !selectedPersonId) return 0;
    return graph.getAncestorDepth(selectedPersonId);
  }, [graph, selectedPersonId]);

  const descendantDepth = useMemo(() => {
    if (!graph || !selectedPersonId) return 0;
    return graph.getDescendantDepth(selectedPersonId);
  }, [graph, selectedPersonId]);

  const tabs = [
    { id: 'fanchart', label: 'Kružni graf', icon: <PieChart size={16} /> },
    { id: 'halffan', label: 'Pola grafa', icon: <HalfFanIcon /> },
    { id: 'ancestors', label: 'Predci', icon: <ChevronsUp size={16} /> },
    { id: 'descendants', label: 'Potomci', icon: <ChevronsDown size={16} /> },
    { id: 'bowtie', label: 'Bowtie (Mašna)', icon: <Waypoints size={16} /> },
    { id: 'origins', label: 'Podrijetlo', icon: <Globe size={16} /> },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-[calc(130vh-64px)] max-w-7xl mx-auto w-full p-4 md:p-6 animate-fade-in print:p-0 print:h-auto print:max-w-none">
      
      {/* Top Navigation Bar - Hidden on print */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 shrink-0 custom-scrollbar mb-4 border-b border-[var(--border-color)] print:hidden">
        <button 
          onClick={() => setActiveModule('overview')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 whitespace-nowrap shrink-0 mr-2"
        >
          <ArrowLeft size={16} className="text-slate-500" /> Natrag
        </button>

        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ChartTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap shrink-0 border transition-colors shadow-sm ${
                isActive 
                  ? 'bg-teal-50/50 border-teal-500 text-teal-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={isActive ? 'text-teal-500' : 'text-teal-600'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Selected Person Card - Header panel below tabs */}
      {selectedPersonId && focalPerson && (
        <div className="p-3 shrink-0 print:m-0 print:p-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-4 print:border-none print:shadow-none">
            
            {/* Focal person details */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl border-2 shadow-inner shrink-0
                ${focalPerson.sex === 'M' ? 'bg-blue-50 border-blue-200 text-blue-500'
                : focalPerson.sex === 'F' ? 'bg-pink-50 border-pink-200 text-pink-500'
                : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                {focalPerson.sex === 'M' ? '♂' : focalPerson.sex === 'F' ? '♀' : '?'}
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-lg text-teal-700 leading-tight truncate">
                  {focalPerson.names[0]?.full || 'Nepoznato'}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                  <span>{focalPerson.birth?.date?.year ? `Rođen/a ${focalPerson.birth.date.year}` : 'Nepoznata godina'}</span>
                  <span className="text-slate-300">|</span>
                  <span>gore (predci): <strong>{ancestorDepth} gen.</strong></span>
                  <span className="text-slate-300">/</span>
                  <span>dolje (potomci): <strong>{descendantDepth} gen.</strong></span>
                </div>
              </div>
            </div>

            <div className="flex-1 print:hidden" />

            {/* Settings section - Hidden on print */}
            <div className="flex flex-wrap items-center gap-3 print:hidden">
              {/* Generations picker (not visible on Origins tab) */}
              {activeTab !== 'origins' && (
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0.5">
                  {[3, 4, 5, 6, 7].map(g => (
                    <button key={g} onClick={() => setMaxGen(g)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                        maxGen === g
                          ? 'bg-white text-teal-600 shadow border border-teal-100'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}>
                      {g}G
                    </button>
                  ))}
                </div>
              )}

              {/* Color modes pills */}
              {activeTab !== 'origins' && (
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0.5">
                  {([
                    { id: 'generation', label: 'Gen' },
                    { id: 'dob_roditelja', label: 'Dob rod.' },
                    { id: 'obitelj', label: 'Obitelj' },
                    { id: 'drzava', label: 'Država' },
                    { id: 'lands', label: 'Krajevi' },
                  ] as { id: ColorMode; label: string }[]).map(c => (
                    <button key={c.id} onClick={() => setColorMode(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                        colorMode === c.id
                          ? 'bg-white text-teal-600 shadow border border-teal-100'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 items-center">
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 text-sm font-bold transition-colors"
                >
                  <Download size={13} /> PDF
                </button>
                <button onClick={() => setSelectedPerson(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-bold transition-colors">
                  <X size={13} /> Zatvori
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col print:border-none print:shadow-none">
        {!selectedPersonId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 p-6">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-500 mb-4 shadow-sm">
              <PieChart size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Vizualizacija grafova obiteljskog stabla</h3>
            <p className="text-sm max-w-md text-center text-slate-500 mb-4">
              Odaberite osobu pomoću tražilice ispod kako biste učitali kružne, polukružne, rodoslovne ili geografske prikaze.
            </p>
            <div className="w-full max-w-sm">
              <PersonSearch />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'fanchart' && (
              <FanChartTab maxGenerations={maxGen} colorMode={colorMode} isHalfFan={false} />
            )}
            {activeTab === 'halffan' && (
              <FanChartTab maxGenerations={maxGen} colorMode={colorMode} isHalfFan={true} />
            )}
            {(activeTab === 'ancestors' || activeTab === 'descendants' || activeTab === 'bowtie') && (
              <FamilyTreeTab viewType={activeTab} maxGenerations={maxGen} colorMode={colorMode} />
            )}
            {activeTab === 'origins' && (
              <OriginsTab />
            )}
          </>
        )}
      </div>

    </div>
  );
}
