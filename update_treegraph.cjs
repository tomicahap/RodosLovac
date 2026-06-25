const fs = require('fs');

const path = 'C:\\\\Users\\\\Tomica Hap\\\\Downloads\\\\predci\\\\src\\\\parser\\\\treeGraph.ts';
let content = fs.readFileSync(path, 'utf8');

const interfaceCode = `

export interface DuplicateCandidate {
  personA: string;
  personB: string;
  confidence: 'High' | 'Medium';
  score: number;
  reasons: string[];
  conflicts: {
    parents: boolean;
    birthYear: boolean;
    birthPlace: boolean;
  };
}

export class TreeGraph`;

content = content.replace(/export class TreeGraph/, interfaceCode);

const oldMethodRegex = /\/\*\*\s*\n\s*\* Simple heuristic duplicate detection based on:[\s\S]*?return results\.sort\(\(a, b\) => b\.score - a\.score\)\.slice\(0, 200\);\n  \}/;

const newMethodCode = `/**
   * Advanced heuristic duplicate detection based on:
   * - Same or very similar name
   * - Same birth year (within 2 years)
   * - Same sex
   * - Parent comparisons
   */
  findDuplicates(): DuplicateCandidate[] {
    const persons = Array.from(this.tree.persons.values());
    const results: DuplicateCandidate[] = [];

    for (let i = 0; i < persons.length; i++) {
      for (let j = i + 1; j < persons.length; j++) {
        const a = persons[i];
        const b = persons[j];
        const reasons: string[] = [];
        let score = 0;
        
        const conflicts = {
          parents: false,
          birthYear: false,
          birthPlace: false,
        };

        // Name similarity
        const aName = a.names[0]?.surname?.toLowerCase() || '';
        const bName = b.names[0]?.surname?.toLowerCase() || '';
        const aGiven = a.names[0]?.given?.toLowerCase() || '';
        const bGiven = b.names[0]?.given?.toLowerCase() || '';

        if (aName && bName && aName === bName) { score += 40; reasons.push('Identično prezime'); }
        if (aGiven && bGiven && aGiven === bGiven) { score += 40; reasons.push('Identično ime'); }
        else if (aGiven && bGiven && (aGiven.includes(bGiven) || bGiven.includes(aGiven))) {
          score += 20; reasons.push('Slično ime');
        }

        // Sex match
        if (a.sex === b.sex && a.sex !== 'U') { score += 10; reasons.push('Isti spol'); }

        // Birth year
        const aYear = a.birth?.date?.year;
        const bYear = b.birth?.date?.year;
        if (aYear && bYear) {
          const diff = Math.abs(aYear - bYear);
          if (diff === 0) { score += 30; reasons.push('Ista godina rođenja'); }
          else if (diff <= 2) { score += 15; reasons.push('Slična godina rođenja'); }
          else { conflicts.birthYear = true; }
        }

        // Birth place
        const aPlace = a.birth?.place?.toLowerCase() || '';
        const bPlace = b.birth?.place?.toLowerCase() || '';
        if (aPlace && bPlace) {
          if (aPlace === bPlace) { score += 20; reasons.push('Isto mjesto rođenja'); }
          else if (!aPlace.includes(bPlace) && !bPlace.includes(aPlace)) {
            conflicts.birthPlace = true;
          }
        }

        // Parents match
        let hasParentConflict = false;
        const aParents = a._parents || [];
        const bParents = b._parents || [];
        
        if (aParents.length > 0 && bParents.length > 0) {
          const getParentNames = (parentIds: string[]) => {
            return parentIds.map(pid => this.tree.persons.get(pid)?.names[0]?.given?.toLowerCase() || '').sort();
          };
          const apNames = getParentNames(aParents);
          const bpNames = getParentNames(bParents);
          
          let sharedParents = 0;
          for (const ap of apNames) {
            for (const bp of bpNames) {
              if (ap === bp || ap.includes(bp) || bp.includes(ap)) sharedParents++;
            }
          }

          if (sharedParents > 0) {
            score += 30; reasons.push('Zajednički roditelji');
          } else {
            hasParentConflict = true;
            conflicts.parents = true;
            reasons.push('Upisani različiti roditelji');
          }
        }

        // Only report if likely duplicate (score >= 70)
        if (score >= 70) {
          let confidence = 'High';
          
          if (conflicts.parents || conflicts.birthPlace || conflicts.birthYear || score < 110) {
            confidence = 'Medium';
          }

          results.push({ personA: a.id, personB: b.id, score, reasons, conflicts, confidence: confidence as 'High' | 'Medium' });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 200);
  }`;

content = content.replace(oldMethodRegex, newMethodCode);

fs.writeFileSync(path, content, 'utf8');
console.log("uspjesno!");
