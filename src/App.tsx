// ============================================================
// App.tsx — Main application shell
// ============================================================

import React, { Suspense, lazy, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LandingPage from './components/LandingPage';
import AppHeader from './components/AppHeader';
import ErrorBoundary from './components/ErrorBoundary';
import HomePersonModal from './components/HomePersonModal';

// Lazy-load heavy modules to keep initial bundle small
const Overview = lazy(() => import('./modules/Overview/Overview'));
const PersonStats = lazy(() => import('./modules/PersonStats/PersonStats'));
const Relationships = lazy(() => import('./modules/Relationships/Relationships'));
const Lifespans = lazy(() => import('./modules/Lifespans/Lifespans'));
const FanChart = lazy(() => import('./modules/FanChart/FanChart'));
const AdvancedMap = lazy(() => import('./modules/AdvancedMap/AdvancedMap'));
const SurnameMap = lazy(() => import('./modules/SurnameMap/SurnameMap'));
const MigrationMap = lazy(() => import('./modules/MigrationMap/MigrationMap'));
const CensusMap = lazy(() => import('./modules/CensusMap/CensusMap'));
const OnThisDay = lazy(() => import('./modules/OnThisDay/OnThisDay'));
const Research = lazy(() => import('./modules/Research/Research'));
const Export = lazy(() => import('./modules/Export/Export'));

function ModuleLoader() {
  return (
    <div className="flex items-center justify-center h-48 gap-3 text-[var(--text-muted)]">
      <div className="w-5 h-5 border-2 border-[var(--brand-color)] border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm">Učitavanje modula...</span>
    </div>
  );
}

function AppShell() {
  const { tree, activeModule, selectedPersonId } = useApp();

  const renderModule = () => {
    switch (activeModule) {
      case 'overview': return <Overview />;
      case 'person-stats': return <PersonStats />;
      case 'relationships': return <Relationships />;
      case 'lifespans': return <Lifespans />;
      case 'fan-chart': return <FanChart />;
      case 'ancestor-map': return <AdvancedMap />;
      case 'surname-map': return <SurnameMap />;
      case 'migration-map': return <MigrationMap />;
      case 'census-map': return <CensusMap />;
      case 'on-this-day': return <OnThisDay />;
      case 'research': return <Research />;
      case 'export': return <Export />;
      default: return <PersonStats />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f9fafb]">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          <Suspense fallback={<ModuleLoader />}>
            {!tree || activeModule === 'landing' ? <LandingPage /> : renderModule()}
          </Suspense>
        </ErrorBoundary>
      </main>
      
      {tree && !selectedPersonId && <HomePersonModal />}
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
