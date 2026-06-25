import React, { useState } from 'react';
import { HelpCircle, Printer, Download } from 'lucide-react';
import { HelpModal } from './HelpModal';

interface TabHeaderProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  helpKey: string;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
}

export function TabHeader({ title, icon, description, helpKey, onExportPdf, onExportExcel }: TabHeaderProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handlePrint = () => {
    if (onExportPdf) {
      onExportPdf();
    } else {
      window.print();
    }
  };

  return (
    <div className="p-5 sm:p-6 bg-white border-b border-slate-200 shrink-0 print:hidden">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        
        {/* Left Side: Title & Description */}
        <div className="flex gap-4 items-start max-w-3xl">
          <div className="p-3 bg-slate-50 rounded-xl text-slate-600 shrink-0 border border-slate-100 shadow-sm">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[20px] font-bold text-slate-800">{title}</h2>
              <button 
                onClick={() => setIsHelpOpen(true)}
                className="p-1 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors"
                title="Saznaj više o ovom alatu"
              >
                <HelpCircle size={18} />
              </button>
            </div>
            <p className="text-[13px] text-slate-500 leading-relaxed font-medium">
              {description}
            </p>
          </div>
        </div>

        {/* Right Side: Export Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white text-slate-600 font-bold text-[13px] rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Printer size={16} /> PDF / Ispis
          </button>
          
          {onExportExcel && (
            <button 
              onClick={onExportExcel}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-[13px] rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download size={16} /> Excel
            </button>
          )}
        </div>
      </div>

      {isHelpOpen && (
        <HelpModal helpKey={helpKey} onClose={() => setIsHelpOpen(false)} title={title} />
      )}
    </div>
  );
}
