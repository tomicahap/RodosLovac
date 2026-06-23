import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { generateDemographics, type StatItem } from '../../../utils/demographics';
import { BarChart2, MapPin, Globe, Users } from 'lucide-react';

const ProgressBar = ({ item, colorClass }: { item: StatItem, colorClass: string }) => (
  <div className="mb-3 last:mb-0">
    <div className="flex justify-between items-end mb-1 text-sm">
      <span className="font-semibold text-[var(--text-primary)] truncate pr-2" title={item.name}>{item.name}</span>
      <span className="font-bold text-[var(--text-secondary)]">{item.count}</span>
    </div>
    <div className="h-1.5 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
      <div 
        className={`h-full rounded-full ${colorClass}`} 
        style={{ width: `${item.bar_percentage}%` }}
      />
    </div>
  </div>
);

export default function DemographicsReport() {
  const { tree } = useApp();

  const stats = useMemo(() => {
    if (!tree) return null;
    return generateDemographics(tree);
  }, [tree]);

  if (!stats) return null;

  return (
    <div className="grid md:grid-cols-3 gap-6 animate-fade-in mt-6">
      
      {/* Surnames */}
      <div className="card p-5 border-t-4 border-t-brand-500">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-[var(--text-primary)]">
          <Users className="text-brand-500" size={20} />
          Top Prezimena
        </h3>
        <div className="space-y-1">
          {stats.top_surnames.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nema podataka o prezimenima.</p>
          ) : (
            stats.top_surnames.map((item, i) => (
              <ProgressBar key={i} item={item} colorClass="bg-brand-500" />
            ))
          )}
        </div>
      </div>

      {/* Countries */}
      <div className="card p-5 border-t-4 border-t-blue-500">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-[var(--text-primary)]">
          <Globe className="text-blue-500" size={20} />
          Zemlje Rođenja
        </h3>
        <div className="space-y-1">
          {stats.top_countries.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nema podataka o lokacijama rođenja.</p>
          ) : (
            stats.top_countries.map((item, i) => (
              <ProgressBar key={i} item={item} colorClass="bg-blue-500" />
            ))
          )}
        </div>
      </div>

      {/* Specific Places */}
      <div className="card p-5 border-t-4 border-t-pink-500">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-[var(--text-primary)]">
          <MapPin className="text-pink-500" size={20} />
          Mikrolokacije Rođenja
        </h3>
        <div className="space-y-1">
          {stats.top_places.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nema podataka o lokacijama rođenja.</p>
          ) : (
            stats.top_places.map((item, i) => (
              <ProgressBar key={i} item={item} colorClass="bg-pink-500" />
            ))
          )}
        </div>
      </div>

    </div>
  );
}
