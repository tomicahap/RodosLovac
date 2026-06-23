import type { GedcomTree, GedcomPerson, GedcomFamily } from '../parser/gedcomTypes';

export interface CalendarEvent {
  personId: string;
  name: string;
  type: 'BIRT' | 'DEAT' | 'MARR';
  dateStr: string;
  yearOriginal: number | null;
  daysFromNow: number;
  ageOrAnniversary: number;
}

export interface NotableFacts {
  earliestAncestor: { year: number; personId: string; name: string } | null;
  longestLife: { years: number; personId: string; name: string } | null;
  largestFamily: { count: number; parents: string; ids: string[] } | null;
  avgChildren: number;
  totalFamilies: number;
  recordsSpan: { min: number; max: number; diff: number } | null;
  uniqueLocationsCount: number;
}

export interface ResearchScore {
  score: number; // 0-100
  duplicatesCount: number;
  duplicateIds: string[];
  brickWallsCount: number;
  brickWallIds: string[];
  pedigreeCollapseLevel: 'Low' | 'Medium' | 'High';
}

export interface DashboardData {
  thisWeekEvents: CalendarEvent[];
  notableFacts: NotableFacts;
  researchScore: ResearchScore;
}

export function computeDashboardData(tree: GedcomTree): DashboardData {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const currentYear = today.getFullYear();

  function getDaysDiff(eMonth: number, eDay: number) {
    const eDate = new Date(currentYear, eMonth - 1, eDay, 12, 0, 0, 0);
    let diff = Math.round((eDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      const nextYearDate = new Date(currentYear + 1, eMonth - 1, eDay, 12, 0, 0, 0);
      diff = Math.round((nextYearDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    return diff;
  }

  const thisWeekEvents: CalendarEvent[] = [];
  let earliestAncestor: NotableFacts['earliestAncestor'] = null;
  let longestLife: NotableFacts['longestLife'] = null;
  let largestFamily: NotableFacts['largestFamily'] = null;
  
  let totalChildren = 0;
  const birthPlaces = new Set<string>();
  let minYear = 9999;
  let maxYear = 0;

  // For Research Score
  const signatureMap = new Map<string, string[]>();
  let brickWallsCount = 0;
  const brickWallIds: string[] = [];

  const updateMinMax = (y?: number) => {
    if (y) {
      if (y < minYear) minYear = y;
      if (y > maxYear) maxYear = y;
    }
  };

  for (const [id, p] of tree.persons) {
    const nameStr = p.names[0]?.full || 'Nepoznato';
    const bYear = p.birth?.date?.year;
    const dYear = p.death?.date?.year;

    updateMinMax(bYear);
    updateMinMax(dYear);

    // Earliest
    if (bYear && (!earliestAncestor || bYear < earliestAncestor.year)) {
      earliestAncestor = { year: bYear, personId: id, name: nameStr };
    }

    // Longest Life
    if (bYear && dYear && dYear >= bYear) {
      let age = dYear - bYear;
      const bMonth = p.birth?.date?.month;
      const bDay = p.birth?.date?.day;
      const dMonth = p.death?.date?.month;
      const dDay = p.death?.date?.day;
      if (bMonth && dMonth) {
        if (dMonth < bMonth || (dMonth === bMonth && dDay && bDay && dDay < bDay)) {
          age--;
        }
      }
      if (!longestLife || age > longestLife.years) {
        longestLife = { years: age, personId: id, name: nameStr };
      }
    }

    // Birth Places
    if (p.birth?.place) {
      birthPlaces.add(p.birth.place);
    }

    // This week (BIRT / DEAT)
    if (p.birth?.date?.month && p.birth?.date?.day) {
      const d = getDaysDiff(p.birth.date.month, p.birth.date.day);
      if (d >= 0 && d <= 7) {
        thisWeekEvents.push({
          personId: id,
          name: nameStr,
          type: 'BIRT',
          dateStr: `${p.birth.date.day}. ${p.birth.date.month}.`,
          yearOriginal: bYear || null,
          daysFromNow: d,
          ageOrAnniversary: bYear ? currentYear - bYear : 0
        });
      }
    }
    if (p.death?.date?.month && p.death?.date?.day) {
      const d = getDaysDiff(p.death.date.month, p.death.date.day);
      if (d >= 0 && d <= 7) {
        thisWeekEvents.push({
          personId: id,
          name: nameStr,
          type: 'DEAT',
          dateStr: `${p.death.date.day}. ${p.death.date.month}.`,
          yearOriginal: dYear || null,
          daysFromNow: d,
          ageOrAnniversary: dYear ? currentYear - dYear : 0
        });
      }
    }

    // Research Score: Duplicates
    if (bYear && p.names[0]) {
      const given = (p.names[0].given || '').slice(0, 4).toLowerCase();
      const sur = (p.names[0].surname || '').slice(0, 4).toLowerCase();
      if (given && sur) {
        const sig = `${given}-${sur}-${bYear}`;
        if (!signatureMap.has(sig)) signatureMap.set(sig, []);
        signatureMap.get(sig)!.push(id);
      }
    }

    // Research Score: Brick Walls
    if (bYear && bYear > 1850 && p.familiesAsChild.length === 0) {
      brickWallsCount++;
      brickWallIds.push(id);
    }
  }

  // Families
  for (const [id, fam] of tree.families) {
    const cCount = fam.children.length;
    totalChildren += cCount;

    if (!largestFamily || cCount > largestFamily.count) {
      const hName = fam.husband ? tree.persons.get(fam.husband)?.names[0]?.full : '?';
      const wName = fam.wife ? tree.persons.get(fam.wife)?.names[0]?.full : '?';
      largestFamily = {
        count: cCount,
        parents: `${hName} i ${wName}`,
        ids: [fam.husband, fam.wife].filter(Boolean) as string[]
      };
    }

    // This week (MARR)
    if (fam.marriage?.date?.month && fam.marriage?.date?.day) {
      const d = getDaysDiff(fam.marriage.date.month, fam.marriage.date.day);
      if (d >= 0 && d <= 7) {
        const hName = fam.husband ? tree.persons.get(fam.husband)?.names[0]?.full : '?';
        const wName = fam.wife ? tree.persons.get(fam.wife)?.names[0]?.full : '?';
        const mYear = fam.marriage.date.year;
        thisWeekEvents.push({
          personId: fam.husband || fam.wife || id,
          name: `${hName} i ${wName}`,
          type: 'MARR',
          dateStr: `${fam.marriage.date.day}. ${fam.marriage.date.month}.`,
          yearOriginal: mYear || null,
          daysFromNow: d,
          ageOrAnniversary: mYear ? currentYear - mYear : 0
        });
      }
    }
  }

  thisWeekEvents.sort((a, b) => a.daysFromNow - b.daysFromNow);

  // Research computations
  let duplicatesCount = 0;
  const duplicateIds: string[] = [];
  for (const ids of signatureMap.values()) {
    if (ids.length > 1) {
      duplicatesCount += ids.length;
      duplicateIds.push(...ids);
    }
  }

  // Simple pedagogical collapse heuristic
  const totalP = tree.persons.size || 1;
  const uniqueSurnames = new Set(Array.from(tree.persons.values()).map(p => p.names[0]?.surname?.toLowerCase()).filter(Boolean)).size;
  const diversityRatio = uniqueSurnames / totalP;
  let pedigreeCollapseLevel: 'Low' | 'Medium' | 'High' = 'Low';
  if (diversityRatio < 0.1) pedigreeCollapseLevel = 'High';
  else if (diversityRatio < 0.25) pedigreeCollapseLevel = 'Medium';

  const penaltyDup = Math.min(30, (duplicatesCount / totalP) * 100 * 2);
  const penaltyBrick = Math.min(40, (brickWallsCount / totalP) * 100);
  let rScore = Math.max(0, Math.round(100 - penaltyDup - penaltyBrick));
  if (pedigreeCollapseLevel === 'High') rScore = Math.max(0, rScore - 10);

  return {
    thisWeekEvents,
    notableFacts: {
      earliestAncestor,
      longestLife,
      largestFamily,
      avgChildren: tree.families.size > 0 ? Number((totalChildren / tree.families.size).toFixed(1)) : 0,
      totalFamilies: tree.families.size,
      recordsSpan: minYear <= maxYear && maxYear > 0 ? { min: minYear, max: maxYear, diff: maxYear - minYear } : null,
      uniqueLocationsCount: birthPlaces.size
    },
    researchScore: {
      score: rScore,
      duplicatesCount,
      duplicateIds,
      brickWallsCount,
      brickWallIds,
      pedigreeCollapseLevel
    }
  };
}
