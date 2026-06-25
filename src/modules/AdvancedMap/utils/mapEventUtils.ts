import type { GedcomPerson, GedcomTree } from '../../../parser/gedcomTypes';

export type GeoEventType = 'BIRT' | 'BAPM' | 'MARR' | 'RESI' | 'DEAT' | 'BURI' | 'OTHER';

export interface PersonGeoEvent {
  personId: string;
  fullName: string;
  type: GeoEventType;
  year?: number;
  place: string;
}

export function extractPersonEvents(tree: GedcomTree, p: GedcomPerson): PersonGeoEvent[] {
  const events: PersonGeoEvent[] = [];
  const fullName = p.names[0]?.full || 'Nepoznato';

  // Helper to add
  const addEvent = (type: GeoEventType, place?: string, year?: number) => {
    if (place) {
      events.push({ personId: p.id, fullName, type, year, place });
    }
  };

  // 1. Birth
  addEvent('BIRT', p.birth?.place, p.birth?.date?.year);

  // 2. Baptism / Christening
  const bapm = p.events.find(e => e.tag === 'BAPM' || e.tag === 'CHR');
  if (bapm) addEvent('BAPM', bapm.place, bapm.date?.year);

  // 3. Marriage
  if (p.familiesAsSpouse) {
    for (const famId of p.familiesAsSpouse) {
      const fam = tree.families.get(famId);
      if (fam && fam.marriage) {
        addEvent('MARR', fam.marriage.place, fam.marriage.date?.year);
      }
    }
  }

  // 4. Residence / Other events (like Census)
  const residences = p.events.filter(e => e.tag === 'RESI' || e.tag === 'CENS');
  for (const r of residences) {
    addEvent('RESI', r.place, r.date?.year);
  }

  // 5. Death
  addEvent('DEAT', p.death?.place, p.death?.date?.year);

  // 6. Burial
  const buri = p.events.find(e => e.tag === 'BURI');
  if (buri) addEvent('BURI', buri.place, buri.date?.year);

  // Sort chronologically by year (if unknown, assume order of insertion is roughly life order)
  // We can just rely on the order above as a fallback, but let's sort by year if available
  const sorted = events.sort((a, b) => {
    if (a.year && b.year) return a.year - b.year;
    // Keep original relative order if no years (the order above is chronological BIRT -> DEAT)
    return 0;
  });

  // Deduplicate consecutive identical places (e.g. if born and baptized in same place, or married and lived there)
  const deduplicated: PersonGeoEvent[] = [];
  for (const ev of sorted) {
    if (deduplicated.length === 0) {
      deduplicated.push(ev);
    } else {
      const last = deduplicated[deduplicated.length - 1];
      if (last.place !== ev.place) {
        deduplicated.push(ev);
      }
    }
  }

  return deduplicated;
}

export function getBestBirthLikeEvent(events: PersonGeoEvent[]): PersonGeoEvent | null {
  return events.find(e => e.type === 'BIRT') || events.find(e => e.type === 'BAPM') || null;
}

export function getBestDeathLikeEvent(events: PersonGeoEvent[]): PersonGeoEvent | null {
  return events.find(e => e.type === 'DEAT') || events.find(e => e.type === 'BURI') || null;
}
