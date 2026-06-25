import { GedcomTree, GedcomPerson, GedcomEvent, GedcomDate } from '../../../parser/gedcomTypes';
import { TreeGraph } from '../../../parser/treeGraph';

export type AnomalyType = 'teleportation' | 'anachronism' | 'bigamy';
export type AnomalySeverity = 'NEMOGUĆE' | 'NEVJEROJATNO';

export interface ChronologicalAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  personId: string;
  personName: string;
  sex: 'M' | 'F' | 'U' | 'X';
  lifespan: string;
  description: string;
}

function getLifespan(p: GedcomPerson): string {
  const by = p.birth?.date?.year || '?';
  const dy = p.death?.date?.year || (p.events.some(e => e.tag === 'DEAT') ? '?' : '');
  return dy ? `${by}-${dy}` : `${by}`;
}

// Basic geocoding mock for major regional cities
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'zagreb': { lat: 45.815, lon: 15.981 },
  'beč': { lat: 48.208, lon: 16.373 },
  'vienna': { lat: 48.208, lon: 16.373 },
  'budimpešta': { lat: 47.497, lon: 19.040 },
  'budapest': { lat: 47.497, lon: 19.040 },
  'beograd': { lat: 44.786, lon: 20.448 },
  'belgrade': { lat: 44.786, lon: 20.448 },
  'sarajevo': { lat: 43.856, lon: 18.413 },
  'ljubljana': { lat: 46.056, lon: 14.505 },
  'new york': { lat: 40.712, lon: -74.006 },
  'chicago': { lat: 41.878, lon: -87.629 },
  'pittsburgh': { lat: 40.440, lon: -79.995 }
};

function getCityFromPlace(place: string): string {
  const parts = place.split(',');
  return parts[0].trim().toLowerCase();
}

function getCountryFromPlace(place: string): string {
  const parts = place.split(',');
  return parts[parts.length - 1].trim().toLowerCase();
}

// Haversine formula
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function dateToTimestamp(d: GedcomDate | undefined): number | null {
  if (!d || !d.year) return null;
  const y = d.year;
  const m = d.month || 1;
  const day = d.day || 1;
  return new Date(y, m - 1, day).getTime();
}

function daysBetween(d1: GedcomDate | undefined, d2: GedcomDate | undefined): number | null {
  const t1 = dateToTimestamp(d1);
  const t2 = dateToTimestamp(d2);
  if (t1 === null || t2 === null) return null;
  return Math.abs(t2 - t1) / (1000 * 60 * 60 * 24);
}

function dateCompare(d1: GedcomDate | undefined, d2: GedcomDate | undefined): number {
  const t1 = dateToTimestamp(d1);
  const t2 = dateToTimestamp(d2);
  if (t1 === null || t2 === null) return 0;
  return t1 - t2;
}

function getAllEvents(p: GedcomPerson): { tag: string; ev: GedcomEvent }[] {
  const events = [];
  if (p.birth) events.push({ tag: 'BIRT', ev: p.birth });
  if (p.death) events.push({ tag: 'DEAT', ev: p.death });
  for (const e of p.events) {
    if (e.tag === 'CHR' || e.tag === 'BAPM' || e.tag === 'MARR' || e.tag === 'BURI' || e.tag === 'RESI' || e.tag === 'EVEN') {
      events.push({ tag: e.tag, ev: e });
    }
  }
  return events.sort((a, b) => dateCompare(a.ev.date, b.ev.date));
}

function extractAnachronisms(p: GedcomPerson, tree: GedcomTree, anomalies: ChronologicalAnomaly[]) {
  const bTs = dateToTimestamp(p.birth?.date);
  const dTs = dateToTimestamp(p.death?.date);
  
  const name = p.names[0]?.full || 'Nepoznato';

  // Burial before death
  const buri = p.events.find(e => e.tag === 'BURI');
  if (dTs && buri?.date) {
    const buriTs = dateToTimestamp(buri.date);
    if (buriTs !== null && buriTs < dTs - 86400000) { // allow 1 day error
      anomalies.push({
        id: `anac-buri-${p.id}`,
        type: 'anachronism',
        severity: 'NEMOGUĆE',
        personId: p.id,
        personName: name,
        sex: p.sex,
        lifespan: getLifespan(p),
        description: `Zabilježen je pokop prije datuma smrti (Smrt: ${p.death?.date?.display}, Pokop: ${buri.date.display}).`
      });
    }
  }

  // Children born after death
  if (dTs && p._children) {
    for (const childId of p._children) {
      const child = tree.persons.get(childId);
      const cBTs = dateToTimestamp(child?.birth?.date);
      if (child && cBTs) {
        if (p.sex === 'F' && cBTs > dTs + 30 * 86400000) { // mother
          anomalies.push({
            id: `anac-moth-${p.id}-${child.id}`,
            type: 'anachronism',
            severity: 'NEMOGUĆE',
            personId: p.id,
            personName: name,
            sex: p.sex,
            lifespan: getLifespan(p),
            description: `Dijete ${child.names[0]?.full} rođeno je (${child.birth?.date?.display}) nakon smrti majke (${p.death?.date?.display}).`
          });
        } else if (p.sex === 'M' && cBTs > dTs + 280 * 86400000) { // father (>9 months)
          anomalies.push({
            id: `anac-fath-${p.id}-${child.id}`,
            type: 'anachronism',
            severity: 'NEMOGUĆE',
            personId: p.id,
            personName: name,
            sex: p.sex,
            lifespan: getLifespan(p),
            description: `Dijete ${child.names[0]?.full} rođeno je (${child.birth?.date?.display}) više od 9 mjeseci nakon smrti oca (${p.death?.date?.display}).`
          });
        }
      }
    }
  }
}

function extractTeleportation(p: GedcomPerson, anomalies: ChronologicalAnomaly[]) {
  const events = getAllEvents(p).filter(e => e.ev.date && e.ev.place);
  
  for (let i = 0; i < events.length - 1; i++) {
    const e1 = events[i].ev;
    const e2 = events[i+1].ev;
    
    if (e1.date?.year && e1.date.year < 1900) {
      const days = daysBetween(e1.date, e2.date);
      if (days !== null && days >= 0 && days < 15 && e1.place && e2.place) {
        const c1 = getCityFromPlace(e1.place);
        const c2 = getCityFromPlace(e2.place);
        const co1 = getCountryFromPlace(e1.place);
        const co2 = getCountryFromPlace(e2.place);
        
        let isTeleport = false;
        
        const loc1 = CITY_COORDS[c1];
        const loc2 = CITY_COORDS[c2];
        
        if (loc1 && loc2) {
          const dist = getDistanceKm(loc1.lat, loc1.lon, loc2.lat, loc2.lon);
          if (dist > 200) isTeleport = true;
        } else if (co1 !== co2 && co1 !== '' && co2 !== '') {
          // completely different countries
          if (co1 !== 'hrvatska' && co2 !== 'croatia') { // ignore slight normalize diffs if not exact, simplistic rule
             // just simple string match for different ends
             if (!co1.includes(co2) && !co2.includes(co1)) isTeleport = true;
          }
        }

        if (isTeleport) {
          const name = p.names[0]?.full || 'Nepoznato';
          anomalies.push({
            id: `tele-${p.id}-${i}`,
            type: 'teleportation',
            severity: 'NEVJEROJATNO',
            personId: p.id,
            personName: name,
            sex: p.sex,
            lifespan: getLifespan(p),
            description: `Događaji su preblizu za putovanje u tom dobu. ${e1.place} i ${e2.place} zabilježeni su u razmaku od samo ${Math.floor(days)} dana.`
          });
        }
      }
    }
  }
}

function extractBigamy(p: GedcomPerson, tree: GedcomTree, anomalies: ChronologicalAnomaly[]) {
  if (!p.familiesAsSpouse || p.familiesAsSpouse.length < 2) return;
  
  const name = p.names[0]?.full || 'Nepoznato';
  const families = p.familiesAsSpouse.map(fid => tree.families.get(fid)).filter(Boolean);
  
  // Check children overlap
  let allChildren: { child: GedcomPerson, ts: number }[] = [];
  for (const f of families) {
    if (!f) continue;
    for (const cid of f.children) {
      const c = tree.persons.get(cid);
      const ts = dateToTimestamp(c?.birth?.date);
      if (c && ts) allChildren.push({ child: c, ts });
    }
  }
  
  allChildren.sort((a, b) => a.ts - b.ts);
  for (let i = 0; i < allChildren.length - 1; i++) {
    const c1 = allChildren[i];
    const c2 = allChildren[i+1];
    const diffDays = (c2.ts - c1.ts) / 86400000;
    
    // If it's a mother, < 7 months between kids is physically improbable
    // If it's a father, having kids with two DIFFERENT women < 7 months is cheating/bigamy
    if (diffDays > 0 && diffDays < 210) { // ~7 months
      if (p.sex === 'F') {
         anomalies.push({
            id: `bigamy-f-${p.id}-${i}`,
            type: 'anachronism',
            severity: 'NEMOGUĆE',
            personId: p.id,
            personName: name,
            sex: p.sex,
            lifespan: getLifespan(p),
            description: `Rođenje djeteta ${c2.child.names[0]?.full} je manje od 7 mjeseci nakon djeteta ${c1.child.names[0]?.full}. Fizički nemoguće.`
          });
      } else if (p.sex === 'M') {
        // Did they have different mothers?
        const fam1 = families.find(f => f?.children.includes(c1.child.id));
        const fam2 = families.find(f => f?.children.includes(c2.child.id));
        if (fam1 && fam2 && fam1.id !== fam2.id) {
           anomalies.push({
            id: `bigamy-m-${p.id}-${i}`,
            type: 'bigamy',
            severity: 'NEVJEROJATNO',
            personId: p.id,
            personName: name,
            sex: p.sex,
            lifespan: getLifespan(p),
            description: `Muškarac ima dvoje djece s dvije različite žene u razmaku manjem od 7 mjeseci (${c1.child.names[0]?.full} i ${c2.child.names[0]?.full}). Preklapanje obitelji.`
          });
        }
      }
    }
  }

  // Check marriage overlap
  // If MARR is after death of spouse or DIV... (not strictly requested in full detail, but basic check is good)
}

// Main generator to not block UI
export async function* analyzeAnomalies(tree: GedcomTree): AsyncGenerator<ChronologicalAnomaly[], void, unknown> {
  let chunk: ChronologicalAnomaly[] = [];
  let counter = 0;

  for (const [id, person] of tree.persons.entries()) {
    extractAnachronisms(person, tree, chunk);
    extractTeleportation(person, chunk);
    extractBigamy(person, tree, chunk);

    counter++;
    if (counter % 1000 === 0) {
      if (chunk.length > 0) {
        yield chunk;
        chunk = [];
      }
      // Small tick to let UI breathe
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (chunk.length > 0) {
    yield chunk;
  }
}
