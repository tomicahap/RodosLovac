import { GedcomTree, GedcomPerson } from '../parser/gedcomTypes';
import { TreeGraph } from '../parser/treeGraph';

export interface ExtremeRecord {
  id: string;
  name: string;
  value: number | string;
  detail?: string;
}

export interface GenBreakdown {
  label: string;
  found: number;
  expected?: number;
}

export interface TreeAtAGlance {
  totalAncestors: number;
  totalDescendants: number;
  grandparentsKnown: number;
  uniqueSurnames: number;
  uniqueCountries: number;
  earliestAncestor: ExtremeRecord | null;
  longestLived: ExtremeRecord | null;
  immigrants: number;
  repeatedAncestors: number;
  largestFamily: ExtremeRecord | null;
  deepestLine: ExtremeRecord | null;
  youngestMother: ExtremeRecord | null;
  oldestFather: ExtremeRecord | null;
  ancestorsBreakdown: GenBreakdown[];
  descendantsBreakdown: GenBreakdown[];
}

export interface NetworkEvent {
  personId: string;
  name: string;
  eventType: 'Rođenje' | 'Smrt' | 'Vjenčanje';
  year: number;
  yearsAgo: number;
  relation: string;
}

export interface CousinGroup {
  degree: number;
  removal: number;
  direction: 'Ascending' | 'Descending' | 'Same';
  side: 'Paternal' | 'Maternal' | 'Both';
  count: number;
  persons: { id: string; name: string }[];
}

export interface CousinBreakdown {
  directLine: { gen: number; count: number; persons: { id: string; name: string }[] }[];
  collateral: { type: string; count: number }[];
  cousinMatrix: CousinGroup[];
}

export interface MissingAncestor {
  generation: number;
  relation: string;
  missingSide: 'M' | 'F';
}

export interface DossierEvent {
  type: string;
  title: string;
  date: string;
  place: string;
  description: string;
}

export interface PersonDossier {
  events: DossierEvent[];
  notes: string[];
  parents: string[];
  spouses: string[];
  children: string[];
}

export interface PersonDeepStats {
  treeAtAGlance: TreeAtAGlance;
  onThisDate: NetworkEvent[];
  cousinBreakdown: CousinBreakdown;
  missingAncestors: MissingAncestor[];
  dossier: PersonDossier;
  absoluteMaxGenerations: number;
}

const tagToTitle = (tag: string) => {
  const map: Record<string, string> = {
    BIRT: 'Rođenje', DEAT: 'Smrt', CHR: 'Krštenje', BURI: 'Pokop',
    MARR: 'Vjenčanje', DIV: 'Razvod', RESI: 'Prebivalište', OCCU: 'Zanimanje',
    RELI: 'Religija', IMMI: 'Imigracija', EMIG: 'Emigracija', EDUC: 'Obrazovanje',
    PROB: 'Oporuka', CENS: 'Popis stanovništva', NATU: 'Naturalizacija', BAPM: 'Krštenje (BAPM)'
  };
  return map[tag] || tag;
};

const genToLabel = (gen: number) => {
  const labels: Record<number, string> = {
    1: 'Roditelji', 2: 'Bake i djedovi', 3: 'Pradjedovi', 4: 'Šukundjedovi',
    5: 'Navrndjedovi (5G)', 6: 'Kurđeli (6G)', 7: 'Askurdjeli (7G)', 8: 'Kurlebala (8G)'
  };
  return labels[gen] || `${gen}. Generacija`;
};

const descGenToLabel = (gen: number) => {
  const labels: Record<number, string> = {
    1: 'Djeca', 2: 'Unuci', 3: 'Praunuci', 4: 'Šukununuci', 5: 'Bijela pčela (5G)'
  };
  return labels[gen] || `${gen}. Generacija`;
};

export function computePersonDeepStats(personId: string, tree: GedcomTree, graph: TreeGraph, maxGenerations: number = 8): PersonDeepStats {
  const currentYear = 2026;
  const person = tree.persons.get(personId);
  if (!person) return null as any;

  const absoluteAncestors = graph.getAncestorDistances(personId, 100);
  const absoluteMaxGenerations = absoluteAncestors.size > 0 ? Math.max(...Array.from(absoluteAncestors.values())) : 0;

  // 1. Traverse Ancestors & Descendants up to maxGenerations
  const ancestors = graph.getAncestorDistances(personId, maxGenerations);
  
  const descendantsSet = new Set<string>();
  const descDistances = new Map<string, number>();
  const descRaw = graph.getDescendants(personId, maxGenerations);
  descRaw.forEach(d => {
    descendantsSet.add(d.personId);
    descDistances.set(d.personId, d.generation);
  });

  // Breakdowns
  const ancBreakdown: GenBreakdown[] = [];
  for (let g = 1; g <= maxGenerations; g++) {
    let count = 0;
    ancestors.forEach((dist) => { if (dist === g) count++; });
    if (count > 0 || g <= 4) {
      ancBreakdown.push({ label: genToLabel(g), found: count, expected: Math.pow(2, g) });
    }
  }

  const descBreakdownMap = new Map<number, number>();
  descDistances.forEach((dist) => {
    descBreakdownMap.set(dist, (descBreakdownMap.get(dist) || 0) + 1);
  });
  const descBreakdown: GenBreakdown[] = Array.from(descBreakdownMap.entries())
    .sort((a,b) => a[0] - b[0])
    .map(([gen, count]) => ({ label: descGenToLabel(gen), found: count }));

  // Build Tree at a Glance
  let gpCount = 0;
  for (const [_, dist] of ancestors.entries()) {
    if (dist === 2) gpCount++;
  }

  const surnames = new Set<string>();
  const countries = new Set<string>();
  
  let earliestYear = 9999;
  let earliestAncestor: ExtremeRecord | null = null;
  
  let maxAge = -1;
  let longestLived: ExtremeRecord | null = null;

  let minMotherAge = 999;
  let youngestMother: ExtremeRecord | null = null;

  let maxFatherAge = -1;
  let oldestFather: ExtremeRecord | null = null;

  let maxChildren = -1;
  let largestFamily: ExtremeRecord | null = null;

  let repeatedAncestors = 0;
  const seenAncestorIds = new Set<string>();

  for (const fam of tree.families.values()) {
    const h = fam.husband;
    const w = fam.wife;
    const connected = (h && (ancestors.has(h) || descendantsSet.has(h))) || 
                      (w && (ancestors.has(w) || descendantsSet.has(w))) ||
                      fam.children.some(c => ancestors.has(c) || descendantsSet.has(c) || c === personId);
    
    if (connected) {
      if (fam.children.length > maxChildren) {
        maxChildren = fam.children.length;
        const hName = h ? tree.persons.get(h)?.names[0]?.full : '';
        const wName = w ? tree.persons.get(w)?.names[0]?.full : '';
        largestFamily = {
          id: fam.id,
          name: `${hName || '?'} & ${wName || '?'}`,
          value: maxChildren,
          detail: 'djece'
        };
      }

      const wPerson = w ? tree.persons.get(w) : null;
      const hPerson = h ? tree.persons.get(h) : null;

      for (const cid of fam.children) {
        const child = tree.persons.get(cid);
        if (!child || !child.birth?.date?.year) continue;
        const cYear = child.birth.date.year;

        if (wPerson && wPerson.birth?.date?.year) {
          const age = cYear - wPerson.birth.date.year;
          if (age >= 12 && age < minMotherAge) {
            minMotherAge = age;
            youngestMother = { id: w || '', name: wPerson.names[0]?.full || '', value: age, detail: `pri rođenju (${cYear})` };
          }
        }

        if (hPerson && hPerson.birth?.date?.year) {
          const age = cYear - hPerson.birth.date.year;
          if (age > maxFatherAge && age < 90) {
            maxFatherAge = age;
            oldestFather = { id: h || '', name: hPerson.names[0]?.full || '', value: age, detail: `pri rođenju (${cYear})` };
          }
        }
      }
    }
  }

  let deepestDist = 0;
  let deepestSurname = '';

  for (const [ancId, dist] of ancestors.entries()) {
    if (seenAncestorIds.has(ancId)) {
      repeatedAncestors++;
    }
    seenAncestorIds.add(ancId);

    const anc = tree.persons.get(ancId);
    if (!anc) continue;

    if (dist > deepestDist) {
      deepestDist = dist;
      deepestSurname = anc.names[0]?.surname || deepestSurname;
    }

    if (anc.names[0]?.surname) surnames.add(anc.names[0].surname);
    if (anc.birth?.place) {
      const parts = anc.birth.place.split(',');
      const country = parts[parts.length - 1].trim();
      countries.add(country);
    }

    const by = anc.birth?.date?.year;
    if (by && by < earliestYear) {
      earliestYear = by;
      earliestAncestor = { id: anc.id, name: anc.names[0]?.full || '', value: by };
    }

    const dy = anc.death?.date?.year;
    if (by && dy && dy >= by) {
      const age = dy - by;
      if (age > maxAge && age < 120) {
        maxAge = age;
        longestLived = { id: anc.id, name: anc.names[0]?.full || '', value: age, detail: `${by}–${dy}` };
      }
    }
  }

  let immigrants = 0;
  const ancCountries = new Map<string, string>();
  for (const ancId of ancestors.keys()) {
    const anc = tree.persons.get(ancId);
    if (anc?.birth?.place) {
       ancCountries.set(ancId, anc.birth.place.split(',').pop()?.trim() || '');
    }
  }

  for (const ancId of ancestors.keys()) {
    const anc = tree.persons.get(ancId);
    if (!anc) continue;
    const myCountry = ancCountries.get(ancId);
    if (!myCountry) continue;
    
    let isImmigrant = false;
    for (const pid of (anc._parents || [])) {
      const pCountry = ancCountries.get(pid);
      if (pCountry && pCountry !== myCountry) {
        isImmigrant = true; break;
      }
    }
    if (isImmigrant) immigrants++;
  }

  const treeAtAGlance: TreeAtAGlance = {
    totalAncestors: ancestors.size,
    totalDescendants: descendantsSet.size,
    grandparentsKnown: gpCount,
    uniqueSurnames: surnames.size,
    uniqueCountries: countries.size,
    earliestAncestor,
    longestLived,
    immigrants,
    repeatedAncestors,
    largestFamily,
    deepestLine: deepestDist > 0 ? { id: '', name: deepestSurname, value: deepestDist, detail: 'generacija' } : null,
    youngestMother,
    oldestFather,
    ancestorsBreakdown: ancBreakdown,
    descendantsBreakdown: descBreakdown
  };

  // 2. On This Date
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const onThisDate: NetworkEvent[] = [];
  
  const closeNetwork = new Set<string>([personId]);
  ancestors.forEach((_, id) => closeNetwork.add(id));
  descendantsSet.forEach(id => closeNetwork.add(id));
  person._parents?.forEach(pid => {
    const p = tree.persons.get(pid);
    p?._children?.forEach(cid => closeNetwork.add(cid));
  });

  for (const netId of closeNetwork) {
    const p = tree.persons.get(netId);
    if (!p) continue;
    
    const checkEvent = (date: any, type: any) => {
      if (date && date.month === currentMonth && date.day === currentDay && date.year) {
        onThisDate.push({
          personId: netId,
          name: p.names[0]?.full || '',
          eventType: type,
          year: date.year,
          yearsAgo: currentYear - date.year,
          relation: netId === personId ? 'Odabrana osoba' : ancestors.has(netId) ? 'Predak' : descendantsSet.has(netId) ? 'Potomak' : 'Srodnik'
        });
      }
    };

    checkEvent(p.birth?.date, 'Rođenje');
    checkEvent(p.death?.date, 'Smrt');
    p.events.filter(e => e.tag === 'MARR').forEach(e => {
      checkEvent(e.date, 'Vjenčanje');
    });
  }

  // 3. Cousin Breakdown
  const allCousins = graph.findCousins(personId, Math.min(5, maxGenerations));
  const matrixMap = new Map<string, CousinGroup>();
  
  const fatherId = person._parents?.find(id => tree.persons.get(id)?.sex === 'M');
  const motherId = person._parents?.find(id => tree.persons.get(id)?.sex === 'F');
  const paternalAncestors = fatherId ? graph.getAncestorDistances(fatherId, maxGenerations) : new Map<string, number>();
  const maternalAncestors = motherId ? graph.getAncestorDistances(motherId, maxGenerations) : new Map<string, number>();
  if (fatherId) paternalAncestors.set(fatherId, 0);
  if (motherId) maternalAncestors.set(motherId, 0);

  allCousins.forEach(c => {
    const theirDistances = graph.getAncestorDistances(c.personId, maxGenerations);
    let mrcaId = null;
    let minCombined = 999;
    let myD = 0; let theirD = 0;
    
    for (const [aid, dist] of ancestors.entries()) {
      if (theirDistances.has(aid)) {
        const tDist = theirDistances.get(aid)!;
        if (dist + tDist < minCombined) {
          minCombined = dist + tDist;
          mrcaId = aid;
          myD = dist;
          theirD = tDist;
        }
      }
    }
    
    if (!mrcaId) return;

    let direction: 'Same' | 'Ascending' | 'Descending' = 'Same';
    let side: 'Paternal' | 'Maternal' | 'Both' = 'Both';

    if (myD > theirD) direction = 'Ascending';
    else if (theirD > myD) direction = 'Descending';
    
    if (mrcaId) {
      if (paternalAncestors.has(mrcaId) && !maternalAncestors.has(mrcaId)) side = 'Paternal';
      else if (maternalAncestors.has(mrcaId) && !paternalAncestors.has(mrcaId)) side = 'Maternal';
    }

    const key = `${c.degree}-${c.removal}-${direction}-${side}`;
    if (!matrixMap.has(key)) {
      matrixMap.set(key, {
        degree: c.degree,
        removal: c.removal,
        direction,
        side,
        count: 0,
        persons: []
      });
    }
    
    const group = matrixMap.get(key)!;
    group.count++;
    const cPerson = tree.persons.get(c.personId);
    group.persons.push({ id: c.personId, name: cPerson?.names[0]?.full || '' });
  });

  const cousinBreakdown: CousinBreakdown = {
    directLine: Array.from({length: Math.min(absoluteMaxGenerations, maxGenerations)}, (_, i) => i + 1).map(gen => {
      let count = 0;
      const genPersons: { id: string; name: string }[] = [];
      ancestors.forEach((dist, id) => { 
        if (dist === gen) {
          count++;
          genPersons.push({ id, name: tree.persons.get(id)?.names[0]?.full || '' });
        }
      });
      return { gen, count, persons: genPersons };
    }),
    collateral: [
      { type: 'Braća i sestre', count: (person._parents || []).reduce((acc, pid) => acc + (tree.persons.get(pid)?._children?.length || 1) - 1, 0) / 2 }
    ],
    cousinMatrix: Array.from(matrixMap.values()).sort((a,b) => a.degree - b.degree || a.removal - b.removal)
  };

  // 4. Missing Ancestors
  const missingAncestors: MissingAncestor[] = [];
  const queue: { id: string; gen: number; pathName: string }[] = [{ id: personId, gen: 0, pathName: person.names[0]?.full || 'Fokalna osoba' }];
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.gen >= maxGenerations) continue;
    
    const p = tree.persons.get(node.id);
    if (!p) continue;

    const fId = p._parents?.find(id => tree.persons.get(id)?.sex === 'M');
    const mId = p._parents?.find(id => tree.persons.get(id)?.sex === 'F');

    if (!fId) {
      missingAncestors.push({ generation: node.gen + 1, relation: `Otac od ${node.pathName}`, missingSide: 'M' });
    } else {
      queue.push({ id: fId, gen: node.gen + 1, pathName: tree.persons.get(fId)?.names[0]?.full || '' });
    }

    if (!mId) {
      missingAncestors.push({ generation: node.gen + 1, relation: `Majka od ${node.pathName}`, missingSide: 'F' });
    } else {
      queue.push({ id: mId, gen: node.gen + 1, pathName: tree.persons.get(mId)?.names[0]?.full || '' });
    }
  }

  missingAncestors.sort((a, b) => a.generation - b.generation);

  // 5. Person Dossier
  const events: DossierEvent[] = [];
  
  if (person.birth) events.push({ type: 'BIRT', title: tagToTitle('BIRT'), date: person.birth.date?.display || '', place: person.birth.place || '', description: person.birth.value || '' });
  if (person.death) events.push({ type: 'DEAT', title: tagToTitle('DEAT'), date: person.death.date?.display || '', place: person.death.place || '', description: person.death.value || '' });
  
  for (const ev of person.events) {
    events.push({
      type: ev.tag,
      title: tagToTitle(ev.tag),
      date: ev.date?.display || '',
      place: ev.place || '',
      description: ev.value || ev.note || ''
    });
  }

  const dossier: PersonDossier = {
    events,
    notes: person.notes.map(nid => tree.notes.get(nid)?.text || '').filter(Boolean),
    parents: (person._parents || []).map(id => tree.persons.get(id)?.names[0]?.full || ''),
    spouses: (person._spouses || []).map(id => tree.persons.get(id)?.names[0]?.full || ''),
    children: (person._children || []).map(id => tree.persons.get(id)?.names[0]?.full || '')
  };

  return {
    treeAtAGlance,
    onThisDate,
    cousinBreakdown,
    missingAncestors,
    dossier,
    absoluteMaxGenerations
  };
}
