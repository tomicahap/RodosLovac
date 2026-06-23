import type { GedcomTree, GedcomPerson } from '../parser/gedcomTypes';

export interface NetworkStats {
  totalPeople: number;
  mainTreeCount: number;
  detachedCount: number;
  detachedIds: string[];
  orphansCount: number;
  orphansList: GedcomPerson[];
  connectedPercentage: number;
}

export function computeNetworkStats(tree: GedcomTree): NetworkStats {
  const adj = new Map<string, Set<string>>();

  // Initialize nodes
  for (const p of tree.persons.keys()) {
    adj.set(p, new Set());
  }

  // Build edges
  for (const fam of tree.families.values()) {
    if (fam.husband && fam.wife) {
      adj.get(fam.husband)?.add(fam.wife);
      adj.get(fam.wife)?.add(fam.husband);
    }
    for (const child of fam.children) {
      if (fam.husband) {
        adj.get(fam.husband)?.add(child);
        adj.get(child)?.add(fam.husband);
      }
      if (fam.wife) {
        adj.get(fam.wife)?.add(child);
        adj.get(child)?.add(fam.wife);
      }
    }
  }

  // Find components using BFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const p of adj.keys()) {
    if (!visited.has(p)) {
      const comp: string[] = [];
      const queue = [p];
      visited.add(p);
      
      while (queue.length > 0) {
        const u = queue.shift()!;
        comp.push(u);
        const neighbors = adj.get(u);
        if (neighbors) {
          for (const v of neighbors) {
            if (!visited.has(v)) {
              visited.add(v);
              queue.push(v);
            }
          }
        }
      }
      components.push(comp);
    }
  }

  // Sort by size descending
  components.sort((a, b) => b.length - a.length);

  const totalPeople = tree.persons.size;
  const mainTreeCount = components.length > 0 ? components[0].length : 0;
  const detachedCount = totalPeople - mainTreeCount;
  const connectedPercentage = totalPeople > 0 ? Math.round((mainTreeCount / totalPeople) * 100) : 0;

  const detachedIds: string[] = [];
  if (components.length > 1) {
    for (let i = 1; i < components.length; i++) {
      detachedIds.push(...components[i]);
    }
  }

  // Find orphans (degree 0)
  const orphansList: GedcomPerson[] = [];
  for (const [pId, neighbors] of adj.entries()) {
    if (neighbors.size === 0) {
      const person = tree.persons.get(pId);
      if (person) orphansList.push(person);
    }
  }
  
  // Sort orphans by name
  orphansList.sort((a, b) => {
    const nameA = a.names[0]?.full || '';
    const nameB = b.names[0]?.full || '';
    return nameA.localeCompare(nameB);
  });

  return {
    totalPeople,
    mainTreeCount,
    detachedCount,
    detachedIds,
    orphansCount: orphansList.length,
    orphansList,
    connectedPercentage
  };
}
