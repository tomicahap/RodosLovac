import React, { useState, Suspense, lazy } from 'react';
import { Copy, FileQuestion, SquareSquare, Type, GitMerge, Dna, AlertTriangle, Lock } from 'lucide-react';

const DuplicatesTab = lazy(() => import('./tabs/DuplicatesTab'));
const ResearchGapsTab = lazy(() => import('./tabs/ResearchGapsTab'));
const BrickWallsTab = lazy(() => import('./tabs/BrickWallsTab'));
const NamingPatternsTab = lazy(() => import('./tabs/NamingPatternsTab'));
const PedigreeCollapseTab = lazy(() => import('./tabs/PedigreeCollapseTab'));
const DNAPlannerTab = lazy(() => import('./tabs/DNAPlannerTab'));
const ChronologicalAnomaliesTab = lazy(() => import('./tabs/ChronologicalAnomaliesTab'));

type ResearchTab = 'duplicates' | 'gaps' | 'brickwalls' | 'naming' | 'collapse' | 'dna' | 'anomalies';

interface TabConfig {
  id: ResearchTab;
  label: string;
  icon: React.ReactNode;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
}



const TABS: TabConfig[] = [
  { id: 'duplicates', label: 'Duplikati', icon: <Copy size={16} />, activeColor: 'text-teal-600', activeBg: 'bg-teal-50', activeBorder: 'border-teal-500' },
  { id: 'gaps', label: 'Praznine u istraživanju', icon: <FileQuestion size={16} />, activeColor: 'text-emerald-600', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-500' },
  { id: 'brickwalls', label: "Nepoznanice / 'Zidovi'", icon: <SquareSquare size={16} />, activeColor: 'text-orange-600', activeBg: 'bg-orange-50', activeBorder: 'border-orange-500' },
  { id: 'naming', label: 'Obrazac imenovanja', icon: <Type size={16} />, activeColor: 'text-pink-600', activeBg: 'bg-pink-50', activeBorder: 'border-pink-500' },
  { id: 'collapse', label: 'Gubitak predaka', icon: <GitMerge size={16} />, activeColor: 'text-purple-600', activeBg: 'bg-purple-50', activeBorder: 'border-purple-500' },
  { id: 'dna', label: 'DNK planer', icon: <Dna size={16} />, activeColor: 'text-lime-600', activeBg: 'bg-lime-50', activeBorder: 'border-lime-500' },
  { id: 'anomalies', label: 'Kronološke anomalije', icon: <AlertTriangle size={16} />, activeColor: 'text-red-600', activeBg: 'bg-red-50', activeBorder: 'border-red-500' },
];

export default function Research() {
  const [activeTab, setActiveTab] = useState<ResearchTab>('duplicates');

  const renderContent = () => {
    switch (activeTab) {
      case 'duplicates': return <DuplicatesTab />;
      case 'gaps': return <ResearchGapsTab />;
      case 'brickwalls': return <BrickWallsTab />;
      case 'naming': return <NamingPatternsTab />;
      case 'collapse': return <PedigreeCollapseTab />;
      case 'dna': return <DNAPlannerTab />;
      case 'anomalies': return <ChronologicalAnomaliesTab />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full animate-fade-in print:p-0 print:max-w-none relative">
      
      {/* Top Navigation Bar - Sticky */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md pt-3 pb-3 mb-4 flex flex-wrap items-center justify-center gap-1.5 shrink-0 border-b border-[var(--border-color)] print:hidden">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all shrink-0 border shadow-sm
                ${isActive 
                  ? `${tab.activeBg} ${tab.activeColor} ${tab.activeBorder}` 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[var(--border-color)] shadow-sm flex flex-col print:border-none print:shadow-none">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Učitavanje...</span>
          </div>
        }>
          {renderContent()}
        </Suspense>
      </div>

      {/* Security Footer */}
      <div className="mt-4 pb-8 flex justify-center print:hidden">
        <div className="flex items-center gap-2 text-[12px] text-slate-400 font-medium bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
          <Lock size={14} className="text-emerald-500" />
          <span><strong className="text-slate-600">Vaši podaci su 100% privatni i sigurni.</strong> Apsolutno sva obrada odvija se lokalno na vašem računalu.</span>
        </div>
      </div>

    </div>
  );
}
