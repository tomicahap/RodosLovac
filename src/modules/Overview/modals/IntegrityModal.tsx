import React, { useState } from 'react';
import type { ValidationItem } from '../../../parser/validationEngine';
import { X } from 'lucide-react';

interface Props {
  errors: ValidationItem[];
  warnings: ValidationItem[];
  onClose: () => void;
  onResearchClick: () => void;
  onPersonClick?: (personId: string) => void;
}

export default function IntegrityModal({ errors, warnings, onClose, onResearchClick, onPersonClick }: Props) {
  const [activeTab, setActiveTab] = useState<'errors' | 'warnings'>('errors');
  const items = activeTab === 'errors' ? errors : warnings;

  // Calculate percentage score. Example heuristic: total persons (passed later if needed, or simply based on count)
  // But wait, the user said "Integrity score... Green for high". We don't have total persons here.
  // We can pass the integrity score from the Overview.
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Integritet</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${errors.length === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {errors.length === 0 ? '100%' : 'Potrebna provjera'}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="p-4 flex items-center gap-3 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('errors')}
            className={`px-4 py-2 rounded-full font-semibold text-sm border-2 transition-colors ${
              activeTab === 'errors' 
                ? 'border-red-500 bg-red-50 text-red-700' 
                : 'border-transparent text-gray-500 hover:bg-gray-100'
            }`}
          >
            Greške [{errors.length}]
          </button>
          <button
            onClick={() => setActiveTab('warnings')}
            className={`px-4 py-2 rounded-full font-semibold text-sm border-2 transition-colors ${
              activeTab === 'warnings' 
                ? 'border-orange-500 bg-orange-50 text-orange-700' 
                : 'border-transparent text-gray-500 hover:bg-gray-100'
            }`}
          >
            Upozorenja [{warnings.length}]
          </button>
        </div>

        {/* List View */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">✅</div>
              <p>Nema pronađenih {activeTab === 'errors' ? 'grešaka' : 'upozorenja'}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <button 
                  key={`${item.personId}-${idx}`} 
                  onClick={() => { onClose(); onPersonClick && onPersonClick(item.personId); }}
                  className="w-full text-left flex gap-3 p-4 border border-gray-100 rounded-xl hover:border-teal-400 transition-colors bg-white cursor-pointer group"
                >
                  {activeTab === 'errors' ? (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 self-start mt-0.5">ERR</span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 self-start mt-0.5">WARN</span>
                  )}
                  <div>
                    <div className="font-bold text-gray-900 group-hover:text-teal-600 transition-colors text-sm mb-0.5">{item.name}</div>
                    <div className="text-sm text-gray-500 leading-relaxed">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
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
