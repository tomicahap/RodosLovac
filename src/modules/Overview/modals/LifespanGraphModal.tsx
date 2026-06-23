import React, { useMemo } from 'react';
import { X, Heart, Activity } from 'lucide-react';
import type { GedcomTree } from '../../../parser/gedcomTypes';

interface Props {
  tree: GedcomTree;
  onClose: () => void;
}

export default function LifespanGraphModal({ tree, onClose }: Props) {
  
  const chartData = useMemo(() => {
    const decades = new Map<number, { sum: number, count: number }>();
    
    for (const p of tree.persons.values()) {
      const bYear = p.birth?.date?.year;
      const dYear = p.death?.date?.year;
      
      if (bYear && dYear && dYear >= bYear) {
        const lifespan = dYear - bYear;
        // Ignore impossible data
        if (lifespan < 0 || lifespan > 120) continue;

        // Bucket by decade based on birth year
        const decade = Math.floor(bYear / 10) * 10;
        
        if (!decades.has(decade)) decades.set(decade, { sum: 0, count: 0 });
        const entry = decades.get(decade)!;
        entry.sum += lifespan;
        entry.count += 1;
      }
    }

    const data = Array.from(decades.entries())
      .map(([decade, stats]) => ({
        decade,
        avgLifespan: Math.round(stats.sum / stats.count),
        count: stats.count
      }))
      .filter(d => d.count >= 2) // Need at least 2 people for an "average" to make sense visually
      .sort((a, b) => a.decade - b.decade);

    return data;
  }, [tree]);

  const maxLifespan = Math.max(...chartData.map(d => d.avgLifespan), 80); // baseline scale 80

  return (
    <div className="w-full mt-2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-teal-200 dark:border-teal-900/50 overflow-hidden min-h-[500px] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-teal-100 dark:border-teal-900/30 bg-teal-50 dark:bg-teal-900/20">
          <div>
            <h2 className="text-xl font-extrabold text-teal-700 dark:text-teal-400 tracking-tight flex items-center gap-2">
              <Activity size={20} className="text-teal-500" /> Prosječan životni vijek po desetljećima
            </h2>
            <p className="text-sm font-medium text-teal-600/70 dark:text-teal-400/70 mt-1">
              Prikaz prosječne duljine života osoba rođenih u određenom desetljeću.
            </p>
          </div>
          <button onClick={onClose} className="btn bg-white border-teal-200 text-teal-700 hover:bg-teal-100 shadow-sm transition-colors text-sm px-4">
            Zatvori prikaz
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-white dark:bg-slate-900 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-center min-h-[400px]">
          
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <Heart className="w-12 h-12 mb-4 opacity-20" />
              <p>Nema dovoljno pouzdanih podataka o godini rođenja i smrti za izradu grafa.</p>
            </div>
          ) : (
            <div className="w-full mt-4 flex flex-col gap-3 pr-4">
              {chartData.map((d, i) => (
                <div key={i} className="flex items-center gap-3 w-full group">
                  
                  {/* Y Axis Label (Decade) */}
                  <div className="w-14 text-right text-sm font-black text-gray-400 dark:text-gray-500 shrink-0">
                    {d.decade}s
                  </div>

                  {/* Horizontal Bar */}
                  <div className="flex-1 h-10 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-r-xl relative overflow-hidden flex items-center shadow-inner">
                    
                    {/* The Bar */}
                    <div 
                      className="h-full bg-teal-500 group-hover:bg-teal-400 transition-all relative flex items-center justify-end pr-2"
                      style={{ width: `${(d.avgLifespan / maxLifespan) * 100}%` }}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-teal-600/30 to-transparent pointer-events-none"></div>
                    </div>
                    
                    {/* Value Label (Overlay) */}
                    <div className="absolute left-3 text-sm font-extrabold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] pointer-events-none">
                      {d.avgLifespan} <span className="font-normal opacity-80 text-xs">godina</span>
                    </div>

                    {/* Sample Size (Overlay far right) */}
                    <div className="absolute right-3 text-[10px] font-semibold text-gray-400 dark:text-gray-500 pointer-events-none">
                      Uzorak: {d.count}
                    </div>

                  </div>

                </div>
              ))}
            </div>
          )}

          <div className="mt-12 text-center text-xs text-gray-500 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl">
            <span className="font-bold text-gray-700 dark:text-gray-300">Napomena:</span> Ovaj graf prikazuje prosječni životni vijek osoba u vašem stablu, isključujući dječju smrtnost ukoliko nije unesena u GEDCOM podatke. Padovi u grafu često su indikatori ratova ili pandemija.
          </div>
        </div>

    </div>
  );
}
