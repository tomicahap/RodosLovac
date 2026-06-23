import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { GedcomTree } from '../../../parser/gedcomTypes';

interface Props {
  tree: GedcomTree;
  onClose: () => void;
  onSurnameSelect: (surname: string) => void;
}

export default function SurnamesModal({ tree, onClose, onSurnameSelect }: Props) {
  const [search, setSearch] = useState('');

  const surnamesData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of tree.persons.values()) {
      const surname = p.names[0]?.surname?.trim();
      if (surname) {
        counts.set(surname, (counts.get(surname) || 0) + 1);
      }
    }
    
    let arr = Array.from(counts.entries()).map(([surname, count]) => ({ surname, count }));
    
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(s => s.surname.toLowerCase().includes(q));
    }

    // Sort strictly alphabetically by default
    arr.sort((a, b) => a.surname.localeCompare(b.surname));
    
    return arr;
  }, [tree, search]);

  return (
    <div className="w-full mt-2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-teal-200 dark:border-teal-900/50 overflow-hidden h-[600px] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-teal-100 dark:border-slate-800 bg-teal-600">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Prezimena
            </h2>
            <p className="text-sm font-medium text-teal-100 mt-1">Jedinstvena prezimena: {surnamesData.length}</p>
          </div>
          <button onClick={onClose} className="btn bg-white/20 border-transparent hover:bg-white/30 text-white shadow-sm transition-colors text-sm px-4">
            Zatvori prikaz
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Pronađi prezime..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
          {surnamesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p>Nema pronađenih prezimena.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {surnamesData.map(item => (
                <button
                  key={item.surname}
                  onClick={() => { onClose(); onSurnameSelect(item.surname); }}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-400 hover:shadow-md transition-all group"
                >
                  <span className="font-bold text-gray-800 dark:text-gray-100 truncate group-hover:text-teal-600 transition-colors">
                    {item.surname}
                  </span>
                  <span className="text-xs font-black text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

    </div>
  );
}
