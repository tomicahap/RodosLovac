import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { computeDashboardData } from '../../../utils/dashboardEngine';

interface Props {
  onOpenModal: (modalId: string) => void;
}

export default function MapsDiscoveryNav({ onOpenModal }: Props) {
  const { tree, graph, setActiveModule } = useApp();

  const data = useMemo(() => {
    if (!tree) return null;
    return computeDashboardData(tree);
  }, [tree]);

  const analytics = useMemo(() => {
    if (!graph) return null;
    return graph.getOverviewAnalytics();
  }, [graph]);

  if (!tree || !data || !analytics) return null;

  const { stats } = tree;
  
  // Calculate generations from the graph
  const earliest = stats.earliestBirth || 1800;
  const latest = stats.latestBirth || new Date().getFullYear();
  const generationsCount = Math.max(1, Math.round((latest - earliest) / 25));

  const cards = [
    { 
      id: 'person-stats', 
      label: 'OSOBE', 
      value: stats.totalPersons, 
      sub: (
        <div className="flex gap-3 justify-center items-center mt-2 text-[11px] sm:text-xs">
          <span className="text-blue-500 font-bold">♂ {stats.maleCount} muških</span>
          <span className="text-rose-500 font-bold">♀ {stats.femaleCount} ženskih</span>
        </div>
      ), 
      onClick: () => onOpenModal('global-persons')
    },
    { 
      id: 'surnames', 
      label: 'PREZIMENA', 
      value: stats.uniqueSurnames.length, 
      sub: null,
      onClick: () => onOpenModal('surnames')
    },
    { 
      id: 'generations', 
      label: 'GENERACIJE', 
      value: generationsCount, 
      sub: null,
      onClick: () => setActiveModule('person-stats') // Generic fallback for generations
    },
    { 
      id: 'lifespan', 
      label: 'PROSJEČAN VIJEK', 
      value: analytics.avgLifespan, 
      sub: null,
      onClick: () => onOpenModal('lifespan')
    },
    { 
      id: 'oldest', 
      label: 'NAJRANIJA GODINA', 
      value: stats.earliestBirth || '-', 
      sub: null,
      onClick: () => setActiveModule('person-stats') // Generic fallback
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mt-4">
      {cards.map((card, i) => (
        <button 
          key={i} 
          onClick={card.onClick}
          className="card py-6 px-4 flex flex-col justify-center items-center hover:border-teal-300 hover:shadow-md transition-all text-center bg-white group cursor-pointer"
        >
          <div className="text-2xl sm:text-3xl font-black text-teal-600 group-hover:scale-105 transition-transform duration-300">
            {card.value}
          </div>
          <div className="text-[13px] font-bold tracking-[0.05em] text-gray-700 uppercase mt-2 group-hover:text-gray-900 transition-colors flex items-center gap-1">
            {card.label} <span className="text-sm font-black text-gray-400 group-hover:text-teal-600">↗</span>
          </div>
          {card.sub && (
            <div className="mt-1.5 opacity-100">
              {card.sub}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
