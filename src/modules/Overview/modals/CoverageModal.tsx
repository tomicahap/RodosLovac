import React from 'react';
import type { ValidationResult } from '../../../parser/validationEngine';
import { X } from 'lucide-react';

interface Props {
  coverage: ValidationResult['coverage'];
  onClose: () => void;
  onResearchClick: () => void;
  onShowActionProfiles?: (title: string, personIds: string[]) => void;
}

export default function CoverageModal({ coverage, onClose, onResearchClick, onShowActionProfiles }: Props) {
  const { totalPersons, withBirthDate, withBirthPlace, deceasedCount, withDeathDate, withDeathPlace } = coverage;

  const pct = (part: number, total: number) => total > 0 ? Math.round((part / total) * 100) : 0;
  
  const bDatePct = pct(withBirthDate, totalPersons);
  const bPlacePct = pct(withBirthPlace, totalPersons);
  const dDatePct = pct(withDeathDate, deceasedCount);
  const dPlacePct = pct(withDeathPlace, deceasedCount);

  const overallScore = Math.round((bDatePct + bPlacePct + dDatePct + dPlacePct) / (deceasedCount > 0 ? 4 : 2));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Pokrivenost (Coverage)</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${overallScore > 80 ? 'bg-green-100 text-green-700' : overallScore > 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
              {overallScore}%
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {/* Section 1: ALL PROFILES */}
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Svi Profili ({totalPersons.toLocaleString()})</h3>
            
            <div className="mb-5">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-semibold text-gray-700">Imaju datum rođenja</span>
                <span className="text-gray-500">
                  {withBirthDate.toLocaleString()} / {totalPersons.toLocaleString()} • {bDatePct}% 
                  {coverage.missingBirthDateIds.length > 0 && (
                     <button onClick={() => { onClose(); onShowActionProfiles && onShowActionProfiles('Nedostaje datum rođenja', coverage.missingBirthDateIds); }} className="ml-2 text-teal-600 hover:underline">
                        (Nedostaje {coverage.missingBirthDateIds.length})
                     </button>
                  )}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${bDatePct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-semibold text-gray-700">Imaju mjesto rođenja</span>
                <span className="text-gray-500">
                  {withBirthPlace.toLocaleString()} / {totalPersons.toLocaleString()} • {bPlacePct}%
                  {coverage.missingBirthPlaceIds.length > 0 && (
                     <button onClick={() => { onClose(); onShowActionProfiles && onShowActionProfiles('Nedostaje mjesto rođenja', coverage.missingBirthPlaceIds); }} className="ml-2 text-teal-600 hover:underline">
                        (Nedostaje {coverage.missingBirthPlaceIds.length})
                     </button>
                  )}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${bPlacePct}%` }}></div>
              </div>
            </div>
          </div>

          {/* Section 2: DECEASED PROFILES */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Preminuli Profili (Procjena: {deceasedCount.toLocaleString()})</h3>
            
            {deceasedCount === 0 ? (
              <p className="text-sm text-gray-500">Nema evidentiranih preminulih osoba u stablu.</p>
            ) : (
              <>
                <div className="mb-5">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold text-gray-700">Imaju datum smrti</span>
                    <span className="text-gray-500">
                      {withDeathDate.toLocaleString()} / {deceasedCount.toLocaleString()} • {dDatePct}%
                      {coverage.missingDeathDateIds.length > 0 && (
                         <button onClick={() => { onClose(); onShowActionProfiles && onShowActionProfiles('Nedostaje datum smrti', coverage.missingDeathDateIds); }} className="ml-2 text-teal-600 hover:underline">
                            (Nedostaje {coverage.missingDeathDateIds.length})
                         </button>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${dDatePct}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold text-gray-700">Imaju mjesto smrti</span>
                    <span className="text-gray-500">
                      {withDeathPlace.toLocaleString()} / {deceasedCount.toLocaleString()} • {dPlacePct}%
                      {coverage.missingDeathPlaceIds.length > 0 && (
                         <button onClick={() => { onClose(); onShowActionProfiles && onShowActionProfiles('Nedostaje mjesto smrti', coverage.missingDeathPlaceIds); }} className="ml-2 text-teal-600 hover:underline">
                            (Nedostaje {coverage.missingDeathPlaceIds.length})
                         </button>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="bg-red-500 h-2.5 rounded-full" style={{ width: `${dPlacePct}%` }}></div>
                  </div>
                </div>
              </>
            )}
          </div>

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
