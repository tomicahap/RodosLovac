import React, { useMemo } from 'react';
import { Calendar, Crown, Activity, Users, MapPin, Clock, Baby, Route } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { computeDashboardData } from '../../../utils/dashboardEngine';

export default function NotableFactsCard() {
  const { tree, setSelectedPerson, setActiveModule } = useApp();
  
  const data = useMemo(() => {
    if (!tree) return null;
    return computeDashboardData(tree);
  }, [tree]);

  if (!data || !tree) return null;

  const { notableFacts, thisWeekEvents } = data;

  const facts = [
    {
      id: 'earliest',
      label: 'Najraniji predak',
      icon: <Clock size={20} />,
      title: notableFacts.earliestAncestor?.name || 'N/A',
      desc: `Rođen(a) ${notableFacts.earliestAncestor?.year || '?'}`,
      onClick: () => { if (notableFacts.earliestAncestor) { setSelectedPerson(notableFacts.earliestAncestor.personId); setActiveModule('person-stats'); } }
    },
    {
      id: 'longest-life',
      label: 'Najduži životni vijek',
      icon: <Activity size={20} />,
      title: notableFacts.longestLife?.name || 'N/A',
      desc: `Živio/la ${notableFacts.longestLife?.years || '?'} god`,
      onClick: () => { if (notableFacts.longestLife) { setSelectedPerson(notableFacts.longestLife.personId); setActiveModule('person-stats'); } }
    },
    {
      id: 'largest-family',
      label: 'Najveća obitelj',
      icon: <Users size={20} />,
      title: notableFacts.largestFamily?.parents || 'N/A',
      desc: `${notableFacts.largestFamily?.count || 0} djece`,
      onClick: () => { if (notableFacts.largestFamily?.ids[0]) { setSelectedPerson(notableFacts.largestFamily.ids[0]); setActiveModule('person-stats'); } }
    },
    {
      id: 'avg-children',
      label: 'Prosjek djece',
      icon: <Baby size={20} />,
      title: `${notableFacts.avgChildren} djece`,
      desc: `(na ${notableFacts.totalFamilies} obitelji)`,
      onClick: undefined
    },
    {
      id: 'timespan',
      label: 'Vremenski raspon',
      icon: <Route size={20} />,
      title: notableFacts.recordsSpan ? `${notableFacts.recordsSpan.diff} godina` : 'N/A',
      desc: notableFacts.recordsSpan ? `Od ${notableFacts.recordsSpan.min}. do ${notableFacts.recordsSpan.max}.` : '-',
      onClick: undefined
    },
    {
      id: 'locations',
      label: 'Mjesta rođenja',
      icon: <MapPin size={20} />,
      title: `${notableFacts.uniqueLocationsCount} lokacija`,
      desc: 'Jedinstvena mjesta rođenja',
      onClick: () => setActiveModule('maps')
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      
      {/* Notable Facts */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
          <Crown className="text-teal-600" size={20} />
          Zanimljivosti iz stabla
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {facts.map((fact, i) => (
            <div 
              key={i}
              onClick={fact.onClick}
              className={`flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/50 ${fact.onClick ? 'cursor-pointer hover:border-teal-200 hover:bg-teal-50/30 transition-colors group' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                {fact.icon}
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{fact.label}</div>
                <div className={`text-sm font-bold text-gray-900 ${fact.onClick ? 'group-hover:text-teal-700' : ''} leading-tight`}>{fact.title}</div>
                <div className="text-xs text-gray-500 mt-1">{fact.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* This Week */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col">
        <h2 className="font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
          <Calendar className="text-teal-600" size={20} />
          U Vašoj obitelji ovaj tjedan...
        </h2>
        
        {(() => {
          const birtCount = thisWeekEvents.filter(e => e.type === 'BIRT').length;
          const deatCount = thisWeekEvents.filter(e => e.type === 'DEAT').length;
          const marrCount = thisWeekEvents.filter(e => e.type === 'MARR').length;
          const totalCount = birtCount + deatCount + marrCount;

          if (totalCount === 0) {
            return (
              <div className="text-center py-8 text-gray-400">
                <Calendar size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nema zabilježenih događaja u idućih 7 dana.</p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => setActiveModule('on-this-day')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 bg-gray-50 hover:border-teal-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <span className="text-4xl font-black text-teal-600 mb-1 group-hover:scale-105 transition-transform">{birtCount}</span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center group-hover:text-gray-900">Rođendana</span>
              </button>
              <button 
                onClick={() => setActiveModule('on-this-day')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 bg-gray-50 hover:border-teal-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <span className="text-4xl font-black text-gray-700 mb-1 group-hover:scale-105 transition-transform">{deatCount}</span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center group-hover:text-gray-900">Godišnjica smrti</span>
              </button>
              <button 
                onClick={() => setActiveModule('on-this-day')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 bg-gray-50 hover:border-teal-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <span className="text-4xl font-black text-gray-900 mb-1 group-hover:scale-105 transition-transform">{marrCount}</span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center group-hover:text-gray-900">Godišnjica braka</span>
              </button>
            </div>
          );
        })()}
      </div>

    </div>
  );
}
