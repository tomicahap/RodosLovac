import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { generateTimeline, TimelineEvent, EventCategory } from '../../utils/timelineEngine';
import { Briefcase, MapPin, Users, Baby, Heart, ShieldAlert, FileText, ArrowRight } from 'lucide-react';

export default function TimelineView() {
  const { tree, selectedPersonId, setSelectedPerson } = useApp();
  const [includeSiblings, setIncludeSiblings] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | EventCategory>('All');

  const timelineEvents = useMemo(() => {
    if (!tree || !selectedPersonId) return [];
    return generateTimeline(selectedPersonId, tree, includeSiblings);
  }, [tree, selectedPersonId, includeSiblings]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'All') return timelineEvents;
    return timelineEvents.filter(e => e.category === activeFilter);
  }, [timelineEvents, activeFilter]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'Birth': case 'ChildBirth': case 'SiblingBirth': return <Baby size={16} />;
      case 'Marriage': return <Heart size={16} />;
      case 'Death': case 'ParentDeath': case 'SiblingDeath': case 'Burial': return <ShieldAlert size={16} />;
      case 'Employment': return <Briefcase size={16} />;
      case 'Residence': return <MapPin size={16} />;
      case 'Census': return <FileText size={16} />;
      default: return <Users size={16} />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'Birth': return 'bg-emerald-500 border-emerald-200 text-white';
      case 'Death': case 'ParentDeath': case 'SiblingDeath': return 'bg-rose-500 border-rose-200 text-white';
      case 'Marriage': return 'bg-pink-500 border-pink-200 text-white';
      case 'Employment': return 'bg-blue-500 border-blue-200 text-white';
      case 'Residence': return 'bg-amber-500 border-amber-200 text-white';
      case 'ChildBirth': return 'bg-teal-400 border-teal-200 text-white';
      case 'Census': return 'bg-indigo-500 border-indigo-200 text-white';
      default: return 'bg-gray-400 border-gray-200 text-white';
    }
  };

  if (!tree || !selectedPersonId) return null;

  // Counts for tabs
  const counts = {
    All: timelineEvents.length,
    Family: timelineEvents.filter(e => e.category === 'Family').length,
    Work: timelineEvents.filter(e => e.category === 'Work').length,
    Migration: timelineEvents.filter(e => e.category === 'Migration').length,
    Census: timelineEvents.filter(e => e.category === 'Census').length,
    Personal: timelineEvents.filter(e => e.category === 'Personal').length,
  };

  const TABS: { id: 'All' | EventCategory; label: string }[] = [
    { id: 'All', label: 'Svi događaji' },
    { id: 'Personal', label: 'Osobno' },
    { id: 'Family', label: 'Obitelj' },
    { id: 'Work', label: 'Posao' },
    { id: 'Migration', label: 'Migracije' },
    { id: 'Census', label: 'Popisi' },
  ];

  return (
    <div className="card p-6 md:p-8 animate-fade-in shadow-sm border border-gray-200">
      
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 border-b border-gray-100 pb-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                activeFilter === tab.id 
                  ? 'bg-teal-600 text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label} <span className="opacity-75 font-normal ml-1">({counts[tab.id]})</span>
            </button>
          ))}
        </div>
        
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer bg-slate-50 px-4 py-2 rounded-xl border border-gray-200 hover:bg-slate-100 transition-colors">
          <input 
            type="checkbox" 
            checked={includeSiblings}
            onChange={(e) => setIncludeSiblings(e.target.checked)}
            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 border-gray-300"
          />
          Uključi braću i sestre
        </label>
      </div>

      {/* Timeline Layout */}
      <div className="relative">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-400 italic">Nema zabilježenih događaja za odabrani filter.</div>
        ) : (
          <div className="space-y-0">
            {filteredEvents.map((ev, idx) => (
              <React.Fragment key={ev.id}>
                
                {/* Gap Indicator */}
                {ev.yearsSincePrevious && ev.yearsSincePrevious > 0 && (
                  <div className="flex items-stretch min-h-[40px] group">
                    <div className="w-24 md:w-32 shrink-0"></div>
                    <div className="relative w-8 flex justify-center shrink-0">
                      <div className="w-0.5 h-full bg-gray-200"></div>
                    </div>
                    <div className="flex-1 py-2 text-[11px] text-gray-400 italic font-medium pl-4 flex items-center">
                      <ArrowRight size={10} className="mr-1.5 opacity-50" />
                      Prošlo je {ev.yearsSincePrevious} {ev.yearsSincePrevious === 1 ? 'godina' : ev.yearsSincePrevious >= 2 && ev.yearsSincePrevious <= 4 ? 'godine' : 'godina'}
                    </div>
                  </div>
                )}

                {/* Event Row */}
                <div className="flex items-start group hover:bg-slate-50 rounded-xl transition-colors -ml-4 p-4">
                  {/* Left Column: Year & Age */}
                  <div className="w-24 md:w-32 shrink-0 text-right pr-4 pt-1">
                    <div className="text-lg font-black text-gray-900 leading-none">{ev.year}</div>
                    {ev.age !== null && (
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                        god: {ev.age}
                      </div>
                    )}
                  </div>

                  {/* Center Column: Line & Icon */}
                  <div className="relative w-8 flex justify-center shrink-0">
                    <div className="absolute top-8 bottom-[-2rem] w-0.5 bg-gray-200 group-last:hidden"></div>
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border-2 ${getEventColor(ev.type)}`}>
                      {getEventIcon(ev.type)}
                    </div>
                  </div>

                  {/* Right Column: Content */}
                  <div className="flex-1 pl-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 mb-1">
                      <h4 className="text-base font-bold text-gray-900">{ev.title}</h4>
                      {ev.dateStr && <span className="text-xs font-semibold text-gray-400">{ev.dateStr}</span>}
                    </div>

                    {ev.personName && (
                      <div className="mb-2">
                        {ev.personId ? (
                          <button 
                            onClick={() => setSelectedPerson(ev.personId!)}
                            className="text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline transition-colors"
                          >
                            {ev.personName}
                          </button>
                        ) : (
                          <span className="text-sm font-semibold text-gray-700">{ev.personName}</span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                      {ev.location && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-md shadow-sm">
                          <MapPin size={12} className="text-gray-400" />
                          <span className="font-medium">{ev.location}</span>
                        </div>
                      )}
                      
                      {ev.description && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-md shadow-sm">
                          <FileText size={12} className="text-gray-400" />
                          <span className="font-medium italic">{ev.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
