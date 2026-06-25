import { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';

export interface CommonAncestorPair {
  ancestor1Id: string;
  ancestor1Name: string;
  ancestor2Id?: string;
  ancestor2Name?: string;
  distanceHusband: number;
  distanceWife: number;
}

export interface DNAImpact {
  totalActualCm: number;
  totalTypicalCm: number;
  totalExtraCm: number;
  commonAncestorNames: string;
}

export interface ConsanguineousMarriage {
  familyId: string;
  husbandId: string;
  husbandName: string;
  husbandYears: string;
  wifeId: string;
  wifeName: string;
  wifeYears: string;
  marriageYear?: number;
  children: { id: string, name: string, birthYear: string }[];
  childrenCount: number;
  fValue: number;
  relationshipName: string;
  sDegree: number;
  commonAncestorPairs: CommonAncestorPair[];
  dnaImpact: DNAImpact;
}

export interface PedigreeCollapseResult {
  totalMarriages: number;
  marriages: ConsanguineousMarriage[];
  relationshipCounts: Record<string, number>;
}

// Mapiranje udaljenosti (n, m) u hrvatski naziv srodstva
function getRelationshipName(s: number): string {
  if (s < 4) return 'Blisko srodstvo (1. - 3. stupanj)';
  if (s === 4) return 'Prvi bratići / sestrične';
  if (s === 5) return 'Prvi i drugi bratići (koljeno i pol)';
  if (s === 6) return 'Drugi bratići / sestrične';
  if (s === 7) return 'Drugi i treći bratići';
  if (s === 8) return 'Treći bratići / sestrične';
  return 'Udaljeno srodstvo';
}

function getDnaImpact(s: number): { typical: number, extra: number, actual: number } {
  let typical = 0;
  let extra = 0;
  if (s < 4) { typical = 1750; extra = 218; }
  else if (s === 4) { typical = 875; extra = 109; }
  else if (s === 5) { typical = 438; extra = 54; }
  else if (s === 6) { typical = 218; extra = 27; }
  else if (s === 7) { typical = 109; extra = 14; }
  else if (s === 8) { typical = 54; extra = 7; }
  
  return { typical, extra, actual: typical + extra };
}

function getYears(p: GedcomPerson): string {
  const by = p.birth?.date?.year || '?';
  const dy = p.death?.date?.year || '?';
  if (by === '?' && dy === '?') return '';
  return `${by}–${dy}`;
}

export function analyzePedigreeCollapse(tree: GedcomTree): PedigreeCollapseResult {
  const results: ConsanguineousMarriage[] = [];
  const relationshipCounts: Record<string, number> = {};

  const getAncestors = (startId: string): Map<string, number[]> => {
    const ancestors = new Map<string, number[]>();
    const queue: [string, number][] = [[startId, 0]];
    
    while (queue.length > 0) {
      const [currentId, dist] = queue.shift()!;
      const currentPerson = tree.persons.get(currentId);
      if (!currentPerson || !currentPerson._parents) continue;

      for (const parentId of currentPerson._parents) {
        const nextDist = dist + 1;
        if (!ancestors.has(parentId)) {
          ancestors.set(parentId, []);
        }
        const existingDists = ancestors.get(parentId)!;
        if (!existingDists.includes(nextDist) && nextDist <= 12) {
          existingDists.push(nextDist);
          queue.push([parentId, nextDist]);
        }
      }
    }
    return ancestors;
  };

  for (const fam of Array.from(tree.families.values())) {
    if (!fam.husband || !fam.wife) continue;

    const husband = tree.persons.get(fam.husband);
    const wife = tree.persons.get(fam.wife);
    
    if (!husband || !wife) continue;

    const husbandAncestors = getAncestors(husband.id);
    const wifeAncestors = getAncestors(wife.id);

    const commonAncestorIds = new Set<string>();
    let fValue = 0;

    let totalActualCm = 0;
    let totalTypicalCm = 0;
    let totalExtraCm = 0;
    const commonNamesSet = new Set<string>();

    let bestS = 999;
    let bestN1 = 999;
    let bestN2 = 999;

    for (const [ancId, hDists] of husbandAncestors.entries()) {
      if (wifeAncestors.has(ancId)) {
        commonAncestorIds.add(ancId);
        const wDists = wifeAncestors.get(ancId)!;
        
        const hMin = Math.min(...hDists);
        const wMin = Math.min(...wDists);
        const s = hMin + wMin;

        if (s < bestS) {
          bestS = s;
          bestN1 = hMin;
          bestN2 = wMin;
        }

        for (const hd of hDists) {
          for (const wd of wDists) {
            fValue += Math.pow(0.5, hd + wd + 1);
          }
        }
      }
    }

    // Odbacujemo sve što je udaljenije od 8. stupnja (Treći bratići)
    if (bestS > 8) continue;

    if (commonAncestorIds.size > 0) {
      const dnaStats = getDnaImpact(bestS);
      totalTypicalCm = dnaStats.typical;
      totalExtraCm = dnaStats.extra;
      totalActualCm = dnaStats.actual;
      const processedAncestors = new Set<string>();
      const pairs: CommonAncestorPair[] = [];
      
      for (const ancId of commonAncestorIds) {
        if (processedAncestors.has(ancId)) continue;
        
        const anc = tree.persons.get(ancId);
        if (!anc) continue;

        const hDist = Math.min(...husbandAncestors.get(ancId)!);
        const wDist = Math.min(...wifeAncestors.get(ancId)!);
        
        let spouseId: string | undefined;
        let spouseName: string | undefined;

        if (anc.familiesAsSpouse) {
          for (const spFamId of anc.familiesAsSpouse) {
            const spFam = tree.families.get(spFamId);
            if (spFam) {
              const potentialSpouseId = anc.sex === 'M' ? spFam.wife : spFam.husband;
              if (potentialSpouseId && commonAncestorIds.has(potentialSpouseId)) {
                spouseId = potentialSpouseId;
                spouseName = tree.persons.get(potentialSpouseId)?.names[0]?.full;
                break;
              }
            }
          }
        }

        processedAncestors.add(ancId);
        let nameCombined = anc.names[0]?.full || 'Nepoznato';
        if (spouseId) {
          processedAncestors.add(spouseId);
          nameCombined += ` & ${spouseName}`;
        }
        commonNamesSet.add(nameCombined);

        pairs.push({
          ancestor1Id: ancId,
          ancestor1Name: anc.names[0]?.full || 'Nepoznato',
          ancestor2Id: spouseId,
          ancestor2Name: spouseName,
          distanceHusband: hDist,
          distanceWife: wDist
        });
      }

      const relationshipName = getRelationshipName(bestS);
      relationshipCounts[relationshipName] = (relationshipCounts[relationshipName] || 0) + 1;

      const childrenList = (fam.children || []).map((cid: string) => {
        const c = tree.persons.get(cid);
        return {
          id: cid,
          name: c?.names[0]?.full || 'Nepoznato',
          birthYear: c?.birth?.date?.year?.toString() || '?'
        };
      });

      results.push({
        familyId: fam.id,
        husbandId: husband.id,
        husbandName: husband.names[0]?.full || 'Nepoznat Muškarac',
        husbandYears: getYears(husband),
        wifeId: wife.id,
        wifeName: wife.names[0]?.full || 'Nepoznata Žena',
        wifeYears: getYears(wife),
        marriageYear: fam.marriage?.date?.year,
        children: childrenList,
        childrenCount: childrenList.length,
        fValue: fValue,
        relationshipName: relationshipName,
        sDegree: bestS,
        commonAncestorPairs: pairs,
        dnaImpact: {
          totalActualCm: totalActualCm,
          totalTypicalCm: totalTypicalCm,
          totalExtraCm: totalExtraCm,
          commonAncestorNames: Array.from(commonNamesSet).join(', ')
        }
      });
    }
  }

  results.sort((a, b) => b.fValue - a.fValue);

  return {
    totalMarriages: results.length,
    marriages: results,
    relationshipCounts
  };
}
