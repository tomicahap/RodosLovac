import React from 'react';
import { X, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function HelpModal({ isOpen, onClose, title, children }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-teal-700">
            <HelpCircle size={20} className="stroke-[2.5]" />
            <h3 className="font-extrabold text-base uppercase tracking-wider">{title}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm text-slate-600 leading-relaxed custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
          >
            Razumijem
          </button>
        </div>
      </div>
    </div>
  );
}

interface HelpButtonProps {
  onClick: () => void;
  className?: string;
}

export function HelpButton({ onClick, className = '' }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-teal-600 shadow-sm flex items-center justify-center transition-all ${className}`}
      title="Pomoć i objašnjenje"
    >
      <HelpCircle size={16} className="stroke-[2.5]" />
    </button>
  );
}
