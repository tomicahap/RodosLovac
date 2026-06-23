import type { TreeGraph } from './treeGraph';
import type { GedcomPerson } from './gedcomTypes';

export interface PathAnalysis {
  ncaId: string | null;
  stepsUp: number;
  stepsDown: number;
  isDirect: boolean; // Direct ancestor/descendant
  isSpouse: boolean;
  isBlood: boolean;
  relationshipName: string;
}

export function analyzePath(path: string[], graph: TreeGraph): PathAnalysis {
  if (!path || path.length < 2) {
    return { ncaId: path[0] || null, stepsUp: 0, stepsDown: 0, isDirect: true, isSpouse: false, isBlood: true, relationshipName: 'Ista osoba' };
  }

  let stepsUp = 0;
  let stepsDown = 0;
  let ncaId: string | null = null;
  let isSpouse = false;
  let isBlood = true;

  // Find the peak (NCA)
  let goingUp = true;
  for (let i = 0; i < path.length - 1; i++) {
    const currId = path[i];
    const nextId = path[i + 1];
    const node = graph.getNode(currId);
    if (!node) continue;

    if (node.spouses.includes(nextId) && path.length === 2) {
      isSpouse = true;
      ncaId = null;
      break;
    }

    if (goingUp && node.parents.includes(nextId)) {
      stepsUp++;
    } else if (goingUp && node.children.includes(nextId)) {
      goingUp = false;
      ncaId = currId; // The peak is the current node before going down
      stepsDown++;
    } else if (!goingUp && node.children.includes(nextId)) {
      stepsDown++;
    } else if (goingUp && node.spouses.includes(nextId)) {
       // Re-marriage step or lateral
       ncaId = currId;
       goingUp = false;
    } else {
      // Fallback
      if (goingUp) { ncaId = currId; goingUp = false; }
      stepsDown++;
    }
  }

  if (goingUp) {
    ncaId = path[path.length - 1];
  }

  // Check if entire path is strictly parent/child connections
  for (let i = 0; i < path.length - 1; i++) {
    const node = graph.getNode(path[i]);
    if (node && !node.parents.includes(path[i+1]) && !node.children.includes(path[i+1])) {
      isBlood = false;
    }
  }

  const targetPerson = graph.getPerson(path[path.length - 1]);
  const sex = targetPerson?.sex || 'U';

  return {
    ncaId,
    stepsUp,
    stepsDown,
    isDirect: stepsUp === 0 || stepsDown === 0,
    isSpouse,
    isBlood,
    relationshipName: getCroatianRelationshipName(stepsUp, stepsDown, sex)
  };
}

export function getCroatianRelationshipName(up: number, down: number, sex: 'M' | 'F' | 'U' | 'X'): string {
  if (up === 0 && down === 0) return 'Ista osoba';
  if (up === 0 && down === 1) return sex === 'F' ? 'Kći' : 'Sin';
  if (up === 0 && down === 2) return sex === 'F' ? 'Unuka' : 'Unuk';
  if (up === 0 && down === 3) return sex === 'F' ? 'Praunuka' : 'Praunuk';
  if (up === 0 && down > 3) return `Potomak u ${down}. koljenu`;

  if (up === 1 && down === 0) return sex === 'F' ? 'Majka' : 'Otac';
  if (up === 2 && down === 0) return sex === 'F' ? 'Baka' : 'Djed';
  if (up === 3 && down === 0) return sex === 'F' ? 'Prabaka' : 'Pradjed';
  if (up === 4 && down === 0) return sex === 'F' ? 'Šukunbaka' : 'Šukundjed';
  if (up > 4 && down === 0) return `Predak u ${up}. koljenu`;

  if (up === 1 && down === 1) return sex === 'F' ? 'Sestra' : 'Brat';
  if (up === 1 && down === 2) return sex === 'F' ? 'Nećakinja' : 'Nećak';
  if (up === 1 && down === 3) return sex === 'F' ? 'Pranećakinja' : 'Pranećak';

  if (up === 2 && down === 1) return sex === 'F' ? 'Teta' : 'Stric/Ujak';
  if (up === 2 && down === 2) return sex === 'F' ? 'Sestrična' : 'Bratić';
  if (up === 2 && down === 3) return sex === 'F' ? 'Sestrična (1. koljeno, 1 uklonjeno)' : 'Bratić (1. koljeno, 1 uklonjeno)';

  if (up === 3 && down === 1) return sex === 'F' ? 'Prateta' : 'Prastric/Praujak';
  if (up === 3 && down === 2) return sex === 'F' ? 'Sestrična (1. koljeno, 1 uklonjeno)' : 'Bratić (1. koljeno, 1 uklonjeno)';
  if (up === 3 && down === 3) return sex === 'F' ? 'Sestrična (2. koljeno)' : 'Bratić (2. koljeno)';

  if (up > 0 && down > 0) {
    const degree = Math.min(up, down) - 1;
    const removal = Math.abs(up - down);
    if (degree === 0) return `Bliži rod (${removal} gen. razlike)`;
    return `${sex === 'F' ? 'Sestrična' : 'Bratić'} (${degree}. koljeno, ${removal} uklonjeno)`;
  }

  return 'Rođak / Srodnik';
}

export function getExpectedDNA(up: number, down: number): { avg: number; range: [number, number]; pct: number } {
  // Approximate total distance
  const distance = up + down;
  
  if (distance === 0) return { avg: 3460, range: [3460, 3460], pct: 100 }; // Self/Twin
  if (distance === 1) return { avg: 3460, range: [3330, 3720], pct: 50 }; // Parent/Child
  if (distance === 2 && up === 1 && down === 1) return { avg: 2613, range: [2209, 3384], pct: 50 }; // Full Sibling
  if (distance === 2) return { avg: 1754, range: [1349, 2175], pct: 25 }; // Grandparent/Grandchild/Half Sibling/Aunt/Uncle/Niece/Nephew
  if (distance === 3) return { avg: 874, range: [575, 1330], pct: 12.5 }; // 1st Cousin / Great-grandparent / Great-Aunt
  if (distance === 4) return { avg: 433, range: [214, 850], pct: 6.25 }; // 1st Cousin 1xR
  if (distance === 5) return { avg: 212, range: [69, 501], pct: 3.12 }; // 2nd Cousin
  if (distance === 6) return { avg: 106, range: [14, 253], pct: 1.5 }; // 2nd Cousin 1xR
  if (distance === 7) return { avg: 53, range: [0, 116], pct: 0.78 }; // 3rd Cousin
  if (distance === 8) return { avg: 26, range: [0, 73], pct: 0.39 }; // 3rd Cousin 1xR
  if (distance >= 9) return { avg: 0, range: [0, 20], pct: 0 }; // Very distant

  return { avg: 0, range: [0, 0], pct: 0 };
}

export function generateNarrative(personA: GedcomPerson, personB: GedcomPerson, path: string[], analysis: PathAnalysis, graph: TreeGraph): string {
  if (analysis.isSpouse) {
    return `${personA.names[0]?.full} i ${personB.names[0]?.full} su supružnici. Nisu nužno krvno povezani unutar stabla.`;
  }
  if (path.length <= 1) {
    return `Odabrali ste istu osobu.`;
  }

  const nca = analysis.ncaId ? graph.getPerson(analysis.ncaId) : null;
  if (!nca) return `${personA.names[0]?.full} i ${personB.names[0]?.full} su povezani obiteljskim vezama, no izravni krvni zajednički predak nije jasno definiran u ovoj putanji.`;

  const ncaName = nca.names[0]?.full || 'Zajednički predak';
  const isDirectDescendant = analysis.isDirect;

  if (isDirectDescendant) {
    if (analysis.stepsUp > 0) {
      return `${personA.names[0]?.full} je izravni potomak od ${personB.names[0]?.full} (${analysis.stepsUp} generacija). ${personB.names[0]?.full} je ${analysis.relationshipName.toLowerCase()} od ${personA.names[0]?.given || 'Osobe A'}.`;
    } else {
      return `${personB.names[0]?.full} je izravni potomak od ${personA.names[0]?.full} (${analysis.stepsDown} generacija). ${personA.names[0]?.full} je predak od ${personB.names[0]?.given || 'Osobe B'}.`;
    }
  }

  return `${personA.names[0]?.full} i ${personB.names[0]?.full} su u srodstvu preko zajedničkog pretka (${ncaName}). ${personA.names[0]?.given || 'Osoba A'} je ${analysis.stepsUp} generacija udaljen/a od pretka, dok je ${personB.names[0]?.given || 'Osoba B'} ${analysis.stepsDown} generacija udaljen/a. To ih čini rođacima u koljenu (${analysis.relationshipName.toLowerCase()}).`;
}
