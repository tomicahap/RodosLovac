import { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';

export interface YDnaLine {
  id: string; // Earliest known ancestor ID
  eka: GedcomPerson; // Earliest Known Ancestor
  surnames: string[];
  males: GedcomPerson[];
  livingMales: GedcomPerson[];
  bestTesters: GedcomPerson[];
  minYear?: number;
  maxYear?: number;
  isAtRisk: boolean;
  totalMalesCount: number;
}

function getYear(p: GedcomPerson, eventType: 'birth' | 'death'): number | undefined {
  const ev = p[eventType];
  return ev?.date?.year;
}

function isLiving(p: GedcomPerson, currentYear: number): boolean {
  if (p.death || p.events.some(e => e.tag === 'DEAT' || e.tag === 'BURI')) return false;
  const by = getYear(p, 'birth');
  if (!by) return false; // Isključi ako nemamo godinu rođenja
  if (currentYear - by > 100) return false; // Isključi ako je osoba rođena prije više od 100 godina
  return true;
}

function getAge(p: GedcomPerson, currentYear: number): number | undefined {
  const by = getYear(p, 'birth');
  if (!by) return undefined;
  if (!isLiving(p, currentYear)) return undefined;
  return currentYear - by;
}

export function analyzeYdnaLines(tree: GedcomTree): YDnaLine[] {
  const currentYear = new Date().getFullYear();
  const maleLines = new Map<string, Set<string>>(); // eka ID -> Set of person IDs
  
  // 1. Find EKA for every male
  const ekaMap = new Map<string, string>(); // personId -> ekaId

  for (const p of Array.from(tree.persons.values())) {
    if (p.sex !== 'M') continue;

    let curr: GedcomPerson | undefined = p;
    const path = [];
    const visited = new Set<string>();

    while (curr && curr.sex === 'M' && !visited.has(curr.id)) {
      visited.add(curr.id);
      path.push(curr.id);

      // Find father
      let father: GedcomPerson | undefined = undefined;
      if (curr._parents) {
        father = curr._parents.map(id => tree.persons.get(id)).find(parent => parent?.sex === 'M');
      }
      
      curr = father;
    }

    const ekaId = path[path.length - 1];
    if (ekaId) {
      if (!maleLines.has(ekaId)) maleLines.set(ekaId, new Set());
      maleLines.get(ekaId)!.add(p.id);
    }
  }

  // 2. Build line objects
  const lines: YDnaLine[] = [];

  for (const [ekaId, personIds] of maleLines.entries()) {
    const eka = tree.persons.get(ekaId);
    if (!eka) continue;

    const males = Array.from(personIds)
      .map(id => tree.persons.get(id))
      .filter((p): p is GedcomPerson => p !== undefined);

    const surnamesSet = new Set<string>();
    let minYear = Infinity;
    let maxYear = -Infinity;
    const livingMales: GedcomPerson[] = [];

    for (const m of males) {
      if (m.names[0]?.surname) {
        surnamesSet.add(m.names[0].surname);
      }
      
      const by = getYear(m, 'birth');
      const dy = getYear(m, 'death');
      if (by && by < minYear) minYear = by;
      if (dy && dy > maxYear) maxYear = dy;
      if (by && by > maxYear) maxYear = by;

      if (isLiving(m, currentYear)) {
        livingMales.push(m);
      }
    }

    // Sort living males by birth year (youngest first -> best testers)
    livingMales.sort((a, b) => {
      const byA = getYear(a, 'birth') || 0;
      const byB = getYear(b, 'birth') || 0;
      return byB - byA; // Descending, so youngest is first
    });

    const isAtRisk = livingMales.length <= 2 || livingMales.every(m => {
      const age = getAge(m, currentYear);
      return age !== undefined && age >= 80;
    });

    const bestTesters: GedcomPerson[] = [];
    if (livingMales.length > 0) {
      bestTesters.push(livingMales[0]); // Najmlađi (jer je sortirano silazno)
      if (livingMales.length > 1) {
        bestTesters.push(livingMales[livingMales.length - 1]); // Najstariji
      }
    }

    lines.push({
      id: ekaId,
      eka,
      surnames: Array.from(surnamesSet),
      males,
      livingMales,
      bestTesters,
      minYear: minYear !== Infinity ? minYear : undefined,
      maxYear: maxYear !== -Infinity ? maxYear : undefined,
      isAtRisk,
      totalMalesCount: males.length
    });
  }

  // Sort lines by total males descending
  lines.sort((a, b) => b.totalMalesCount - a.totalMalesCount);

  return lines;
}

export interface MtDnaLine {
  id: string; // Earliest known ancestor ID (Mother)
  eka: GedcomPerson;
  femalesCount: number;
  totalCount: number;
  livingDescendants: GedcomPerson[];
  livingFemalesCount: number;
  bestTesters: GedcomPerson[];
  minYear?: number;
  maxYear?: number;
  isAtRisk: boolean;
  atRiskReason: 'extinct' | 'lone' | 'two' | 'no-females' | 'none';
}

export function analyzeMtDnaLines(tree: GedcomTree): MtDnaLine[] {
  const currentYear = new Date().getFullYear();
  const mtLines = new Map<string, Set<string>>(); // eka ID -> Set of person IDs
  
  // 1. Find EKA for every person
  for (const p of Array.from(tree.persons.values())) {
    let curr: GedcomPerson | undefined = p;
    const path = [];
    const visited = new Set<string>();

    // For mtDNA, everyone has it, but it only comes from the mother.
    // So we trace up the mother's line.
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      path.push(curr.id);

      // Find mother
      let mother: GedcomPerson | undefined = undefined;
      if (curr._parents) {
        mother = curr._parents.map(id => tree.persons.get(id)).find(parent => parent?.sex === 'F');
      }
      
      curr = mother;
    }

    const ekaId = path[path.length - 1];
    if (ekaId) {
      if (!mtLines.has(ekaId)) mtLines.set(ekaId, new Set());
      mtLines.get(ekaId)!.add(p.id);
    }
  }

  // 2. Build line objects
  const lines: MtDnaLine[] = [];

  for (const [ekaId, personIds] of mtLines.entries()) {
    const eka = tree.persons.get(ekaId);
    if (!eka) continue;
    // An EKA must be female if it's a matrilineal line, unless the tree only has 1 person who is male with no parents.
    // We only care about actual lines (more than 1 person, or at least a female EKA)
    // Actually, let's keep all, but standard is EKA is female.
    if (eka.sex !== 'F' && personIds.size === 1) continue; // Skip isolated males

    const descendants = Array.from(personIds)
      .map(id => tree.persons.get(id))
      .filter((p): p is GedcomPerson => p !== undefined);

    let femalesCount = 0;
    let minYear = Infinity;
    let maxYear = -Infinity;
    const livingDescendants: GedcomPerson[] = [];
    let livingFemalesCount = 0;

    for (const d of descendants) {
      if (d.sex === 'F') femalesCount++;
      
      const by = getYear(d, 'birth');
      const dy = getYear(d, 'death');
      if (by && by < minYear) minYear = by;
      if (dy && dy > maxYear) maxYear = dy;
      if (by && by > maxYear) maxYear = by;

      if (isLiving(d, currentYear)) {
        livingDescendants.push(d);
        if (d.sex === 'F') livingFemalesCount++;
      }
    }

    // Sort living descendants by birth year (youngest first -> best testers)
    livingDescendants.sort((a, b) => {
      const byA = getYear(a, 'birth') || 0;
      const byB = getYear(b, 'birth') || 0;
      return byB - byA; // Descending, so youngest is first
    });

    let atRiskReason: MtDnaLine['atRiskReason'] = 'none';
    if (livingDescendants.length === 0) {
      atRiskReason = 'extinct';
    } else if (livingDescendants.length === 1) {
      atRiskReason = 'lone';
    } else if (livingDescendants.length === 2) {
      atRiskReason = 'two';
    } else if (livingFemalesCount === 0) {
      atRiskReason = 'no-females';
    } else if (livingDescendants.every(m => {
      const age = getAge(m, currentYear);
      return age !== undefined && age >= 80;
    })) {
      atRiskReason = 'extinct'; // Older than 80 logic is basically extinct for testing viability in future
    }

    const isAtRisk = atRiskReason !== 'none';

    const bestTesters: GedcomPerson[] = [];
    if (livingDescendants.length > 0) {
      bestTesters.push(livingDescendants[0]); // Najmlađi
      if (livingDescendants.length > 1) {
        bestTesters.push(livingDescendants[livingDescendants.length - 1]); // Najstariji
      }
    }

    lines.push({
      id: ekaId,
      eka,
      femalesCount,
      totalCount: descendants.length,
      livingDescendants,
      livingFemalesCount,
      bestTesters,
      minYear: minYear !== Infinity ? minYear : undefined,
      maxYear: maxYear !== -Infinity ? maxYear : undefined,
      isAtRisk,
      atRiskReason
    });
  }

  // Sort lines by females count descending
  lines.sort((a, b) => b.femalesCount - a.femalesCount);

  return lines;
}
