import React from 'react';
import { useApp } from '../context/AppContext';
import type { GedcomTree } from '../parser/gedcomTypes';
import type { TreeGraph } from '../parser/treeGraph';
import { analyzePath } from '../parser/kinshipLogic';

interface Props {
  path: string[];
  tree: GedcomTree;
  graph: TreeGraph;
}

type ArrowDir = 'UP' | 'DOWN' | 'RIGHT' | 'LEFT';

export default function RelationshipPathVisualizer({ path, tree, graph }: Props) {
  const { setSelectedPerson } = useApp();

  if (!path || path.length === 0) return null;

  const analysis = analyzePath(path, graph);
  const ncaIndex = path.indexOf(analysis.ncaId || path[0]);
  
  const upPath = path.slice(0, ncaIndex).reverse(); 
  const downPath = path.slice(ncaIndex + 1);

  const getOtherParent = (childId: string, knownParentId: string): string | null => {
    const child = tree.persons.get(childId);
    if (!child) return null;
    const parents = child._parents || [];
    return parents.find(id => id !== knownParentId) || null;
  };

  const getRelationLabel = (fromId: string, toId: string): { label: string, arrowDir: ArrowDir, isSpouse: boolean } => {
    const from = tree.persons.get(fromId);
    const to = tree.persons.get(toId);
    if (!from || !to) return { label: 'Veza', arrowDir: 'DOWN', isSpouse: false };

    // Parent
    if (from.familiesAsChild) {
      for (const famId of from.familiesAsChild) {
        const fam = tree.families.get(famId);
        if (fam && (fam.husband === toId || fam.wife === toId)) {
          return { label: to.sex === 'M' ? 'Otac' : 'Majka', arrowDir: 'UP', isSpouse: false };
        }
      }
    }

    // Child
    if (from.familiesAsSpouse) {
      for (const famId of from.familiesAsSpouse) {
        const fam = tree.families.get(famId);
        if (fam && fam.children.includes(toId)) {
          return { label: to.sex === 'M' ? 'Sin' : 'Kći', arrowDir: 'DOWN', isSpouse: false };
        }
      }
    }

    // Spouse
    if (from.familiesAsSpouse) {
      for (const famId of from.familiesAsSpouse) {
        const fam = tree.families.get(famId);
        if (fam && ((fam.husband === fromId && fam.wife === toId) || (fam.wife === fromId && fam.husband === toId))) {
          return { label: to.sex === 'M' ? 'Suprug' : 'Supruga', arrowDir: 'RIGHT', isSpouse: true };
        }
      }
    }

    // Sibling
    if (from.familiesAsChild) {
      for (const famId of from.familiesAsChild) {
        const fam = tree.families.get(famId);
        if (fam && fam.children.includes(toId)) {
          return { label: to.sex === 'M' ? 'Brat' : 'Sestra', arrowDir: 'RIGHT', isSpouse: false };
        }
      }
    }

    return { label: 'Veza', arrowDir: 'DOWN', isSpouse: false };
  };

  interface Cell {
    mainId: string;
    spouseIds: { id: string, label: string }[];
    relFromAbove?: { label: string, arrowDir: ArrowDir, isSpouse: boolean };
  }

  const buildColumn = (pathNodes: string[], topId: string, isLeft: boolean): Cell[] => {
    const cells: Cell[] = [];
    let currentTop = topId;
    for (let i = 0; i < pathNodes.length; i++) {
      const id = pathNodes[i];
      const rel = isLeft ? getRelationLabel(id, currentTop) : getRelationLabel(currentTop, id);
      
      if (rel.isSpouse && cells.length > 0) {
        cells[cells.length - 1].spouseIds.push({ id, label: rel.label });
        currentTop = id;
      } else {
        cells.push({
          mainId: id,
          spouseIds: [],
          relFromAbove: rel
        });
        currentTop = id;
      }
    }
    return cells;
  };

  const leftCells = buildColumn(upPath, analysis.ncaId || path[0], true);
  const rightCells = buildColumn(downPath, analysis.ncaId || path[0], false);
  const maxRows = Math.max(leftCells.length, rightCells.length);

  const PersonCard = ({ id }: { id: string }) => {
    const person = tree.persons.get(id);
    const isEndpoint = id === path[0] || id === path[path.length - 1];

    if (!person) return <div className="w-36 h-20 border border-slate-200 rounded-xl bg-white"></div>;
    
    const bYear = person.birth?.date?.year ? person.birth.date.year : '';
    const dYear = person.death?.date?.year ? person.death.date.year : '';
    const yearStr = (bYear || dYear) ? `${bYear} - ${dYear}` : '';

    return (
      <div 
        onClick={() => setSelectedPerson(id)}
        className={`cursor-pointer hover:border-teal-400 transition-colors relative flex flex-col items-center bg-white rounded-xl p-3 w-40 shadow z-20 shrink-0
        ${isEndpoint ? 'border-[3px] border-orange-500/80 shadow-orange-500/20' : 'border border-slate-200'}`}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 bg-slate-100 border border-slate-200 text-slate-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <div className="font-medium text-slate-700 text-center text-[11px] leading-tight mb-1">{person.names[0]?.full}</div>
        {yearStr && <div className="text-[10px] text-slate-400">{yearStr}</div>}
      </div>
    );
  };

  const VerticalLink = ({ label, arrowDir }: { label: string, arrowDir: ArrowDir }) => (
    <div className="h-16 flex flex-col items-center justify-center relative w-px bg-orange-500/80">
      {arrowDir === 'UP' && (
        <svg className="absolute -top-1 w-3 h-3 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 15l-6-6-6 6"/>
        </svg>
      )}
      {arrowDir === 'DOWN' && (
        <svg className="absolute -bottom-1 w-3 h-3 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      )}
      <div className="bg-[#f2f2f2] dark:bg-[var(--bg-card)] px-1 text-[10px] text-slate-500 z-10 whitespace-nowrap">
        {label}
      </div>
    </div>
  );

  const HorizontalLink = ({ label }: { label: string }) => (
    <div className="w-16 flex items-center justify-center relative h-px bg-orange-500/80 shrink-0">
      <svg className="absolute -right-1 w-3 h-3 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6"/>
      </svg>
      <div className="bg-[#f2f2f2] dark:bg-[var(--bg-card)] px-1 text-[10px] text-slate-500 z-10 whitespace-nowrap absolute -top-3">
        {label}
      </div>
    </div>
  );

  const CellRenderer = ({ cell }: { cell: Cell }) => (
    <div className="flex flex-col items-center relative">
      {cell.relFromAbove && <VerticalLink label={cell.relFromAbove.label} arrowDir={cell.relFromAbove.arrowDir} />}
      <div className="flex items-center">
        <PersonCard id={cell.mainId} />
        {cell.spouseIds.map(sp => (
          <React.Fragment key={sp.id}>
            <HorizontalLink label={sp.label} />
            <PersonCard id={sp.id} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const getKinshipText = (row: number) => {
    if (row === 1) return "prvi rođaci";
    if (row === 2) return "drugi rođaci u drugom koljenu";
    if (row === 3) return "treći rođaci";
    if (row === 4) return "četvrti rođaci";
    if (row === 5) return "peti rođaci";
    return "";
  };

  return (
    <div className="w-full overflow-x-auto py-12 px-4 custom-scrollbar bg-[#f2f2f2] min-h-screen">
      <div className="flex flex-col items-center min-w-[800px] max-w-4xl mx-auto">
        
        {analysis.ncaId && (() => {
          let otherId: string | null = null;
          if (downPath.length > 0) {
            otherId = getOtherParent(downPath[0], analysis.ncaId);
          } else if (upPath.length > 0) {
            otherId = getOtherParent(upPath[0], analysis.ncaId);
          }

          return (
            <div className="flex flex-col items-center z-20">
              <div className="flex items-center gap-0">
                <PersonCard id={analysis.ncaId} />
                {otherId && (
                  <>
                    <div className="w-12 h-px bg-slate-300"></div>
                    <PersonCard id={otherId} />
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {(leftCells.length > 0 || rightCells.length > 0) && (
          <div className="relative w-full h-8 z-10">
            {leftCells.length > 0 && rightCells.length > 0 && (
               <>
                 <div className="absolute top-0 left-1/2 w-px h-8 bg-slate-300"></div>
                 <div className="absolute bottom-0 left-[25%] right-[25%] h-px bg-slate-300"></div>
               </>
            )}
            {leftCells.length > 0 && rightCells.length === 0 && (
               <>
                 <div className="absolute top-0 left-1/2 w-px h-8 bg-slate-300"></div>
                 <div className="absolute bottom-0 left-[25%] right-[50%] h-px bg-slate-300"></div>
               </>
            )}
            {leftCells.length === 0 && rightCells.length > 0 && (
               <>
                 <div className="absolute top-0 left-1/2 w-px h-8 bg-slate-300"></div>
                 <div className="absolute bottom-0 left-[50%] right-[25%] h-px bg-slate-300"></div>
               </>
            )}
          </div>
        )}

        <div className="flex flex-col items-center w-full">
          {Array.from({ length: maxRows }).map((_, i) => {
            const left = leftCells[i];
            const right = rightCells[i];
            
            return (
              <div key={i} className="flex w-full justify-center relative">
                <div className="w-1/2 flex justify-center">
                  {left && <CellRenderer cell={left} />}
                </div>

                {left && right && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-[50%] text-[10px] text-slate-400 z-0 bg-[#f2f2f2] px-2 whitespace-nowrap">
                    {getKinshipText(i)}
                  </div>
                )}

                <div className="w-1/2 flex justify-center">
                  {right && <CellRenderer cell={right} />}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
