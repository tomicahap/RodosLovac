import type { GedcomTree } from '../parser/gedcomTypes';

export interface StatItem {
  name: string;
  count: number;
  bar_percentage: number;
}

export interface DemographicsStats {
  top_surnames: StatItem[];
  top_countries: StatItem[];
  top_places: StatItem[];
}

// Basic Soundex algorithm implementation
export function soundex(s: string): string {
  if (!s) return '';
  const a = s.toLowerCase().replace(/[^a-z]/g, '');
  if (!a) return '';

  const map: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6'
  };

  const firstChar = a.charAt(0).toUpperCase();
  let res = firstChar;
  let prevCode = map[a.charAt(0)] || '0';

  for (let i = 1; i < a.length; i++) {
    const c = a.charAt(i);
    const code = map[c] || '0';
    if (code !== '0' && code !== prevCode) {
      res += code;
    }
    prevCode = code;
    if (res.length === 4) break;
  }

  while (res.length < 4) res += '0';
  return res;
}

export function generateDemographics(tree: GedcomTree): DemographicsStats {
  const surnameGroups = new Map<string, { count: number, variations: Set<string> }>();
  const countryCounts = new Map<string, number>();
  const placeCounts = new Map<string, number>();

  for (const person of tree.persons.values()) {
    // 1. Surnames
    const surname = person.names[0]?.surname?.trim();
    if (surname) {
      const code = soundex(surname);
      if (!surnameGroups.has(code)) {
        surnameGroups.set(code, { count: 0, variations: new Set() });
      }
      const group = surnameGroups.get(code)!;
      group.count++;
      // Clean surname for variation display (capitalize properly)
      const cleanSurname = surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
      group.variations.add(cleanSurname);
    }

    // 2. Birth Places
    const birthPlace = person.birth?.place?.trim();
    if (birthPlace) {
      // B) Specific places
      placeCounts.set(birthPlace, (placeCounts.get(birthPlace) || 0) + 1);

      // A) Countries (assume last part after comma)
      const parts = birthPlace.split(',');
      const country = parts[parts.length - 1].trim();
      if (country) {
        countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
      }
    }
  }

  // Format Surnames
  const formattedSurnames = Array.from(surnameGroups.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(g => ({
      name: Array.from(g.variations).join(', '),
      count: g.count,
    }));

  // Format Countries
  const formattedCountries = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Format Places
  const formattedPlaces = Array.from(placeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Add bar_percentage
  const attachPercentage = (arr: {name: string, count: number}[]): StatItem[] => {
    if (arr.length === 0) return [];
    const maxCount = arr[0].count;
    return arr.map(item => ({
      ...item,
      bar_percentage: maxCount > 0 ? Number(((item.count / maxCount) * 100).toFixed(2)) : 0
    }));
  };

  return {
    top_surnames: attachPercentage(formattedSurnames),
    top_countries: attachPercentage(formattedCountries),
    top_places: attachPercentage(formattedPlaces)
  };
}
