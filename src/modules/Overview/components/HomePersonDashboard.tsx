import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import AncestorMap from '../../AncestorMap/AncestorMap';
import SimpleOverviewFanChart from './SimpleOverviewFanChart';
import { MapPin, Users, Globe2 } from 'lucide-react';

export default function HomePersonDashboard() {
  const { tree, graph, selectedPersonId } = useApp();

  const stats = useMemo(() => {
    if (!tree || !graph || !selectedPersonId) return null;

    const ancestors = graph.getAncestors(selectedPersonId, 15);
    ancestors.push({ personId: selectedPersonId, generation: 0, ahnentafelNumber: 1 });

    let personsWithPlace = 0;
    const places = new Set<string>();
    const countryCounts = new Map<string, number>();

    for (const a of ancestors) {
      const p = tree.persons.get(a.personId);
      if (!p) continue;

      let placeName = p.birth?.place;
      if (!placeName && p.events) {
        const firstPlac = p.events.find(e => e.place);
        if (firstPlac) placeName = firstPlac.place;
      }

      if (placeName) {
        personsWithPlace++;
        places.add(placeName);
        
        // Extract country
        const parts = placeName.split(',').map(s => s.trim());
        const country = parts.length > 0 ? parts[parts.length - 1] : 'Nepoznato';
        
        countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
      }
    }

    return {
      totalPersons: personsWithPlace,
      uniquePlaces: places.size,
      uniqueCountries: countryCounts.size
    };
  }, [tree, graph, selectedPersonId]);

  if (!selectedPersonId || !stats) return null;

  return (
    <div className="card p-5 mb-6 animate-fade-in border-t-4 border-t-brand-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
          <Globe2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Geografsko porijeklo</h3>
          <p className="text-sm text-gray-500">Karta i statistika zemalja rođenja za obitelj odabrane osobe</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Geo Origin (Stats, Pie, Map) */}
        <div className="flex flex-col gap-6">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-3 text-center hover:border-brand-300 transition-colors">
              <Users className="w-4 h-4 mx-auto text-brand-500 mb-1" />
              <div className="text-xl font-extrabold text-gray-800 dark:text-white">{stats.totalPersons}</div>
              <div className="text-[10px] uppercase font-bold text-gray-400">Osoba na karti</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-3 text-center hover:border-rose-300 transition-colors">
              <MapPin className="w-4 h-4 mx-auto text-rose-500 mb-1" />
              <div className="text-xl font-extrabold text-gray-800 dark:text-white">{stats.uniquePlaces}</div>
              <div className="text-[10px] uppercase font-bold text-gray-400">Mjesta</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-3 text-center hover:border-blue-300 transition-colors">
              <Globe2 className="w-4 h-4 mx-auto text-blue-500 mb-1" />
              <div className="text-xl font-extrabold text-gray-800 dark:text-white">{stats.uniqueCountries}</div>
              <div className="text-[10px] uppercase font-bold text-gray-400">Zemalja</div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm relative hover:border-brand-300 transition-colors">
              <AncestorMap mini={true} maxGenerations={15} />
            </div>
            <p className="text-xs text-gray-500 mt-2 italic text-center px-2">
              * Na karti se prikazuju samo mjesta koja su ispravno unesena s potpunim podacima lokacije.
            </p>
          </div>
        </div>

        {/* Right Column: Sunburst Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm relative min-h-[780px] flex flex-col items-center justify-center hover:border-brand-300 transition-colors h-full">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 mt-4 text-center uppercase tracking-widest absolute top-0 w-full z-10 pointer-events-none">Stablo predaka (Sunburst)</h4>
            <div className="w-full h-full pt-10 px-2 pb-2 min-h-[780px] flex items-center justify-center">
                <SimpleOverviewFanChart />
            </div>
        </div>

      </div>
    </div>
  );
}
