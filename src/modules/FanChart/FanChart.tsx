import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, PieChart, ChevronsUp, ChevronsDown, Waypoints, Globe, Download, X } from 'lucide-react';
import FanChartTab from './FanChartTab';
import FamilyTreeTab from './FamilyTreeTab';
import DescendantsSunburstTab from './DescendantsSunburstTab';
import BowtieTab from './BowtieTab';
import OriginsTab from './OriginsTab';
import PersonSearch from '../../components/PersonSearch';

export type ChartTab = 'fanchart' | 'halffan' | 'ancestors' | 'descendants' | 'bowtie' | 'origins';
export type ColorMode = 'generation' | 'dob_roditelja' | 'obitelj' | 'drzava' | 'lands';

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

      {/* Content Area */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col print:border-none print:shadow-none">
        {activeTab === 'fanchart' && (
          <FanChartTab
            maxGenerations={maxGen}
            setMaxGenerations={setMaxGen}
            colorMode={colorMode}
            setColorMode={setColorMode}
            isHalfFan={false}
          />
        )}
        {activeTab === 'halffan' && (
          <FanChartTab
            maxGenerations={maxGen}
            setMaxGenerations={setMaxGen}
            colorMode={colorMode}
            setColorMode={setColorMode}
            isHalfFan={true}
          />
        )}
        {activeTab === 'ancestors' && (
          <FamilyTreeTab
            viewType={activeTab}
            maxGenerations={maxGen}
            setMaxGenerations={setMaxGen}
            colorMode={colorMode}
            setColorMode={setColorMode}
          />
        )}
        {activeTab === 'bowtie' && (
          <BowtieTab />
        )}
        {activeTab === 'descendants' && (
          <DescendantsSunburstTab
            maxGenerations={maxGen}
            setMaxGenerations={setMaxGen}
          />
        )}
        {activeTab === 'origins' && (
          <OriginsTab />
        )}
      </div>

    </div>
  );
}
