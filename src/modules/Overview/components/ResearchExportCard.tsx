import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { computeDashboardData } from '../../../utils/dashboardEngine';
import { ShieldAlert, Download, AlertTriangle, GitMerge, Fingerprint, Info } from 'lucide-react';

interface Props {
  onShowActionProfiles?: (title: string, ids: string[]) => void;
}

export default function ResearchExportCard({ onShowActionProfiles }: Props) {
  const { tree, setActiveModule } = useApp();

  const data = useMemo(() => {
    if (!tree) return null;
    return computeDashboardData(tree);
  }, [tree]);

  if (!tree || !data) return null;

  const { researchScore } = data;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-50';
    if (score >= 50) return 'text-amber-500 bg-amber-50';
    return 'text-red-500 bg-red-50';
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      
      {/* Research Score Card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
              <ShieldAlert className="text-rose-500" size={20} />
              Kvaliteta istraživanja
            </h2>
            <p className="text-sm text-gray-500 mt-1">Napredne genealoške metrike</p>
          </div>
          <div className={`px-4 py-2 rounded-xl text-2xl font-black ${getScoreColor(researchScore.score)}`}>
            {researchScore.score}<span className="text-sm font-bold opacity-50">/100</span>
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mb-6">
          <div className={`h-2 rounded-full ${getBarColor(researchScore.score)}`} style={{ width: `${researchScore.score}%` }}></div>
        </div>

        <div className="space-y-4 flex-1">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600"><Fingerprint size={16} /></div>
              <div>
                <div className="text-sm font-bold text-gray-900">Potencijalni duplikati</div>
                <div className="text-xs text-gray-500">Ista prva 4 slova imena, prezimena i god. rođenja</div>
              </div>
            </div>
            {researchScore.duplicatesCount > 0 ? (
              <button 
                onClick={() => onShowActionProfiles && onShowActionProfiles('Potencijalni duplikati', researchScore.duplicateIds)}
                className="text-sm font-bold text-orange-600 hover:text-orange-800 hover:underline cursor-pointer"
              >
                {researchScore.duplicatesCount} profila ↗
              </button>
            ) : (
              <div className="text-sm font-bold text-emerald-600">0 profila</div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-600"><AlertTriangle size={16} /></div>
              <div>
                <div className="text-sm font-bold text-gray-900">Brick Walls (Zidovi)</div>
                <div className="text-xs text-gray-500">Osobe rođene nakon 1850. bez unesenih roditelja</div>
              </div>
            </div>
            {researchScore.brickWallsCount > 0 ? (
              <button 
                onClick={() => onShowActionProfiles && onShowActionProfiles('Brick Walls (Zidovi)', researchScore.brickWallIds)}
                className="text-sm font-bold text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
              >
                {researchScore.brickWallsCount} profila ↗
              </button>
            ) : (
              <div className="text-sm font-bold text-emerald-600">0 profila</div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-50 text-teal-600"><GitMerge size={16} /></div>
              <div>
                <div className="text-sm font-bold text-gray-900">Pedigree Collapse</div>
                <div className="text-xs text-gray-500">Omjer različitih prezimena i ukupnog broja osoba</div>
              </div>
            </div>
            <div className={`text-sm font-bold ${researchScore.pedigreeCollapseLevel === 'Low' ? 'text-emerald-600' : researchScore.pedigreeCollapseLevel === 'Medium' ? 'text-amber-600' : 'text-red-600'}`}>
              {researchScore.pedigreeCollapseLevel} rizik
            </div>
          </div>

        </div>

        <div className="mt-6 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-2 text-xs text-slate-600">
          <Info size={16} className="shrink-0 mt-0.5 text-teal-600" />
          <p>
            <strong>Pravila bodovanja:</strong> Početni rezultat je 100. Gubite bodove za <strong>duplikate</strong> (osobe s istom godinom rođenja i prva 4 slova imena/prezimena) i <strong>"Zidove"</strong> (osobe rođene poslije 1850. bez unesenih roditelja). Visok <strong>Pedigree Collapse</strong> (kada je omjer jedinstvenih prezimena naspram ukupnog broja ljudi vrlo malen, tj. manji od 10%) dodatno umanjuje rezultat za 10 bodova. <span className="italic">Kliknite na profile iznad za prikaz!</span>
          </p>
        </div>

        <button 
          onClick={() => setActiveModule('research')}
          className="w-full mt-4 py-2.5 rounded-xl border-2 border-teal-100 text-teal-600 font-bold hover:bg-teal-50 transition-colors"
        >
          Otvori detaljni modul praznina
        </button>
      </div>

      {/* Export Card */}
      <div className="bg-gradient-to-br from-teal-600 to-slate-800 rounded-2xl p-6 shadow-sm flex flex-col text-white relative overflow-hidden group">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6 opacity-90">
            <Download size={24} />
            <h2 className="font-bold text-lg">Izvoz podataka</h2>
          </div>

          <div className="flex-1">
            <div className="text-5xl font-black mb-2">{(tree.persons.size + tree.families.size + tree.sources.size).toLocaleString()}</div>
            <div className="text-teal-100 font-medium">Ukupno parsiranih zapisa (INDI, FAM, SOUR) spremnih za preuzimanje.</div>
          </div>

          <button 
            onClick={() => setActiveModule('export')}
            className="w-full mt-6 py-3 rounded-xl bg-white text-teal-700 font-bold hover:bg-teal-50 hover:shadow-lg transition-all"
          >
            Idi na Izvoz (PDF / CSV)
          </button>
        </div>
      </div>

    </div>
  );
}
