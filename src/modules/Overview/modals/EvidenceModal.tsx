import React from 'react';
import type { ValidationResult } from '../../../parser/validationEngine';
import { X } from 'lucide-react';

interface Props {
  evidence: ValidationResult['evidence'];
  totalPersons: number;
  onClose: () => void;
  onResearchClick: () => void;
  onShowActionProfiles?: (title: string, personIds: string[]) => void;
}

export default function EvidenceModal({ evidence, totalPersons, onClose, onResearchClick, onShowActionProfiles }: Props) {
  const { sourcedCount, unsourcedCount } = evidence;
  const pct = totalPersons > 0 ? Math.round((sourcedCount / totalPersons) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Dokazi (Evidence)</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${pct > 80 ? 'bg-green-100 text-green-700' : pct > 40 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
              {pct}% Pokriveno
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
              <div className="text-3xl font-extrabold text-red-600 mb-1">{sourcedCount.toLocaleString()}</div>
              <div className="text-xs font-bold text-red-800 uppercase tracking-widest">Sourced (Imaju izvore)</div>
            </div>
            <button 
              onClick={() => { onClose(); onShowActionProfiles && onShowActionProfiles('Osobe bez izvora', evidence.unsourcedIds); }}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
            >
              <div className="text-3xl font-extrabold text-slate-700 mb-1">{unsourcedCount.toLocaleString()}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Unsourced (Bez izvora)</div>
            </button>
          </div>

          {/* Visuals */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2 font-medium text-gray-700">
              <span>Ukupno osoba s izvorom</span>
              <span>{sourcedCount.toLocaleString()} / {totalPersons.toLocaleString()} • {pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden">
              <div className="bg-red-500 h-full" style={{ width: `${pct}%` }}></div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-6 leading-relaxed bg-gray-50 p-3 rounded-lg">
            <strong>Napomena:</strong> Profil se smatra dokumentiranim (sourced) ako sadrži barem jednu GEDCOM referencu na izvor (SOUR), pridruženi medij (OBJE) ili eksplicitnu web poveznicu unutar svojih podataka.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
          <button onClick={() => { onClose(); onResearchClick(); }} className="text-sm font-medium text-teal-600 hover:text-teal-800 hover:underline">
            Otvori Istraživanje (Research Gaps) →
          </button>
        </div>
      </div>
    </div>
  );
}
