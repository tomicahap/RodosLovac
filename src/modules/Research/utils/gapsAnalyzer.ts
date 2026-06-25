import { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';
import { TreeGraph } from '../../../parser/treeGraph';

export interface FieldCoverage {
  totalPersons: number;
  hasName: number;
  hasBirthYear: number;
  hasBirthPlace: number;
  hasDeathYear: number;
  hasDeathPlace: number;
  expectedParents: number;
  knownParents: number;
}

export interface DataAnomaly {
  id: string; // unique hash
  type: 'ERROR' | 'WARNING';
  personId: string;
  relatedPersonId?: string;
  description: string;
}

export interface ResearchPriority {
  personId: string;
  missingFields: string[];
  generation: number;
  score: number;
}

export interface DisconnectedTree {
  id: string;
  size: number;
  dominantSurname: string;
  topPersons: GedcomPerson[];
  allPersons: GedcomPerson[];
}

export function analyzeFieldCoverage(tree: GedcomTree): FieldCoverage {
  const coverage: FieldCoverage = {
    totalPersons: 0,
    hasName: 0,
    hasBirthYear: 0,
    hasBirthPlace: 0,
    hasDeathYear: 0,
    hasDeathPlace: 0,
    expectedParents: 0,
    knownParents: 0,
  };

  for (const person of tree.persons.values()) {
    coverage.totalPersons++;
    
    const hasName = person.names.length > 0 && person.names[0].full && person.names[0].full.replace(/\//g, '').trim().length > 0;
    if (hasName) coverage.hasName++;

    if (person.birth?.date?.year) coverage.hasBirthYear++;
    if (person.birth?.place && person.birth.place.trim() !== '') coverage.hasBirthPlace++;
    
    if (person.death?.date?.year) coverage.hasDeathYear++;
    if (person.death?.place && person.death.place.trim() !== '') coverage.hasDeathPlace++;

    coverage.expectedParents += 2; // Every person theoretically has 2 parents
    if (person._parents && person._parents.length > 0) {
      coverage.knownParents += person._parents.length;
    }
  }

  return coverage;
}

export function analyzeDataIntegrity(tree: GedcomTree): DataAnomaly[] {
  const anomalies: DataAnomaly[] = [];

  const addAnomaly = (type: 'ERROR' | 'WARNING', personId: string, desc: string, relatedPersonId?: string) => {
    anomalies.push({
      id: `${personId}_${relatedPersonId || ''}_${desc.substring(0, 20)}`,
      type,
      personId,
      relatedPersonId,
      description: desc
    });
  };

  // 1. Osobne anomalije
  for (const p of tree.persons.values()) {
    const bYear = p.birth?.date?.year;
    const dYear = p.death?.date?.year;

    if (bYear && dYear) {
      if (bYear > dYear) {
        addAnomaly('ERROR', p.id, `Osoba rođena (${bYear}) nakon vlastite smrti (${dYear}).`);
      } else if (dYear - bYear > 120) {
        addAnomaly('ERROR', p.id, `Nerealna dob života: iznad 120 godina (Rođenje: ${bYear}, Smrt: ${dYear}).`);
      }
    }

    if (bYear && p.familiesAsSpouse && p.familiesAsSpouse.length > 0) {
      for (const famId of p.familiesAsSpouse) {
        const fam = tree.families.get(famId);
        if (fam && fam.marriage?.date?.year) {
          const mYear = fam.marriage.date.year;
          if (mYear < bYear) {
            addAnomaly('ERROR', p.id, `Brak (${mYear}) prije rođenja (${bYear}).`);
          } else if (mYear - bYear < 13) {
            addAnomaly('WARNING', p.id, `Brak sklopljen s manje od 13 godina starosti (Rođenje: ${bYear}, Brak: ${mYear}).`);
          }
        }
      }
    }
  }

  // 2. Obiteljske anomalije
  for (const fam of tree.families.values()) {
    const father = fam.husband ? tree.persons.get(fam.husband) : null;
    const mother = fam.wife ? tree.persons.get(fam.wife) : null;

    for (const childId of fam.children) {
      const child = tree.persons.get(childId);
      if (!child) continue;

      const cYear = child.birth?.date?.year;
      if (!cYear) continue;

      if (father && father.birth?.date?.year) {
        const fYear = father.birth.date.year;
        if (fYear > cYear) {
          addAnomaly('ERROR', child.id, `Otac (r. ${fYear}) rođen nakon vlastitog djeteta (r. ${cYear}).`, father.id);
        } else if (cYear - fYear < 13) {
          addAnomaly('WARNING', child.id, `Otac premlad pri rođenju djeteta (<13 god). (Otac r. ${fYear}, dijete r. ${cYear}).`, father.id);
        }
      }

      if (mother) {
        if (mother.death?.date?.year && mother.death.date.year < cYear) {
           addAnomaly('ERROR', child.id, `Majka umrla (${mother.death.date.year}) prije rođenja djeteta (${cYear}).`, mother.id);
        }
        if (mother.birth?.date?.year) {
          const mYear = mother.birth.date.year;
          if (mYear > cYear) {
             addAnomaly('ERROR', child.id, `Majka (r. ${mYear}) rođena nakon vlastitog djeteta (r. ${cYear}).`, mother.id);
          } else if (cYear - mYear < 13) {
             addAnomaly('WARNING', child.id, `Majka premlada pri rođenju djeteta (<13 god). (Majka r. ${mYear}, dijete r. ${cYear}).`, mother.id);
          } else if (cYear - mYear > 55) {
             addAnomaly('WARNING', child.id, `Majka biološki prestara pri rođenju djeteta (>55 god). (Majka r. ${mYear}, dijete r. ${cYear}).`, mother.id);
          }
        }
      }
    }
  }

  return anomalies;
}

export function findResearchPriorities(tree: GedcomTree, rootPersonId: string | null, graph: TreeGraph): ResearchPriority[] {
  // Prvo, pronađi udaljenosti koristeći BFS od korijena (Generacije)
  const distances = new Map<string, number>();
  
  if (rootPersonId) {
    const queue: { id: string, dist: number }[] = [{ id: rootPersonId, dist: 0 }];
    const visited = new Set<string>([rootPersonId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      distances.set(current.id, current.dist);
      
      const node = graph.getNode(current.id);
      if (node) {
        const neighbors = [...node.parents, ...node.children, ...node.spouses];
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push({ id: n, dist: current.dist + 1 });
          }
        }
      }
    }
  }

  const priorities: ResearchPriority[] = [];

  for (const person of tree.persons.values()) {
    const missingFields: string[] = [];
    
    if (!person.names[0]?.full || person.names[0].full.replace(/\//g, '').trim() === '') missingFields.push('Ime i prezime');
    if (!person.birth?.date?.year) missingFields.push('Godina rođenja');
    if (!person.birth?.place) missingFields.push('Mjesto rođenja');
    if (!person.death?.date?.year && !person.events.some(e => e.tag === 'BURI')) missingFields.push('Godina smrti/pokopa');
    if (!person._parents || person._parents.length === 0) missingFields.push('Roditelji');

    if (missingFields.length > 0) {
      const gen = distances.has(person.id) ? distances.get(person.id)! : 999;
      
      // Bodovanje: Više nedostajućih polja = viši bodovi. Manja udaljenost (gen) = znatno viši bodovi.
      // Score = (missingFields * 10) / (gen + 1)
      let score = (missingFields.length * 100) / (gen + 1);
      
      // Bonus ako su roditelji poznati, a osoba nema ime (hitno)
      if (missingFields.includes('Ime i prezime') && person._parents && person._parents.length > 0) score += 50;
      
      priorities.push({
        personId: person.id,
        missingFields,
        generation: distances.has(person.id) ? gen : -1,
        score
      });
    }
  }

  return priorities.sort((a, b) => b.score - a.score).slice(0, 100); // Vrati top 100
}

export function findDisconnectedIndividuals(tree: GedcomTree): GedcomPerson[] {
  const isolated: GedcomPerson[] = [];
  
  for (const person of tree.persons.values()) {
    const hasParents = person._parents && person._parents.length > 0;
    const hasChildren = person._children && person._children.length > 0;
    const hasSpouses = person.familiesAsSpouse && person.familiesAsSpouse.length > 0;

    if (!hasParents && !hasChildren && !hasSpouses) {
      isolated.push(person);
    }
  }

  return isolated;
}

export function findDisconnectedTrees(tree: GedcomTree, graph: TreeGraph): DisconnectedTree[] {
  const visited = new Set<string>();
  const components: DisconnectedTree[] = [];
  const persons = Array.from(tree.persons.keys());

  for (const pId of persons) {
    if (!visited.has(pId)) {
      // Započni BFS za novu komponentu
      const queue = [pId];
      visited.add(pId);
      
      const componentPersons: GedcomPerson[] = [];
      
      while (queue.length > 0) {
        const currId = queue.shift()!;
        const currPerson = tree.persons.get(currId);
        if (currPerson) componentPersons.push(currPerson);

        const node = graph.getNode(currId);
        if (node) {
          const neighbors = [...node.parents, ...node.children, ...node.spouses];
          for (const n of neighbors) {
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          }
        }
      }

      if (componentPersons.length > 1) { // Komponente veličine 1 su samo izolirani pojedinci (obrađeno iznad)
        // Pronađi dominirajuće prezime
        const surnameCounts = new Map<string, number>();
        for (const p of componentPersons) {
          const s = p.names[0]?.surname || 'Nepoznato';
          surnameCounts.set(s, (surnameCounts.get(s) || 0) + 1);
        }
        
        let dominantSurname = 'Nepoznato';
        let maxCount = 0;
        for (const [sn, cnt] of surnameCounts.entries()) {
          if (cnt > maxCount) {
            maxCount = cnt;
            dominantSurname = sn;
          }
        }

        // Odaberi top 3 osobe za prikaz (po mogućnosti s godinama rođenja)
        const sorted = [...componentPersons].sort((a, b) => {
           const yA = a.birth?.date?.year || 9999;
           const yB = b.birth?.date?.year || 9999;
           return yA - yB;
        });

        components.push({
          id: pId,
          size: componentPersons.length,
          dominantSurname,
          topPersons: sorted.slice(0, 3),
          allPersons: sorted
        });
      }
    }
  }

  // Najveća komponenta je glavno stablo, nju mičemo
  if (components.length > 0) {
    components.sort((a, b) => b.size - a.size);
    components.shift(); // Ukloni glavno stablo
  }

  return components;
}
