import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { generateDemographics, type StatItem } from '../../../utils/demographics';

const MinimalBar = ({ item, index }: { item: StatItem, index: number }) => (
  <div className="mb-3">
    <div className="flex items-center text-[13px] mb-1 gap-3">
      <span className="text-gray-400 text-xs w-4 text-right shrink-0">{index}</span>
      <span className="font-semibold text-teal-600 dark:text-teal-400 truncate flex-1" title={item.name}>{item.name}</span>
      <span className="text-gray-400 font-medium shrink-0">{item.count}</span>
    </div>
    <div className="pl-7">
      <div className="h-[3px] bg-gray-100 dark:bg-slate-800 rounded-full w-full overflow-hidden">
        <div 
          className="h-full bg-teal-500 rounded-full" 
          style={{ width: `${item.bar_percentage}%` }}
        />
      </div>
    </div>
  </div>
);

export default function DemographicsCards() {
  const { tree } = useApp();

  const stats = useMemo(() => {
    if (!tree) return null;
    return generateDemographics(tree);
  }, [tree]);

  if (!stats) return null;

  return (
    <>
      {/* Card 2: Top Surnames */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">Top Prezimena</h2>
          <button className="text-[13px] font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1">
            Vidi sve →
          </button>
        </div>
        
        <div className="flex-1">
          {stats.top_surnames.length === 0 ? (
            <p className="text-sm text-gray-400">Nema podataka.</p>
          ) : (
            stats.top_surnames.map((item, i) => (
              <MinimalBar key={i} item={item} index={i + 1} />
            ))
          )}
        </div>
      </div>

      {/* Card 3: Top Birth Locations */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col h-full">
        <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-6">Top Mjesta Rođenja</h2>
        
        <div className="flex-1 space-y-6">
          {/* Countries */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Države</h3>
            {stats.top_countries.length === 0 ? (
              <p className="text-sm text-gray-400">Nema podataka.</p>
            ) : (
              stats.top_countries.slice(0, 5).map((item, i) => (
                <MinimalBar key={i} item={item} index={i + 1} />
              ))
            )}
          </div>

          {/* Places */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Naselja</h3>
            {stats.top_places.length === 0 ? (
              <p className="text-sm text-gray-400">Nema podataka.</p>
            ) : (
              stats.top_places.slice(0, 5).map((item, i) => (
                <MinimalBar key={i} item={item} index={i + 1} />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
