import React from 'react';
import { Users, AlertCircle } from 'lucide-react';
import PersonSearch from './PersonSearch';

export default function HomePersonModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full p-8 border border-gray-100 dark:border-slate-800 animate-slide-up relative">
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[#00ab84]/10 flex items-center justify-center text-[#00ab84] shrink-0 shadow-sm">
            <Users size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Odaberite početnu osobu</h2>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
              Za početak analize potrebno je odabrati središnju (home) osobu oko koje će se graditi izvještaji i grafovi.
            </p>
          </div>
        </div>
        
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-8 flex gap-3 text-amber-800 dark:text-amber-500">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm font-medium leading-relaxed">
            Upišite ime ili prezime osobe u polje ispod i odaberite ju s popisa kako biste otključali sve značajke nadzorne ploče.
          </div>
        </div>

        <div className="relative z-50">
           <PersonSearch placeholder="Upišite ime za pretraživanje (npr. Ivan Horvat)..." />
        </div>
      </div>
    </div>
  );
}
