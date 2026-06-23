import React, { useMemo } from 'react';
import type { GedcomPerson, GedcomTree } from '../../../parser/gedcomTypes';
import { Check } from 'lucide-react';

interface Props {
  personA: GedcomPerson;
  personB: GedcomPerson;
  tree: GedcomTree;
}

export default function CompareTreesTab({ personA, personB, tree }: Props) {
  
  const getPedigree = (personId: string) => {
    const p = tree.persons.get(personId);
    if (!p) return null;

    const getParents = (id?: string) => {
      if (!id) return { father: null, mother: null };
      const person = tree.persons.get(id);
      if (!person || person.familiesAsChild.length === 0) return { father: null, mother: null };
      const fam = tree.families.get(person.familiesAsChild[0]);
      if (!fam) return { father: null, mother: null };
      return { 
        father: fam.husband ? tree.persons.get(fam.husband) : null, 
        mother: fam.wife ? tree.persons.get(fam.wife) : null 
      };
    };

    const getChildren = (id: string) => {
      const person = tree.persons.get(id);
      if (!person) return [];
      let children: GedcomPerson[] = [];
      for (const famId of person.familiesAsSpouse) {
        const fam = tree.families.get(famId);
        if (fam) {
          fam.children.forEach(cid => {
            const c = tree.persons.get(cid);
            if (c) children.push(c);
          });
        }
      }
      return children;
    };

    const parents = getParents(personId);
    const ff = getParents(parents.father?.id);
    const fm = getParents(parents.mother?.id);
    const children = getChildren(personId);

    return {
      target: p,
      children: children,
      parents: [parents.father, parents.mother],
      grandparents: [ff.father, ff.mother, fm.father, fm.mother],
    };
  };

  const pedA = useMemo(() => getPedigree(personA.id), [personA.id, tree]);
  const pedB = useMemo(() => getPedigree(personB.id), [personB.id, tree]);

  if (!pedA || !pedB) return null;

  // Align children so they can be matched if they exist
  // We can just pad children to max length of either
  const maxChildren = Math.max(pedA.children.length, pedB.children.length);
  const childrenA = Array.from({ length: maxChildren }).map((_, i) => pedA.children[i] || null);
  const childrenB = Array.from({ length: maxChildren }).map((_, i) => pedB.children[i] || null);

  // Count matches
  let matchCount = 0;
  
  // Person match
  if (pedA.target?.id === pedB.target?.id) matchCount++;
  
  // Parents match
  pedA.parents.forEach((p, i) => {
    if (p && pedB.parents[i] && p.id === pedB.parents[i]?.id) matchCount++;
  });

  // Grandparents match
  pedA.grandparents.forEach((p, i) => {
    if (p && pedB.grandparents[i] && p.id === pedB.grandparents[i]?.id) matchCount++;
  });

  // Children match
  childrenA.forEach((c, i) => {
    if (c && childrenB[i] && c.id === childrenB[i]?.id) matchCount++;
  });


  const renderCard = (person: GedcomPerson | null | undefined, isMatch: boolean, placeholder: string = 'nepoznato') => {
    if (!person) {
      return (
        <div className="w-full p-3 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 bg-white">
          <span className="text-xs italic">{placeholder}</span>
        </div>
      );
    }
    
    const bYear = person.birth?.date?.year ? `r. ${person.birth.date.year}` : '';
    const dYear = person.death?.date?.year ? `u. ${person.death.date.year}` : '';
    const yearStr = [bYear, dYear].filter(Boolean).join(' ');

    if (isMatch) {
      return (
        <div className="w-full p-3 border border-emerald-400 bg-[#eefdf5] rounded-lg shadow-sm">
          <div className="font-bold text-emerald-600 text-[15px] truncate">{person.names[0]?.full}</div>
          {yearStr && <div className="text-xs text-emerald-600/70 truncate mt-0.5">{yearStr}</div>}
          <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-500">
            <Check size={12} strokeWidth={4} /> POKLAPANJE
          </div>
        </div>
      );
    }

    // Default card
    return (
      <div className="w-full p-3 border border-teal-500 bg-[#f4fbf9] rounded-lg shadow-sm">
        <div className="font-bold text-teal-800 text-[15px] truncate">{person.names[0]?.full}</div>
        {yearStr && <div className="text-xs text-teal-600/70 truncate mt-0.5">{yearStr}</div>}
      </div>
    );
  };

  return (
    <div className="animate-fade-in w-full space-y-6">

      <div className="bg-[#edfbf4] border border-emerald-200 p-4 rounded-lg text-[15px] text-slate-600 shadow-sm">
        <strong className="text-emerald-500">{matchCount} pozicija</strong> s odgovarajućim imenima u oba rodovnika — označeno ispod.
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden flex">
        
        {/* Left Labels Column */}
        <div className="w-40 shrink-0 pt-16 pb-8 pl-8 flex flex-col gap-8">
          <div className="h-[360px] flex items-start">
             <div className="text-xs font-bold text-slate-500 tracking-wider uppercase">Djedovi i bake</div>
          </div>
          <div className="h-[180px] flex items-start">
             <div className="text-xs font-bold text-slate-500 tracking-wider uppercase">Roditelji</div>
          </div>
          <div className="h-[80px] flex items-start">
             <div className="text-xs font-bold text-slate-500 tracking-wider uppercase">Osoba</div>
          </div>
          {childrenA.length > 0 && (
            <div className="flex items-start pt-2">
               <div className="text-xs font-bold text-slate-500 tracking-wider uppercase">Djeca</div>
            </div>
          )}
        </div>

        {/* Content Columns */}
        <div className="flex-1 flex pt-8 pb-8 pr-8">
           
           {/* Column A */}
           <div className="flex-1 flex flex-col pr-4">
              <div className="text-teal-600 font-bold mb-4 ml-1">{personA.names[0]?.full}</div>
              
              {/* Grandparents */}
              <div className="flex flex-col gap-3 h-[360px]">
                {pedA.grandparents.map((p, i) => {
                  const isMatch = p && pedB.grandparents[i] && p.id === pedB.grandparents[i]?.id;
                  return <React.Fragment key={`A-gp-${i}`}>{renderCard(p, !!isMatch)}</React.Fragment>;
                })}
              </div>

              {/* Parents */}
              <div className="flex flex-col gap-3 h-[180px]">
                {pedA.parents.map((p, i) => {
                  const isMatch = p && pedB.parents[i] && p.id === pedB.parents[i]?.id;
                  return <React.Fragment key={`A-p-${i}`}>{renderCard(p, !!isMatch)}</React.Fragment>;
                })}
              </div>

              {/* Person */}
              <div className="flex flex-col gap-3 h-[80px]">
                {renderCard(pedA.target, pedA.target?.id === pedB.target?.id)}
              </div>

              {/* Children */}
              <div className="flex flex-col gap-3">
                {childrenA.map((c, i) => {
                  const isMatch = c && childrenB[i] && c.id === childrenB[i]?.id;
                  return <React.Fragment key={`A-c-${i}`}>{renderCard(c, !!isMatch)}</React.Fragment>;
                })}
              </div>
           </div>

           {/* Column B */}
           <div className="flex-1 flex flex-col pl-4">
              <div className="text-teal-600 font-bold mb-4 ml-1">{personB.names[0]?.full}</div>
              
              {/* Grandparents */}
              <div className="flex flex-col gap-3 h-[360px]">
                {pedB.grandparents.map((p, i) => {
                  const isMatch = p && pedA.grandparents[i] && p.id === pedA.grandparents[i]?.id;
                  return <React.Fragment key={`B-gp-${i}`}>{renderCard(p, !!isMatch)}</React.Fragment>;
                })}
              </div>

              {/* Parents */}
              <div className="flex flex-col gap-3 h-[180px]">
                {pedB.parents.map((p, i) => {
                  const isMatch = p && pedA.parents[i] && p.id === pedA.parents[i]?.id;
                  return <React.Fragment key={`B-p-${i}`}>{renderCard(p, !!isMatch)}</React.Fragment>;
                })}
              </div>

              {/* Person */}
              <div className="flex flex-col gap-3 h-[80px]">
                {renderCard(pedB.target, pedB.target?.id === pedA.target?.id)}
              </div>

              {/* Children */}
              <div className="flex flex-col gap-3">
                {childrenB.map((c, i) => {
                  const isMatch = c && childrenA[i] && c.id === childrenA[i]?.id;
                  return <React.Fragment key={`B-c-${i}`}>{renderCard(c, !!isMatch)}</React.Fragment>;
                })}
              </div>
           </div>

        </div>

      </div>

    </div>
  );
}
