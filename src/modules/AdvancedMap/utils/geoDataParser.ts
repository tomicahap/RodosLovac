import type { GedcomTree, GeoTreeFeature, MigrationFlowFeature } from '../../../parser/gedcomTypes';
import { TreeGraph } from '../../../parser/treeGraph';
import { batchGeocode } from '../../../utils/geocoder';

export async function generateGeoData(
  tree: GedcomTree,
  graph: TreeGraph,
  rootPersonId: string,
  onProgress?: (progress: number) => void
): Promise<{ features: GeoTreeFeature[], flows: MigrationFlowFeature[] }> {
  
  const ancestors = graph.getAncestors(rootPersonId, 20);
  ancestors.push({ personId: rootPersonId, generation: 0, ahnentafelNumber: 1 });
  
  const placesToGeocode = new Set<string>();
  const rawEvents: Array<{
    personId: string;
    fullName: string;
    type: 'BIRT' | 'DEAT' | 'MARR' | 'OTHER';
    year?: number;
    place?: string;
    branch?: 'Paternal' | 'Maternal' | 'Both';
  }> = [];

  for (const a of ancestors) {
    const p = tree.persons.get(a.personId);
    if (!p) continue;
    
    // Determine branch based on Ahnentafel (1 = root, 2*n = paternal, 2*n+1 = maternal)
    let branch: 'Paternal' | 'Maternal' | 'Both' = 'Both';
    if (a.ahnentafelNumber !== undefined) {
      if (a.ahnentafelNumber === 1) branch = 'Both';
      else {
        // Find highest ancestor node
        let temp = a.ahnentafelNumber;
        while (temp > 3) temp = Math.floor(temp / 2);
        branch = temp === 2 ? 'Paternal' : 'Maternal';
      }
    }

    if (p.birth?.place) {
      placesToGeocode.add(p.birth.place);
      rawEvents.push({
        personId: p.id, fullName: p.names[0]?.full || 'Nepoznato',
        type: 'BIRT', year: p.birth?.date?.year, place: p.birth.place, branch
      });
    }
    if (p.death?.place) {
      placesToGeocode.add(p.death.place);
      rawEvents.push({
        personId: p.id, fullName: p.names[0]?.full || 'Nepoznato',
        type: 'DEAT', year: p.death?.date?.year, place: p.death.place, branch
      });
    }
  }

  // Geocode all places
  const geoMap = await batchGeocode(Array.from(placesToGeocode), false, (done, total) => {
    if (onProgress) onProgress(Math.round((done / total) * 100));
  });

  const features: GeoTreeFeature[] = [];
  const flows: MigrationFlowFeature[] = [];

  // Generate Point Features
  for (const ev of rawEvents) {
    if (!ev.place || !ev.year) continue;
    const geo = geoMap.get(ev.place);
    if (!geo) continue;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [geo.lng, geo.lat] },
      properties: {
        personId: ev.personId,
        fullName: ev.fullName,
        eventType: ev.type,
        year: ev.year,
        description: `${ev.type === 'BIRT' ? 'Rođenje' : 'Smrt'} (${ev.year}): ${ev.place}`,
        branch: ev.branch
      }
    });
  }

  // Generate Migration Flows (Child Birth -> Parent Birth)
  // For each person, find their parents. If parent birth place != child birth place, create flow.
  for (const a of ancestors) {
    const p = tree.persons.get(a.personId);
    if (!p || !p.birth?.place || !p.birth?.date?.year) continue;
    
    const childGeo = geoMap.get(p.birth.place);
    if (!childGeo) continue;

    const parentIds = p._parents || [];
    for (const parentId of parentIds) {
      const parent = tree.persons.get(parentId);
      if (!parent || !parent.birth?.place || !parent.birth?.date?.year) continue;
      
      const parentGeo = geoMap.get(parent.birth.place);
      if (!parentGeo) continue;
      
      // If coordinates are identical or extremely close, skip (no migration)
      if (Math.abs(parentGeo.lat - childGeo.lat) < 0.05 && Math.abs(parentGeo.lng - childGeo.lng) < 0.05) {
        continue;
      }

      // Determine branch for flow
      let branch: 'Paternal' | 'Maternal' | 'Both' = 'Both';
      const pNode = ancestors.find(x => x.personId === parentId);
      if (pNode?.ahnentafelNumber !== undefined) {
        if (pNode.ahnentafelNumber === 1) branch = 'Both';
        else {
          let temp = pNode.ahnentafelNumber;
          while (temp > 3) temp = Math.floor(temp / 2);
          branch = temp === 2 ? 'Paternal' : 'Maternal';
        }
      }

      flows.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [[parentGeo.lng, parentGeo.lat], [childGeo.lng, childGeo.lat]]
        },
        properties: {
          personId: p.id,
          fullName: `${parent.names[0]?.full} → ${p.names[0]?.full}`,
          year: p.birth.date.year, // Flow happens roughly at child's birth
          intensity: 1,
          fromPlace: parent.birth.place,
          toPlace: p.birth.place,
          branch
        }
      });
    }
  }

  return { features, flows };
}
