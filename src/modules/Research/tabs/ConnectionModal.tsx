import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { AutosomalTester } from '../utils/dnaAutosomalAnalyzer';
import { analyzePath } from '../../../parser/kinshipLogic';
import { X, User } from 'lucide-react';
import { GedcomPerson } from '../../../parser/gedcomTypes';

interface Props {
  tester: AutosomalTester;
  onClose: () => void;
}

export function ConnectionModal({ tester, onClose }: Props) {
  const { tree, graph, selectedPersonId } = useApp();

  const connectionData = useMemo(() => {
    if (!tree || !graph || !selectedPersonId) return null;

    const pathData = analyzePath(tester.path, graph);
    const ncaId = pathData.ncaId;
    if (!ncaId) return null;

    const ncaIndex = tester.path.indexOf(ncaId);
    if (ncaIndex === -1) return null;

    // Split path into UP (Focus -> NCA) and DOWN (NCA -> Tester)
    // Focus -> Parent -> NCA => left column: Parent -> Focus
    // Tester -> Uncle -> NCA => right column: Uncle -> Tester
    // We want the columns to flow top-to-bottom: NCA is at top.
    
    // Left side: from NCA child down to FocusPerson
    // Path is [Focus, Parent, NCA, Uncle, Tester]
    // NCA is at index 2
    // Left: path from index 1 down to 0
    const leftPath = [];
    for (let i = ncaIndex - 1; i >= 0; i--) {
      const p = tree.persons.get(tester.path[i]);
      if (p) leftPath.push(p);
    }

    // Right side: from NCA child down to Tester
    // Right: path from index 3 up to length-1
    const rightPath = [];
    for (let i = ncaIndex + 1; i < tester.path.length; i++) {
      const p = tree.persons.get(tester.path[i]);
      if (p) rightPath.push(p);
    }

    // Find if there is a spouse of NCA that is also a common ancestor
    // Actually, if they are full siblings/cousins, they share both parents.
    // The path only goes through ONE parent (e.g. father). We can find the other parent.
    const ncaPerson = tree.persons.get(ncaId);
    let sharedAncestors = ncaPerson ? [ncaPerson] : [];

    if (!tester.isHalf && ncaPerson && ncaPerson._parents) {
      // It's full. Does the other side go through the other parent?
      // Actually, if NCA is the grandparent, and it's not half, the common ancestors are the grandparents (the couple).
      // We can check if the leftPath[0] and rightPath[0] share both parents.
      if (leftPath.length > 0 && rightPath.length > 0) {
        const lpParents = leftPath[0]._parents || [];
        const rpParents = rightPath[0]._parents || [];
        const shared = lpParents.filter(pid => rpParents.includes(pid));
        if (shared.length === 2) {
          sharedAncestors = shared.map(id => tree.persons.get(id)).filter(Boolean) as GedcomPerson[];
        }
      }
    }

    return {
      sharedAncestors,
      leftPath,
      rightPath,
      focusName: tree.persons.get(selectedPersonId)?.names[0]?.given?.toUpperCase() || 'VAŠA',
      testerName: tester.person.names[0]?.given?.toUpperCase() || 'LINIJA'
    };
  }, [tree, graph, selectedPersonId, tester]);

  if (!connectionData) return null;

  const { sharedAncestors, leftPath, rightPath, focusName, testerName } = connectionData;

  const renderCard = (p: GedcomPerson, isEndNode: boolean) => {
    const isMale = p.sex === 'M';
    const isFemale = p.sex === 'F';
    const bYear = p.birth?.date?.year || '?';
    const dYear = p.death?.date?.year || (p.events.some(e => e.tag === 'DEAT') ? '?' : '');
    const lifespan = dYear ? `${bYear}-${dYear}` : bYear;

    return (
      <div className={`p-3 bg-white rounded-xl border-2 flex items-center gap-3 shadow-sm transition-all ${isEndNode ? 'border-red-500 shadow-md ring-2 ring-red-100' : 'border-slate-200'}`}>
        <div className={`p-2 rounded-full ${isMale ? 'bg-cyan-50 text-cyan-600' : isFemale ? 'bg-pink-50 text-pink-600' : 'bg-slate-100 text-slate-500'}`}>
          <User size={20} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-bold text-slate-800 truncate text-sm">{p.names[0]?.full}</div>
          <div className="text-xs text-slate-500">({lifespan})</div>
        </div>
      </div>
    );
  };

  const renderSharedAncestorCard = (p: GedcomPerson) => {
    const isMale = p.sex === 'M';
    const isFemale = p.sex === 'F';
    const bYear = p.birth?.date?.year || '?';
    const dYear = p.death?.date?.year || (p.events.some(e => e.tag === 'DEAT') ? '?' : '');
    const lifespan = dYear ? `${bYear}-${dYear}` : bYear;

    return (
      <div className="p-3 bg-white rounded-xl border-2 border-cyan-400 flex flex-col items-center gap-2 shadow-sm min-w-[200px]">
        <div className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">Zajednički predak</div>
        <div className={`p-2 rounded-full ${isMale ? 'bg-cyan-50 text-cyan-600' : isFemale ? 'bg-pink-50 text-pink-600' : 'bg-slate-100 text-slate-500'}`}>
          <User size={20} />
        </div>
        <div className="text-center">
          <div className="font-bold text-slate-800 text-sm truncate w-full">{p.names[0]?.full}</div>
          <div className="text-xs text-slate-500">({lifespan})</div>
        </div>
      </div>
    );
  };

  // Pad the shorter column with empty spaces to align generations
  const maxLen = Math.max(leftPath.length, rightPath.length);
  const leftPadded = [...leftPath];
  const rightPadded = [...rightPath];
  
  // Actually, we want to align the BOTTOM nodes (Focus and Tester) or align by generation?
  // Visually, it usually aligns from top down.
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Kako ste povezani</h2>
            <div className="text-xl font-bold text-slate-800">{tester.relationTitle}</div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center relative">
          
          {/* Shared Ancestors Row */}
          <div className="flex justify-center gap-6 relative z-10 mb-8">
            {sharedAncestors.map(sa => (
              <React.Fragment key={sa.id}>
                {renderSharedAncestorCard(sa)}
              </React.Fragment>
            ))}
          </div>

          {/* Connection Lines from Ancestors to Branches */}
          {/* A simple horizontal bar and vertical drops */}
          
          <div className="w-full flex justify-center gap-16 relative">
            {/* Draw connecting SVGs behind the cards if needed, but flex gap is easier */}
            <div className="flex-1 flex flex-col items-center">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 bg-white px-4 py-1 rounded-full border border-slate-200 shadow-sm">Vaša linija</div>
              <div className="flex flex-col gap-6 w-full max-w-[280px]">
                {leftPath.map((p, idx) => (
                  <div key={p.id} className="relative flex flex-col items-center">
                    {/* Vertical line from top */}
                    <div className="absolute -top-6 w-0.5 h-6 bg-slate-300"></div>
                    <div className="w-full relative z-10">
                      {renderCard(p, idx === leftPath.length - 1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 bg-white px-4 py-1 rounded-full border border-slate-200 shadow-sm">{testerName}'s linija</div>
              <div className="flex flex-col gap-6 w-full max-w-[280px]">
                {rightPath.map((p, idx) => (
                  <div key={p.id} className="relative flex flex-col items-center">
                    {/* Vertical line from top */}
                    <div className="absolute -top-6 w-0.5 h-6 bg-slate-300"></div>
                    <div className="w-full relative z-10">
                      {renderCard(p, idx === rightPath.length - 1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Central connecting logic: draw lines from shared ancestors down to the headers. */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
               {/* We rely on simple CSS vertical lines from the items themselves, but the top connection from Shared Ancestors needs a custom line */}
               <svg className="absolute w-full h-full" style={{ top: '-40px' }}>
                 <path d="M 50% 0 L 50% 20 L 25% 20 L 25% 40" fill="none" stroke="#cbd5e1" strokeWidth="2" />
                 <path d="M 50% 0 L 50% 20 L 75% 20 L 75% 40" fill="none" stroke="#cbd5e1" strokeWidth="2" />
               </svg>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
