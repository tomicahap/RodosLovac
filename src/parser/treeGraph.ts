// ============================================================
// Tree Graph — in-memory graph built from parsed GedcomTree
// Provides: ancestor/descendant traversal, cousin finder,
//           relationship path (BFS), pedigree collapse detection
// ============================================================

import type {
  GedcomTree, GedcomPerson, PersonNode, RelationshipPath,
  CousinInfo, AncestorEntry, DescendantEntry, LifespanEntry,
} from './gedcomTypes';

// ─── Graph Build ──────────────────────────────────────────────



export interface DuplicateCandidate {
  personA: string;
  personB: string;
  confidence: 'High' | 'Medium' | 'Low';
  score: number;
  reasons: string[];
  conflicts: {
    parents: boolean;
    birthYear: boolean;
    birthPlace: boolean;
  };
}

export class TreeGraph {
  private nodes: Map<string, PersonNode>;
  private tree: GedcomTree;

  constructor(tree: GedcomTree) {
    this.tree = tree;
    this.nodes = new Map();
    this.buildGraph();
  }

  private buildGraph() {
    const { persons, families } = this.tree;

    // Initialize nodes
    for (const [id] of persons) {
      this.nodes.set(id, { id, parents: [], children: [], spouses: [] });
    }

    // Fill from families
    for (const fam of families.values()) {
      const parentIds: string[] = [];
      if (fam.husband && this.nodes.has(fam.husband)) parentIds.push(fam.husband);
      if (fam.wife && this.nodes.has(fam.wife)) parentIds.push(fam.wife);

      // Link spouses
      if (fam.husband && fam.wife) {
        const h = this.nodes.get(fam.husband);
        const w = this.nodes.get(fam.wife);
        if (h && !h.spouses.includes(fam.wife)) h.spouses.push(fam.wife);
        if (w && !w.spouses.includes(fam.husband)) w.spouses.push(fam.husband);
      }

      // Link parents ↔ children
      for (const childId of fam.children) {
        const childNode = this.nodes.get(childId);
        if (!childNode) continue;
        for (const parentId of parentIds) {
          const parentNode = this.nodes.get(parentId);
          if (parentNode && !parentNode.children.includes(childId)) {
            parentNode.children.push(childId);
          }
          if (!childNode.parents.includes(parentId)) {
            childNode.parents.push(parentId);
          }
        }
      }
    }

    // Also populate computed fields on GedcomPerson
    for (const [id, node] of this.nodes) {
      const p = persons.get(id);
      if (p) {
        p._parents = node.parents;
        p._children = node.children;
        p._spouses = node.spouses;
      }
    }
  }

  getNode(id: string): PersonNode | undefined {
    return this.nodes.get(id);
  }

  getPerson(id: string): GedcomPerson | undefined {
    return this.tree.persons.get(id);
  }

  getAllPersonIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  // ─── Ancestor Traversal ─────────────────────────────────────

  /**
   * Returns all ancestors of personId with their generation number.
   * generation 1 = parents, 2 = grandparents, etc.
   * If maxGen is provided, stops there.
   */
  getAncestors(personId: string, maxGen = 50): AncestorEntry[] {
    const results: AncestorEntry[] = [];
    const queue: Array<{ id: string; gen: number; ahnentafel: number }> = [
      { id: personId, gen: 0, ahnentafel: 1 }
    ];
    const visited = new Set<string>([personId]);

    while (queue.length > 0) {
      const { id, gen, ahnentafel } = queue.shift()!;
      if (gen > 0) results.push({ personId: id, generation: gen, ahnentafelNumber: ahnentafel });
      if (gen >= maxGen) continue;

      const node = this.nodes.get(id);
      if (!node) continue;

      // Standard ordering: father = 2n, mother = 2n+1
      const parents = node.parents.slice(0, 2); // cap at 2
      parents.forEach((parentId, i) => {
        if (!visited.has(parentId)) {
          visited.add(parentId);
          queue.push({ id: parentId, gen: gen + 1, ahnentafel: ahnentafel * 2 + i });
        }
      });
    }

    return results;
  }

  /**
   * Returns ancestor count per generation.
   */
  getAncestorCountByGeneration(personId: string, maxGen = 50): Record<number, number> {
    const ancestors = this.getAncestors(personId, maxGen);
    const byGen: Record<number, number> = {};
    for (const a of ancestors) {
      byGen[a.generation] = (byGen[a.generation] || 0) + 1;
    }
    return byGen;
  }

  // ─── Descendant Traversal ───────────────────────────────────

  getDescendants(personId: string, maxGen = 50): DescendantEntry[] {
    const results: DescendantEntry[] = [];
    const queue: Array<{ id: string; gen: number }> = [{ id: personId, gen: 0 }];
    const visited = new Set<string>([personId]);

    while (queue.length > 0) {
      const { id, gen } = queue.shift()!;
      if (gen > 0) results.push({ personId: id, generation: gen });
      if (gen >= maxGen) continue;

      const node = this.nodes.get(id);
      if (!node) continue;

      for (const childId of node.children) {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push({ id: childId, gen: gen + 1 });
        }
      }
    }

    return results;
  }

  getDescendantCountByGeneration(personId: string, maxGen = 50): Record<number, number> {
    const descendants = this.getDescendants(personId, maxGen);
    const byGen: Record<number, number> = {};
    for (const d of descendants) {
      byGen[d.generation] = (byGen[d.generation] || 0) + 1;
    }
    return byGen;
  }

  // ─── BFS Relationship Path ──────────────────────────────────

  /**
   * Finds the shortest path between two persons in the family graph
   * using bidirectional BFS across parent/child/spouse edges.
   */
  findRelationshipPath(fromId: string, toId: string): RelationshipPath | null {
    if (fromId === toId) return { path: [fromId], description: 'Same person', distance: 0 };

    // BFS from both directions
    const visitedFrom = new Map<string, string | null>([[fromId, null]]);
    const visitedTo = new Map<string, string | null>([[toId, null]]);
    const queueFrom: string[] = [fromId];
    const queueTo: string[] = [toId];

    const getNeighbors = (id: string): string[] => {
      const node = this.nodes.get(id);
      if (!node) return [];
      return [...node.parents, ...node.children, ...node.spouses];
    };

    const reconstructPath = (meetPoint: string): string[] => {
      const pathFrom: string[] = [];
      let cur: string | null = meetPoint;
      while (cur !== null) {
        pathFrom.unshift(cur);
        cur = visitedFrom.get(cur) ?? null;
      }
      const pathTo: string[] = [];
      cur = visitedTo.get(meetPoint) ?? null;
      while (cur !== null) {
        pathTo.push(cur);
        cur = visitedTo.get(cur) ?? null;
      }
      return [...pathFrom, ...pathTo];
    };

    let iterations = 0;
    const MAX_ITER = 100000;

    while ((queueFrom.length > 0 || queueTo.length > 0) && iterations < MAX_ITER) {
      iterations++;

      if (queueFrom.length > 0) {
        const current = queueFrom.shift()!;
        for (const neighbor of getNeighbors(current)) {
          if (!visitedFrom.has(neighbor)) {
            visitedFrom.set(neighbor, current);
            queueFrom.push(neighbor);
            if (visitedTo.has(neighbor)) {
              const path = reconstructPath(neighbor);
              return {
                path,
                description: describeRelationship(path, this),
                distance: path.length - 1,
              };
            }
          }
        }
      }

      if (queueTo.length > 0) {
        const current = queueTo.shift()!;
        for (const neighbor of getNeighbors(current)) {
          if (!visitedTo.has(neighbor)) {
            visitedTo.set(neighbor, current);
            queueTo.push(neighbor);
            if (visitedFrom.has(neighbor)) {
              const path = reconstructPath(neighbor);
              return {
                path,
                description: describeRelationship(path, this),
                distance: path.length - 1,
              };
            }
          }
        }
      }
    }

    return null; // No connection found
  }

  // ─── Cousin Finder ──────────────────────────────────────────

  /**
   * Finds all cousins of a person up to a given degree.
   * Uses LCA (Lowest Common Ancestor) algorithm.
   */
  findCousins(personId: string, maxDegree = 5): CousinInfo[] {
    // Get ancestors of this person with distances
    const myAncestors = this.getAncestorDistances(personId);

    const results: CousinInfo[] = [];
    const seen = new Set<string>();

    for (const [ancestorId, myDist] of myAncestors) {
      // Get all descendants of this ancestor
      const descendants = this.getDescendants(ancestorId, maxDegree + 2);

      for (const desc of descendants) {
        const theirId = desc.personId;
        if (theirId === personId || seen.has(theirId)) continue;

        // Their distance from common ancestor
        const theirDist = desc.generation;

        // Degree = min(myDist, theirDist) - 1 (cousins share ancestors at same depth)
        // Actually: degree = max(distA, distB) - 1, removal = |distA - distB|
        // 1st cousin: both at dist 2 from common ancestor (grandparent)
        const degree = Math.min(myDist, theirDist) - 1;
        const removal = Math.abs(myDist - theirDist);

        if (degree < 1 || degree > maxDegree) continue;
        if (degree === 1 && removal > maxDegree) continue;

        seen.add(theirId);

        const label = formatCousinLabel(degree, removal);
        results.push({
          personId: theirId,
          degree,
          removal,
          commonAncestors: [ancestorId],
          label,
        });
      }
    }

    return results.sort((a, b) =>
      a.degree !== b.degree ? a.degree - b.degree : a.removal - b.removal
    );
  }

  public getAncestorDistances(personId: string, maxGenerations = 100): Map<string, number> {
    const result = new Map<string, number>();
    const queue: Array<{ id: string; dist: number }> = [{ id: personId, dist: 0 }];
    const visited = new Set<string>([personId]);

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      if (dist > 0) result.set(id, dist);

      const node = this.nodes.get(id);
      if (!node || dist >= maxGenerations) continue;

      for (const parentId of node.parents) {
        if (!visited.has(parentId)) {
          visited.add(parentId);
          queue.push({ id: parentId, dist: dist + 1 });
        }
      }
    }

    return result;
  }

  // ─── Pedigree Collapse ──────────────────────────────────────

  /**
   * Detects pedigree collapse: counts unique vs total ancestor slots by generation.
   */
  getPedigreeCollapse(personId: string, maxGen = 15): Array<{
    generation: number;
    totalSlots: number;
    uniqueAncestors: number;
    collapsePercent: number;
  }> {
    // BFS tracking all slots (including duplicates)
    const slots: Array<{ id: string; gen: number }> = [];
    const queue: Array<{ id: string; gen: number }> = [{ id: personId, gen: 0 }];
    const nodeVisit = new Map<string, number>(); // id → first gen seen

    while (queue.length > 0) {
      const { id, gen } = queue.shift()!;
      if (gen > 0) slots.push({ id, gen });
      if (gen >= maxGen) continue;

      const node = this.nodes.get(id);
      if (!node) continue;

      for (const parentId of node.parents) {
        queue.push({ id: parentId, gen: gen + 1 });
      }
    }

    // Group by generation
    const byGen = new Map<number, { total: number; unique: Set<string> }>();
    for (const { id, gen } of slots) {
      if (!byGen.has(gen)) byGen.set(gen, { total: 0, unique: new Set() });
      const entry = byGen.get(gen)!;
      entry.total++;
      entry.unique.add(id);
    }

    return Array.from(byGen.entries())
      .sort(([a], [b]) => a - b)
      .map(([gen, { total, unique }]) => ({
        generation: gen,
        totalSlots: total,
        uniqueAncestors: unique.size,
        collapsePercent: total > 0 ? Math.round((1 - unique.size / total) * 100) : 0,
      }));
  }

  // ─── Brick Walls ────────────────────────────────────────────

  /**
   * Returns persons whose lineage "stops" — no known parents.
   * These are the brick walls in the research.
   */
  getBrickWalls(): Array<{ personId: string; generation: number; fromPersonId: string }> {
    const walls: Array<{ personId: string; generation: number; fromPersonId: string }> = [];
    const seen = new Set<string>();

    for (const [rootId] of this.tree.persons) {
      // Start from persons with no parents themselves
      const node = this.nodes.get(rootId);
      if (!node || node.parents.length > 0) continue;
      // This person has no known parents — potential brick wall
      if (!seen.has(rootId)) {
        seen.add(rootId);
        walls.push({ personId: rootId, generation: 0, fromPersonId: rootId });
      }
    }

    return walls;
  }

  // ─── Duplicate Detection ─────────────────────────────────────

  /**
   * Optimized heuristic duplicate detection based on:
   * - Pre-caching all O(N) operations (e.g. toLowerCase)
   * - Short-circuit evaluating impossible matches
   * - Comparing parent arrays directly from cache
   * - Bigram Sørensen-Dice string similarity for names (>80%)
   * - Date variation +/- 5 years for birth & death
   */
  findDuplicates(): DuplicateCandidate[] {
    throw new Error('findDuplicates() has been moved to duplicateWorker.ts for Big Data architectural performance reasons.');
  }

  // ─── Lifespan Data ───────────────────────────────────────────

  getLifespanData(rootPersonId?: string): LifespanEntry[] {
    const results: LifespanEntry[] = [];
    let generationMap: Map<string, number>;

    if (rootPersonId) {
      // Build generation relative to root
      generationMap = new Map();
      const ancestors = this.getAncestors(rootPersonId);
      generationMap.set(rootPersonId, 0);
      for (const a of ancestors) generationMap.set(a.personId, a.generation);
      const descendants = this.getDescendants(rootPersonId);
      for (const d of descendants) {
        if (!generationMap.has(d.personId)) generationMap.set(d.personId, -d.generation);
      }
    } else {
      generationMap = new Map();
    }

    for (const p of this.tree.persons.values()) {
      const birthYear = p.birth?.date?.year;
      const deathYear = p.death?.date?.year;
      let age: number | undefined;

      if (birthYear && deathYear) age = deathYear - birthYear;
      else if (birthYear && !p.death) {
        // Estimate if born >120 years ago
        const currentYear = new Date().getFullYear();
        if (currentYear - birthYear < 120) age = currentYear - birthYear;
      }

      results.push({
        personId: p.id,
        name: p.names[0]?.full || '[Unknown]',
        birthYear,
        deathYear,
        age,
        sex: p.sex,
        generation: generationMap.get(p.id) ?? 0,
      });
    }

    return results;
  }

  // ─── Naming Patterns ─────────────────────────────────────────

  getNamingPatterns(): Array<{ name: string; count: number; type: 'given' | 'surname' }> {
    const givenCounts = new Map<string, number>();
    const surnameCounts = new Map<string, number>();

    for (const p of this.tree.persons.values()) {
      const given = p.names[0]?.given;
      const surname = p.names[0]?.surname;
      if (given) {
        // First given name only
        const firstName = given.split(' ')[0].trim();
        if (firstName) givenCounts.set(firstName, (givenCounts.get(firstName) || 0) + 1);
      }
      if (surname) {
        surnameCounts.set(surname, (surnameCounts.get(surname) || 0) + 1);
      }
    }

    const results: Array<{ name: string; count: number; type: 'given' | 'surname' }> = [];
    for (const [name, count] of givenCounts) {
      if (count > 1) results.push({ name, count, type: 'given' });
    }
    for (const [name, count] of surnameCounts) {
      if (count > 1) results.push({ name, count, type: 'surname' });
    }

    return results.sort((a, b) => b.count - a.count);
  }

  // ─── Research Gaps ───────────────────────────────────────────

  getResearchGaps(): Array<{
    personId: string;
    name: string;
    missingBirthDate: boolean;
    missingBirthPlace: boolean;
    missingDeathDate: boolean;
    missingDeathPlace: boolean;
    missingSources: boolean;
    gapScore: number; // Higher = more gaps
  }> {
    const results = [];

    for (const p of this.tree.persons.values()) {
      const missingBirthDate = !p.birth?.date?.year;
      const missingBirthPlace = !p.birth?.place;
      const missingDeathDate = !p.death?.date?.year;
      const missingDeathPlace = !p.death?.place;
      const missingSources = p.sources.length === 0;

      const gapScore = [missingBirthDate, missingBirthPlace, missingDeathDate,
        missingDeathPlace, missingSources].filter(Boolean).length;

      results.push({
        personId: p.id,
        name: p.names[0]?.full || '[Unknown]',
        missingBirthDate,
        missingBirthPlace,
        missingDeathDate,
        missingDeathPlace,
        missingSources,
        gapScore,
      });
    }

    return results.sort((a, b) => b.gapScore - a.gapScore);
  }

  // ─── Overview Analytics ──────────────────────────────────────

  getOverviewAnalytics() {
    let personsWithData = 0;
    let personsWithErrors = 0;
    let personsConnected = 0;

    let totalLifespans = 0;
    let lifespanCount = 0;

    let earliestAncestor: { name: string; year: number } | null = null;
    let longestLife: { name: string; age: number } | null = null;
    let largestFamily: { parents: string; count: number } | null = null;

    for (const p of this.tree.persons.values()) {
      // Coverage
      if (p.birth?.date || p.birth?.place || p.death?.date || p.death?.place) {
        personsWithData++;
      }

      // Integrity
      const bYear = p.birth?.date?.year;
      const dYear = p.death?.date?.year;
      if (bYear && dYear && (dYear < bYear || dYear - bYear > 115)) {
        personsWithErrors++;
      }

      // Connections
      if (p.familiesAsChild.length > 0 || p.familiesAsSpouse.length > 0) {
        personsConnected++;
      }

      // Lifespan & Earliest
      if (bYear && dYear && dYear >= bYear && dYear - bYear < 120) {
        const age = dYear - bYear;
        totalLifespans += age;
        lifespanCount++;
        if (!longestLife || age > longestLife.age) {
          longestLife = { name: p.names[0]?.full || 'Unknown', age };
        }
      }
      if (bYear) {
        if (!earliestAncestor || bYear < earliestAncestor.year) {
          earliestAncestor = { name: p.names[0]?.full || 'Unknown', year: bYear };
        }
      }
    }

    let familiesWithChildren = 0;
    let totalChildren = 0;

    for (const fam of this.tree.families.values()) {
      if (fam.children.length > 0) {
        familiesWithChildren++;
        totalChildren += fam.children.length;
        if (!largestFamily || fam.children.length > largestFamily.count) {
          const h = fam.husband ? this.tree.persons.get(fam.husband)?.names[0]?.given : 'Unknown';
          const w = fam.wife ? this.tree.persons.get(fam.wife)?.names[0]?.given : 'Unknown';
          largestFamily = { parents: `${h} & ${w}`, count: fam.children.length };
        }
      }
    }

    const total = this.tree.persons.size || 1;
    const coverage = Math.round((personsWithData / total) * 100);
    const integrity = Math.round(((total - personsWithErrors) / total) * 100);
    const connections = Math.round((personsConnected / total) * 100);

    const avgLifespan = lifespanCount > 0 ? Math.round(totalLifespans / lifespanCount) : 0;
    const avgChildren = familiesWithChildren > 0 ? (totalChildren / familiesWithChildren).toFixed(1) : '0';

    // Top Locations
    const locationCounts = new Map<string, number>();
    for (const p of this.tree.persons.values()) {
      if (p.birth?.place) {
        const country = p.birth.place.split(',').pop()?.trim();
        if (country) {
          locationCounts.set(country, (locationCounts.get(country) || 0) + 1);
        }
      }
    }
    const topLocations = Array.from(locationCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top Surnames
    const surnameCounts = new Map<string, number>();
    for (const p of this.tree.persons.values()) {
      const surname = p.names[0]?.surname;
      if (surname) surnameCounts.set(surname, (surnameCounts.get(surname) || 0) + 1);
    }
    const topSurnames = Array.from(surnameCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      health: { coverage, integrity, connections },
      avgLifespan,
      earliestAncestor,
      longestLife,
      largestFamily,
      avgChildren,
      topLocations,
      topSurnames,
    };
  }

  getAncestorDepth(personId: string): number {
    let maxDepth = 0;
    const visited = new Set<string>();
    const dfs = (id: string, depth: number) => {
      if (visited.has(id)) return;
      visited.add(id);
      maxDepth = Math.max(maxDepth, depth);
      const node = this.nodes.get(id);
      if (node) {
        for (const parentId of node.parents) {
          dfs(parentId, depth + 1);
        }
      }
      visited.delete(id);
    };
    dfs(personId, 0);
    return maxDepth;
  }

  getDescendantDepth(personId: string): number {
    let maxDepth = 0;
    const visited = new Set<string>();
    const dfs = (id: string, depth: number) => {
      if (visited.has(id)) return;
      visited.add(id);
      maxDepth = Math.max(maxDepth, depth);
      const node = this.nodes.get(id);
      if (node) {
        for (const childId of node.children) {
          dfs(childId, depth + 1);
        }
      }
      visited.delete(id);
    };
    dfs(personId, 0);
    return maxDepth;
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function formatCousinLabel(degree: number, removal: number): string {
  const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  const ord = ordinals[degree] || `${degree}th`;
  if (removal === 0) return `${ord} cousin`;
  return `${ord} cousin ${removal}× removed`;
}

function describeRelationship(path: string[], graph: TreeGraph): string {
  if (path.length === 1) return 'Same person';
  if (path.length === 2) {
    const a = graph.getNode(path[0]);
    const b = graph.getNode(path[1]);
    if (!a || !b) return 'Related';
    if (a.children.includes(path[1])) return 'Parent';
    if (a.parents.includes(path[1])) return 'Child';
    if (a.spouses.includes(path[1])) return 'Spouse';
  }
  return `${path.length - 1} step${path.length > 2 ? 's' : ''} apart`;
}
