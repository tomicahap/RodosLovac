import React, { useState, useMemo } from 'react';
import { X, Search, ArrowUpDown, MapPin, Users } from 'lucide-react';
import type { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';

interface Props {
  tree: GedcomTree;
  initialSurnameFilter?: string | null;
  filterIds?: string[] | null;
  title?: string | null;
  onClose: () => void;
  onPersonClick: (personId: string) => void;
}

type SortOption = 'name_asc' | 'name_desc' | 'year_asc' | 'year_desc' | 'surname_asc' | 'surname_desc';

export default function PersonsListModal({ tree, initialSurnameFilter, filterIds, title, onClose, onPersonClick }: Props) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');

  const getSpousesLinks = (person: GedcomPerson) => {
    if (!person.familiesAsSpouse || person.familiesAsSpouse.length === 0) return null;
    const spouses: { id: string, name: string }[] = [];
    for (const famId of person.familiesAsSpouse) {
      const fam = tree.families.get(famId);
      if (fam) {
        const spouseId = person.sex === 'M' ? fam.wife : fam.husband;
        if (spouseId) {
          const spouse = tree.persons.get(spouseId);
          if (spouse) spouses.push({ id: spouseId, name: spouse.names[0]?.full || 'Nepoznato' });
        }
      }
    }
    return spouses;
  };

  const persons = useMemo(() => {
    let list = Array.from(tree.persons.values());

    // Apply id filter if passed
    if (filterIds) {
      const idSet = new Set(filterIds);
      list = list.filter(p => idSet.has(p.id));
    }

    // Apply initial surname filter if passed
    if (initialSurnameFilter) {
      list = list.filter(p => p.names[0]?.surname?.toLowerCase() === initialSurnameFilter.toLowerCase());
    }

    // Apply text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.names[0]?.full.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      const nameA = a.names[0]?.full.toLowerCase() || '';
      const nameB = b.names[0]?.full.toLowerCase() || '';
      const surnameA = a.names[0]?.surname?.toLowerCase() || '';
      const surnameB = b.names[0]?.surname?.toLowerCase() || '';
      const yearA = a.birth?.date?.year || (sortBy.includes('desc') ? -9999 : 9999);
      const yearB = b.birth?.date?.year || (sortBy.includes('desc') ? -9999 : 9999);

      switch (sortBy) {
        case 'name_asc': return nameA.localeCompare(nameB);
        case 'name_desc': return nameB.localeCompare(nameA);
        case 'surname_asc': return surnameA.localeCompare(surnameB) || nameA.localeCompare(nameB);
        case 'surname_desc': return surnameB.localeCompare(surnameA) || nameB.localeCompare(nameA);
        case 'year_asc': return yearA - yearB;
        case 'year_desc': return yearB - yearA;
        default: return 0;
      }
    });

    return list;
  }, [tree, search, sortBy, initialSurnameFilter]);

  return (
    <div className="w-full mt-2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-teal-200 dark:border-teal-900/50 overflow-hidden h-[600px] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 bg-teal-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-extrabold text-teal-800 dark:text-teal-400 tracking-tight flex items-center gap-2">
              <Users size={20} className="text-teal-500" />
              {title ? title : initialSurnameFilter ? `Osobe s prezimenom: ${initialSurnameFilter}` : 'Sve Osobe'}
            </h2>
            <p className="text-sm font-medium text-teal-600/70 dark:text-teal-400/70 mt-1">Ukupno pronađeno: {persons.length}</p>
          </div>
          <button onClick={onClose} className="btn bg-white border-teal-200 text-teal-700 hover:bg-teal-100 shadow-sm transition-colors text-sm px-4">
            Zatvori prikaz
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Pretraži po imenu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="text-gray-400 w-4 h-4 hidden sm:block" />
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 w-full sm:w-auto"
            >
              <option value="name_asc">Po imenu (A-Ž)</option>
              <option value="name_desc">Po imenu (Ž-A)</option>
              <option value="surname_asc">Po prezimenu (A-Ž)</option>
              <option value="surname_desc">Po prezimenu (Ž-A)</option>
              <option value="year_asc">Kronološki (Najstariji prvo)</option>
              <option value="year_desc">Kronološki (Najnoviji prvo)</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
          {persons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p>Nema pronađenih osoba za ovaj upit.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {persons.map(p => {
                const isMale = p.sex === 'M';
                const isFemale = p.sex === 'F';
                const spouses = getSpousesLinks(p);

                return (
                  <button
                    key={p.id}
                    onClick={() => { onClose(); onPersonClick(p.id); }}
                    className="w-full text-left p-3 sm:p-4 rounded-xl bg-white dark:bg-slate-800 hover:shadow-md border border-gray-100 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all group"
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-sm shrink-0
                      ${isMale ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 
                        isFemale ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' : 
                        'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                    >
                      {isMale ? '♂' : isFemale ? '♀' : '?'}
                    </div>
                    
                    {/* Main Info */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="font-extrabold text-gray-900 dark:text-white truncate group-hover:text-teal-600 transition-colors text-base">
                        {p.names[0]?.full}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                          {p.birth?.date?.year ? `r. ${p.birth.date.year}.` : 'Nepoznata god.'}
                          {p.death?.date?.year ? ` - u. ${p.death.date.year}.` : ''}
                        </div>

                        {p.birth?.place && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400" />
                            {p.birth.place.split(',')[0]}
                          </div>
                        )}
                        
                        {spouses && spouses.length > 0 && (
                          <div className="text-[11px] text-gray-500 flex gap-1 flex-wrap items-center mt-1 sm:mt-0">
                            Bračni drug: 
                            {spouses.map((s, i) => (
                              <button 
                                key={s.id} 
                                onClick={(e) => { e.stopPropagation(); onClose(); onPersonClick(s.id); }}
                                className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold hover:underline"
                              >
                                {s.name}{i < spouses.length - 1 ? ',' : ''}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

    </div>
  );
}
