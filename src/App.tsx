// ============================================================
// App.tsx — Main application shell
// ============================================================

import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LandingPage from './components/LandingPage';
import AppHeader from './components/AppHeader';
import ErrorBoundary from './components/ErrorBoundary';
import HomePersonModal from './components/HomePersonModal';
import SharedPersonHeader from './components/SharedPersonHeader';

// Lazy-load heavy modules to keep initial bundle small
const Overview = lazy(() => import('./modules/Overview/Overview'));
const PersonStats = lazy(() => import('./modules/PersonStats/PersonStats'));
const Relationships = lazy(() => import('./modules/Relationships/Relationships'));
const Lifespans = lazy(() => import('./modules/Lifespans/Lifespans'));
const FanChart = lazy(() => import('./modules/FanChart/FanChart'));
const MapsDashboard = lazy(() => import('./modules/Maps/MapsDashboard'));
const OnThisDay = lazy(() => import('./modules/OnThisDay/OnThisDay'));
const Research = lazy(() => import('./modules/Research/Research'));
const Export = lazy(() => import('./modules/Export/Export'));

function ModuleLoader() {
  return (
    <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm font-bold">Učitavanje modula...</span>
    </div>
  );
}

function AppShell() {
  const { tree, activeModule, selectedPersonId, appVersion, uploadCount } = useApp();

  const renderModule = () => {
    switch (activeModule) {
      case 'overview': return <Overview />;
      case 'person-stats': return <PersonStats />;
      case 'relationships': return <Relationships />;
      case 'lifespans': return <Lifespans />;
      case 'fan-chart': return <FanChart />;
      case 'maps': return <MapsDashboard />;
      case 'on-this-day': return <OnThisDay />;
      case 'research': return <Research />;
      case 'export': return <Export />;
      default: return <PersonStats />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <AppHeader />
      <main className="flex-1 overflow-y-auto w-full">
        {(!tree || activeModule === 'landing') ? (
          <LandingPage />
        ) : (
          <div className="max-w-[80vw] print:max-w-none print:w-full mx-auto w-full pt-8 pb-16 px-4 print:p-0">
            {/* Global Shared Header (shown on all specific person tabs) */}
            {activeModule !== 'overview' && activeModule !== 'export' && (
              <SharedPersonHeader />
            )}
            
            <ErrorBoundary>
              <Suspense fallback={<ModuleLoader />}>
                {renderModule()}
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </main>
      
      {tree && !selectedPersonId && <HomePersonModal />}

      {/* Footer with version and load count */}
      <footer className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0 print:hidden z-10">
        <div>Verzija: <span className="font-bold">{appVersion}</span></div>
        <div>Ukupno učitavanja aplikacije: <span className="font-bold">{uploadCount}</span></div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
