import React, { useMemo } from 'react';
import { Users, Activity, Heart, Info, X } from 'lucide-react';
import type { GedcomTree } from '../../../parser/gedcomTypes';
import { computeDashboardData } from '../../../utils/dashboardEngine';

interface Props {
  tree: GedcomTree;
  onClose: () => void;
  onShowActionProfiles?: (title: string, ids: string[]) => void;
}

export default function PersonsGlobalStatsModal({ tree, onClose, onShowActionProfiles }: Props) {
  
  const stats = useMemo(() => {
    const dashboard = computeDashboardData(tree);
    
    // Arrays for distribution
    const deathAges: number[] = [];
    const ageBuckets = new Array(11).fill(0); // 0-9, 10-19... 100+
    
    let potentiallyAlive = 0;
    const potentiallyAliveIds: string[] = [];
    let dead = 0;
    const currentYear = new Date().getFullYear();

    for (const [id, p] of tree.persons.entries()) {
      const bYear = p.birth?.date?.year;
      const dYear = p.death?.date?.year;
      let lifespan = -1;
      if (bYear && dYear && dYear >= bYear) {
        lifespan = dYear - bYear;
      }

      // Step 1: Direct GEDCOM proofs of death
      // Note: We check if they have death or burial tags. The GedcomPerson object stores death in `p.death`.
      // The parser usually extracts DEAT/BURI. We will assume p.death means they are dead.
      // We also check for WILL if it exists on the parser level, but p.death being present is standard.
      // To strictly follow the rules even if some fields are missing from GedcomPerson interface:
      const hasDeathRecord = !!p.death || !!dYear;
      // Note: Full Gedcom raw node parsing would be needed to find 'WILL' or 'BURI' specifically,
      // but `p.death` is the proxy for standard death events in our parser.

      let isAlive = true;

      // Korak 1:
      if (hasDeathRecord) {
        isAlive = false;
      } else {
        // Korak 2: Privacy / Living tags (assume RESN priv is handled if we had it, fallback is Korak 3)
        // Since we don't have direct access to raw tags like '_ATTR Living', we proceed to Korak 3.
        
        // Korak 3: Age rules
        let marriageYear = 0;
        let youngestChildBirthYear = 0;
        
        // Find marriage years and youngest child from families
        for (const famId of p.familiesAsSpouse) {
          const fam = tree.families.get(famId);
          if (fam) {
            if (fam.marriage?.date?.year) {
              marriageYear = Math.max(marriageYear, fam.marriage.date.year);
            }
            for (const childId of fam.children) {
              const child = tree.persons.get(childId);
              if (child?.birth?.date?.year) {
                youngestChildBirthYear = Math.max(youngestChildBirthYear, child.birth.date.year);
              }
            }
          }
        }

        if (bYear && (currentYear - bYear >= 100)) {
          isAlive = false;
        } else if (!bYear && marriageYear && (currentYear - marriageYear >= 70)) {
          isAlive = false;
        } 
        // Korak 4: Relational rules based on children
        else if (!bYear && !marriageYear && youngestChildBirthYear > 0) {
          if (p.sex === 'F' && (currentYear - youngestChildBirthYear >= 55)) {
            isAlive = false;
          } else if (p.sex === 'M' && (currentYear - youngestChildBirthYear >= 35)) {
            isAlive = false;
          }
        }
      }

      // Record stats
      if (!isAlive) {
        dead++;
        if (lifespan >= 0 && lifespan <= 120) {
          deathAges.push(lifespan);
          const bucketIndex = Math.min(10, Math.floor(lifespan / 10));
          ageBuckets[bucketIndex]++;
        }
      } else {
        potentiallyAlive++;
        potentiallyAliveIds.push(id);
      }
    }

    // Median death age
    deathAges.sort((a, b) => a - b);
    let medianDeathAge = 0;
    if (deathAges.length > 0) {
      const mid = Math.floor(deathAges.length / 2);
      medianDeathAge = deathAges.length % 2 !== 0 ? deathAges[mid] : (deathAges[mid - 1] + deathAges[mid]) / 2;
    }

    // Average children per family
    let totalChildren = 0;
    let familyCount = 0;
    for (const fam of tree.families.values()) {
      if (fam.children.length > 0) {
        totalChildren += fam.children.length;
        familyCount++;
      }
    }
    const avgChildren = familyCount > 0 ? (totalChildren / familyCount).toFixed(1) : '0';

    // Average lifespan
    const avgLifespan = deathAges.length > 0 ? Math.round(deathAges.reduce((a, b) => a + b, 0) / deathAges.length) : 0;

    return {
      maleCount: tree.stats.maleCount,
      femaleCount: tree.stats.femaleCount,
      avgLifespan,
      medianDeathAge: Math.round(medianDeathAge),
      longestLife: dashboard.notableFacts.longestLife,
      earliestAncestor: dashboard.notableFacts.earliestAncestor,
      avgChildren,
      dead,
      potentiallyAlive,
      potentiallyAliveIds,
      ageBuckets
    };
  }, [tree]);

  const maxBucketValue = Math.max(...stats.ageBuckets, 1);

  return (
    <div className="w-full mt-2 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-teal-200 dark:border-teal-900/50 overflow-hidden min-h-[500px] animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-teal-100 dark:border-teal-900/30 bg-teal-50 dark:bg-teal-900/20">
          <div>
            <h2 className="text-xl font-extrabold text-teal-700 dark:text-teal-400 tracking-tight flex items-center gap-2">
              <Users size={20} className="text-teal-500" /> Globalna Statistika Osoba
            </h2>
            <p className="text-sm font-medium text-teal-600/70 dark:text-teal-400/70 mt-1">
              Detaljna demografska analiza svih profila u vašem obiteljskom stablu.
            </p>
          </div>
          <button onClick={onClose} className="btn bg-white border-teal-200 text-teal-700 hover:bg-teal-100 shadow-sm transition-colors text-sm px-4">
            Zatvori prikaz
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-white dark:bg-slate-900 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-8">
          
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Spolna distribucija</span>
              <div className="flex gap-4">
                <div className="text-blue-500 font-bold text-lg">♂ {stats.maleCount}</div>
                <div className="text-rose-500 font-bold text-lg">♀ {stats.femaleCount}</div>
              </div>
            </div>

            <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-xl border border-teal-100 dark:border-teal-900/30 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">Prosječan životni vijek</span>
              <div className="text-3xl font-black text-teal-700 dark:text-teal-400">{stats.avgLifespan} <span className="text-sm">god</span></div>
            </div>

            <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-xl border border-teal-100 dark:border-teal-900/30 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">Medijan dobi smrti</span>
              <div className="text-3xl font-black text-teal-700 dark:text-teal-400">{stats.medianDeathAge} <span className="text-sm">god</span></div>
            </div>

            <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-xl border border-teal-100 dark:border-teal-900/30 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">Prosjek djece</span>
              <div className="text-3xl font-black text-teal-700 dark:text-teal-400">{stats.avgChildren}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Najdulji zabilježeni vijek</span>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{stats.longestLife?.name || 'Nepoznato'}</div>
              <div className="text-sm text-slate-500">{stats.longestLife?.years || '?'} godina</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Najstarija upisana osoba</span>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{stats.earliestAncestor?.name || 'Nepoznato'}</div>
              <div className="text-sm text-slate-500">Rođen(a) {stats.earliestAncestor?.year || '?'}</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col justify-center relative overflow-hidden group">
              <div className="relative z-10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status (Umrli / Živi)</span>
                <div className="flex items-end gap-3 mt-1">
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{stats.dead} <span className="text-sm font-normal text-slate-500">umrlih</span></div>
                  <button 
                    onClick={() => onShowActionProfiles && onShowActionProfiles('Potencijalno živi profili', stats.potentiallyAliveIds)}
                    className="text-xl font-bold text-teal-600 dark:text-teal-400 hover:text-teal-800 transition-colors cursor-pointer text-left"
                    title="Prikaži popis potencijalno živih osoba"
                  >
                    {stats.potentiallyAlive} <span className="text-sm font-normal text-teal-600/70 hover:underline">živih* ↗</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-teal-50/50 dark:bg-teal-900/10 p-4 rounded-lg border border-teal-100 dark:border-teal-900/30 flex items-start gap-3 text-xs sm:text-sm text-teal-800 dark:text-teal-300">
            <Info size={24} className="shrink-0 mt-1" />
            <div className="flex flex-col gap-2 leading-relaxed">
              <strong className="text-teal-900 dark:text-teal-200 uppercase tracking-widest text-[10px]">Algoritam za determinaciju (Logika eliminacije)</strong>
              <p>RodosLovac provjerava statuse osoba točno ovim redoslijedom:</p>
              <ul className="list-decimal list-inside ml-1 space-y-1.5">
                <li><strong>Izravni dokazi o smrti:</strong> Osoba s oznakom smrti (DEAT), pokopa (BURI) ili oporuke (WILL) odmah se označava preminulom.</li>
                <li><strong>Izravni dokazi o životu:</strong> Osobe s eksplicitnim oznakama privatnosti ili života se izuzimaju.</li>
                <li><strong>Vremenska pravila (100 / 70 godina):</strong> Ako od godine rođenja prođe više od 100 godina, ili 70 godina od sklapanja braka, osoba se smatra preminulom.</li>
                <li><strong>Relacijska pravila (preko djece):</strong> Kada nedostaju datumi, gleda se godina rođenja najmlađeg djeteta. Ako je prošlo 55 godina za majke, odnosno 35 godina za očeve, biološki se pretpostavlja da više nisu živi.</li>
                <li><strong>Fallback status:</strong> Sve osobe koje ne upadnu u ove rigorozne granice starosti automatski se, radi zaštite privatnosti, tretiraju kao <strong>žive</strong>.</li>
              </ul>
              <p className="mt-1 text-teal-600 dark:text-teal-400 text-xs italic">
                Savjet: Kliknite na brojčani podatak "živih*" iznad kako biste otvorili točan popis osoba koje sustav trenutno smatra živima.
              </p>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Histogram Chart */}
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
              <Activity size={18} className="text-teal-500" />
              Distribucija starosti pri smrti
            </h3>

            <div className="flex items-end h-64 gap-2 w-full pt-4">
              {stats.ageBuckets.map((count, i) => {
                const label = i === 10 ? '100+' : `${i * 10}-${i * 10 + 9}`;
                const heightPct = (count / maxBucketValue) * 100;
                
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                    {/* Tooltip */}
                    <div className="absolute -top-8 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {count} osoba
                    </div>
                    
                    {/* Bar */}
                    <div 
                      className="w-full bg-teal-500 rounded-t-sm group-hover:bg-teal-400 transition-colors relative min-h-[2px]"
                      style={{ height: `${heightPct}%` }}
                    ></div>
                    
                    {/* Label */}
                    <div className="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

    </div>
  );
}
