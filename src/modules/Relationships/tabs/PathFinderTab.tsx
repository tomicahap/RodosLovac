import React, { useState } from 'react';
import type { GedcomPerson, GedcomTree } from '../../../parser/gedcomTypes';
import type { TreeGraph } from '../../../parser/treeGraph';
import { getExpectedDNA, generateNarrative, type PathAnalysis } from '../../../parser/kinshipLogic';
import { Network, Search, GitMerge, FileText } from 'lucide-react';
import RelationshipPathVisualizer from '../../../components/RelationshipPathVisualizer';

interface Props {
  personA: GedcomPerson;
  personB: GedcomPerson;
  path: string[];
  analysis: PathAnalysis;
  tree: GedcomTree;
  graph: TreeGraph;
}

export default function PathFinderTab({ personA, personB, path, analysis, tree, graph }: Props) {

  const dna = getExpectedDNA(analysis.stepsUp, analysis.stepsDown);
  const narrative = generateNarrative(personA, personB, path, analysis, graph);

  // The old V-shaped tree and horizontal path renderers have been replaced by the RelationshipPathVisualizer

  if (path.length === 0) {
    return (
      <div className="animate-fade-in p-12 text-center card bg-red-50 border-red-200 mt-6">
        <h3 className="text-2xl font-bold text-red-700 mb-2">Nema veze</h3>
        <p className="text-red-600 font-medium text-lg">Osobe nije moguće povezati ni na koji način.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      
      {/* Summary Block */}
      <div className="card p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-teal-700 tracking-tight leading-none mb-3">
            {analysis.relationshipName}
          </h2>
          <div className="mb-3">
            {analysis.isBlood ? (
              <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span> Krvno srodstvo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Moguće je prikazati srodstvo, ali to nije krvno srodstvo
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {analysis.stepsUp} generacija gore • {analysis.stepsDown} generacija dolje • {path.length} osoba u liniji
          </p>
        </div>

        <div className="flex bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border-color)]">
          <button className="px-4 py-2 rounded-md text-sm font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-2" onClick={() => window.print()}>
            <FileText size={16} /> Ispiši PDF
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="card bg-[#f8fafc] dark:bg-[var(--bg-card)] border border-[var(--border-color)] min-h-[400px] overflow-hidden mb-6 flex justify-center py-6">
        <RelationshipPathVisualizer path={path} tree={tree} graph={graph} />
      </div>

      {/* DNA Box */}
      {!analysis.isSpouse && path.length > 1 && (
        <div className="mb-6 card p-6 bg-white border border-[var(--border-color)] shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Network className="w-5 h-5 text-purple-600" />
                Očekivano dijeljenje DNK
              </h3>
              <p className="text-xs text-gray-500 mt-1">Procjena temeljena na rodbinskoj udaljenosti</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-purple-700">{dna.avg} cM</div>
              <div className="text-xs font-semibold text-purple-900/60 uppercase">Prosjek</div>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
              <span>Raspon: {dna.range[0]} – {dna.range[1]} cM</span>
              <span>Max: 3720 cM</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden relative">
              <div className="absolute top-0 bottom-0 bg-purple-200" 
                style={{ left: `${(dna.range[0]/3720)*100}%`, width: `${((dna.range[1]-dna.range[0])/3720)*100}%` }}></div>
              <div className="absolute top-0 bottom-0 w-1 bg-purple-600 shadow-sm" style={{ left: `${(dna.avg/3720)*100}%` }}></div>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 leading-tight mt-4">
            * Stvarno dijeljenje može varirati. Rezultat izvan ovog raspona u DNA testovima može ukazivati na polusrodstvo, endogamiju ili pogrešku u rodoslovnom stablu.
          </p>
        </div>
      )}

      {/* Automated Narrative Generator */}
      <div className="card p-5 bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900">
        <h4 className="text-xs font-bold text-teal-800 dark:text-teal-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <FileText size={14} /> Narativno objašnjenje
        </h4>
        <p className="text-sm text-teal-900 dark:text-teal-100 leading-relaxed">
          {narrative}
        </p>
      </div>

    </div>
  );
}
