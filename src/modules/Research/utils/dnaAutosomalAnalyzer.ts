import { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';
import { TreeGraph } from '../../../parser/treeGraph';

function getYear(p: GedcomPerson, eventType: 'birth' | 'death'): number | undefined {
  const ev = p[eventType];
  return ev?.date?.year;
}

function isLiving(p: GedcomPerson, currentYear: number): boolean {
  if (p.death || p.events.some(e => e.tag === 'DEAT' || e.tag === 'BURI')) return false;
  const by = getYear(p, 'birth');
  if (!by) return false;
  if (currentYear - by > 100) return false;
  return true;
}

// ─── MOD 2: TARGET ANCESTOR (CILJAJ PRETKA) ─────────────────────────────

export interface TargetDescendant {
  person: GedcomPerson;
  generation: number;
  cmEstimate: number;
  cmRange: string;
}

export interface TargetGenerationGroup {
  generation: number;
  title: string;
  avgCm: number;
  rangeCm: string;
  descendants: TargetDescendant[];
}

const CM_BY_DESCENDANT_GEN: Record<number, { avg: number; range: string; title: string }> = {
  1: { avg: 3485, range: '2376–3900', title: 'DIJETE' },
  2: { avg: 1754, range: '1156–2311', title: 'UNUK' },
  3: { avg: 884, range: '482–1054', title: 'PRAUNUK' },
  4: { avg: 443, range: '191–515', title: 'ŠUKUNUNUK' },
  5: { avg: 212, range: '0–450', title: 'ŠUKUN-ŠUKUNUNUK' },
  6: { avg: 106, range: '0–250', title: 'POTOMAK 6. GENERACIJE' }
};

export function analyzeTargetAncestor(tree: GedcomTree, graph: TreeGraph, targetId: string): TargetGenerationGroup[] {
  const currentYear = new Date().getFullYear();
  const descendants = graph.getDescendants(targetId, 6);

  const groups = new Map<number, TargetDescendant[]>();

  for (const entry of descendants) {
    const p = tree.persons.get(entry.personId);
    if (!p) continue;
    
    if (isLiving(p, currentYear)) {
      const genData = CM_BY_DESCENDANT_GEN[entry.generation] || { avg: 0, range: '0', title: `GENERACIJA ${entry.generation}` };
      
      const targetDesc: TargetDescendant = {
        person: p,
        generation: entry.generation,
        cmEstimate: genData.avg,
        cmRange: genData.range
      };

      if (!groups.has(entry.generation)) {
        groups.set(entry.generation, []);
      }
      groups.get(entry.generation)!.push(targetDesc);
    }
  }

  const result: TargetGenerationGroup[] = [];
  for (const gen of Array.from(groups.keys()).sort((a, b) => a - b)) {
    const genData = CM_BY_DESCENDANT_GEN[gen] || { avg: 0, range: '0', title: `GENERACIJA ${gen}` };
    result.push({
      generation: gen,
      title: genData.title,
      avgCm: genData.avg,
      rangeCm: genData.range,
      descendants: groups.get(gen) || []
    });
  }

  return result;
}

// ─── MOD 1: BEST TESTERS (PRONAĐI NAJBOLJE KANDIDATE) ────────────────────

export interface AutosomalTester {
  person: GedcomPerson;
  relationTitle: string;
  cmEstimate: number;
  isHalf: boolean;
  path: string[];
  multiplier: number;
}

export interface AncestorGroup {
  ancestor: GedcomPerson;
  generation: number;
  genTitle: string;
  side: 'Paternal' | 'Maternal' | 'Unknown';
  testers: AutosomalTester[];
  maxCm: number;
}

const GEN_TITLES: Record<number, string> = {
  1: 'RODITELJ',
  2: 'DJED/BAKA',
  3: 'PRADJED/PRABAKA',
  4: 'ŠUKUNDJED/ŠUKUNBAKA',
  5: 'ŠUKUN-ŠUKUNDJED/BAKA',
  6: 'PREDAK 6. GENERACIJE'
};

// Based on actual DNAPainter v4 biological averages
function getRelationCm(stepsUp: number, stepsDown: number, isHalf: boolean): { avg: number; title: string } {
  if (stepsUp === 1 && stepsDown === 1) return isHalf ? { avg: 1759, title: 'Polubrat/Polusestra' } : { avg: 2613, title: 'Brat/Sestra' };
  if (stepsUp === 2 && stepsDown === 1) return isHalf ? { avg: 871, title: 'Polu-ujak/Poluteta' } : { avg: 1741, title: 'Ujak/Teta/Stric' };
  if (stepsUp === 1 && stepsDown === 2) return isHalf ? { avg: 871, title: 'Polunećak/Polunećakinja' } : { avg: 1741, title: 'Nećak/Nećakinja' };
  if (stepsUp === 2 && stepsDown === 2) return isHalf ? { avg: 426, title: 'Polubratić (1. koljeno)' } : { avg: 866, title: '1. bratić/sestrična' };
  if (stepsUp === 3 && stepsDown === 1) return isHalf ? { avg: 426, title: 'Polu-prastric/Prateta' } : { avg: 850, title: 'Prastric/Prateta' };
  if (stepsUp === 3 && stepsDown === 2) return isHalf ? { avg: 212, title: 'Polubratić 1. kol. (1x razlika)' } : { avg: 423, title: '1. bratić/sestrična (1x razlika)' };
  if (stepsUp === 2 && stepsDown === 3) return isHalf ? { avg: 212, title: 'Polubratić 1. kol. (1x razlika dolje)' } : { avg: 423, title: '1. bratić/sestrična (1x razlika dolje)' };
  if (stepsUp === 3 && stepsDown === 3) return isHalf ? { avg: 106, title: 'Polubratić 2. koljena' } : { avg: 229, title: '2. bratić/sestrična' };
  if (stepsUp === 4 && stepsDown === 3) return isHalf ? { avg: 53, title: 'Polubratić 2. kol. (1x razlika)' } : { avg: 114, title: '2. bratić/sestrična (1x razlika)' };
  if (stepsUp === 3 && stepsDown === 4) return isHalf ? { avg: 53, title: 'Polubratić 2. kol. (1x razlika dolje)' } : { avg: 114, title: '2. bratić/sestrična (1x razlika dolje)' };
  if (stepsUp === 4 && stepsDown === 4) return isHalf ? { avg: 31, title: 'Polubratić 3. koljena' } : { avg: 73, title: '3. bratić/sestrična' };
  if (stepsUp === 5 && stepsDown === 5) return isHalf ? { avg: 7, title: 'Polubratić 4. koljena' } : { avg: 17, title: '4. bratić/sestrična' };
  
  const totalSteps = stepsUp + stepsDown;
  const genericAvg = Math.floor(3500 / Math.pow(2, totalSteps - 1));
  const finalAvg = isHalf ? Math.floor(genericAvg / 2) : genericAvg;

  return { avg: finalAvg, title: `Rođak u ${totalSteps} koraka` };
}

export function analyzeBestTesters(tree: GedcomTree, graph: TreeGraph, focusPersonId: string): AncestorGroup[] {
  const currentYear = new Date().getFullYear();
  
  const ancestors = graph.getAncestors(focusPersonId, 6);
  const ancestorIds = new Set(ancestors.map(a => a.personId));
  
  const fpNode = tree.persons.get(focusPersonId);
  let paternalId: string | null = null;
  let maternalId: string | null = null;
  if (fpNode?._parents) {
    const parents = fpNode._parents.map(id => tree.persons.get(id));
    paternalId = parents.find(p => p?.sex === 'M')?.id || null;
    maternalId = parents.find(p => p?.sex === 'F')?.id || null;
  }

  const getSide = (id: string): 'Paternal' | 'Maternal' | 'Unknown' => {
    if (id === paternalId) return 'Paternal';
    if (id === maternalId) return 'Maternal';
    if (paternalId) {
      const patAncestors = graph.getAncestors(paternalId, 6);
      if (patAncestors.some(a => a.personId === id)) return 'Paternal';
    }
    if (maternalId) {
      const matAncestors = graph.getAncestors(maternalId, 6);
      if (matAncestors.some(a => a.personId === id)) return 'Maternal';
    }
    return 'Unknown';
  };

  const results: AncestorGroup[] = [];

  for (const ancEntry of ancestors) {
    const ancestor = tree.persons.get(ancEntry.personId);
    if (!ancestor) continue;

    const descendants = graph.getDescendants(ancEntry.personId, 6);
    const testers: AutosomalTester[] = [];

    for (const descEntry of descendants) {
      const descId = descEntry.personId;
      if (descId === focusPersonId || ancestorIds.has(descId)) continue;

      const p = tree.persons.get(descId);
      if (!p) continue;

      if (isLiving(p, currentYear)) {
        const stepsUp = ancEntry.generation;
        const stepsDown = descEntry.generation;
        
        let isHalf = false;
        let path: string[] = [];

        const pathData = graph.findRelationshipPath(focusPersonId, descId);
        if (pathData) {
          path = pathData.path;
        }

        if (stepsUp === 1 && stepsDown === 1) {
          const siblingParents = p._parents || [];
          const focusParents = fpNode?._parents || [];
          const sharedParents = siblingParents.filter(pid => focusParents.includes(pid));
          isHalf = sharedParents.length === 1;
        }

        const relation = getRelationCm(stepsUp, stepsDown, isHalf);

        // Multiplier: how many times more DNA you have than this relative (from this specific ancestor)
        // If you are gen 1 (child) and they are gen 3 (great-grandchild), you have 4x more DNA.
        // Formula: 2^(stepsDown - stepsUp). Only makes sense if stepsDown > stepsUp.
        let multiplier = 1;
        if (stepsDown > stepsUp) {
          multiplier = Math.pow(2, stepsDown - stepsUp);
        }

        testers.push({
          person: p,
          relationTitle: relation.title,
          cmEstimate: relation.avg,
          isHalf,
          path,
          multiplier
        });
      }
    }

    if (testers.length > 0) {
      testers.sort((a, b) => b.cmEstimate - a.cmEstimate);

      results.push({
        ancestor,
        generation: ancEntry.generation,
        genTitle: GEN_TITLES[ancEntry.generation] || `PREDAK ${ancEntry.generation}. GENERACIJE`,
        side: getSide(ancEntry.personId),
        testers,
        maxCm: testers[0].cmEstimate
      });
    }
  }

  results.sort((a, b) => {
    if (a.generation !== b.generation) return a.generation - b.generation;
    return b.maxCm - a.maxCm;
  });

  return results;
}
