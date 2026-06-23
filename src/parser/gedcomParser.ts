// ============================================================
// GEDCOM Parser — supports 5.5 / 5.5.1 / 7.0
// Fully client-side, no server required
// ============================================================

import type {
  GedcomTree, GedcomPerson, GedcomFamily, GedcomSource, GedcomNote,
  GedcomName, GedcomEvent, GedcomDate, Sex, TreeStats
} from './gedcomTypes';

// ─── Date Parsing ────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  // Hebrew months (for GEDCOM 5.5 Hebrew calendar support)
  TSH: 1, CSH: 2, KSL: 3, TVT: 4, SHV: 5, ADR: 6,
  ADS: 7, NSN: 8, IYR: 9, SVN: 10, TMZ: 11, AAV: 12, ELL: 13,
};

const MONTH_NAMES: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
};

export function parseDate(raw: string): GedcomDate {
  const s = (raw || '').trim().toUpperCase();
  if (!s) return { raw, quality: 'unknown', display: '' };

  let rest = s;
  let quality: GedcomDate['quality'] = 'exact';
  let isBC = false;

  // Strip calendar escape
  if (rest.startsWith('@#D')) {
    const endAt = rest.indexOf('@', 3);
    if (endAt !== -1) rest = rest.slice(endAt + 1).trim();
  }

  // Between range: BET d1 AND d2
  if (rest.startsWith('BET ') || rest.startsWith('BETWEEN ')) {
    const andIdx = rest.indexOf(' AND ');
    if (andIdx !== -1) {
      const d1 = parseDate(rest.replace(/^(BET\w*)\s+/, '').split(' AND ')[0]);
      const d2 = parseDate(rest.slice(andIdx + 5));
      return {
        raw,
        quality: 'between',
        year: d1.year, month: d1.month, day: d1.day,
        yearEnd: d2.year, monthEnd: d2.month, dayEnd: d2.day,
        display: `${d1.display}–${d2.display}`,
      };
    }
  }

  // Qualifiers
  if (rest.startsWith('ABT ') || rest.startsWith('ABOUT ') || rest.startsWith('ABT.')) {
    quality = 'about';
    rest = rest.replace(/^(ABT\.?|ABOUT)\s+/, '');
  } else if (rest.startsWith('EST ') || rest.startsWith('ESTIMATED ')) {
    quality = 'estimated';
    rest = rest.replace(/^(EST\.?|ESTIMATED)\s+/, '');
  } else if (rest.startsWith('CAL ') || rest.startsWith('CALCULATED ')) {
    quality = 'calculated';
    rest = rest.replace(/^(CAL\.?|CALCULATED)\s+/, '');
  } else if (rest.startsWith('BEF ') || rest.startsWith('BEFORE ')) {
    quality = 'before';
    rest = rest.replace(/^(BEF\.?|BEFORE)\s+/, '');
  } else if (rest.startsWith('AFT ') || rest.startsWith('AFTER ')) {
    quality = 'after';
    rest = rest.replace(/^(AFT\.?|AFTER)\s+/, '');
  } else if (rest.startsWith('FROM ')) {
    quality = 'about';
    rest = rest.replace(/^FROM\s+/, '');
  } else if (rest.startsWith('TO ')) {
    quality = 'about';
    rest = rest.replace(/^TO\s+/, '');
  }

  // BC suffix
  if (rest.endsWith(' BC') || rest.endsWith('/BC')) {
    isBC = true;
    rest = rest.replace(/\s*\/?BC$/, '');
  }

  // Parse: [DD] [MON] YYYY
  const parts = rest.split(/\s+/);
  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;

  for (const part of parts) {
    const n = parseInt(part, 10);
    if (!isNaN(n)) {
      if (n > 31) year = n;
      else if (day === undefined && month !== undefined) day = n;
      else if (day === undefined) day = n;
    } else if (MONTH_MAP[part]) {
      month = MONTH_MAP[part];
    } else if (/^\d{4}\/\d{2,4}$/.test(part)) {
      // Dual dating e.g. 1750/51
      year = parseInt(part.split('/')[0], 10);
    }
  }

  // Build display string
  const qualPrefix = quality === 'about' ? '~' : quality === 'estimated' ? 'est.' :
    quality === 'before' ? 'bef.' : quality === 'after' ? 'aft.' :
    quality === 'calculated' ? 'cal.' : '';
  const parts2: string[] = [];
  if (day) parts2.push(String(day));
  if (month) parts2.push(MONTH_NAMES[month]);
  if (year) parts2.push(isBC ? `${year} BC` : String(year));
  const display = qualPrefix + (parts2.join(' ') || raw);

  return { raw, quality, year, month, day, isBC, display };
}

// ─── Name Parsing ────────────────────────────────────────────

export function parseName(nameStr: string): GedcomName {
  const raw = nameStr || '';
  // Extract surname between //
  const surnameMatch = raw.match(/\/([^/]*)\//);
  const surname = surnameMatch ? surnameMatch[1].trim() : undefined;
  const given = raw.replace(/\/[^/]*\//g, '').replace(/\s+/g, ' ').trim() || undefined;
  const full = given && surname ? `${given} ${surname}`.trim() :
    (given || surname || raw).trim();
  return { full, given, surname };
}

// ─── Core GEDCOM Line Tokenizer ───────────────────────────────

interface GedcomLine {
  level: number;
  xref?: string;   // @Ixx@
  tag: string;
  value: string;
}

function parseLine(line: string): GedcomLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // level [xref] tag [value]
  const match = trimmed.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z0-9_]+)(?:\s+(.*))?$/i);
  if (!match) return null;

  return {
    level: parseInt(match[1], 10),
    xref: match[2],
    tag: match[3].toUpperCase(),
    value: (match[4] || '').trim(),
  };
}

// ─── Record Builder ────────────────────────────────────────────

interface RawRecord {
  level: number;
  xref?: string;
  tag: string;
  value: string;
  children: RawRecord[];
}

function buildRecordTree(lines: GedcomLine[]): RawRecord[] {
  const roots: RawRecord[] = [];
  const stack: RawRecord[] = [];

  for (const line of lines) {
    const node: RawRecord = { ...line, children: [] };
    // Pop stack until we find parent at level-1
    while (stack.length > 0 && stack[stack.length - 1].level >= line.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return roots;
}

// ─── Event Extractor ──────────────────────────────────────────

function extractEvent(record: RawRecord): GedcomEvent {
  const event: GedcomEvent = { tag: record.tag, value: record.value || undefined };
  for (const child of record.children) {
    if (child.tag === 'DATE') event.date = parseDate(child.value);
    else if (child.tag === 'PLAC') event.place = child.value;
    else if (child.tag === 'NOTE') event.note = child.value;
    else if (child.tag === 'SOUR') event.source = child.value;
    else if (child.tag === 'ADDR') {
      // Fold address into place if no place yet
      if (!event.place) event.place = child.value;
    }
  }
  return event;
}

// ─── INDI Record Parser ────────────────────────────────────────

const EVENT_TAGS = new Set([
  'BIRT', 'DEAT', 'MARR', 'DIV', 'CENS', 'PROB', 'WILL',
  'GRAD', 'EMIG', 'IMMI', 'NATU', 'RETI', 'RESI', 'OCCU',
  'EDUC', 'PROP', 'CAST', 'NATI', 'EVEN', 'CHR', 'BURI',
  'BARM', 'BASM', 'BLES', 'CHRA', 'CONF', 'FCOM', 'ORDN',
  'ORDI', 'ADOP', 'BAPL', 'CONL', 'ENDL', 'SLGC',
]);

function parseIndi(record: RawRecord): GedcomPerson {
  const id = record.xref || record.value;
  const person: GedcomPerson = {
    id,
    names: [],
    sex: 'U',
    events: [],
    familiesAsChild: [],
    familiesAsSpouse: [],
    notes: [],
    sources: [],
  };

  let primaryName: GedcomName | null = null;
  const nameSubRecords: RawRecord[] = [];

  for (const child of record.children) {
    switch (child.tag) {
      case 'NAME': {
        const name = parseName(child.value);
        // Look for sub-tags
        for (const sub of child.children) {
          if (sub.tag === 'GIVN') name.given = sub.value;
          else if (sub.tag === 'SURN') name.surname = sub.value;
          else if (sub.tag === 'NICK') name.nickname = sub.value;
          else if (sub.tag === 'NPFX') name.prefix = sub.value;
          else if (sub.tag === 'NSFX') name.suffix = sub.value;
          else if (sub.tag === 'SPFX') name.surnamePrefix = sub.value;
        }
        // Rebuild full name if we got sub-parts
        if (name.given || name.surname) {
          const parts: string[] = [];
          if (name.prefix) parts.push(name.prefix);
          if (name.given) parts.push(name.given);
          if (name.surnamePrefix) parts.push(name.surnamePrefix);
          if (name.surname) parts.push(name.surname);
          if (name.suffix) parts.push(name.suffix);
          name.full = parts.join(' ').trim();
        }
        person.names.push(name);
        if (!primaryName) primaryName = name;
        nameSubRecords.push(child);
        break;
      }
      case 'SEX':
        person.sex = (['M', 'F', 'X'].includes(child.value.toUpperCase())
          ? child.value.toUpperCase() : 'U') as Sex;
        break;
      case 'BIRT':
        person.birth = extractEvent(child);
        break;
      case 'DEAT':
        person.death = extractEvent(child);
        break;
      case 'FAMC':
        person.familiesAsChild.push(child.value.replace(/@/g, '').trim());
        break;
      case 'FAMS':
        person.familiesAsSpouse.push(child.value.replace(/@/g, '').trim());
        break;
      case 'NOTE':
        person.notes.push(child.value || child.children.map(c => c.value).join(' '));
        break;
      case 'SOUR':
        person.sources.push(child.value);
        break;
      default:
        if (EVENT_TAGS.has(child.tag)) {
          person.events.push(extractEvent(child));
        }
    }
  }

  // Ensure at least one name
  if (person.names.length === 0) {
    person.names.push({ full: '[Unknown]', given: undefined, surname: undefined });
  }

  return person;
}

// ─── FAM Record Parser ─────────────────────────────────────────

function parseFam(record: RawRecord): GedcomFamily {
  const id = record.xref || record.value;
  const fam: GedcomFamily = {
    id,
    children: [],
    events: [],
  };

  for (const child of record.children) {
    const ref = (child.value || '').replace(/@/g, '').trim();
    switch (child.tag) {
      case 'HUSB': fam.husband = ref; break;
      case 'WIFE': fam.wife = ref; break;
      case 'CHIL': fam.children.push(ref); break;
      case 'MARR': fam.marriage = extractEvent(child); break;
      case 'DIV': fam.divorce = extractEvent(child); break;
      default:
        if (EVENT_TAGS.has(child.tag)) fam.events.push(extractEvent(child));
    }
  }
  return fam;
}

// ─── Main Parser ───────────────────────────────────────────────

export function parseGedcom(text: string): GedcomTree {
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalizedText.split('\n');

  const lines: GedcomLine[] = [];
  for (const raw of rawLines) {
    const parsed = parseLine(raw);
    if (parsed) lines.push(parsed);
  }

  const records = buildRecordTree(lines);

  const persons = new Map<string, GedcomPerson>();
  const families = new Map<string, GedcomFamily>();
  const sources = new Map<string, GedcomSource>();
  const notes = new Map<string, GedcomNote>();
  let submitter: GedcomTree['submitter'] = {};
  let header: GedcomTree['header'] = {};

  for (const record of records) {
    if (record.level !== 0) continue;

    switch (record.tag) {
      case 'INDI': {
        const person = parseIndi(record);
        // Normalize ID - remove @ signs and trim
        const normalId = record.xref ? record.xref.replace(/@/g, '').trim() : person.id;
        person.id = normalId;
        // Fix family refs
        person.familiesAsChild = person.familiesAsChild.map(f => f.replace(/@/g, '').trim());
        person.familiesAsSpouse = person.familiesAsSpouse.map(f => f.replace(/@/g, '').trim());
        persons.set(normalId, person);
        break;
      }
      case 'FAM': {
        const fam = parseFam(record);
        const normalId = record.xref ? record.xref.replace(/@/g, '').trim() : fam.id;
        fam.id = normalId;
        families.set(normalId, fam);
        break;
      }
      case 'SOUR': {
        const srcId = record.xref ? record.xref.replace(/@/g, '').trim() : '';
        const src: GedcomSource = { id: srcId };
        for (const child of record.children) {
          if (child.tag === 'TITL') src.title = child.value;
          else if (child.tag === 'AUTH') src.author = child.value;
          else if (child.tag === 'PUBL') src.publication = child.value;
          else if (child.tag === 'TEXT') src.text = child.value;
        }
        sources.set(srcId, src);
        break;
      }
      case 'NOTE': {
        const noteId = record.xref ? record.xref.replace(/@/g, '').trim() : '';
        const noteText = [record.value, ...record.children.filter(c => c.tag === 'CONT' || c.tag === 'CONC').map(c => c.value)].join('\n');
        notes.set(noteId, { id: noteId, text: noteText });
        break;
      }
      case 'HEAD': {
        for (const child of record.children) {
          if (child.tag === 'SOUR') header!.source = child.value;
          else if (child.tag === 'GEDC') {
            for (const sub of child.children) {
              if (sub.tag === 'VERS') header!.gedcomVersion = sub.value;
            }
          } else if (child.tag === 'CHAR') header!.charset = child.value;
          else if (child.tag === 'DATE') header!.date = child.value;
          else if (child.tag === 'FILE') header!.fileName = child.value;
        }
        break;
      }
      case 'SUBM': {
        for (const child of record.children) {
          if (child.tag === 'NAME') submitter!.name = child.value;
          else if (child.tag === 'LANG') submitter!.language = child.value;
        }
        break;
      }
    }
  }

  // Link persons to families
  for (const fam of families.values()) {
    if (fam.husband) {
      const p = persons.get(fam.husband);
      if (p && !p.familiesAsSpouse.includes(fam.id)) p.familiesAsSpouse.push(fam.id);
    }
    if (fam.wife) {
      const p = persons.get(fam.wife);
      if (p && !p.familiesAsSpouse.includes(fam.id)) p.familiesAsSpouse.push(fam.id);
    }
    for (const childId of fam.children) {
      const p = persons.get(childId);
      if (p && !p.familiesAsChild.includes(fam.id)) p.familiesAsChild.push(fam.id);
    }
  }

  // Compute stats
  const stats = computeStats(persons, families);

  return { persons, families, sources, notes, submitter, header, stats };
}

// ─── Stats Computation ─────────────────────────────────────────

function computeStats(
  persons: Map<string, GedcomPerson>,
  _families: Map<string, GedcomFamily>
): TreeStats {
  let male = 0, female = 0, unknownSex = 0;
  let withBirth = 0, withDeath = 0, withBirthPlace = 0;
  let earliest: number | undefined, latest: number | undefined;
  const surnames = new Set<string>();
  const places = new Set<string>();

  for (const p of persons.values()) {
    if (p.sex === 'M') male++;
    else if (p.sex === 'F') female++;
    else unknownSex++;

    if (p.birth?.date?.year) {
      withBirth++;
      if (earliest === undefined || p.birth.date.year < earliest) earliest = p.birth.date.year;
      if (latest === undefined || p.birth.date.year > latest) latest = p.birth.date.year;
    }
    if (p.death?.date) withDeath++;
    if (p.birth?.place) {
      withBirthPlace++;
      places.add(p.birth.place);
    }
    for (const name of p.names) {
      if (name.surname) surnames.add(name.surname);
    }
    for (const ev of p.events) {
      if (ev.place) places.add(ev.place);
    }
  }

  return {
    totalPersons: persons.size,
    totalFamilies: _families.size,
    maleCount: male,
    femaleCount: female,
    unknownSexCount: unknownSex,
    withBirthDate: withBirth,
    withDeathDate: withDeath,
    withBirthPlace: withBirthPlace,
    earliestBirth: earliest,
    latestBirth: latest,
    uniqueSurnames: Array.from(surnames).sort(),
    uniquePlaces: Array.from(places).sort(),
  };
}

export default parseGedcom;
