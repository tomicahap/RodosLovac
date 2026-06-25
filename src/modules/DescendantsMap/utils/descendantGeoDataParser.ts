import type { GedcomTree, GeoTreeFeature, MigrationFlowFeature } from '../../../parser/gedcomTypes';
import { TreeGraph } from '../../../parser/treeGraph';
import { batchGeocode } from '../../../utils/geocoder';
import { extractPersonEvents, getBestBirthLikeEvent, getBestDeathLikeEvent, PersonGeoEvent } from '../../AdvancedMap/utils/mapEventUtils';

export type PlotType = 'BIRTH' | 'DEATH' | 'MOVES';

export async function generateDescendantGeoData(
  tree: GedcomTree,
  graph: TreeGraph,
  rootPersonId: string,
  plotType: PlotType,
  maxGenerations: number,
  onProgress?: (progress: number) => void
): Promise<{ features: GeoTreeFeature[], flows: MigrationFlowFeature[], stats: { locationsCount: number, peopleCount: number } }> {
  
  const descendants = graph.getDescendants(rootPersonId, maxGenerations);
  // Always include root person as gen 0
  descendants.push({ personId: rootPersonId, generation: 0 });
  
  const placesToGeocode = new Set<string>();
  const allParsedEvents: PersonGeoEvent[] = [];

  for (const d of descendants) {
    // Skip if beyond requested generations
    if (d.generation > maxGenerations) continue;

    const p = tree.persons.get(d.personId);
    if (!p) continue;

    const events = extractPersonEvents(tree, p);
    
    if (plotType === 'BIRTH') {
      const birth = getBestBirthLikeEvent(events);
      if (birth) {
        placesToGeocode.add(birth.place);
        allParsedEvents.push(birth);
      }
    } else if (plotType === 'DEATH') {
      const death = getBestDeathLikeEvent(events);
      if (death) {
        placesToGeocode.add(death.place);
        allParsedEvents.push(death);
      }
    } else if (plotType === 'MOVES') {
      for (const ev of events) {
        placesToGeocode.add(ev.place);
        allParsedEvents.push(ev);
      }
    }
  }

  // Geocode all places
  const geoMap = await batchGeocode(Array.from(placesToGeocode), false, (done, total) => {
    if (onProgress) onProgress(Math.round((done / total) * 100));
  });

  const features: GeoTreeFeature[] = [];
  const flows: MigrationFlowFeature[] = [];
  const uniqueLocations = new Set<string>();
  const uniquePeople = new Set<string>();

  // Generate Point Features
  for (const ev of allParsedEvents) {
    if (!ev.place) continue;
    const geo = geoMap.get(ev.place);
    if (!geo) continue;

    uniqueLocations.add(ev.place);
    uniquePeople.add(ev.personId);

    let typeStr = ev.type === 'BIRT' || ev.type === 'BAPM' ? 'Rođenje/Krštenje' 
                : ev.type === 'DEAT' || ev.type === 'BURI' ? 'Smrt/Ukop'
                : ev.type === 'MARR' ? 'Vjenčanje' : 'Boravište';

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [geo.lng, geo.lat] },
      properties: {
        personId: ev.personId,
        fullName: ev.fullName,
        eventType: ev.type,
        year: ev.year || 0,
        description: `${typeStr} ${ev.year ? `(${ev.year})` : ''}: ${ev.place}`,
        place: ev.place
      }
    });
  }

  // Generate Migration Flows for 'MOVES'
  if (plotType === 'MOVES') {
    for (const d of descendants) {
      if (d.generation > maxGenerations) continue;
      const p = tree.persons.get(d.personId);
      if (!p) continue;
      
      const events = extractPersonEvents(tree, p);
      if (events.length < 2) continue; // need at least two locations to move

      for (let i = 0; i < events.length - 1; i++) {
        const fromEv = events[i];
        const toEv = events[i + 1];
        
        const fromGeo = geoMap.get(fromEv.place);
        const toGeo = geoMap.get(toEv.place);

        if (fromGeo && toGeo && (fromGeo.lat !== toGeo.lat || fromGeo.lng !== toGeo.lng)) {
          flows.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: [[fromGeo.lng, fromGeo.lat], [toGeo.lng, toGeo.lat]] },
            properties: {
              personId: p.id,
              fullName: p.names[0]?.full || 'Nepoznato',
              year: fromEv.year || 0,
              intensity: 1,
              fromPlace: fromEv.place,
              toPlace: toEv.place
            }
          });
        }
      }
    }
  }

  return { 
    features, 
    flows,
    stats: {
      locationsCount: uniqueLocations.size,
      peopleCount: uniquePeople.size
    }
  };
}
