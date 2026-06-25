/// <reference lib="webworker" />

// --- POMOĆNE FUNKCIJE ---
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  let v0 = new Int32Array(b.length + 1);
  let v1 = new Int32Array(b.length + 1);

  for (let i = 0; i <= b.length; i++) v0[i] = i;

  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = (a[i] === b[j]) ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    const temp = v0;
    v0 = v1;
    v1 = temp;
  }
  return v0[b.length];
};

const getSimilarity = (a: string, b: string): number => {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;
  const aBigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.substring(i, i + 2);
    aBigrams.set(bg, (aBigrams.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.substring(i, i + 2);
    const count = aBigrams.get(bg);
    if (count && count > 0) {
      aBigrams.set(bg, count - 1);
      intersection++;
    }
  }
  return (2.0 * intersection) / (a.length + b.length - 2);
};

const soundex = (s: string): string => {
  if (!s) return '0000';
  const a = s.toLowerCase().split('');
  const f = a.shift()!;
  let r = '';
  const codes: Record<string, string> = {
    a: '', e: '', i: '', o: '', u: '', y: '', h: '', w: '',
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6'
  };
  let prevCode = codes[f] || '';
  for (const c of a) {
    const code = codes[c];
    if (code !== undefined && code !== '' && code !== prevCode) {
      r += code;
      prevCode = code;
    }
    if (r.length === 3) break;
  }
  return (f + r + '000').substring(0, 4);
};

export interface WorkerPerson {
  id: string;
  sex: string;
  surname: string;
  given: string;
  bYear?: number;
  dYear?: number;
  firstEventYear?: number;
  lastEventYear?: number;
  bPlace: string;
  parentNames: string[];
  parentIdsLength: number;
}

export interface DuplicateResult {
  personA: string;
  personB: string;
  score: number;
  reasons: string[];
  confidence: 'High' | 'Medium' | 'Low';
  conflicts: { parents: boolean; birthYear: boolean; birthPlace: boolean; };
}

self.onmessage = (e: MessageEvent) => {
  const persons: WorkerPerson[] = e.data;
  const len = persons.length;
  
  self.postMessage({ type: 'progress', progress: 5, status: 'Pre-computing (Soundex, Dates)...' });

  // 1. Pre-computation and Bucketing
  const blocks = new Map<string, WorkerPerson[]>();
  
  const addToBlock = (key: string, p: WorkerPerson) => {
    let arr = blocks.get(key);
    if (!arr) {
      arr = [];
      blocks.set(key, arr);
    }
    arr.push(p);
  };

  for (let i = 0; i < len; i++) {
    const p = persons[i];
    
    // Blok A: Soundex(Prezime) + Prvo slovo imena
    if (p.surname && p.given) {
      const sdx = soundex(p.surname);
      addToBlock(`N_${sdx}_${p.given[0]}`, p);
    }
    
    // Blok B: Soundex(Ime) + Prvo slovo prezimena (Hvata grube greške u početku prezimena)
    if (p.surname && p.given) {
      const sdxG = soundex(p.given);
      addToBlock(`G_${sdxG}_${p.surname[0]}`, p);
    }

    // Blok C: Desetljeće rođenja + Soundex prezimena (Striktno razbija decenije po prezimenima, rješava OutOfMemory)
    if (p.bYear && p.surname) {
      const decade = Math.floor(p.bYear / 10) * 10;
      const sdx = soundex(p.surname);
      addToBlock(`Y_${decade}_${sdx}`, p);
      addToBlock(`Y_${decade - 10}_${sdx}`, p); // Overlap
      addToBlock(`Y_${decade + 10}_${sdx}`, p);
    }
    
    if (i % 2000 === 0 && i > 0) {
      self.postMessage({ type: 'progress', progress: 5 + Math.floor((i / len) * 15), status: 'Indeksiranje u ladice...' });
    }
  }

  self.postMessage({ type: 'progress', progress: 20, status: 'Uspoređivanje unutar indeksnih blokova...' });

  const results: DuplicateResult[] = [];
  const processedPairs = new Set<string>();

  const blockEntries = Array.from(blocks.entries());
  const numBlocks = blockEntries.length;

  for (let bIndex = 0; bIndex < numBlocks; bIndex++) {
    const [_, blockPersons] = blockEntries[bIndex];
    const bLen = blockPersons.length;

    // Preskoči prazne ili single blokove, kao i patološke (npr. nepoznata imena, N.N., 
    // prazan Soundex) koji bi rezultirali sa stotinama tisuća nepotrebnih O(N^2) provjera
    if (bLen < 2 || bLen > 500) continue; 

    for (let i = 0; i < bLen; i++) {
      for (let j = i + 1; j < bLen; j++) {
        const a = blockPersons[i];
        const b = blockPersons[j];

        if (a.id === b.id) continue;

        // Hash za spriječavanje obrade istog para ako se nađu u 2 bloka
        const hash = a.id < b.id ? `${a.id}_${b.id}` : `${b.id}_${a.id}`;
        if (processedPairs.has(hash)) continue;
        processedPairs.add(hash);

        // 0. ANAKRONIZAM PROVJERA
        if (a.lastEventYear && b.firstEventYear && a.lastEventYear < b.firstEventYear - 5) continue;
        if (b.lastEventYear && a.firstEventYear && b.lastEventYear < a.firstEventYear - 5) continue;

        // 1. FAST SHORT-CIRCUIT UPPER BOUND
        let possibleScore = 10;
        if (a.surname && b.surname) {
          if (a.surname === b.surname) possibleScore += 40;
          else {
            const lenDiff = Math.abs(a.surname.length - b.surname.length);
            if (lenDiff <= 2 && a.surname[0] === b.surname[0]) possibleScore += 35;
            else if (lenDiff <= 4) possibleScore += 30;
          }
        }
        
        if (a.given && b.given) {
          if (a.given === b.given) possibleScore += 40;
          else {
            const lenDiff = Math.abs(a.given.length - b.given.length);
            if (lenDiff <= 2 && a.given[0] === b.given[0]) possibleScore += 35;
            else if (lenDiff <= 4 || a.given.includes(b.given) || b.given.includes(a.given)) possibleScore += 20;
          }
        }
        
        if (a.bYear && b.bYear) {
          const diff = Math.abs(a.bYear - b.bYear);
          if (diff === 0) possibleScore += 30;
          else if (diff <= 3) possibleScore += 15;
        } else {
          possibleScore += 30;
        }

        if (a.dYear && b.dYear) {
          const diff = Math.abs(a.dYear - b.dYear);
          if (diff === 0) possibleScore += 20;
          else if (diff <= 5) possibleScore += 10;
        } else {
          possibleScore += 20;
        }

        if (a.bPlace && b.bPlace) {
           if (a.bPlace === b.bPlace || a.bPlace.includes(b.bPlace) || b.bPlace.includes(a.bPlace)) possibleScore += 20;
        } else {
           possibleScore += 20;
        }

        if (a.parentIdsLength > 0 && b.parentIdsLength > 0) possibleScore += 30;

        if (possibleScore < 50) continue; 

        // Compute actual score and conflicts
        const reasons: string[] = [];
        let score = 0;
        const conflicts = { parents: false, birthYear: false, birthPlace: false };

        if (a.surname && b.surname) {
          if (a.surname === b.surname) { score += 40; reasons.push('Identično prezime'); }
          else if (Math.abs(a.surname.length - b.surname.length) <= 2 && getLevenshteinDistance(a.surname, b.surname) <= 2) { score += 35; reasons.push('Vrlo slično prezime (fonetski)'); }
          else if (getSimilarity(a.surname, b.surname) >= 0.8) { score += 30; reasons.push('Slično prezime'); }
        }
        
        if (a.given && b.given) {
          if (a.given === b.given) { score += 40; reasons.push('Identično ime'); }
          else if (Math.abs(a.given.length - b.given.length) <= 2 && getLevenshteinDistance(a.given, b.given) <= 2) { score += 35; reasons.push('Vrlo slično ime (fonetski)'); }
          else if (a.given.includes(b.given) || b.given.includes(a.given)) {
            score += 20; reasons.push('Sadrži slično ime');
          }
          else if (getSimilarity(a.given, b.given) >= 0.8) {
            score += 20; reasons.push('Slično ime (80%)');
          }
        }

        if (a.sex === b.sex && a.sex !== 'U') { score += 10; reasons.push('Isti spol'); }

        let sameBirthPlace = false;
        if (a.bPlace && b.bPlace) {
          if (a.bPlace === b.bPlace) { score += 20; reasons.push('Isto mjesto rođenja'); sameBirthPlace = true; }
          else if (a.bPlace.includes(b.bPlace) || b.bPlace.includes(a.bPlace)) { score += 15; reasons.push('Blisko mjesto rođenja (<20km procjena)'); sameBirthPlace = true; }
          else {
            conflicts.birthPlace = true;
          }
        }

        if (a.bYear && b.bYear) {
          const diff = Math.abs(a.bYear - b.bYear);
          if (diff === 0) { score += 30; reasons.push('Ista godina rođenja'); }
          else if (diff <= 1) { score += 25; reasons.push('Godina rođenja ±1'); }
          else if (diff <= 3) { score += 15; reasons.push('Godina rođenja ±3'); conflicts.birthYear = true; }
          else { conflicts.birthYear = true; }
        }
        
        if (a.dYear && b.dYear) {
          const diff = Math.abs(a.dYear - b.dYear);
          if (diff === 0) { score += 20; reasons.push('Ista godina smrti'); }
          else if (diff <= 3) { score += 10; reasons.push('Godina smrti ±3'); }
        }

        if (a.parentIdsLength > 0 && b.parentIdsLength > 0) {
          let sharedParents = 0;
          for (const ap of a.parentNames) {
            for (const bp of b.parentNames) {
              const similarity = getSimilarity(ap, bp);
              // Max 5% odstupanje: Striktno slaganje ili 95% sličnosti, bez labavog "includes".
              // Dopušten maksimalno 1 tipfeler (Levenshtein = 1) samo ako je ime dovoljno dugačko.
              if (
                 ap === bp || 
                 similarity >= 0.95 || 
                 (Math.abs(ap.length - bp.length) <= 1 && getLevenshteinDistance(ap, bp) <= 1 && Math.max(ap.length, bp.length) >= 8)
              ) {
                sharedParents++;
              }
            }
          }

          if (sharedParents > 0) {
            score += 30; reasons.push('Zajednički roditelji');
          } else {
            conflicts.parents = true;
            reasons.push('Upisani različiti roditelji');
          }
        }

        if (score >= 50) {
          let confidence: 'High' | 'Medium' | 'Low' = 'High';
          if (score >= 110 && !conflicts.parents && !conflicts.birthPlace && (!a.bYear || !b.bYear || Math.abs(a.bYear - b.bYear) <= 1)) {
             confidence = 'High';
          } else if (score >= 80) {
             if (conflicts.parents || conflicts.birthYear) confidence = 'Medium';
             else confidence = 'High';
          } else if (score >= 50) {
             confidence = 'Low';
          }

          results.push({
            personA: a.id,
            personB: b.id,
            score,
            confidence,
            reasons,
            conflicts
          });
        }
      }
    }

    if (bIndex % 100 === 0 && bIndex > 0) {
       self.postMessage({ type: 'progress', progress: 20 + Math.floor((bIndex / numBlocks) * 80), status: `Uspoređivanje blokova (${bIndex}/${numBlocks})...` });
    }
  }

  // Zadržimo najizglednijih 1000 kandidata kako bismo izbjegli
  // masivno gutanje memorije prilikom prijenosa rezultata u Main Thread (postMessage Structured Clone algoritam).
  results.sort((a, b) => b.score - a.score);
  
  let totalHigh = 0;
  let totalMedium = 0;
  let totalLow = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i].confidence === 'High') totalHigh++;
    else if (results[i].confidence === 'Medium') totalMedium++;
    else totalLow++;
  }

  const finalResults = results.slice(0, 1000);
  self.postMessage({ 
    type: 'done', 
    results: finalResults, 
    totalFound: results.length,
    totalHigh,
    totalMedium,
    totalLow
  });
};
