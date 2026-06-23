import type { GedcomTree, GedcomPerson, GedcomFamily } from './gedcomTypes';

export interface ValidationItem {
  id: string; // e.g. ERR_01
  level: 'error' | 'warning' | 'suggestion';
  personId: string;
  name: string;
  description: string;
}

export interface TreeHealthReport {
  score: number;      // 0-100
  grade: string;
  gradeText: string;
  metrics: {
    coverage: number;   // 0-100
    evidence: number;   // 0-100
    integrity: number;  // 0-100
    connections: number;// 0-100
  };
  actions: {
    title: string;
    description: string;
    count: number;
    priority: number;
    personIds: string[];
  }[];
}

export interface ValidationResult {
  items: ValidationItem[];
  errors: ValidationItem[]; // For backward compatibility with existing modals
  warnings: ValidationItem[]; // For backward compatibility
  suggestions: ValidationItem[];
  healthReport: TreeHealthReport;
  coverage: { // For backward compatibility
    totalPersons: number;
    withBirthDate: number;
    missingBirthDateIds: string[];
    withBirthPlace: number;
    missingBirthPlaceIds: string[];
    deceasedCount: number;
    withDeathDate: number;
    missingDeathDateIds: string[];
    withDeathPlace: number;
    missingDeathPlaceIds: string[];
  };
  evidence: { // For backward compatibility
    sourcedCount: number;
    sourcedIds: string[];
    unsourcedCount: number;
    unsourcedIds: string[];
  };
}

export function runValidation(tree: GedcomTree): ValidationResult {
  const items: ValidationItem[] = [];

  let withBirthDate = 0;
  const missingBirthDateIds: string[] = [];
  let withBirthPlace = 0;
  const missingBirthPlaceIds: string[] = [];
  let deceasedCount = 0;
  let withDeathDate = 0;
  const missingDeathDateIds: string[] = [];
  let withDeathPlace = 0;
  const missingDeathPlaceIds: string[] = [];
  let sourcedCount = 0;
  const sourcedIds: string[] = [];
  let unsourcedCount = 0;
  let connectedCount = 0;

  const currentYear = new Date().getFullYear();

  // Helper to check if a person is considered deceased
  const isDeceased = (p: GedcomPerson) => {
    if (p.death) return true;
    if (p.events.some(e => ['BURI', 'CREM', 'PROB', 'WILL'].includes(e.tag))) return true;
    if (p.birth?.date?.year && currentYear - p.birth.date.year > 115) return true;
    return false;
  };

  const hasKeyData = (p: GedcomPerson) => {
    return !!(p.names[0]?.full && p.birth?.date?.year && p.birth?.place);
  };

  let personsWithKeyData = 0;
  let personsWithEvidence = 0;
  const missingEvidenceIds: string[] = [];
  const missingKeyDataIds: string[] = [];

  for (const [id, p] of tree.persons) {
    const nameStr = p.names[0]?.full || '[Unknown]';
    const bYear = p.birth?.date?.year;
    const dYear = p.death?.date?.year;

    // Coverage & Evidence stats
    if (bYear) {
      withBirthDate++;
    } else {
      missingBirthDateIds.push(id);
    }
    
    if (p.birth?.place) {
      withBirthPlace++;
    } else {
      missingBirthPlaceIds.push(id);
    }
    
    const dead = isDeceased(p);
    if (dead) {
      deceasedCount++;
      if (dYear) {
        withDeathDate++;
      } else {
        missingDeathDateIds.push(id);
      }
      if (p.death?.place) {
        withDeathPlace++;
      } else {
        missingDeathPlaceIds.push(id);
      }
    }

    if (p.sources.length > 0 || p.events.some(e => e.tag === 'OBJE')) {
      sourcedCount++;
      sourcedIds.push(id);
      personsWithEvidence++;
    } else {
      unsourcedCount++;
      missingEvidenceIds.push(id);
    }

    if (hasKeyData(p)) {
      personsWithKeyData++;
    } else {
      missingKeyDataIds.push(id);
    }

    if (p.familiesAsChild.length > 0 || p.familiesAsSpouse.length > 0) {
      connectedCount++;
    }

    // ERR_01: Birth after death
    if (bYear && dYear && bYear > dYear) {
      items.push({ id: 'ERR_01', level: 'error', personId: id, name: nameStr, description: `Rođenje (${bYear}) je kronološki kasnije od datuma smrti (${dYear}).` });
    }

    // ERR_02: Baptism before birth / Burial before death
    const bapEvent = p.events.find(e => e.tag === 'BAPM' || e.tag === 'CHR');
    if (bYear && bapEvent?.date?.year && bapEvent.date.year < bYear) {
      items.push({ id: 'ERR_02', level: 'error', personId: id, name: nameStr, description: `Krštenje (${bapEvent.date.year}) zabilježeno prije rođenja (${bYear}).` });
    }
    const buriEvent = p.events.find(e => e.tag === 'BURI');
    if (dYear && buriEvent?.date?.year && buriEvent.date.year < dYear) {
      items.push({ id: 'ERR_02', level: 'error', personId: id, name: nameStr, description: `Pokop (${buriEvent.date.year}) zabilježen prije smrti (${dYear}).` });
    }

    // WRN_03: Improbable lifespan > 100
    if (bYear && dYear && (dYear - bYear > 100)) {
      items.push({ id: 'WRN_03', level: 'warning', personId: id, name: nameStr, description: `Životni vijek iznosi preko 100 godina (${dYear - bYear} god) bez oznake verifikacije.` });
    }

    // WRN_06: Missing sex
    if (!p.sex || p.sex === 'U') {
      items.push({ id: 'WRN_06', level: 'warning', personId: id, name: nameStr, description: `Osoba nema definiran spol, što onemogućuje točne provjere majka/otac uloga.` });
    }

    // WRN_07: Person without dates
    if (!bYear && !dYear) {
      items.push({ id: 'WRN_07', level: 'warning', personId: id, name: nameStr, description: `Osoba postoji u sustavu, ali nema zabilježen ni datum rođenja ni datum smrti.` });
    }

    // SUG_03: Auto deceased status
    if (!p.death && bYear && (currentYear - bYear > 110)) {
      items.push({ id: 'SUG_03', level: 'suggestion', personId: id, name: nameStr, description: `Osoba je rođena prije više od 110 godina (${bYear}). Predlaže se automatska promjena statusa u "Preminuo".` });
    }
  }

  // Families / Connections checks
  for (const fam of tree.families.values()) {
    const husband = fam.husband ? tree.persons.get(fam.husband) : undefined;
    const wife = fam.wife ? tree.persons.get(fam.wife) : undefined;
    const mYear = fam.marriage?.date?.year;
    const divYear = fam.divorce?.date?.year;

    if (husband && wife) {
      const hBirth = husband.birth?.date?.year;
      const wBirth = wife.birth?.date?.year;
      const hDeath = husband.death?.date?.year;
      const wDeath = wife.death?.date?.year;

      // ERR_06: Marriage after death
      if (mYear && hDeath && mYear > hDeath) items.push({ id: 'ERR_06', level: 'error', personId: husband.id, name: husband.names[0].full, description: `Brak (${mYear}) zabilježen nakon smrti (${hDeath}).` });
      if (mYear && wDeath && mYear > wDeath) items.push({ id: 'ERR_06', level: 'error', personId: wife.id, name: wife.names[0].full, description: `Brak (${mYear}) zabilježen nakon smrti (${wDeath}).` });

      // ERR_07: Divorce before marriage
      if (mYear && divYear && divYear < mYear) {
        items.push({ id: 'ERR_07', level: 'error', personId: husband.id, name: `${husband.names[0].full} i ${wife.names[0].full}`, description: `Razvod (${divYear}) kronološki zabilježen prije braka (${mYear}).` });
      }

      // WRN_04: Underage marriage
      if (mYear && hBirth && mYear - hBirth < 14) items.push({ id: 'WRN_04', level: 'warning', personId: husband.id, name: husband.names[0].full, description: `Brak sklopljen s manje od 14 godina (dob: ${mYear - hBirth}).` });
      if (mYear && wBirth && mYear - wBirth < 14) items.push({ id: 'WRN_04', level: 'warning', personId: wife.id, name: wife.names[0].full, description: `Brak sklopljen s manje od 14 godina (dob: ${mYear - wBirth}).` });

      // SUG_04: Marriage year estimation
      if (!mYear && fam.children.length > 0) {
        let firstChildBirth: number | undefined;
        fam.children.forEach(cId => {
          const c = tree.persons.get(cId);
          if (c?.birth?.date?.year) {
            if (!firstChildBirth || c.birth.date.year < firstChildBirth) firstChildBirth = c.birth.date.year;
          }
        });
        if (firstChildBirth) {
           items.push({ id: 'SUG_04', level: 'suggestion', personId: husband.id, name: `${husband.names[0].full} i ${wife.names[0].full}`, description: `Brak je vjerojatno sklopljen oko ${firstChildBirth - 1}. (1 god prije rođenja prvog djeteta).` });
        }
      }

      // SUG_05: Parent birth estimation
      if (!hBirth && fam.children.length > 0) {
        let firstChildBirth: number | undefined;
        fam.children.forEach(cId => {
          const c = tree.persons.get(cId);
          if (c?.birth?.date?.year) {
            if (!firstChildBirth || c.birth.date.year < firstChildBirth) firstChildBirth = c.birth.date.year;
          }
        });
        if (firstChildBirth) {
           items.push({ id: 'SUG_05', level: 'suggestion', personId: husband.id, name: husband.names[0].full, description: `Tražite rođenje oca oko ${firstChildBirth - 25} (cca 25 god prije rođenja prvog djeteta).` });
        }
      }
      if (!wBirth && fam.children.length > 0) {
        let firstChildBirth: number | undefined;
        fam.children.forEach(cId => {
          const c = tree.persons.get(cId);
          if (c?.birth?.date?.year) {
            if (!firstChildBirth || c.birth.date.year < firstChildBirth) firstChildBirth = c.birth.date.year;
          }
        });
        if (firstChildBirth) {
           items.push({ id: 'SUG_05', level: 'suggestion', personId: wife.id, name: wife.names[0].full, description: `Tražite rođenje majke oko ${firstChildBirth - 25} (cca 25 god prije rođenja prvog djeteta).` });
        }
      }
    }

    let lastChildYear: number | undefined;
    const sortedChildren = fam.children
      .map(id => tree.persons.get(id))
      .filter(c => c && c.birth?.date?.year)
      .sort((a, b) => (a!.birth!.date!.year! - b!.birth!.date!.year!));

    for (let i = 0; i < sortedChildren.length; i++) {
      const child = sortedChildren[i]!;
      const cYear = child.birth!.date!.year!;
      lastChildYear = cYear;

      if (wife) {
        const wBirth = wife.birth?.date?.year;
        const wDeath = wife.death?.date?.year;
        
        // ERR_03: Child born after mother's death
        if (wDeath && cYear > wDeath) {
          items.push({ id: 'ERR_03', level: 'error', personId: child.id, name: child.names[0].full, description: `Dijete rođeno (${cYear}) nakon majčine smrti (${wDeath}).` });
        }
        // ERR_05: Child born before parents
        if (wBirth && wBirth > cYear) {
          items.push({ id: 'ERR_05', level: 'error', personId: wife.id, name: wife.names[0].full, description: `Majka rođena (${wBirth}) nakon djeteta (${cYear}).` });
        }
        // WRN_01: Mother age bounds
        if (wBirth) {
          const age = cYear - wBirth;
          if (age < 13 || age > 50) {
            items.push({ id: 'WRN_01', level: 'warning', personId: wife.id, name: wife.names[0].full, description: `Majka imala neobičnu dob pri porodu (${age} god).` });
          }
        }
      }

      if (husband) {
        const hBirth = husband.birth?.date?.year;
        const hDeath = husband.death?.date?.year;

        // ERR_04: Child born > 9 months after father's death (assume year + 1 to be safe)
        if (hDeath && cYear > hDeath + 1) {
          items.push({ id: 'ERR_04', level: 'error', personId: child.id, name: child.names[0].full, description: `Dijete rođeno (${cYear}) više od 9 mjeseci nakon očeve smrti (${hDeath}).` });
        }
        // ERR_05: Child born before parents
        if (hBirth && hBirth > cYear) {
          items.push({ id: 'ERR_05', level: 'error', personId: husband.id, name: husband.names[0].full, description: `Otac rođen (${hBirth}) nakon djeteta (${cYear}).` });
        }
        // WRN_02: Father age bounds
        if (hBirth) {
          const age = cYear - hBirth;
          if (age < 14 || age > 75) {
            items.push({ id: 'WRN_02', level: 'warning', personId: husband.id, name: husband.names[0].full, description: `Otac imao neobičnu dob pri rođenju djeteta (${age} god).` });
          }
        }
      }

      // WRN_05: Child spacing < 9 months
      if (i > 0) {
        const prevChild = sortedChildren[i - 1]!;
        // Simple heuristic: same year but not same day/month could mean < 9 months,
        // but since we only have years easily accessible, if they are born in the same year, 
        // we could check months if available. If we don't have months, we skip to avoid false twins.
        const c1M = prevChild.birth?.date?.month;
        const c2M = child.birth?.date?.month;
        if (prevChild.birth!.date!.year === cYear && c1M && c2M) {
          const monthDiff = c2M - c1M;
          if (monthDiff > 0 && monthDiff < 9) {
             items.push({ id: 'WRN_05', level: 'warning', personId: wife?.id || husband?.id || fam.id, name: wife?.names[0].full || 'Obitelj', description: `Razmak između rođenja dvoje djece iznosi manje od 9 mjeseci.` });
          }
        }
      }
    }

    // SUG_01 / SUG_02
    if (wife && !wife.death?.date?.year && lastChildYear) {
       items.push({ id: 'SUG_01', level: 'suggestion', personId: wife.id, name: wife.names[0].full, description: `Pretpostavka: Majka je preminula nakon ${lastChildYear} (rođenje zadnjeg djeteta).` });
    }
    if (husband && !husband.death?.date?.year && lastChildYear) {
       items.push({ id: 'SUG_02', level: 'suggestion', personId: husband.id, name: husband.names[0].full, description: `Pretpostavka: Otac je preminuo nakon ${lastChildYear - 1} (začeće zadnjeg djeteta).` });
    }
  }

  // TODO: ERR_08 Cyclic Relationship (Obrnute generacije/Petlja) can be complex for a simple parse, skipping or doing a quick BFS if needed.

  const errors = items.filter(i => i.level === 'error');
  const warnings = items.filter(i => i.level === 'warning');
  const suggestions = items.filter(i => i.level === 'suggestion');

  // Calculate Metrics
  const totalPersons = tree.persons.size || 1;
  const coveragePercent = Math.min(100, Math.round((personsWithKeyData / totalPersons) * 100));
  const evidencePercent = Math.min(100, Math.round((personsWithEvidence / totalPersons) * 100));
  
  const errPenalty = errors.length * 3;
  const wrnPenalty = warnings.length * 0.5;
  const integrityPercent = Math.max(0, 100 - errPenalty - wrnPenalty);
  
  const connectionsPercent = Math.min(100, Math.round((connectedCount / totalPersons) * 100));

  const totalScore = Math.round(
    (coveragePercent * 0.30) + 
    (evidencePercent * 0.30) + 
    (integrityPercent * 0.30) + 
    (connectionsPercent * 0.10)
  );

  let grade: string = 'F';
  let gradeText = 'Potreban rad';

  if (totalScore >= 95) { grade = 'A+'; gradeText = 'Savršeno'; }
  else if (totalScore >= 85) { grade = 'A'; gradeText = 'Odlično'; }
  else if (totalScore >= 75) { grade = 'B+'; gradeText = 'Vrlo dobro +'; }
  else if (totalScore >= 65) { grade = 'B'; gradeText = 'Vrlo dobro'; }
  else if (totalScore >= 55) { grade = 'C+'; gradeText = 'Dobro +'; }
  else if (totalScore >= 45) { grade = 'C'; gradeText = 'Dobro'; }
  else if (totalScore >= 35) { grade = 'D+'; gradeText = 'Dovoljno +'; }
  else if (totalScore >= 25) { grade = 'D'; gradeText = 'Dovoljno'; }
  else if (totalScore >= 15) { grade = 'F+'; gradeText = 'Slabo'; }
  else { grade = 'F'; gradeText = 'Potreban rad'; }

  // Action Plan
  const actions = [];
  if (errors.length > 0) {
    actions.push({ priority: 1, title: 'Ispravite kritične pogreške', description: 'Logičke i biološke greške ruše integritet stabla.', count: errors.length, personIds: Array.from(new Set(errors.map(e => e.personId))) });
  }
  if (warnings.length > 0) {
    actions.push({ priority: 2, title: 'Pregledajte upozorenja', description: 'Provjerite sumnjive starosne dobi i nelogičnosti.', count: warnings.length, personIds: Array.from(new Set(warnings.map(w => w.personId))) });
  }
  
  if (missingEvidenceIds.length > 0) {
    actions.push({ priority: 3, title: 'Dodajte izvore i medije', description: 'Povećajte ocjenu dokaza dodavanjem GEDCOM izvora (SOUR) ili slika (OBJE).', count: missingEvidenceIds.length, personIds: missingEvidenceIds });
  }

  if (missingKeyDataIds.length > 0) {
    actions.push({ priority: 4, title: 'Popunite ključne podatke', description: 'Mnogim osobama nedostaje godina ili mjesto rođenja.', count: missingKeyDataIds.length, personIds: missingKeyDataIds });
  }

  return {
    items,
    errors,
    warnings,
    suggestions,
    healthReport: {
      score: totalScore,
      grade,
      gradeText,
      metrics: {
        coverage: coveragePercent,
        evidence: evidencePercent,
        integrity: integrityPercent,
        connections: connectionsPercent
      },
      actions
    },
    coverage: {
      totalPersons: tree.persons.size,
      withBirthDate,
      missingBirthDateIds,
      withBirthPlace,
      missingBirthPlaceIds,
      deceasedCount,
      withDeathDate,
      missingDeathDateIds,
      withDeathPlace,
      missingDeathPlaceIds,
    },
    evidence: {
      sourcedCount,
      sourcedIds,
      unsourcedCount,
      unsourcedIds: missingEvidenceIds,
    }
  };
}
