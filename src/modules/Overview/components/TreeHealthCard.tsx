import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { runValidation } from '../../../parser/validationEngine';

export default function TreeHealthCard({ onActionClick, onShowActionProfiles }: { onActionClick?: (type: string) => void, onShowActionProfiles?: (title: string, personIds: string[]) => void }) {
  const { tree } = useApp();
  const validation = useMemo(() => tree ? runValidation(tree) : null, [tree]);

  if (!validation) return null;
  const { healthReport } = validation;

  const gradeColors = {
    'A+': 'text-emerald-600 bg-emerald-50 border-emerald-200',
    'A': 'text-emerald-500 bg-emerald-50 border-emerald-200',
    'B+': 'text-teal-600 bg-teal-50 border-teal-200',
    'B': 'text-teal-500 bg-teal-50 border-teal-200',
    'C+': 'text-amber-500 bg-amber-50 border-amber-200',
    'C': 'text-amber-500 bg-amber-50 border-amber-200',
    'D+': 'text-orange-500 bg-orange-50 border-orange-200',
    'D': 'text-orange-500 bg-orange-50 border-orange-200',
    'F+': 'text-red-500 bg-red-50 border-red-200',
    'F': 'text-red-600 bg-red-50 border-red-200'
  };

  const getGradeColor = (grade: string) => {
    return gradeColors[grade as keyof typeof gradeColors] || gradeColors['C'];
  };

  const getGradeTextColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-emerald-600';
    if (grade.startsWith('B')) return 'text-teal-600';
    if (grade.startsWith('C')) return 'text-amber-500';
    if (grade.startsWith('D')) return 'text-orange-500';
    return 'text-red-600';
  };

  const getBarColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-emerald-500';
    if (grade.startsWith('B')) return 'bg-teal-500';
    if (grade.startsWith('C')) return 'bg-amber-500';
    if (grade.startsWith('D')) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getLetter = (score: number) => {
    const segments = Math.round(score / 10);
    switch (segments) {
      case 10: return 'A+';
      case 9: return 'A';
      case 8: return 'B+';
      case 7: return 'B';
      case 6: return 'C+';
      case 5: return 'C';
      case 4: return 'D+';
      case 3: return 'D';
      case 2: return 'F+';
      case 1: return 'F';
      case 0: return 'F';
      default: return 'A+';
    }
  };

  const SegmentedBar = ({ score, grade }: { score: number, grade: string }) => {
    const filledSegments = Math.round(score / 10);
    const color = getBarColor(grade);
    return (
      <div className="flex gap-1 h-2 flex-1 mx-4 items-center">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`flex-1 h-full rounded-sm ${i < filledSegments ? color : 'bg-gray-100 dark:bg-slate-800'}`} />
        ))}
      </div>
    );
  };

  const metrics = [
    { label: 'Pokrivenost', id: 'coverage', weight: 30, score: healthReport.metrics.coverage },
    { label: 'Dokazi', id: 'evidence', weight: 30, score: healthReport.metrics.evidence },
    { label: 'Integritet', id: 'integrity', weight: 30, score: healthReport.metrics.integrity },
    { label: 'Povezanost', id: 'connections', weight: 10, score: healthReport.metrics.connections }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col h-full">
      <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-5">Zdravlje stabla</h2>
      
      {/* Header Block */}
      <div className="flex gap-4 mb-6">
        <div className={`w-20 h-16 rounded-xl border flex items-center justify-center text-4xl font-black shrink-0 ${getGradeColor(healthReport.grade)}`}>
          {healthReport.grade}
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-gray-900 dark:text-white text-base">{healthReport.gradeText}</span>
            <span className="text-sm font-medium text-gray-500">· {healthReport.score}/100</span>
          </div>
          <p className="text-[13px] text-gray-500 mt-1 leading-snug">
            Glavni prostor za napredak je dodavanje izvora i rješavanje sitnih anomalija.
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-800">
        {metrics.map(m => {
          const letter = getLetter(m.score);
          return (
            <div key={m.label} className="flex items-center justify-between">
              <div className="w-24">
                <button 
                  onClick={() => onActionClick && onActionClick(m.id)}
                  className="text-[13px] font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  {m.label} ↗
                </button>
              </div>
              <SegmentedBar score={m.score} grade={letter} />
              <div className={`w-6 text-right font-black text-lg ${getGradeTextColor(letter)}`}>
                {letter}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div>
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Kako povećati ocjenu</h3>
        <div className="space-y-3">
          {healthReport.actions.slice(0, 4).map((action, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-[18px] h-[18px] rounded bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="text-[13px] text-gray-700 dark:text-gray-300 leading-snug">
                {action.title}
                {action.personIds && action.personIds.length > 0 && (
                  <button 
                    onClick={() => onShowActionProfiles && onShowActionProfiles(action.title, action.personIds)}
                    className="ml-1 text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    ({action.count} profila)
                  </button>
                )}
                {(!action.personIds || action.personIds.length === 0) && (
                  <span className="text-gray-500 ml-1">({action.count} profila)</span>
                )}
              </div>
            </div>
          ))}
          {healthReport.actions.length === 0 && (
            <div className="text-[13px] text-emerald-600 font-medium">Stablo je u savršenom stanju!</div>
          )}
        </div>
      </div>
    </div>
  );
}
