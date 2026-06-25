import React from 'react';
import { useApp, type AppModule } from '../context/AppContext';
import DetectiveIcon from './DetectiveIcon';

interface NavItem {
  id: AppModule;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  // People & Analysis
  { id: 'person-stats', label: 'Statistika osobe', icon: <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />, group: 'Ljudi i analiza' },
  { id: 'lifespans', label: 'Životni vijekovi', icon: <Icon d="M3 3v18h18M7 16l4-4 4 4 4-8" />, group: 'Ljudi i analiza' },
  { id: 'fan-chart', label: 'Grafovi', icon: <Icon d="M12 2a10 10 0 1 0 10 10" />, group: 'Ljudi i analiza' },
  // Maps & Discovery
  { id: 'maps', label: 'Karte', icon: <Icon d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />, group: 'Karte i otkrića' },
  { id: 'on-this-day', label: 'Na ovaj dan', icon: <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />, group: 'Karte i otkrića' },
  // Research & Export
  { id: 'research', label: 'Istraživanje', icon: <Icon d="M10 21h7a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 12.586 3H7a2 2 0 0 0-2 2v11m0 5-4.879-4.879c-.781-.781-.781-2.048 0-2.828L15 9" />, group: 'Istraživanje i izvoz' },
  { id: 'export', label: 'Izvoz', icon: <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, group: 'Istraživanje i izvoz' },
];

const GROUPS = ['Ljudi i analiza', 'Karte i otkrića', 'Istraživanje i izvoz'];

interface Props {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: Props) {
  const { activeModule, setActiveModule, tree, selectedPersonId, appVersion, uploadCount } = useApp();

  const selectedName = tree && selectedPersonId
    ? tree.persons.get(selectedPersonId)?.names[0]?.full || 'Nepoznato'
    : null;

  const handleNav = (module: AppModule) => {
    setActiveModule(module);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00ab84] flex items-center justify-center text-white shadow-sm">
              <DetectiveIcon size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-[var(--text-primary)]">RodosLovac</div>
              <div className="text-[10px] text-[var(--text-muted)]">Alat za naprednu analizu</div>
            </div>
          </div>
        </div>

        {/* Selected person badge */}
        {selectedName && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-[var(--brand-light)] border border-[var(--brand-color)]/20">
            <div className="text-[10px] font-medium text-[var(--brand-color)] uppercase tracking-wider mb-0.5">Odabrana osoba</div>
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{selectedName}</div>
          </div>
        )}

        {/* Navigation */}
        <nav className="py-3 flex-1">
          {GROUPS.map(group => (
            <div key={group} className="mb-4">
              <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">  
                {group}
              </div>
              {NAV_ITEMS.filter(i => i.group === group).map(item => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`sidebar-nav-item w-full ${activeModule === item.id ? 'active' : ''}`}
                >
                  <span className="opacity-70">{item.icon}</span>
                  <span>{item.label}</span>
                  {activeModule === item.id && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--brand-color)]"></span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg text-[var(--text-muted)] text-xs">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              100% privatno
            </div>
            <div className="text-[9px] opacity-40 hover:opacity-100 transition-opacity">v{appVersion} • {uploadCount}x</div>
          </div>
        </div>
      </aside>
    </>
  );
}
