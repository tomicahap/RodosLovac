import React, { useMemo } from 'react';
import type { GedcomTree } from '../../../parser/gedcomTypes';
import { computeNetworkStats } from '../../../utils/networkEngine';
import { X, Share2, Users, AlertCircle } from 'lucide-react';

interface Props {
  tree: GedcomTree;
  onClose: () => void;
  onPersonClick?: (id: string) => void;
  onShowActionProfiles?: (title: string, personIds: string[]) => void;
}

export default function ConnectionsModal({ tree, onClose, onPersonClick, onShowActionProfiles }: Props) {
  const stats = useMemo(() => computeNetworkStats(tree), [tree]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Share2 className="text-teal-600" />
              Povezanost stabla
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Analiza "glavnog stabla" i detekcija odvojenih ("detached") profila.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          
          <div className="flex items-center gap-6 mb-8">
            <div className="flex flex-col items-center justify-center min-w-[120px] p-4 bg-teal-50 dark:bg-teal-900/20 rounded-2xl border border-teal-100 dark:border-teal-900/50">
              <div className="text-5xl font-black text-teal-600">{stats.connectedPercentage}%</div>
              <div className="text-xs font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wider mt-1">Povezano</div>
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Glavno stablo (Connected)</div>
                  <div className="text-xs text-gray-500">Osobe u najvećem kontinuiranom grafu</div>
                </div>
                <div className="text-lg font-bold text-teal-600">{stats.mainTreeCount.toLocaleString()}</div>
              </div>

              <div className="h-3 w-full bg-red-100 dark:bg-red-900/30 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-teal-500 rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${stats.connectedPercentage}%` }}
                />
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <div className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Odvojeni profili (Detached)</div>
                  <div className="text-xs text-gray-500">Ne pripadaju glavnom stablu</div>
                </div>
                {stats.detachedCount > 0 ? (
                  <button 
                    onClick={() => { onClose(); onShowActionProfiles && onShowActionProfiles('Odvojeni profili (Detached)', stats.detachedIds); }}
                    className="text-lg font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    {stats.detachedCount.toLocaleString()} ↗
                  </button>
                ) : (
                  <div className="text-lg font-bold text-red-600">{stats.detachedCount.toLocaleString()}</div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={18} />
                Siročad (Orphans) <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">{stats.orphansCount}</span>
              </h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              Ovi profili nemaju niti jednog zabilježenog roditelja, supružnika ili dijete.
              Potpuno su izolirani u GEDCOM datoteci.
            </p>

            {stats.orphansCount === 0 ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/50 text-sm font-medium">
                Bravo! Nemate niti jedan "siroče" profil u bazi.
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {stats.orphansList.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => { if (onPersonClick) { onPersonClick(p.id); onClose(); } }}
                      className="w-full text-left p-3 border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-6 text-center text-xs text-gray-400">{i + 1}.</div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-teal-600 transition-colors">
                          {p.names[0]?.full || 'Nepoznato'}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {p.id} {p.birth?.date?.year ? `· Rođ: ${p.birth.date.year}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
