import React, { useMemo } from 'react';
import { X, Calendar, ArrowRight } from 'lucide-react';
import type { GedcomTree } from '../../../parser/gedcomTypes';

interface Props {
  tree: GedcomTree;
  onClose: () => void;
  onPersonClick: (id: string) => void;
}

export default function OldestRecordModal({ tree, onClose, onPersonClick }: Props) {
  
  const oldestPerson = useMemo(() => {
    let oldest = null;
    let minYear = 9999;

    for (const p of tree.persons.values()) {
      const year = p.birth?.date?.year;
      // Filter out impossible years like year 0 or negative
      if (year && year > 0 && year < minYear) {
        minYear = year;
        oldest = p;
      }
    }

    return oldest;
  }, [tree]);

  return (
    <div className="w-full mt-2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-amber-200 dark:border-amber-900/50 overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20">
          <div>
            <h2 className="text-xl font-extrabold text-amber-700 dark:text-amber-400 tracking-tight flex items-center gap-2">
              <Calendar size={20} className="text-amber-500" /> Najstariji zapis
            </h2>
            <p className="text-sm font-medium text-amber-600/70 dark:text-amber-400/70 mt-1">
              Osoba s najranijom pouzdanom godinom rođenja.
            </p>
          </div>
          <button onClick={onClose} className="btn bg-white border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm transition-colors text-sm px-4">
            Zatvori prikaz
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-white dark:bg-slate-900 flex flex-col items-center justify-center py-10">
          
          {!oldestPerson ? (
            <div className="text-center text-gray-400">
              <Calendar className="w-12 h-12 mb-4 mx-auto opacity-20" />
              <p>Nema zapisa s validnom godinom rođenja.</p>
            </div>
          ) : (
            <div className="w-full text-center">
              
              <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 text-sm font-black uppercase tracking-widest mb-6">
                Godina {oldestPerson.birth?.date?.year}.
              </div>

              <div className="w-24 h-24 mx-auto rounded-full shadow-lg flex items-center justify-center text-4xl mb-6
                bg-gradient-to-br from-amber-200 to-amber-500 text-amber-900 border-4 border-white dark:border-slate-800">
                {oldestPerson.sex === 'M' ? '♂' : oldestPerson.sex === 'F' ? '♀' : '?'}
              </div>

              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                {oldestPerson.names[0]?.full}
              </h3>
              
              <div className="text-gray-500 mb-8 max-w-sm mx-auto space-y-2">
                {oldestPerson.birth?.place && (
                  <p className="text-sm">
                    <strong>Mjesto rođenja:</strong> <br/>{oldestPerson.birth.place}
                  </p>
                )}
                {oldestPerson.death?.date?.year && (
                  <p className="text-sm">
                    <strong>Preminuo/la:</strong> {oldestPerson.death.date.year}. 
                    {oldestPerson.death?.place ? ` u ${oldestPerson.death.place.split(',')[0]}` : ''}
                  </p>
                )}
              </div>

              <button 
                onClick={() => { onClose(); onPersonClick(oldestPerson.id); }}
                className="btn bg-amber-500 text-white hover:bg-amber-600 shadow-md border-transparent px-8 py-3 w-full sm:w-auto"
              >
                Prikaži detalje osobe <ArrowRight size={18} className="ml-2" />
              </button>

            </div>
          )}

        </div>

    </div>
  );
}
