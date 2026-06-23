import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { User, GitCommit, BarChart2, MapPin, Tag, Calendar, ArrowRight } from 'lucide-react';
import { computeDashboardData } from '../../../utils/dashboardEngine';

export default function FeaturesGrid() {
  const { tree, graph, setActiveModule } = useApp();

  const analytics = useMemo(() => {
    if (!graph) return null;
    return graph.getOverviewAnalytics();
  }, [graph]);

  if (!tree || !analytics) return null;

  const features = [
    {
      group: 'LJUDI I ANALIZA',
      items: [
        {
          id: 'person-stats',
          title: 'Statistika osobe',
          icon: <User size={24} strokeWidth={1.5} />,
          badge: `${tree.stats.totalPersons} osoba`,
          desc: 'Detaljni prikaz pojedinca — preci, potomci, lepeza (fan chart), rodbinske veze i pronalazač rođaka.',
        },
        {
          id: 'relationships',
          title: 'Pronalazač rodbinskih veza',
          icon: <GitCommit size={24} strokeWidth={1.5} />,
          badge: null,
          desc: 'Pronađite točnu rodbinsku vezu i putanju između bilo koje dvije osobe u Vašem stablu.',
        },
        {
          id: 'lifespans',
          title: 'Životni vijek',
          icon: <BarChart2 size={24} strokeWidth={1.5} />,
          badge: `prosjek ${analytics.avgLifespan} god.`,
          desc: 'Prosječni životni vijek po generaciji i spolu, uz interaktivnu vremensku crtu predaka.',
        }
      ]
    },
    {
      group: 'KARTE I OTKRIĆA',
      items: [
        {
          id: 'ancestor-map',
          title: 'Karta predaka',
          icon: <MapPin size={24} strokeWidth={1.5} />,
          badge: `${analytics.topLocations.length > 0 ? analytics.topLocations.length + '+' : '0'} lokacija`,
          desc: 'Mjesta rođenja predaka prikazana na interaktivnoj karti s mogućnošću filtriranja po generacijama.',
        },
        {
          id: 'surname-map',
          title: 'Karta prezimena',
          icon: <Tag size={24} strokeWidth={1.5} />,
          badge: `${tree.stats.uniqueSurnames.length} prezimena`,
          desc: 'Pregledajte sva prezimena, mapirajte mjesta rođenja i filtrirajte po vremenskom razdoblju.',
        },
        {
          id: 'on-this-day',
          title: 'Na današnji dan',
          icon: <Calendar size={24} strokeWidth={1.5} />,
          badge: null,
          desc: 'Rođendani, godišnjice vjenčanja, obljetnice smrti i drugi važni događaji na bilo koji dan u godini.',
        }
      ]
    }
  ];

  return (
    <div className="flex flex-col gap-10">
      {features.map((section, idx) => (
        <div key={idx}>
          <h3 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-4 pl-1">
            {section.group}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {section.items.map((item, i) => (
              <button
                key={i}
                onClick={() => setActiveModule(item.id as any)}
                className="card p-6 flex flex-col items-start text-left bg-white border border-gray-200 rounded-2xl hover:border-teal-500 hover:shadow-lg transition-all group"
              >
                <div className="text-teal-600 mb-4">
                  {item.icon}
                </div>
                
                <h4 className="text-base font-bold text-gray-900 mb-2">
                  {item.title}
                </h4>

                {item.badge && (
                  <div className="bg-teal-50 text-teal-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-3 tracking-wide">
                    {item.badge}
                  </div>
                )}
                
                <p className="text-sm text-gray-500 leading-relaxed mb-6 flex-1">
                  {item.desc}
                </p>

                <div className="text-teal-600 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all mt-auto">
                  Istraži <ArrowRight size={14} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
