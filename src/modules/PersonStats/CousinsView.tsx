import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { generateCousins, CousinPerson, MRCA } from '../../utils/cousinsEngine';
import { Search, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { formatLifespan } from '../../utils/cousinsEngine';

type SortOption = 'Shared ancestor' | 'Name' | 'Birth year';

interface Props {
  openPathModal: (id: string) => void;
}

interface FlattenedCousin extends CousinPerson {
  mrca: MRCA;
  isHalf: boolean;
}

export default function CousinsView({ openPathModal }: Props) {
  const { tree, graph, selectedPersonId } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('Shared ancestor');
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});

  const cousinData = useMemo(() => {
    if (!tree || !selectedPersonId || !graph) return [];
    return generateCousins(selectedPersonId, tree, graph);
  }, [tree, graph, selectedPersonId]);

  const toggleGroup = (degree: number) => {
    setExpandedGroups(prev => ({
      ...prev,
      [degree]: prev[degree] === false ? true : false
    }));
  };

  let totalVisibleCousins = 0;

  const processedData = useMemo(() => {
    return cousinData.map(degreeData => {
      // 1. Filter by search
      let filteredGroups = degreeData.groups.map(g => ({
        ...g,
        cousins: g.cousins.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      })).filter(g => g.cousins.length > 0);

      const totalInDegree = filteredGroups.reduce((acc, g) => acc + g.cousins.length, 0);

      if (sortBy === 'Shared ancestor') {
        // Grouped mode
        filteredGroups.sort((a, b) => a.mrca.label.localeCompare(b.mrca.label));
        filteredGroups.forEach(g => {
          g.cousins.sort((a, b) => a.name.localeCompare(b.name));
        });
        return {
          ...degreeData,
          totalInDegree,
          isGrouped: true,
          groups: filteredGroups,
          flatCousins: []
        };
      } else {
        // Flattened mode
        const flatCousins: FlattenedCousin[] = [];
        filteredGroups.forEach(g => {
          g.cousins.forEach(c => {
            flatCousins.push({
              ...c,
              mrca: g.mrca,
              isHalf: g.isHalf
            });
          });
        });

        if (sortBy === 'Name') {
          flatCousins.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'Birth year') {
          flatCousins.sort((a, b) => (a.birthYear || 9999) - (b.birthYear || 9999));
        }

        return {
          ...degreeData,
          totalInDegree,
          isGrouped: false,
          groups: [],
          flatCousins
        };
      }
    }).filter(d => d.totalInDegree > 0);
  }, [cousinData, searchQuery, sortBy]);

  processedData.forEach(d => { totalVisibleCousins += d.totalInDegree; });

  if (!tree || !selectedPersonId) return null;

  return (
    <div className="max-w-4xl mx-auto mt-8 animate-fade-in pb-20">
      
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm text-slate-600">
        Prikazuje samo rođake 1., 2. i 3. koljena — ista generacija, bez "pomaka" (removed). 
        Polu-rođaci (koji dijele samo jednog pretka umjesto para) uključeni su i posebno označeni.
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="relative w-full md:w-1/3">
          <input
            type="text"
            placeholder={`Pretraži ${totalVisibleCousins} rođaka...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          <span className="text-xs text-gray-400 uppercase font-bold tracking-wider mr-2 hidden md:block">Sortiraj:</span>
          {(['Shared ancestor', 'Name', 'Birth year'] as SortOption[]).map(option => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors whitespace-nowrap ${
                sortBy === option 
                  ? 'bg-teal-500 text-white shadow-sm' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {option === 'Shared ancestor' ? 'Zajednički predak' : option === 'Name' ? 'Ime' : 'Godina rođenja'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {processedData.length === 0 ? (
          <div className="text-center py-16 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-300">
            Nema pronađenih rođaka koji zadovoljavaju filter.
          </div>
        ) : (
          processedData.map((degreeData) => {
            const isExpanded = expandedGroups[degreeData.degree] !== false;

            return (
              <div key={degreeData.degree} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                
                <div 
                  className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGroup(degreeData.degree)}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black text-gray-800">{degreeData.label}</h3>
                    <span className="bg-gray-200 text-gray-700 py-0.5 px-2.5 rounded-full text-xs font-bold">
                      {degreeData.totalInDegree}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      className="text-teal-600 hover:text-teal-800 p-1 rounded hover:bg-teal-50 transition-colors"
                      title="Izvoz u Excel (u pripremi)"
                      onClick={(e) => { e.stopPropagation(); alert("Izvoz u Excel stiže uskoro!"); }}
                    >
                      <Download size={18} />
                    </button>
                    {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 space-y-6">
                    {degreeData.isGrouped ? (
                      // GROUPED VIEW (Shared ancestor)
                      degreeData.groups.map((group, gIdx) => (
                        <div key={gIdx} className="ml-2">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-2 h-2 rounded-full ${group.isHalf ? 'bg-amber-400' : 'bg-teal-500'}`}></div>
                            <h4 className="text-sm font-bold text-gray-600">
                              {group.mrca.label} <span className="opacity-60 font-normal">({group.cousins.length})</span>
                              {group.isHalf && <span className="ml-2 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded uppercase">Polu-rođaci</span>}
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pl-4 border-l border-gray-100">
                            {group.cousins.map(cousin => (
                              <button
                                key={cousin.id}
                                onClick={() => openPathModal(cousin.id)}
                                className="text-left flex flex-col p-3 bg-slate-50 border border-gray-100 rounded-lg hover:border-teal-300 hover:bg-white hover:shadow-sm transition-all group"
                              >
                                <div className="font-semibold text-gray-800 text-sm truncate w-full group-hover:text-teal-700 transition-colors">
                                  {cousin.name}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {formatLifespan(cousin.birthYear, cousin.deathYear) || <span className="opacity-50">nepoznato</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      // FLAT VIEW (Name or Birth year)
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {degreeData.flatCousins.map((cousin, cIdx) => (
                          <button
                            key={`${cousin.id}-${cIdx}`}
                            onClick={() => openPathModal(cousin.id)}
                            className="text-left flex flex-col p-3 bg-slate-50 border border-gray-100 rounded-lg hover:border-teal-300 hover:bg-white hover:shadow-sm transition-all group relative overflow-hidden"
                          >
                            {cousin.isHalf && (
                              <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded-bl-lg font-bold uppercase">
                                Polu
                              </div>
                            )}
                            <div className="font-semibold text-gray-800 text-sm truncate w-full group-hover:text-teal-700 transition-colors pr-6">
                              {cousin.name}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {formatLifespan(cousin.birthYear, cousin.deathYear) || <span className="opacity-50">nepoznato</span>}
                            </div>
                            <div className="mt-2 text-[10px] text-gray-500 italic bg-white p-1.5 rounded border border-gray-100">
                              {cousin.mrca.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
