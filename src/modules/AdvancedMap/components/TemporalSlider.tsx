import React from 'react';

interface Props {
  minYear: number;
  maxYear: number;
  currentYear: number;
  onChange: (year: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
}

export default function TemporalSlider({ minYear, maxYear, currentYear, onChange, isPlaying, onPlayToggle }: Props) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-xl rounded-2xl px-6 py-4 w-[90%] max-w-2xl border border-gray-200 dark:border-slate-700 flex items-center gap-6">
      
      <button 
        onClick={onPlayToggle}
        className="w-10 h-10 shrink-0 rounded-full bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 transition-colors shadow-sm"
      >
        {isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M5 3l14 9-14 9V3z"/></svg>
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1 relative">
        <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
          <span>{minYear}</span>
          <span className="text-teal-600 dark:text-teal-400 text-sm">{currentYear}</span>
          <span>{maxYear}</span>
        </div>
        
        <input 
          type="range" 
          min={minYear} 
          max={maxYear} 
          value={currentYear}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
        />
        <div className="flex justify-between mt-1 px-1">
          {/* Tick marks could go here */}
        </div>
      </div>
    </div>
  );
}
