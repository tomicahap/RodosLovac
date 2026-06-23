import React, { useMemo, useState } from 'react';
import { X, Heart, Search, MapPin } from 'lucide-react';
import type { GedcomTree } from '../../../parser/gedcomTypes';

interface Props {
  tree: GedcomTree;
  onClose: () => void;
  onPersonClick: (id: string) => void;
}

export default function CouplesModal({ tree, onClose, onPersonClick }: Props) {
  const [search, setSearch] = useState('');
  const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set());

  const toggleChildren = (familyId: string) => {
    const newSet = new Set(expandedChildren);
    if (newSet.has(familyId)) newSet.delete(familyId);
    else newSet.add(familyId);
    setExpandedChildren(newSet);
  };

  const couples = useMemo(() => {
    let list = Array.from(tree.families.values())
      .filter(f => f.husband && f.wife)
      .map(f => {
        const husband = tree.persons.get(f.husband!);
        const wife = tree.persons.get(f.wife!);
        
        const childrenList: { id: string, name: string }[] = [];
        for (const cid of f.children) {
          const c = tree.persons.get(cid);
          if (c) childrenList.push({ id: cid, name: c.names[0]?.given || c.names[0]?.full.split(' ')[0] || 'Dijete' });
        }

        return {
          familyId: f.id,
          husband,
          wife,
          marriageDate: f.marriage?.date?.year || null,
          marriagePlace: f.marriage?.place || null,
          childrenCount: f.children.length,
          childrenList
        };
      })
      .filter(c => c.husband && c.wife); // Safety check

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => 
        c.husband?.names[0]?.full.toLowerCase().includes(q) || 
        c.wife?.names[0]?.full.toLowerCase().includes(q)
      );
    }

    // Sort by marriage date (oldest first)
    list.sort((a, b) => (a.marriageDate || 9999) - (b.marriageDate || 9999));

    return list;
  }, [tree, search]);

  return (
    <div className="w-full mt-2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-rose-200 dark:border-rose-900/50 overflow-hidden h-[600px] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/20">
          <div>
            <h2 className="text-xl font-extrabold text-rose-700 dark:text-rose-400 tracking-tight flex items-center gap-2">
              <Heart size={20} className="fill-rose-500 text-rose-500" /> Oženjeni / Udani
            </h2>
            <p className="text-sm font-medium text-rose-600/70 dark:text-rose-400/70 mt-1">
              Pronađeno bračnih parova: {couples.length}
            </p>
          </div>
          <button onClick={onClose} className="btn bg-white border-rose-200 text-rose-700 hover:bg-rose-100 shadow-sm transition-colors text-sm px-4">
            Zatvori prikaz
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Pretraži po imenu supružnika..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-rose-400 outline-none text-gray-900 dark:text-white transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50 space-y-3 custom-scrollbar">
          {couples.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Heart className="w-12 h-12 mb-4 opacity-20" />
              <p>Nema pronađenih parova.</p>
            </div>
          ) : (
            couples.map((c, i) => (
              <div key={c.familyId + i} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md border border-gray-100 dark:border-slate-700 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between hover:border-rose-300 transition-colors">
                
                {/* Persons */}
                <div className="flex flex-col gap-3 w-full lg:w-auto flex-1">
                  <button onClick={() => { onClose(); onPersonClick(c.husband!.id); }} className="flex items-center gap-4 text-left group w-max">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 flex items-center justify-center text-sm font-bold shadow-sm">♂</span>
                    <div>
                      <span className="font-extrabold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors block leading-tight">{c.husband!.names[0]?.full}</span>
                      <span className="text-xs text-gray-500">{c.husband?.birth?.date?.year ? `* ${c.husband.birth.date.year}.` : ''}</span>
                    </div>
                  </button>
                  <button onClick={() => { onClose(); onPersonClick(c.wife!.id); }} className="flex items-center gap-4 text-left group w-max">
                    <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 flex items-center justify-center text-sm font-bold shadow-sm">♀</span>
                    <div>
                      <span className="font-extrabold text-gray-900 dark:text-white group-hover:text-rose-600 transition-colors block leading-tight">{c.wife!.names[0]?.full}</span>
                      <span className="text-xs text-gray-500">{c.wife?.birth?.date?.year ? `* ${c.wife.birth.date.year}.` : ''}</span>
                    </div>
                  </button>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-2 items-start lg:items-end w-full lg:w-1/3 border-t border-gray-100 lg:border-0 pt-4 lg:pt-0">
                  <div className="flex flex-col items-start lg:items-end w-full">
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-200">
                      {c.marriageDate ? `Vjenčani ${c.marriageDate}.` : 'Vjenčani (nepoznata god.)'}
                    </div>
                    {c.marriagePlace && (
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 text-right">
                        <MapPin size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate" title={c.marriagePlace}>{c.marriagePlace}</span>
                      </div>
                    )}
                  </div>

                  {c.childrenCount > 0 && (
                    <div className="mt-2 w-full lg:w-auto flex flex-col items-start lg:items-end">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleChildren(c.familyId); }}
                        className="text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 border border-teal-100 dark:border-teal-800/50 px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        Djeca ({c.childrenCount}) {expandedChildren.has(c.familyId) ? '▼' : '▶'}
                      </button>
                      
                      {expandedChildren.has(c.familyId) && (
                        <div className="flex gap-1.5 flex-wrap justify-start lg:justify-end mt-2.5 animate-fade-in w-full">
                          {c.childrenList.map(child => (
                             <button 
                               key={child.id}
                               onClick={(e) => { e.stopPropagation(); onClose(); onPersonClick(child.id); }}
                               className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-2.5 py-1 rounded-md hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors shadow-sm"
                             >
                               {child.name}
                             </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ))
          )}
        </div>

    </div>
  );
}
