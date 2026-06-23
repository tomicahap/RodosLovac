import { GedcomTree, GedcomPerson } from '../parser/gedcomTypes';
import { TreeGraph } from '../parser/treeGraph';

export interface CousinPerson {
  id: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
}

export interface MRCA {
  id1: string;
  id2?: string; // Optional if half-cousin
  label: string; // "through Michael Happ & Anna Muller"
}

export interface CousinGroup {
  mrca: MRCA;
  isHalf: boolean;
  cousins: CousinPerson[];
}

export interface GenerationCousins {
  degree: number; // 1 = 1st Cousins, 2 = 2nd Cousins, etc.
  label: string;  // "1. Koljeno (1st Cousins)"
  totalCount: number;
  groups: CousinGroup[];
}

// Helper to extract year
const extractYear = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
};

// Helper to format person life years "(1898 - 1964)"
export const formatLifespan = (b: number | null, d: number | null): string => {
  if (!b && !d) return "";
  if (b && d) return `(${b} - ${d})`;
  if (b) return `(rođ. ${b})`;
  if (d) return `(um. ${d})`;
  return "";
};

export const generateCousins = (personId: string, tree: GedcomTree, graph: TreeGraph): GenerationCousins[] => {
  // 1. Get ancestors with distances
  const myAncestors = graph.getAncestorDistances(personId, 10);
  
  // Create a map to hold raw cousin entries
  // Key: cousinId
  // Value: array of ancestors they share with focal person
  const cousinToSharedAncestors = new Map<string, { ancestorId: string, myDist: number, theirDist: number }[]>();

  // 2. Find descendants of each ancestor
  for (const [ancestorId, myDist] of myAncestors) {
    if (myDist === 0) continue; // Skip self

    const descendants = graph.getDescendants(ancestorId, 15);
    for (const desc of descendants) {
      if (desc.personId === personId) continue;
      
      const theirDist = desc.generation;
      
      // We only care about same generation cousins! (No removed)
      if (myDist === theirDist && myDist >= 2) {
        if (!cousinToSharedAncestors.has(desc.personId)) {
          cousinToSharedAncestors.set(desc.personId, []);
        }
        cousinToSharedAncestors.get(desc.personId)!.push({ ancestorId, myDist, theirDist });
      }
    }
  }

  // 3. Process into Groups
  // degree = dist - 1.  (dist=2 -> 1st cousin, dist=3 -> 2nd cousin)
  
  // We need to group by (degree, mrca_key)
  const groupedResult = new Map<number, Map<string, CousinGroup>>();

  for (const [cousinId, shared] of cousinToSharedAncestors.entries()) {
    const cPerson = tree.persons.get(cousinId);
    if (!cPerson) continue;

    // Filter shared to find the closest (minimum distance)
    let minDist = 999;
    for (const s of shared) {
      if (s.myDist < minDist) minDist = s.myDist;
    }

    // Only keep the closest shared ancestors to avoid duplicate counting 
    // (e.g. sharing grandparents also implies sharing great-grandparents)
    const closestShared = shared.filter(s => s.myDist === minDist);
    
    if (closestShared.length === 0) continue;

    const degree = minDist - 1;
    if (degree < 1) continue; // Not a cousin (maybe sibling)

    const isHalf = closestShared.length === 1;
    
    // Sort ancestor IDs to create a consistent MRCA key
    closestShared.sort((a, b) => a.ancestorId.localeCompare(b.ancestorId));
    
    const id1 = closestShared[0].ancestorId;
    const id2 = closestShared.length > 1 ? closestShared[1].ancestorId : undefined;
    const mrcaKey = isHalf ? id1 : `${id1}-${id2}`;

    if (!groupedResult.has(degree)) {
      groupedResult.set(degree, new Map<string, CousinGroup>());
    }

    const degreeMap = groupedResult.get(degree)!;

    if (!degreeMap.has(mrcaKey)) {
      const p1 = tree.persons.get(id1);
      const p2 = id2 ? tree.persons.get(id2) : null;
      let label = "";
      if (p1 && p2) {
        label = `preko ${p1.names[0]?.full} & ${p2.names[0]?.full}`;
      } else if (p1) {
        label = `preko ${p1.names[0]?.full}`;
      }

      degreeMap.set(mrcaKey, {
        mrca: { id1, id2, label },
        isHalf,
        cousins: []
      });
    }

    const bYear = cPerson.birth?.date?.year || extractYear(cPerson.birth?.date?.display);
    const dYear = cPerson.death?.date?.year || extractYear(cPerson.death?.date?.display);

    degreeMap.get(mrcaKey)!.cousins.push({
      id: cousinId,
      name: cPerson.names[0]?.full || 'Nepoznato',
      birthYear: bYear,
      deathYear: dYear
    });
  }

  // 4. Format Output
  const result: GenerationCousins[] = [];

  const degreeLabels: Record<number, string> = {
    1: '1. Koljeno (1st Cousins)',
    2: '2. Koljeno (2nd Cousins)',
    3: '3. Koljeno (3rd Cousins)',
    4: '4. Koljeno (4th Cousins)',
    5: '5. Koljeno (5th Cousins)',
    6: '6. Koljeno (6th Cousins)'
  };

  const sortedDegrees = Array.from(groupedResult.keys())
    .filter(deg => deg <= 3) // Only up to 3rd cousins
    .sort((a, b) => a - b);

  for (const deg of sortedDegrees) {
    const groupsMap = groupedResult.get(deg)!;
    const groups = Array.from(groupsMap.values());
    
    let totalCount = 0;
    for (const g of groups) {
      totalCount += g.cousins.length;
    }

    result.push({
      degree: deg,
      label: degreeLabels[deg] || `${deg}. Koljeno`,
      totalCount,
      groups
    });
  }

  return result;
};
