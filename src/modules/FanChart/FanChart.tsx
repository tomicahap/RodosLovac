import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, PieChart, Gauge, Users, ChevronsDown, Waypoints, Globe } from 'lucide-react';
import FanChartTab from './FanChartTab';

type ChartTab = 'fanchart' | 'genage' | 'family' | 'descendants' | 'bowtie' | 'origins';

interface Props {
  mini?: boolean;
  maxGenerations?: number;
}

export default function FanChart({ mini, maxGenerations }: Props) {
  const { setActiveModule } = useApp();
  const [activeTab, setActiveTab] = useState<ChartTab>('fanchart');

  if (mini) {
    return <FanChartTab mini={mini} maxGenerations={maxGenerations} />;
  }

  const tabs = [
    { id: 'fanchart', label: 'Kružni graf', icon: <PieChart size={16} /> },
    { id: 'genage', label: 'Generacijska starost', icon: <Gauge size={16} /> },
    { id: 'family', label: 'Obitelj', icon: <Users size={16} /> },
    { id: 'descendants', label: 'Potomci', icon: <ChevronsDown size={16} /> },
    { id: 'bowtie', label: 'Mašna', icon: <Waypoints size={16} /> },
    { id: 'origins', label: 'Podrijetlo', icon: <Globe size={16} /> },
  ];

  return (
    <div className="flex flex-col h-[calc(130vh-64px)] max-w-7xl mx-auto w-full p-4 md:p-6 animate-fade-in">
      
      {/* Top Navigation Bar exactly like image */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 shrink-0 custom-scrollbar mb-4 border-b border-[var(--border-color)]">
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

      {/* Content Area */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col">
        {activeTab === 'fanchart' && <FanChartTab />}
        {activeTab === 'genage' && <FanChartTab isGenAgeMode={true} initialColorMode="dob_roditelja" />}
        {activeTab === 'family' && <FanChartTab isFamilyMode={true} initialColorMode="obitelj" />}
        
        {activeTab !== 'fanchart' && activeTab !== 'genage' && activeTab !== 'family' && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
            {tabs.find(t => t.id === activeTab)?.icon}
            <h3 className="mt-4 text-xl font-bold text-slate-600">Graf u pripremi</h3>
            <p className="mt-2 text-sm max-w-sm text-center">
              Prikaz za {tabs.find(t => t.id === activeTab)?.label} još nije implementiran. Dodat ćemo podatke naknadno!
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
