import { GedcomTree, GedcomPerson } from '../parser/gedcomTypes';

export type EventCategory = 'Personal' | 'Family' | 'Work' | 'Migration' | 'Census';
export type EventType = 
  | 'Birth' | 'Death' | 'Marriage' | 'Burial' | 'Census' | 'Employment' | 'Residence' 
  | 'ChildBirth' | 'ParentDeath' | 'SiblingBirth' | 'SiblingDeath' | 'Other';

export interface TimelineEvent {
  id: string; // unique ID for React keys
  year: number; // sort key
  dateStr: string;
  age: number | null; // age of focal person at the time
  type: EventType;
  category: EventCategory;
  title: string;
  personName?: string; // If event is about a relative
  personId?: string;
  location?: string;
  description?: string;
  yearsSincePrevious?: number; // Calculated after sorting
}

// Helper to extract year from partial date
const extractYear = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
};

// Map GEDCOM tags to our EventTypes
const tagToEventType = (tag: string): { type: EventType, category: EventCategory, title: string } | null => {
  switch (tag) {
    case 'BURI': return { type: 'Burial', category: 'Personal', title: 'Pokop' };
    case 'CENS': return { type: 'Census', category: 'Census', title: 'Popis stanovništva' };
    case 'RESI': return { type: 'Residence', category: 'Migration', title: 'Promjena prebivališta' };
    case 'OCCU': 
    case 'EMPL': return { type: 'Employment', category: 'Work', title: 'Zaposlenje' };
    case 'MARR': return { type: 'Marriage', category: 'Family', title: 'Brak' };
    case 'DIV': return { type: 'Other', category: 'Family', title: 'Razvod' };
    case 'CHR': return { type: 'Birth', category: 'Personal', title: 'Krštenje' };
    case 'PROB': return { type: 'Other', category: 'Personal', title: 'Oporuka' };
    case 'WILL': return { type: 'Other', category: 'Personal', title: 'Oporuka' };
    case 'GRAD': return { type: 'Other', category: 'Personal', title: 'Diploma' };
    case 'EMIG': return { type: 'Residence', category: 'Migration', title: 'Emigracija' };
    case 'IMMI': return { type: 'Residence', category: 'Migration', title: 'Imigracija' };
    default: return null;
  }
};

export const generateTimeline = (personId: string, tree: GedcomTree, includeSiblings: boolean = false): TimelineEvent[] => {
  const person = tree.persons.get(personId);
  if (!person) return [];

  const events: TimelineEvent[] = [];
  let eventCounter = 0;
  
  const birthYear = person.birth?.date?.year || extractYear(person.birth?.date?.display) || null;
  const deathYear = person.death?.date?.year || extractYear(person.death?.date?.display) || null;

  const pushEvent = (
    year: number, dateStr: string, type: EventType, category: EventCategory, 
    title: string, location?: string, description?: string, 
    relName?: string, relId?: string
  ) => {
    // Only include events during the person's lifetime (or birth/death themselves)
    if (birthYear && year < birthYear && type !== 'Birth') return;
    if (deathYear && year > deathYear && type !== 'Death' && type !== 'Burial') return;

    let age: number | null = null;
    if (birthYear) {
      age = year - birthYear;
      if (age < 0) age = 0;
    }

    events.push({
      id: `${type}-${year}-${eventCounter++}`,
      year,
      dateStr,
      age,
      type,
      category,
      title,
      location,
      description,
      personName: relName,
      personId: relId
    });
  };

  // 1. Personal Events
  if (person.birth?.date?.display) {
    const year = person.birth.date.year || extractYear(person.birth.date.display);
    if (year) pushEvent(year, person.birth.date.display, 'Birth', 'Personal', 'Rođenje', person.birth.place);
  }
  if (person.death?.date?.display) {
    const year = person.death.date.year || extractYear(person.death.date.display);
    if (year) pushEvent(year, person.death.date.display, 'Death', 'Personal', 'Smrt', person.death.place);
  }
  
  for (const ev of person.events) {
    const year = ev.date?.year || extractYear(ev.date?.display);
    if (!year) continue;
    const mapping = tagToEventType(ev.tag);
    if (mapping) {
      pushEvent(year, ev.date?.display || '', mapping.type, mapping.category, mapping.title, ev.place, ev.value);
    }
  }

  // 2. Marriages
  if (person.familiesAsSpouse) {
    for (const famId of person.familiesAsSpouse) {
      const fam = tree.families.get(famId);
      if (fam && fam.marriage?.date?.display) {
        const mYear = fam.marriage.date.year || extractYear(fam.marriage.date.display);
        if (mYear) {
          const spouseId = fam.husband === person.id ? fam.wife : fam.husband;
          const spouseName = spouseId ? tree.persons.get(spouseId)?.names[0]?.full : undefined;
          pushEvent(mYear, fam.marriage.date.display, 'Marriage', 'Family', 'Brak', fam.marriage.place, undefined, spouseName, spouseId);
        }
      }
    }
  }

  // 3. Children Births
  if (person.familiesAsSpouse) {
    for (const famId of person.familiesAsSpouse) {
      const fam = tree.families.get(famId);
      if (fam && fam.children) {
        for (const childId of fam.children) {
          const child = tree.persons.get(childId);
          if (child) {
            const cYear = child.birth?.date?.year || extractYear(child.birth?.date?.display);
            if (cYear && child.birth?.date?.display) {
              pushEvent(cYear, child.birth.date.display, 'ChildBirth', 'Family', 'Rođenje djeteta', child.birth.place, undefined, child.names[0]?.full, child.id);
            }
          }
        }
      }
    }
  }

  // 4. Parents Death
  if (person.familiesAsChild) {
    for (const famId of person.familiesAsChild) {
      const fam = tree.families.get(famId);
      if (fam) {
        const parents = [fam.husband, fam.wife].filter(Boolean) as string[];
        for (const pId of parents) {
          const parent = tree.persons.get(pId);
          if (parent) {
            const dYear = parent.death?.date?.year || extractYear(parent.death?.date?.display);
            if (dYear && parent.death?.date?.display) {
              const relation = pId === fam.husband ? 'oca' : 'majke';
              pushEvent(dYear, parent.death.date.display, 'ParentDeath', 'Family', `Smrt ${relation}`, parent.death.place, undefined, parent.names[0]?.full, parent.id);
            }
          }
        }
      }
    }
  }

  // 5. Siblings (Optional)
  if (includeSiblings && person.familiesAsChild) {
    for (const famId of person.familiesAsChild) {
      const fam = tree.families.get(famId);
      if (fam && fam.children) {
        for (const sibId of fam.children) {
          if (sibId === person.id) continue;
          const sib = tree.persons.get(sibId);
          if (sib) {
            const sBYear = sib.birth?.date?.year || extractYear(sib.birth?.date?.display);
            if (sBYear && sib.birth?.date?.display) {
              pushEvent(sBYear, sib.birth.date.display, 'SiblingBirth', 'Family', 'Rođenje brata/sestre', sib.birth.place, undefined, sib.names[0]?.full, sib.id);
            }
            const sDYear = sib.death?.date?.year || extractYear(sib.death?.date?.display);
            if (sDYear && sib.death?.date?.display) {
              pushEvent(sDYear, sib.death.date.display, 'SiblingDeath', 'Family', 'Smrt brata/sestre', sib.death.place, undefined, sib.names[0]?.full, sib.id);
            }
          }
        }
      }
    }
  }

  // Sort chronologically
  events.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    // Secondary sort: Birth should always come first in a year, Death last
    if (a.type === 'Birth') return -1;
    if (b.type === 'Birth') return 1;
    if (a.type === 'Death' || a.type === 'Burial') return 1;
    if (b.type === 'Death' || b.type === 'Burial') return -1;
    return 0;
  });

  // Calculate gaps
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].year - events[i - 1].year;
    events[i].yearsSincePrevious = gap > 0 ? gap : 0;
  }

  return events;
};
