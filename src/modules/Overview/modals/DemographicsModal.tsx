import React, { useMemo, useState } from 'react';
import { Activity, BarChart2, Calendar, Info, Users } from 'lucide-react';
import type { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';

interface Props {
  tree: GedcomTree;
  onClose: () => void;
  onPersonClick: (id: string) => void;
}

export default function DemographicsModal({ tree, onClose, onPersonClick }: Props) {
  const [showLivingList, setShowLivingList] = useState(false);

  const stats = useMemo(() => {
    let male = 0;
    let female = 0;
    let unknown = 0;

    let totalLifespan = 0;
    const lifespans: number[] = [];
    
    let longestLifePerson: { id: string, age: number, ageStr: string, name: string } | null = null;
    let oldestRecordedPerson: { id: string, year: number, name: string } | null = null;
    
    const ageAtDeathBuckets = new Array(11).fill(0); // 0-9, 10-19... 100+

    let totalChildren = 0;
    let familiesWithChildren = 0;

    const possibleLiving: { id: string, name: string, reason: string }[] = [];
    let deceasedCount = 0;

    const currentYear = new Date().getFullYear();

    // Pass 1: Family stats
    for (const [_, fam] of tree.families) {
      if (fam.children.length > 0) {
        familiesWithChildren++;
        totalChildren += fam.children.length;
      }
    }

    // Helper: get parent birth years
    const getParentBirthYears = (person: GedcomPerson) => {
      let earliest = 9999;
      if (person.familiesAsChild && person.familiesAsChild.length > 0) {
        const fam = tree.families.get(person.familiesAsChild[0]);
        if (fam) {
          const husb = fam.husband ? tree.persons.get(fam.husband) : null;
          const wife = fam.wife ? tree.persons.get(fam.wife) : null;
          if (husb?.birth?.date?.year) earliest = Math.min(earliest, husb.birth.date.year);
          if (wife?.birth?.date?.year) earliest = Math.min(earliest, wife.birth.date.year);
        }
      }
      return earliest === 9999 ? null : earliest;
    };

    // Helper: get oldest child birth year
    const getOldestChildBirthYear = (person: GedcomPerson) => {
      let oldest = 9999;
      if (person.familiesAsSpouse && person.familiesAsSpouse.length > 0) {
        for (const famId of person.familiesAsSpouse) {
          const fam = tree.families.get(famId);
          if (fam) {
            for (const childId of fam.children) {
              const child = tree.persons.get(childId);
              if (child?.birth?.date?.year) oldest = Math.min(oldest, child.birth.date.year);
            }
          }
        }
      }
      return oldest === 9999 ? null : oldest;
    };

    // Pass 2: Person stats
    for (const [id, p] of tree.persons) {
      // Gender
      if (p.sex === 'M') male++;
      else if (p.sex === 'F') female++;
      else unknown++;

      const bYear = p.birth?.date?.year;
      const dYear = p.death?.date?.year;
      const name = p.names[0]?.full || 'Nepoznato';

      // Oldest record
      if (bYear && (!oldestRecordedPerson || bYear < oldestRecordedPerson.year)) {
        oldestRecordedPerson = { id, year: bYear, name };
      }

      let isDeceased = false;
      let livingReason = '';

      // Deceased logic
      if (p.death || dYear) {
        isDeceased = true;
      } else {
        // 1. Born more than 100 years ago
        if (bYear && (currentYear - bYear) > 100) {
          isDeceased = true;
        } 
        else {
          // 2. Married more than 80 years ago
          let marriedLongAgo = false;
          if (p.familiesAsSpouse && p.familiesAsSpouse.length > 0) {
            for (const famId of p.familiesAsSpouse) {
              const fam = tree.families.get(famId);
              if (fam?.marriage?.date?.year && (currentYear - fam.marriage.date.year) > 80) {
                marriedLongAgo = true;
                break;
              }
            }
          }
          if (marriedLongAgo) {
            isDeceased = true;
          } 
          else {
            // 3. Child born more than 70 years ago
            const oldestChildYear = getOldestChildBirthYear(p);
            if (oldestChildYear && (currentYear - oldestChildYear) > 70) {
              isDeceased = true;
            }
            else {
              // 4. Parents born more than 130 years ago (fallback)
              const parentEarliestBirth = getParentBirthYears(p);
              if (parentEarliestBirth && (currentYear - parentEarliestBirth) > 130) {
                isDeceased = true;
              }
            }
          }
        }
      }

      if (isDeceased) {
        deceasedCount++;
      } else {
        // It's possible living
        if (bYear) livingReason = `Rođen/a ${bYear}. (Mlađe od 100 god.)`;
        else livingReason = 'Nema datuma koji upućuju na starost > 100 god.';
        possibleLiving.push({ id, name, reason: livingReason });
      }

      // Lifespan
      if (bYear && dYear && dYear >= bYear) {
        let age = dYear - bYear;
        const bMonth = p.birth?.date?.month;
        const dMonth = p.death?.date?.month;
        const bDay = p.birth?.date?.day;
        const dDay = p.death?.date?.day;
        
        if (bMonth && dMonth) {
          let mDiff = dMonth - bMonth;
          if (bDay && dDay && dDay < bDay) {
            mDiff -= 1;
          }
          age += mDiff / 12;
        }

        // Ignore wildly incorrect data
        if (age >= 0 && age <= 130) {
          lifespans.push(age);
          totalLifespan += age;

          if (!longestLifePerson || age > longestLifePerson.age) {
            longestLifePerson = { id, age, ageStr: age.toFixed(1), name };
          }

          // Bucket by completed years
          const bucket = Math.min(Math.floor(Math.floor(age) / 10), 10);
          ageAtDeathBuckets[bucket]++;
        }
      }
    }

    lifespans.sort((a, b) => a - b);
    let medianLifespan = 0;
    if (lifespans.length > 0) {
      const mid = Math.floor(lifespans.length / 2);
      medianLifespan = lifespans.length % 2 === 0 
        ? (lifespans[mid - 1] + lifespans[mid]) / 2 
        : lifespans[mid];
    }
    
    const medianLifespanStr = lifespans.length > 0 ? medianLifespan.toFixed(1) : '0.0';
    const avgLifespanStr = lifespans.length > 0 ? (totalLifespan / lifespans.length).toFixed(1) : '0.0';
    const avgChildrenStr = familiesWithChildren > 0 ? (totalChildren / familiesWithChildren).toFixed(1) : '0.0';

    return {
      male, female, unknown,
      total: male + female + unknown,
      avgLifespan: avgLifespanStr, 
      medianLifespan: medianLifespanStr,
      longestLifePerson, oldestRecordedPerson,
      avgChildren: avgChildrenStr,
      ageAtDeathBuckets,
      deceasedCount,
      possibleLiving
    };
  }, [tree]);

  const maxBucket = Math.max(...stats.ageAtDeathBuckets, 1);

  return (
    <div className="w-full mt-2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-indigo-200 dark:border-indigo-900/50 overflow-hidden animate-fade-in">
        
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/20">
        <div>
          <h2 className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400 tracking-tight flex items-center gap-2">
            <BarChart2 size={20} className="text-indigo-500" /> Duboka demografska statistika
          </h2>
          <p className="text-sm font-medium text-indigo-600/70 dark:text-indigo-400/70 mt-1">
            Napredna analiza životnog vijeka, spola i moguće živih osoba.
          </p>
        </div>
        <button onClick={onClose} className="btn bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm transition-colors text-sm px-4">
          Zatvori prikaz
        </button>
      </div>

      <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Stats & Averages */}
        <div className="space-y-6">
          {/* Gender Split */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Raspodjela po spolu</div>
            <div className="flex items-center gap-2 h-4 rounded-full overflow-hidden mb-2">
              <div style={{ width: `${(stats.male / stats.total) * 100}%` }} className="h-full bg-blue-500"></div>
              <div style={{ width: `${(stats.female / stats.total) * 100}%` }} className="h-full bg-rose-500"></div>
              {stats.unknown > 0 && <div style={{ width: `${(stats.unknown / stats.total) * 100}%` }} className="h-full bg-slate-300 dark:bg-slate-600"></div>}
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-blue-600">♂ Muški: {stats.male} ({Math.round((stats.male/stats.total)*100)}%)</span>
              <span className="text-rose-600">♀ Ženski: {stats.female} ({Math.round((stats.female/stats.total)*100)}%)</span>
              {stats.unknown > 0 && <span className="text-slate-500">? Nepoznato: {stats.unknown}</span>}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prosječni vijek</div>
              <div className="text-3xl font-extrabold text-indigo-600">{stats.avgLifespan} <span className="text-sm">god.</span></div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Srednja dob smrti</div>
              <div className="text-3xl font-extrabold text-indigo-600">{stats.medianLifespan} <span className="text-sm">god.</span></div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prosjek djece</div>
              <div className="text-3xl font-extrabold text-teal-600">{stats.avgChildren}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Moguće živih</div>
              <div className="text-3xl font-extrabold text-emerald-600">{stats.possibleLiving.length}</div>
            </div>
          </div>

          {/* Records (Longest / Oldest) */}
          <div className="space-y-3">
            {stats.longestLifePerson && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-full text-indigo-600 dark:text-indigo-400"><Activity size={16} /></div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Najdugovječnija osoba ({stats.longestLifePerson.ageStr} god)</div>
                  <button onClick={() => { onClose(); onPersonClick(stats.longestLifePerson!.id); }} className="text-sm font-bold text-indigo-700 hover:underline text-left">
                    {stats.longestLifePerson.name}
                  </button>
                </div>
              </div>
            )}
            {stats.oldestRecordedPerson && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-full text-indigo-600 dark:text-indigo-400"><Calendar size={16} /></div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Najraniji rođeni zapis ({stats.oldestRecordedPerson.year})</div>
                  <button onClick={() => { onClose(); onPersonClick(stats.oldestRecordedPerson!.id); }} className="text-sm font-bold text-indigo-700 hover:underline text-left">
                    {stats.oldestRecordedPerson.name}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Charts & Living List */}
        <div className="space-y-6">
          
          {/* Age at Death Chart */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 pb-12 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Grafikon dobi u trenutku smrti</div>
            <div className="flex items-end gap-1 h-32">
              {stats.ageAtDeathBuckets.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className="absolute -top-8 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 whitespace-nowrap">
                    {count} osoba
                  </div>
                  <div 
                    className="w-full max-w-[24px] bg-indigo-400 group-hover:bg-indigo-500 rounded-t-sm transition-colors relative"
                    style={{ height: `${Math.max((count / maxBucket) * 100, 2)}%` }}
                  >
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-6 text-[10px] font-bold text-slate-600 dark:text-slate-400 -rotate-90 whitespace-nowrap">
                      {i === 10 ? '100+' : `${i*10}-${i*10+9}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Living Calculator */}
          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">Preminuli vs Moguće Živi</div>
                <div className="text-xs text-emerald-600/70 mt-1 flex items-center gap-1">
                  <Info size={12} /> Procjena na temelju starosti rođenja, vjenčanja ili djece.
                </div>
              </div>
              <button 
                onClick={() => setShowLivingList(!showLivingList)}
                className="text-xs font-bold bg-white text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-emerald-50 whitespace-nowrap"
              >
                {showLivingList ? 'Sakrij popis' : 'Prikaži popis'}
              </button>
            </div>
            
            {showLivingList && (
              <div className="mt-4 max-h-60 overflow-y-auto pr-2 space-y-2 border-t border-emerald-100 pt-3">
                <div className="text-[10px] text-emerald-600 mb-2 font-medium bg-emerald-100/50 p-2 rounded">
                  Pravila isključenja: Rođeni prije &gt;100g, Vjenčani prije &gt;80g, Djeca starija od 70g, ili roditelji rođeni prije &gt;130g se računaju kao preminuli.
                </div>
                {stats.possibleLiving.length === 0 ? (
                  <div className="text-sm text-emerald-600 text-center py-4">Nema pronađenih osoba.</div>
                ) : (
                  stats.possibleLiving.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-emerald-50/50">
                      <button onClick={() => { onClose(); onPersonClick(p.id); }} className="text-sm font-bold text-emerald-700 hover:underline text-left truncate flex-1">
                        {p.name}
                      </button>
                      <span className="text-[10px] text-slate-400 ml-2">{p.reason}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
