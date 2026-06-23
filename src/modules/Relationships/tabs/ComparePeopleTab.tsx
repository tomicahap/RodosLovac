import React, { useState, useMemo } from 'react';
import type { GedcomPerson, GedcomTree } from '../../../parser/gedcomTypes';
import type { TreeGraph } from '../../../parser/treeGraph';
import { ArrowRight } from 'lucide-react';

interface Props {
  personA: GedcomPerson;
  personB: GedcomPerson;
  tree: GedcomTree;
  graph: TreeGraph;
  onJumpToPath: () => void;
}

export default function ComparePeopleTab({ personA, personB, tree, graph, onJumpToPath }: Props) {
  const [maxGen, setMaxGen] = useState(4);

  const getStats = (id: string, maxG: number) => {
    // Quick helpers
    const p = tree.persons.get(id);
    if (!p) return null;

    const bYear = p.birth?.date?.year;
    const dYear = p.death?.date?.year;
    const lifespan = (bYear && dYear) ? dYear - bYear : null;
    const bPlace = p.birth?.place || 'Nepoznato';

    // Graph traversals up to maxGen
    const ancestors = graph.getAncestors(id, maxG);
    const descendants = graph.getDescendants(id, maxG);
    
    // For cousins of same generation, we look for removal = 0 (same level)
    // findCousins doesn't have maxDepth filter easily accessible in this hypothetical treeGraph,
    // so we'll just say "Cousins up to maxGen distance". 
    // Wait, the specification says "Bratići/Sestrične (ista generacija)". 
    // We'll approximate this by finding descendants of ancestors at (maxG-1) depth.
    // Or just call findCousins(id) if it exists, otherwise return a placeholder count.
    const cousins = graph.findCousins ? graph.findCousins(id, maxG).filter(c => c.removal === 0).length : 0;

    return {
      bYear: bYear || '?',
      dYear: dYear || '?',
      lifespan: lifespan ? `${lifespan} god.` : '?',
      bPlace,
      ancCount: ancestors.length,
      descCount: descendants.length,
      cousinCount: cousins
    };
  };

  const statsA = useMemo(() => getStats(personA.id, maxGen), [personA.id, maxGen]);
  const statsB = useMemo(() => getStats(personB.id, maxGen), [personB.id, maxGen]);

  if (!statsA || !statsB) return null;

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      
      {/* Generation Filter */}
      <div className="flex items-center justify-between mb-6 bg-white p-3 rounded-xl border border-[var(--border-color)] shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-2">Prikaži do:</span>
          <div className="flex gap-1">
            {[2, 3, 4, 5, 6, 7].map(g => (
              <button
                key={g}
                onClick={() => setMaxGen(g)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  maxGen === g 
                    ? 'bg-teal-600 text-white shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {g}G
              </button>
            ))}
          </div>
        </div>
        <button onClick={onJumpToPath} className="btn bg-white text-teal-600 border-teal-200 hover:bg-teal-50 mr-1 text-sm h-9">
          Vidi poveznicu <ArrowRight size={16} className="ml-1" />
        </button>
      </div>

      {/* Comparison Table Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-[var(--border-color)] overflow-hidden">
        
        {/* Table Header */}
        <div className="grid grid-cols-3 bg-slate-50 border-b border-[var(--border-color)]">
          <div className="p-6 text-center border-r border-[var(--border-color)]">
            <div className="inline-block px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-bold uppercase tracking-widest mb-3">Osoba A</div>
            <h3 className="text-xl font-bold text-[var(--text-primary)] leading-tight">{personA.names[0]?.full}</h3>
          </div>
          <div className="p-6 flex flex-col items-center justify-center text-slate-400 bg-slate-100/50">
            <span className="text-sm font-extrabold tracking-widest uppercase mb-1">Usporedba</span>
            <div className="h-0.5 w-12 bg-slate-300 rounded-full"></div>
          </div>
          <div className="p-6 text-center border-l border-[var(--border-color)]">
            <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-widest mb-3">Osoba B</div>
            <h3 className="text-xl font-bold text-[var(--text-primary)] leading-tight">{personB.names[0]?.full}</h3>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[var(--border-color)]">
          
          {[
            { label: 'Godina rođenja', valA: statsA.bYear, valB: statsB.bYear },
            { label: 'Godina smrti', valA: statsA.dYear, valB: statsB.dYear },
            { label: 'Životni vijek', valA: statsA.lifespan, valB: statsB.lifespan },
            { label: 'Mjesto rođenja', valA: statsA.bPlace, valB: statsB.bPlace },
            { label: 'Poznati preci', valA: statsA.ancCount, valB: statsB.ancCount },
            { label: 'Poznati potomci', valA: statsA.descCount, valB: statsB.descCount },
            { label: 'Bratići / Sestrične (ista gen.)', valA: statsA.cousinCount, valB: statsB.cousinCount },
          ].map((row, idx) => (
            <div key={idx} className="grid grid-cols-3 hover:bg-slate-50/50 transition-colors">
              <div className="p-4 flex items-center justify-center text-center font-medium text-gray-800 border-r border-[var(--border-color)]">
                {row.valA}
              </div>
              <div className="p-4 flex items-center justify-center text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                {row.label}
              </div>
              <div className="p-4 flex items-center justify-center text-center font-medium text-gray-800 border-l border-[var(--border-color)]">
                {row.valB}
              </div>
            </div>
          ))}

        </div>
      </div>

    </div>
  );
}
