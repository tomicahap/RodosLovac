import React, { useState, Suspense, lazy, useMemo } from 'react';
import { MapPin, Users, Tag, Ship, FileText, List, ArrowLeft, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PersonSearch from '../../components/PersonSearch';

// Lazy load actual map modules to keep this shell light
const AdvancedMap = lazy(() => import('../AdvancedMap/AdvancedMap'));
const DescendantsMap = lazy(() => import('../DescendantsMap/DescendantsMap'));
const SurnameMap = lazy(() => import('../SurnameMap/SurnameMap'));
const MigrationMap = lazy(() => import('../MigrationMap/MigrationMap'));
const PlacesIndex = lazy(() => import('../PlacesIndex/PlacesIndex'));

type MapTab = 'ancestors' | 'descendants' | 'surnames' | 'migrations' | 'places';

interface TabConfig {
  id: MapTab;
  label: string;
  icon: React.ReactNode;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
}

const TABS: TabConfig[] = [
  { id: 'ancestors', label: 'Karta predaka', icon: <MapPin size={16} />, activeColor: 'text-teal-600', activeBg: 'bg-teal-50', activeBorder: 'border-teal-500' },
  { id: 'descendants', label: 'Karta potomaka', icon: <Users size={16} />, activeColor: 'text-green-600', activeBg: 'bg-green-50', activeBorder: 'border-green-500' },
  { id: 'surnames', label: 'Karta prezimena', icon: <Tag size={16} />, activeColor: 'text-orange-600', activeBg: 'bg-orange-50', activeBorder: 'border-orange-500' },
  { id: 'migrations', label: 'Karta migracija', icon: <Ship size={16} />, activeColor: 'text-blue-600', activeBg: 'bg-blue-50', activeBorder: 'border-blue-500' },
  { id: 'places', label: 'Mjesta', icon: <List size={16} />, activeColor: 'text-teal-600', activeBg: 'bg-teal-50', activeBorder: 'border-teal-500' },
];

export default function MapsDashboard() {
  const { tree, selectedPersonId, setSelectedPerson, setActiveModule } = useApp();
  const [activeTab, setActiveTab] = useState<MapTab>('ancestors');

  const selectedPerson = useMemo(() => {
    if (!tree || !selectedPersonId) return null;
    return tree.persons.get(selectedPersonId) || null;
  }, [tree, selectedPersonId]);

  const renderContent = () => {
    switch (activeTab) {
      case 'ancestors':
        return <AdvancedMap />;
      case 'descendants':
        return <DescendantsMap />;
      case 'surnames':
        return <SurnameMap />;
      case 'migrations':
        return <MigrationMap />;
      case 'places':
        return <PlacesIndex />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(130vh-64px)] max-w-7xl mx-auto w-full p-4 md:p-6 animate-fade-in print:p-0 print:h-auto print:max-w-none">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 shrink-0 custom-scrollbar mb-4 border-b border-[var(--border-color)] print:hidden">


        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap shrink-0 border shadow-sm
                ${isActive 
                  ? `${tab.activeBg} ${tab.activeColor} ${tab.activeBorder}` 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              <span className={`${isActive ? '' : tab.id === 'ancestors' ? 'text-rose-500' : ''}`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col print:border-none print:shadow-none">
        
        {/* Map Canvas */}
        <div className="flex-1 overflow-hidden relative">
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center gap-3 text-slate-400">
              <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Učitavanje karte...</span>
            </div>
          }>
            {renderContent()}
          </Suspense>
        </div>

      </div>
    </div>
  );
}
