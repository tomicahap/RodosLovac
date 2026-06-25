import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import PersonSearch from './PersonSearch';
import { Calendar, MapPin, Users, Info } from 'lucide-react';
import { computePersonDeepStats } from '../utils/personStatsEngine';

export default function SharedPersonHeader() {
  const { tree, graph, selectedPersonId } = useApp();

  const person = useMemo(() => {
    if (!tree || !selectedPersonId) return null;
    return tree.persons.get(selectedPersonId) || null;
  }, [tree, selectedPersonId]);

  const stats = useMemo(() => {
    if (!tree || !graph || !selectedPersonId) return null;
    return computePersonDeepStats(selectedPersonId, tree, graph, 100);
  }, [tree, graph, selectedPersonId]);

  if (!person || !stats) return null;

  const bYear = person.birth?.date?.year;
  const dYear = person.death?.date?.year;
  const bPlace = person.birth?.place ? person.birth.place.split(',')[0].trim() : '';
  const dPlace = person.death?.place ? person.death.place.split(',')[0].trim() : '';

  const age = bYear && dYear ? dYear - bYear : null;

  // Extract notes
  const notes = person.events.find(e => e.tag === 'NOTE')?.value || '';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 shrink-0 relative overflow-hidden print:border-none print:shadow-none print:p-0 print:mb-4 print:bg-transparent">
      {/* Decorative background element */}
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-slate-50 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row gap-6 relative z-10">
        {/* Left Side: Avatar & Name */}
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 shadow-inner
            ${person.sex === 'M' ? 'bg-blue-50 text-blue-500' :
              person.sex === 'F' ? 'bg-pink-50 text-pink-500' :
              'bg-slate-100 text-slate-500'}`}
          >
            {person.sex === 'M' ? '♂' : person.sex === 'F' ? '♀' : '?'}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
              {person.names[0]?.full || 'Nepoznato Ime'}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm font-bold text-slate-500">
              {/* Birth */}
              {(bYear || bPlace) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-teal-500">★</span>
                  <span>{bYear ? `${bYear}.` : '?'}{bPlace ? ` ${bPlace}` : ''}</span>
                </div>
              )}
              {/* Death */}
              {(dYear || dPlace) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">†</span>
                  <span>{dYear ? `${dYear}.` : '?'}{dPlace ? ` ${dPlace}` : ''}</span>
                </div>
              )}
              {/* Age */}
              {age !== null && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs">
                  {age} god.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Search & Stats */}
        <div className="flex-1 flex flex-col items-start md:items-end gap-4 ml-auto">
          {/* Global Search specific to changing the focus person */}
          <div className="w-full max-w-xs print:hidden">
            <PersonSearch placeholder="Promijeni odabranu osobu..." className="w-full" />
          </div>

          {/* Quick Stats Badges */}
          <div className="flex flex-wrap justify-end gap-3 text-xs font-bold mt-auto">
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100">
              <ArrowUp size={14} className="text-indigo-400" />
              <span>{stats.absoluteMaxGenerations} gen. predaka</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
              <ArrowDown size={14} className="text-emerald-400" />
              <span>{stats.treeAtAGlance.totalDescendants} potomaka</span>
            </div>
            {(person.familiesAsSpouse?.length || 0) > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-100">
                <Users size={14} className="text-amber-400" />
                <span>{person.familiesAsSpouse?.length} braka/veze</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {notes && (
        <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500 flex gap-2">
          <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="font-medium italic leading-relaxed">{notes}</p>
        </div>
      )}
    </div>
  );
}

// Arrow icons (inline for simplicity or import from lucide-react)
function ArrowUp({ size, className }: { size: number, className: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>;
}
function ArrowDown({ size, className }: { size: number, className: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>;
}
