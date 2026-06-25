import { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';

export type PlaceEventType = 'BIRT' | 'BAPM' | 'MARR' | 'RESI' | 'DEAT' | 'BURI' | 'OTHER';

export interface PlaceEvent {
  person: GedcomPerson;
  type: PlaceEventType;
  year?: number;
}

export interface PlaceInfo {
  name: string;
  country: string;
  historicalLand?: string;
  people: Set<string>;
  events: PlaceEvent[];
  minYear?: number;
  maxYear?: number;
  badge?: 'CORE' | 'MAJOR';
}

// ─── Local country normalization dictionary ─────────────────
// Maps historical / alternate country names to modern equivalents
// This runs entirely in-memory, zero network calls
const COUNTRY_NORMALIZE: Record<string, string> = {
  'hrvatska': 'Croatia', 'kroatien': 'Croatia', 'croatie': 'Croatia',
  'republic of croatia': 'Croatia', 'kingdom of croatia': 'Croatia',
  'croatia-slavonia': 'Croatia',
  'slavonia': 'Croatia', 'slavonija': 'Croatia',
  'dalmatia': 'Croatia', 'dalmacija': 'Croatia',
  'istria': 'Croatia', 'istra': 'Croatia',
  'magyarország': 'Hungary', 'ungarn': 'Hungary', 'hongrie': 'Hungary',
  'kingdom of hungary': 'Hungary',
  'österreich': 'Austria', 'autriche': 'Austria',
  'austrian empire': 'Austria', 'cisleithania': 'Austria',
  'austria-hungary': 'Austria-Hungary', 'austro-hungarian empire': 'Austria-Hungary',
  'habsburg empire': 'Austria-Hungary', 'habsburg monarchy': 'Austria-Hungary',
  'k.u.k.': 'Austria-Hungary', 'kaiserlich und königlich': 'Austria-Hungary',
  'deutschland': 'Germany', 'allemagne': 'Germany',
  'german empire': 'Germany', 'prussia': 'Germany', 'preussen': 'Germany',
  'preußen': 'Germany', 'bayern': 'Germany', 'bavaria': 'Germany',
  'sachsen': 'Germany', 'saxony': 'Germany', 'württemberg': 'Germany',
  'srbija': 'Serbia', 'serbien': 'Serbia', 'kingdom of serbia': 'Serbia',
  'bosna i hercegovina': 'Bosnia and Herzegovina',
  'bosna': 'Bosnia and Herzegovina', 'bosnia': 'Bosnia and Herzegovina',
  'bosnia-herzegovina': 'Bosnia and Herzegovina',
  'slovenija': 'Slovenia', 'slowenien': 'Slovenia',
  'carniola': 'Slovenia', 'kranjska': 'Slovenia',
  'yugoslavia': 'Yugoslavia', 'jugoslavija': 'Yugoslavia',
  'kingdom of yugoslavia': 'Yugoslavia',
  'sfr yugoslavia': 'Yugoslavia', 'sfrj': 'Yugoslavia',
  'polska': 'Poland', 'polen': 'Poland', 'pologne': 'Poland',
  'congress poland': 'Poland', 'galicia': 'Poland',
  'czechia': 'Czech Republic', 'česko': 'Czech Republic',
  'bohemia': 'Czech Republic', 'böhmen': 'Czech Republic',
  'moravia': 'Czech Republic', 'mähren': 'Czech Republic',
  'românia': 'Romania', 'rumänien': 'Romania',
  'transylvania': 'Romania', 'siebenbürgen': 'Romania',
  'italia': 'Italy', 'italien': 'Italy',
  'frankreich': 'France',
  'england': 'United Kingdom', 'scotland': 'United Kingdom',
  'wales': 'United Kingdom', 'great britain': 'United Kingdom',
  'usa': 'United States', 'u.s.a.': 'United States',
  'america': 'United States', 'united states of america': 'United States',
  'russland': 'Russia', 'россия': 'Russia',
  'україна': 'Ukraine', 'ukraina': 'Ukraine', 'ukraine': 'Ukraine',
  'ottoman empire': 'Ottoman Empire', 'osmansko carstvo': 'Ottoman Empire',
  'schweiz': 'Switzerland', 'suisse': 'Switzerland', 'svizzera': 'Switzerland',
  'slovensko': 'Slovakia', 'slowakei': 'Slovakia',
  'nederland': 'Netherlands', 'niederlande': 'Netherlands',
  'belgien': 'Belgium', 'belgique': 'Belgium',
  'españa': 'Spain', 'spanien': 'Spain',
  'portugal': 'Portugal',
  'greece': 'Greece', 'griechenland': 'Greece', 'ελλάδα': 'Greece',
  'bulgaria': 'Bulgaria', 'bulgarien': 'Bulgaria',
  'romania': 'Romania',
};

function normalizeCountry(raw: string): string {
  const trimmed = raw.trim();
  const key = trimmed.toLowerCase();
  if (COUNTRY_NORMALIZE[key]) return COUNTRY_NORMALIZE[key];
  return trimmed.replace(/\b\w/g, c => c.toUpperCase());
}

export function parseAllPlaces(tree: GedcomTree, scopePersonId: string | null): Map<string, PlaceInfo> {
  const places = new Map<string, PlaceInfo>();

  // Determine scope
  let personsToProcess: GedcomPerson[];
  if (scopePersonId) {
    const ancestors = new Set<string>();
    const stack = [scopePersonId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (ancestors.has(current)) continue;
      ancestors.add(current);
      const p = tree.persons.get(current);
      if (p?._parents) stack.push(...p._parents);
    }
    personsToProcess = Array.from(tree.persons.values()).filter(p => ancestors.has(p.id));
  } else {
    personsToProcess = Array.from(tree.persons.values());
  }

  for (const person of personsToProcess) {
    const placeStrings: { place: string; type: PlaceEventType; year?: number }[] = [];

    if (person.birth?.place) placeStrings.push({ place: person.birth.place, type: 'BIRT', year: person.birth.date?.year });
    const bapm = person.events.find(e => e.tag === 'BAPM' || e.tag === 'CHR');
    if (bapm?.place) placeStrings.push({ place: bapm.place, type: 'BAPM', year: bapm.date?.year });
    for (const famId of person.familiesAsSpouse || []) {
      const fam = tree.families.get(famId);
      if (fam?.marriage?.place) placeStrings.push({ place: fam.marriage.place, type: 'MARR', year: fam.marriage.date?.year });
    }
    for (const r of person.events.filter(e => e.tag === 'RESI' || e.tag === 'CENS')) {
      if (r.place) placeStrings.push({ place: r.place, type: 'RESI', year: r.date?.year });
    }
    if (person.death?.place) placeStrings.push({ place: person.death.place, type: 'DEAT', year: person.death.date?.year });
    const buri = person.events.find(e => e.tag === 'BURI');
    if (buri?.place) placeStrings.push({ place: buri.place, type: 'BURI', year: buri.date?.year });

    for (const { place: placeStr, type, year } of placeStrings) {
      if (!placeStr || !placeStr.trim()) continue;

      const parts = placeStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
      const rawCountry = parts.length > 0 ? parts[parts.length - 1] : '—';
      const country = normalizeCountry(rawCountry);
      const histLand = parts.length > 1 ? parts[parts.length - 2] : undefined;

      let info = places.get(placeStr);
      if (!info) {
        info = {
          name: placeStr,
          country,
          historicalLand: histLand,
          people: new Set(),
          events: [],
        };
        places.set(placeStr, info);
      }

      info.people.add(person.id);
      info.events.push({ person, type, year });

      if (year) {
        if (info.minYear === undefined || year < info.minYear) info.minYear = year;
        if (info.maxYear === undefined || year > info.maxYear) info.maxYear = year;
      }
    }
  }

  // Calculate Badges
  const allPlaces = Array.from(places.values());
  allPlaces.sort((a, b) => b.people.size - a.people.size);
  const totalPlaces = allPlaces.length;
  const coreLimit = Math.max(1, Math.floor(totalPlaces * 0.05));
  const majorLimit = Math.max(1, Math.floor(totalPlaces * 0.15)) + coreLimit;

  for (let i = 0; i < totalPlaces; i++) {
    if (i < coreLimit && allPlaces[i].people.size >= 3) allPlaces[i].badge = 'CORE';
    else if (i < majorLimit && allPlaces[i].people.size >= 2) allPlaces[i].badge = 'MAJOR';
  }

  return places;
}

export function getPlacesStats(placesList: PlaceInfo[]) {
  const uniquePeople = new Set<string>();
  const uniqueCountries = new Set<string>();
  for (const p of placesList) {
    uniqueCountries.add(p.country);
    for (const pid of p.people) uniquePeople.add(pid);
  }
  return {
    totalPlaces: placesList.length,
    totalPeople: uniquePeople.size,
    totalCountries: uniqueCountries.size,
  };
}
