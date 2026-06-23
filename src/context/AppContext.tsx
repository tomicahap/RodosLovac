// ============================================================
// Global App Context — parsed tree, selected person, theme
// ============================================================

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { GedcomTree } from '../parser/gedcomTypes';
import { TreeGraph } from '../parser/treeGraph';
import parseGedcom from '../parser/gedcomParser';

export type AppModule =
  | 'landing'
  | 'overview'
  | 'person-stats'
  | 'relationships'
  | 'lifespans'
  | 'fan-chart'
  | 'ancestor-map'
  | 'surname-map'
  | 'migration-map'
  | 'census-map'
  | 'on-this-day'
  | 'research'
  | 'export';

export type Theme = 'dark' | 'light';

interface AppState {
  tree: GedcomTree | null;
  graph: TreeGraph | null;
  selectedPersonId: string | null;
  comparePersonId: string | null;
  activeModule: AppModule;
  theme: Theme;
  isLoading: boolean;
  loadError: string | null;
  fileName: string | null;
  appVersion: string;
  uploadCount: number;
}

interface AppContextValue extends AppState {
  loadGedcom: (text: string, fileName?: string) => Promise<void>;
  setSelectedPerson: (id: string | null) => void;
  setComparePersonId: (id: string | null) => void;
  setActiveModule: (module: AppModule) => void;
  toggleTheme: () => void;
  resetTree: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    tree: null,
    graph: null,
    selectedPersonId: null,
    comparePersonId: null,
    activeModule: 'landing',
    theme: 'light',
    isLoading: false,
    loadError: null,
    fileName: null,
    appVersion: 'v1.2.0',
    uploadCount: parseInt(localStorage.getItem('predci_upload_count') || '0', 10),
  });

  // Apply theme to <html> element
  const applyTheme = useCallback((theme: Theme) => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, []);

  React.useEffect(() => {
    applyTheme(state.theme);
  }, [state.theme, applyTheme]);

  const loadGedcom = useCallback(async (text: string, fileName?: string) => {
    setState(s => ({ ...s, isLoading: true, loadError: null }));
    try {
      const start = Date.now();
      
      // Parse in a setTimeout to allow UI to update first
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            const tree = parseGedcom(text);
            const graph = new TreeGraph(tree);
            
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 9000 - elapsed);

            setTimeout(() => {
              // Pick first person as default selected
              const firstPersonId = tree.persons.size > 0
                ? tree.persons.keys().next().value
                : null;
                
              setState(s => ({
                ...s,
                tree,
                graph,
                selectedPersonId: null,
                activeModule: 'overview',
                isLoading: false,
                fileName: fileName || 'Untitled.ged',
                uploadCount: s.uploadCount + 1,
              }));
              
              // Increment local storage counter
              const newCount = parseInt(localStorage.getItem('predci_upload_count') || '0', 10) + 1;
              localStorage.setItem('predci_upload_count', newCount.toString());
              
              resolve();
            }, remaining);
            
          } catch (e) {
            reject(e);
          }
        }, 50);
      });
    } catch (err) {
      setState(s => ({
        ...s,
        isLoading: false,
        loadError: err instanceof Error ? err.message : 'Failed to parse GEDCOM file',
      }));
    }
  }, []);

  const setSelectedPerson = useCallback((id: string | null) => {
    setState(s => ({ ...s, selectedPersonId: id }));
  }, []);

  const setComparePersonId = useCallback((id: string | null) => {
    setState(s => ({ ...s, comparePersonId: id }));
  }, []);

  const setActiveModule = useCallback((module: AppModule) => {
    setState(s => ({ ...s, activeModule: module }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const resetTree = useCallback(() => {
    setState(s => ({
      ...s,
      tree: null,
      graph: null,
      selectedPersonId: null,
      comparePersonId: null,
      activeModule: 'landing',
      isLoading: false,
      loadError: null,
      fileName: null,
    }));
  }, []);

  const value: AppContextValue = {
    ...state,
    loadGedcom,
    setSelectedPerson,
    setComparePersonId,
    setActiveModule,
    toggleTheme,
    resetTree,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
