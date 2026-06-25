import { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';

export type Confidence = 'STRONG' | 'LIKELY' | 'POSSIBLE';

export interface Evidence {
  childId: string;
  childName: string;
  childBirthYear?: number;
  ancestorId?: string;
  ancestorName: string;
  ancestorBirthYear?: number;
  role: string;
  patternId: string;
  confidence: Confidence;
}

export interface PatternExample extends Evidence {}

export interface PatternResult {
  id: string;
  name: string;
  desc: string;
  eligibleFamilies: number;
  matches: number;
  examples: PatternExample[];
}

export interface DeathPredictionInsight {
  ancestorId: string;
  ancestorName: string;
  sex: 'M' | 'F' | 'U' | 'X';
  lastKnownYear: number;
  predictedDeathYearUpperBound: number;
  predictedYear: number;
  confidence: Confidence;
  descendantNamesakes: Evidence[];
  insightText: string;
}

export interface NamingHighlights {
  mostReusedNames: { name: string; count: number }[];
  mostCommemorated: { ancestorId: string; name: string; count: number } | null;
  totalConnections: number;
  strongConnections: number;
  likelyConnections: number;
  coveragePercent: number;
}

export interface NamingAnalysisResult {
  patterns: PatternResult[];
  allEvidences: Evidence[];
  highlights: NamingHighlights;
  deathPredictions: DeathPredictionInsight[];
}

const getSimilarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;
  const aBigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.substring(i, i + 2).toLowerCase();
    aBigrams.set(bg, (aBigrams.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.substring(i, i + 2).toLowerCase();
    const count = aBigrams.get(bg);
    if (count && count > 0) {
      aBigrams.set(bg, count - 1);
      intersection++;
    }
  }
  return (2.0 * intersection) / (a.length + b.length - 2);
};

const normalizeName = (s?: string) => (s || '').toLowerCase().replace(/[^a-zčćđšž]/g, '').trim();

function getMatchConfidence(n1?: string, n2?: string): Confidence | null {
  if (!n1 || !n2) return null;
  const getFirst = (s: string) => s.split(/[\s-]/)[0] || s;
  const a = normalizeName(getFirst(n1));
  const b = normalizeName(getFirst(n2));
  if (!a || !b) return null;
  
  if (a === b) return 'STRONG';
  
  const sim = getSimilarity(a, b);
  if (sim >= 0.8 || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)))) return 'LIKELY';
  if (sim >= 0.6) return 'POSSIBLE';
  
  return null;
}

function getGiven(p: GedcomPerson | undefined): string | undefined {
  return p?.names[0]?.given || p?.names[0]?.full;
}

export function analyzeNamingPatterns(tree: GedcomTree): NamingAnalysisResult {
  const p1: PatternResult = { id: 'O1', name: 'Prvi sin po očevoj liniji', desc: 'Prvorođeni sin dobiva ime po ocu, djedu ili pradjedu s očeve strane.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p2: PatternResult = { id: 'O2', name: 'Drugi sin po očevoj liniji', desc: 'Drugorođeni sin dobiva ime po ocu, djedu ili pradjedu s očeve strane.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p3: PatternResult = { id: 'O3', name: 'Prvi sin po majčinoj liniji', desc: 'Prvorođeni sin dobiva ime po djedu ili pradjedu s majčine strane.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p4: PatternResult = { id: 'O4', name: 'Drugi sin po majčinoj liniji', desc: 'Drugorođeni sin dobiva ime po djedu ili pradjedu s majčine strane.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p5: PatternResult = { id: 'O5', name: 'Prva kći po majčinoj liniji', desc: 'Prvorođena kći dobiva ime po majci, baki ili prabaki s majčine strane.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p6: PatternResult = { id: 'O6', name: 'Druga kći po majčinoj liniji', desc: 'Drugorođena kći dobiva ime po majci, baki ili prabaki s majčine strane.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p7: PatternResult = { id: 'O7', name: 'Prva kći po očevoj liniji', desc: 'Prvorođena kći dobiva ime po baki ili prabaki s očeve strane.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p8: PatternResult = { id: 'O8', name: 'Druga kći po očevoj liniji', desc: 'Drugorođena kći dobiva ime po baki ili prabaki s očeve strane.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p9: PatternResult = { id: 'O9', name: 'Recikliranje imena', desc: 'Kada dijete umre rano, iduće dijete istog spola često dobiva isto ime.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p10: PatternResult = { id: 'O10', name: 'Komemorativno imenovanje', desc: 'Dijete dobiva ime po baki ili djedu koji su umrli u zadnjih 5 godina.', eligibleFamilies: 0, matches: 0, examples: [] };
  const p11: PatternResult = { id: 'O11', name: 'Imenovanje po kumu/kumi', desc: 'Dijete dobiva ime po svojem kumu na krštenju.', eligibleFamilies: 0, matches: 0, examples: [] };

  const fams = Array.from(tree.families.values());
  const allEvidences: Evidence[] = [];
  const familiesWithCandidate = new Set<string>();

  const pushEv = (p: PatternResult, ev: Evidence) => {
    p.matches++;
    p.examples.push(ev);
    allEvidences.push(ev);
  };

  for (const fam of fams) {
    if (!fam.children || fam.children.length === 0) continue;

    const husb = fam.husband ? tree.persons.get(fam.husband) : undefined;
    const wife = fam.wife ? tree.persons.get(fam.wife) : undefined;

    const childrenObj = fam.children.map(cid => tree.persons.get(cid)).filter(Boolean) as GedcomPerson[];
    const validChildren = childrenObj.filter(c => c.birth?.date?.year);
    validChildren.sort((a, b) => (a.birth!.date!.year! - b.birth!.date!.year!));
    
    const sons = validChildren.filter(c => c.sex === 'M');
    const daus = validChildren.filter(c => c.sex === 'F');

    const husbParents = husb?._parents ? (tree.persons.get(husb._parents[0])?._parents?.map(pid => tree.persons.get(pid)) || []) : [];
    const wifeParents = wife?._parents ? (tree.persons.get(wife._parents[0])?._parents?.map(pid => tree.persons.get(pid)) || []) : [];
    
    const husbFather = husbParents?.find(p => p?.sex === 'M');
    const husbMother = husbParents?.find(p => p?.sex === 'F');
    const wifeFather = wifeParents?.find(p => p?.sex === 'M');
    const wifeMother = wifeParents?.find(p => p?.sex === 'F');

    const getParentsOf = (p: GedcomPerson | undefined) => p?._parents ? (tree.persons.get(p._parents[0])?._parents?.map(pid => tree.persons.get(pid)) || []) : [];
    
    const husbGrandfathers = [husb, husbFather, ...getParentsOf(husbFather), ...getParentsOf(husbMother)].filter(p => p?.sex === 'M');
    const husbGrandmothers = [husbMother, ...getParentsOf(husbFather), ...getParentsOf(husbMother)].filter(p => p?.sex === 'F');
    
    const wifeGrandfathers = [wifeFather, ...getParentsOf(wifeFather), ...getParentsOf(wifeMother)].filter(p => p?.sex === 'M');
    const wifeGrandmothers = [wife, wifeMother, ...getParentsOf(wifeFather), ...getParentsOf(wifeMother)].filter(p => p?.sex === 'F');

    let famHasCandidates = false;

    const checkChild = (child: GedcomPerson | undefined, candidates: (GedcomPerson | undefined)[], pattern: PatternResult, roleName: string) => {
      if (!child) return;
      const validCands = candidates.filter(Boolean) as GedcomPerson[];
      if (validCands.length === 0) return;
      
      pattern.eligibleFamilies++; 
      famHasCandidates = true;
      
      for (const cand of validCands) {
        const conf = getMatchConfidence(getGiven(child), getGiven(cand));
        if (conf && conf !== 'POSSIBLE') { // We only count Strong/Likely as solid pattern match
          pushEv(pattern, {
            childId: child.id, childName: child.names[0]?.full || '', childBirthYear: child.birth?.date?.year,
            ancestorId: cand.id, ancestorName: cand.names[0]?.full || '', ancestorBirthYear: cand.birth?.date?.year,
            role: roleName, patternId: pattern.id, confidence: conf
          });
          return;
        }
      }
    };

    checkChild(sons[0], husbGrandfathers, p1, 'predak po ocu');
    checkChild(sons[1], husbGrandfathers, p2, 'predak po ocu');
    checkChild(sons[0], wifeGrandfathers, p3, 'djed/pradjed po majci');
    checkChild(sons[1], wifeGrandfathers, p4, 'djed/pradjed po majci');
    checkChild(daus[0], wifeGrandmothers, p5, 'predak po majci');
    checkChild(daus[1], wifeGrandmothers, p6, 'predak po majci');
    checkChild(daus[0], husbGrandmothers, p7, 'baka/prabaka po ocu');
    checkChild(daus[1], husbGrandmothers, p8, 'baka/prabaka po ocu');

    // O9: Recikliranje imena
    let hasDeadChild = false;
    for (let i = 0; i < validChildren.length - 1; i++) {
      const c1 = validChildren[i];
      if (c1.birth?.date?.year && c1.death?.date?.year) {
        const lifespan = c1.death.date.year - c1.birth.date.year;
        if (lifespan < 10) {
          hasDeadChild = true;
          const nextOfSex = validChildren.slice(i + 1).find(c => c.sex === c1.sex);
          if (nextOfSex) {
            const conf = getMatchConfidence(getGiven(nextOfSex), getGiven(c1));
            if (conf && conf !== 'POSSIBLE') {
              pushEv(p9, {
                childId: nextOfSex.id, childName: nextOfSex.names[0]?.full || '', childBirthYear: nextOfSex.birth?.date?.year,
                ancestorId: c1.id, ancestorName: c1.names[0]?.full || '', ancestorBirthYear: c1.birth?.date?.year,
                role: 'pokojni brat/sestra', patternId: p9.id, confidence: conf
              });
              break;
            }
          }
        }
      }
    }
    if (hasDeadChild) { p9.eligibleFamilies++; famHasCandidates = true; }

    // O10: Komemorativno imenovanje
    const gps = [husbFather, husbMother, wifeFather, wifeMother].filter(Boolean) as GedcomPerson[];
    if (validChildren.length > 0 && gps.some(g => g.death?.date?.year)) {
      p10.eligibleFamilies++;
      famHasCandidates = true;
      for (const c of validChildren) {
        if (!c.birth?.date?.year) continue;
        const bYear = c.birth.date.year;
        const commemGp = gps.find(g => {
          if (!g.death?.date?.year) return false;
          const diff = bYear - g.death.date.year;
          return diff >= 0 && diff <= 5;
        });

        if (commemGp) {
          const conf = getMatchConfidence(getGiven(c), getGiven(commemGp));
          if (conf && conf !== 'POSSIBLE') {
            pushEv(p10, {
              childId: c.id, childName: c.names[0]?.full || '', childBirthYear: bYear,
              ancestorId: commemGp.id, ancestorName: commemGp.names[0]?.full || '', ancestorBirthYear: commemGp.birth?.date?.year,
              role: 'nedavno preminuli predak', patternId: p10.id, confidence: conf
            });
            break;
          }
        }
      }
    }

    // O11: Po kumu/kumi
    let famHasGodparents = false;
    for (const c of childrenObj) {
      const bapm = c.events.find(e => (e.tag === 'BAPM' || e.tag === 'CHR') && e.godparents && e.godparents.length > 0);
      if (bapm && bapm.godparents) {
        famHasGodparents = true;
        for (const gpStr of bapm.godparents) {
          const conf = getMatchConfidence(getGiven(c), gpStr);
          if (conf && conf !== 'POSSIBLE') {
            pushEv(p11, {
              childId: c.id, childName: c.names[0]?.full || '', childBirthYear: c.birth?.date?.year,
              ancestorName: gpStr, role: 'kum na krštenju',
              patternId: p11.id, confidence: conf
            });
            break;
          }
        }
      }
    }
    if (famHasGodparents) { p11.eligibleFamilies++; famHasCandidates = true; }
    
    if (famHasCandidates) familiesWithCandidate.add(fam.id);
  }

  const patterns = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11];
  patterns.sort((a, b) => {
    const pA = a.eligibleFamilies ? a.matches / a.eligibleFamilies : 0;
    const pB = b.eligibleFamilies ? b.matches / b.eligibleFamilies : 0;
    return pB - pA;
  });

  // Calculate Highlights
  const allGivenNames = Array.from(tree.persons.values()).map(p => normalizeName(getGiven(p))).filter(Boolean);
  const nameCounts = new Map<string, number>();
  for (const n of allGivenNames) {
    if (n) nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
  }
  const mostReusedNames = Array.from(nameCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }));

  const ancestorCounts = new Map<string, {name: string, count: number}>();
  for (const ev of allEvidences) {
    if (ev.ancestorId && ev.patternId !== 'O9') { // exclude siblings for commemorated
      const ex = ancestorCounts.get(ev.ancestorId) || { name: ev.ancestorName, count: 0 };
      ex.count++;
      ancestorCounts.set(ev.ancestorId, ex);
    }
  }
  let mostCommemorated = null;
  let maxCount = 0;
  for (const [id, data] of ancestorCounts.entries()) {
    if (data.count > maxCount) { maxCount = data.count; mostCommemorated = { ancestorId: id, name: data.name, count: maxCount }; }
  }

  const coveragePercent = fams.length > 0 ? (familiesWithCandidate.size / fams.length) * 100 : 0;
  const strongConnections = allEvidences.filter(e => e.confidence === 'STRONG').length;
  const likelyConnections = allEvidences.filter(e => e.confidence === 'LIKELY').length;

  const highlights: NamingHighlights = {
    mostReusedNames, mostCommemorated,
    totalConnections: allEvidences.length, strongConnections, likelyConnections, coveragePercent
  };

  // Calculate Average Lifespan (for Bayes Prior)
  let totalLifespan = 0;
  let adultsCount = 0;
  for (const p of Array.from(tree.persons.values())) {
    if (p.birth?.date?.year && p.death?.date?.year) {
      const span = p.death.date.year - p.birth.date.year;
      if (span >= 18) {
        totalLifespan += span;
        adultsCount++;
      }
    }
  }
  const averageLifespan = adultsCount > 0 ? Math.round(totalLifespan / adultsCount) : 65;

  // Calculate Death Predictions
  const deathPredictions: DeathPredictionInsight[] = [];
  
  // DFS to get all descendants up to depth 3
  const getDescendants = (personId: string, depth: number): GedcomPerson[] => {
    if (depth === 0) return [];
    const p = tree.persons.get(personId);
    if (!p || !p._children) return [];
    let desc: GedcomPerson[] = [];
    for (const cid of p._children) {
      const child = tree.persons.get(cid);
      if (child) {
        desc.push(child);
        desc = desc.concat(getDescendants(cid, depth - 1));
      }
    }
    return desc;
  };

  const getLastKnownYear = (p: GedcomPerson): number | undefined => {
    let maxYear = p.birth?.date?.year || undefined;
    for (const e of p.events) {
      if (e.date?.year && (!maxYear || e.date.year > maxYear)) maxYear = e.date.year;
    }
    if (p._children) {
      for (const cid of p._children) {
        const c = tree.persons.get(cid);
        if (c?.birth?.date?.year) {
           const y = c.birth.date.year;
           const eventYear = p.sex === 'M' ? y - 1 : y;
           if (!maxYear || eventYear > maxYear) maxYear = eventYear;
        }
      }
    }
    return maxYear;
  };

  for (const person of Array.from(tree.persons.values())) {
    if (person.death?.date?.year) continue;
    
    const gMin = getLastKnownYear(person);
    if (!gMin) continue;

    const birthYear = person.birth?.date?.year;
    if (gMin > 1920 || (birthYear && birthYear > 1920)) continue; 
    
    let gMax = (birthYear || (gMin - 35)) + 100;
    
    const descs = getDescendants(person.id, 3);
    const validNamesakes: Evidence[] = [];
    
    for (const d of descs) {
      if (!d.birth?.date?.year) continue;
      const conf = getMatchConfidence(getGiven(d), getGiven(person));
      if (conf) {
        validNamesakes.push({
          childId: d.id, childName: d.names[0]?.full || '', childBirthYear: d.birth.date.year,
          ancestorId: person.id, ancestorName: person.names[0]?.full || '', ancestorBirthYear: person.birth?.date?.year,
          role: 'potomak', patternId: 'DEATH_PREDICT', confidence: conf
        });
      }
    }

    validNamesakes.sort((a, b) => (a.childBirthYear || 0) - (b.childBirthYear || 0));

    let clusterWeight = 0;
    let namesakePeakYear = 0;
    let hasCommemoration = false;

    if (validNamesakes.length > 0) {
      const firstNamesakeYear = validNamesakes[0].childBirthYear!;
      if (firstNamesakeYear < gMax) {
         gMax = firstNamesakeYear;
      }

      let maxClusterSize = 0;
      for (let i = 0; i < validNamesakes.length; i++) {
         const startYear = validNamesakes[i].childBirthYear!;
         const cluster = validNamesakes.filter(n => n.childBirthYear! >= startYear && n.childBirthYear! <= startYear + 5);
         const branches = new Set(cluster.map(n => tree.persons.get(n.childId)?._parents?.[0] || n.childId));
         
         if (branches.size > maxClusterSize && branches.size > 1) {
           maxClusterSize = branches.size;
           namesakePeakYear = startYear;
         }
      }

      if (maxClusterSize > 1) {
         hasCommemoration = true;
         clusterWeight = maxClusterSize;
      }
    }

    if (gMax < gMin) gMax = gMin;

    const assumedBirth = birthYear || (gMin - 35);
    const historicalExpectedDeath = assumedBirth + averageLifespan;
    
    let predictedYear = 0;
    
    if (hasCommemoration && namesakePeakYear >= gMin) {
      const densityTarget = namesakePeakYear - 1;
      const w1 = 1;
      const w2 = clusterWeight * 2;
      predictedYear = Math.round((historicalExpectedDeath * w1 + densityTarget * w2) / (w1 + w2));
    } else {
      predictedYear = historicalExpectedDeath;
    }

    if (predictedYear < gMin) predictedYear = gMin;
    if (predictedYear > gMax) predictedYear = gMax;

    const conf: Confidence = hasCommemoration ? 'STRONG' : (validNamesakes.length > 0 ? 'LIKELY' : 'POSSIBLE');
    const linesCount = new Set(validNamesakes.map(n => tree.persons.get(n.childId)?._parents?.[0])).size;

    const insightText = `Dokazano živ/a u ${gMin}. ` +
      (hasCommemoration ? `Pronađena "eksplozija komemoracije" počevši oko ${namesakePeakYear}. g. kroz ${linesCount} obiteljske linije. ` : 
      (validNamesakes.length > 0 ? `Pronađeno ${validNamesakes.length} kasnijih imenjaka. ` : '')) +
      `Prosječan životni vijek odraslih u vašem stablu je ${averageLifespan} godina. Na temelju toga Bayesov model postavlja najvjerojatniju godinu smrti oko ${predictedYear}.`;

    deathPredictions.push({
      ancestorId: person.id, ancestorName: person.names[0]?.full || '', sex: person.sex,
      lastKnownYear: gMin, predictedDeathYearUpperBound: gMax, predictedYear,
      confidence: conf, descendantNamesakes: validNamesakes,
      insightText
    });
  }

  // Sort death predictions by confidence and density
  deathPredictions.sort((a, b) => {
    if (a.confidence === 'STRONG' && b.confidence !== 'STRONG') return -1;
    if (a.confidence !== 'STRONG' && b.confidence === 'STRONG') return 1;
    return b.descendantNamesakes.length - a.descendantNamesakes.length;
  });

  return { patterns, allEvidences, highlights, deathPredictions };
}
