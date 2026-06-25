import { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';
import { extractPersonEvents, getBestBirthLikeEvent } from '../../AdvancedMap/utils/mapEventUtils';

export interface MigrationRoute {
  person: GedcomPerson;
  fromPlace: string;
  toPlace: string;
  year?: number;
  isDocumented: boolean;
  sourceText: string;
  generation: number;
}

export function extractAncestralMigrations(tree: GedcomTree, startPersonId: string): MigrationRoute[] {
  const routes: MigrationRoute[] = [];
  const visited = new Set<string>();

  function traverse(personId: string, generation: number) {
    if (visited.has(personId)) return;
    visited.add(personId);

    const person = tree.persons.get(personId);
    if (!person) return;

    // Analyze this person
    const events = extractPersonEvents(tree, person);
    const birthLike = getBestBirthLikeEvent(events);

    if (birthLike && birthLike.place) {
      const birthPlace = birthLike.place;
      
      // Look for first event that is NOT in birthPlace
      const migrationEvent = events.find(e => e.place && e.place !== birthPlace);

      if (migrationEvent) {
        // Documented migration
        routes.push({
          person,
          fromPlace: birthPlace,
          toPlace: migrationEvent.place,
          year: migrationEvent.year,
          isDocumented: true,
          sourceText: `Dokumentirano preko ${migrationEvent.type} u ${migrationEvent.place.split(',')[0]}`,
          generation
        });
      } else {
        // Inferred migration: Check children's birthplaces
        let inferredRoute: MigrationRoute | null = null;
        if (person._children) {
          for (const childId of person._children) {
            const child = tree.persons.get(childId);
            if (child) {
              const childEvents = extractPersonEvents(tree, child);
              const childBirth = getBestBirthLikeEvent(childEvents);
              if (childBirth && childBirth.place && childBirth.place !== birthPlace) {
                // If we don't have a year or child is born earlier, use child's birth as the inferred year
                if (!inferredRoute || (childBirth.year && inferredRoute.year && childBirth.year < inferredRoute.year)) {
                  inferredRoute = {
                    person,
                    fromPlace: birthPlace,
                    toPlace: childBirth.place,
                    year: childBirth.year,
                    isDocumented: false,
                    sourceText: `Imali dijete rođeno u ${childBirth.place.split(',')[0]}`,
                    generation
                  };
                }
              }
            }
          }
        }
        if (inferredRoute) {
          routes.push(inferredRoute);
        }
      }
    }

    // Recurse parents
    if (person._parents) {
      for (const parentId of person._parents) {
        traverse(parentId, generation + 1);
      }
    }
  }

  traverse(startPersonId, 0);

  return routes;
}
