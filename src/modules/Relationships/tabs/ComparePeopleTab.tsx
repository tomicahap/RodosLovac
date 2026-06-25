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

  const formatDatePlace = (event?: any) => {
    if (!event) return '-';
    const parts = [];
    if (event.date) {
      if (event.date.day && event.date.month) {
        parts.push(`${event.date.day}. ${event.date.month}. ${event.date.year}.`);
      } else if (event.date.year) {
        parts.push(`${event.date.year}.`);
      }
    }
    if (event.place) parts.push(event.place);
    return parts.length > 0 ? parts.join(' — ') : '-';
  };

  const getParents = (id: string) => {
    const p = tree.persons.get(id);
    if (!p || !p._parents || p._parents.length === 0) return '-';
    return p._parents.map(pid => tree.persons.get(pid)?.names[0]?.full).filter(Boolean).join(' i ');
  };

  const getSpouses = (id: string) => {
    const p = tree.persons.get(id);
    if (!p || !p.familiesAsSpouse || p.familiesAsSpouse.length === 0) return '-';
    return p.familiesAsSpouse.map(fId => {
      const fam = tree.families.get(fId);
      if (!fam) return '';
      const partnerId = p.sex === 'M' ? fam.wife : fam.husband;
      const partnerName = partnerId ? tree.persons.get(partnerId)?.names[0]?.full || 'Nepoznat partner' : 'Nepoznat partner';
      const marr = fam.marriage ? formatDatePlace(fam.marriage) : '';
      return marr ? `${partnerName} (Vj: ${marr})` : partnerName;
    }).filter(Boolean).join(' | ');
  };

  const getChildren = (id: string) => {
    const p = tree.persons.get(id);
    if (!p || !p.familiesAsSpouse) return '-';
    const children: string[] = [];
    p.familiesAsSpouse.forEach(fId => {
      const fam = tree.families.get(fId);
      if (fam && fam.children) {
        fam.children.forEach(cId => {
          const childName = tree.persons.get(cId)?.names[0]?.given || tree.persons.get(cId)?.names[0]?.full;
          if (childName) children.push(childName);
        });
      }
    });
    return children.length > 0 ? children.join(', ') : '-';
  };

  const getStats = (id: string, maxG: number) => {
    const p = tree.persons.get(id);
    if (!p) return null;

    const ancestors = graph.getAncestors(id, maxG);
    const descendants = graph.getDescendants(id, maxG);
    
    return {
      birth: formatDatePlace(p.birth),
      death: formatDatePlace(p.death),
      parents: getParents(id),
      spouses: getSpouses(id),
      children: getChildren(id),
      ancCount: ancestors.length,
      descCount: descendants.length,
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
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-2">Prikaži statistiku do:</span>
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
            { label: 'Rođenje', valA: statsA.birth, valB: statsB.birth },
            { label: 'Smrt', valA: statsA.death, valB: statsB.death },
            { label: 'Roditelji', valA: statsA.parents, valB: statsB.parents },
            { label: 'Partner(i) i Brak', valA: statsA.spouses, valB: statsB.spouses },
            { label: 'Djeca', valA: statsA.children, valB: statsB.children },
            { label: 'Poznati preci (za odabranu generaciju)', valA: statsA.ancCount, valB: statsB.ancCount },
            { label: 'Poznati potomci (za odabranu generaciju)', valA: statsA.descCount, valB: statsB.descCount },
          ].map((row, idx) => (
            <div key={idx} className="grid grid-cols-3 hover:bg-slate-50/50 transition-colors">
              <div className="p-5 flex items-center justify-center text-center font-medium text-gray-800 border-r border-[var(--border-color)] text-sm">
                {row.valA}
              </div>
              <div className="p-5 flex items-center justify-center text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                {row.label}
              </div>
              <div className="p-5 flex items-center justify-center text-center font-medium text-gray-800 border-l border-[var(--border-color)] text-sm">
                {row.valB}
              </div>
            </div>
          ))}

        </div>
      </div>

    </div>
  );
}
