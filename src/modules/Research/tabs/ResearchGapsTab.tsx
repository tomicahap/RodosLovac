import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { 
  analyzeFieldCoverage, 
  analyzeDataIntegrity, 
  findResearchPriorities, 
  findDisconnectedIndividuals, 
  findDisconnectedTrees 
} from '../utils/gapsAnalyzer';
import { ChevronDown, ChevronUp, Download, CheckCircle2, XCircle, AlertTriangle, FileEdit, FileQuestion } from 'lucide-react';
import { TabHeader } from '../components/TabHeader';

export default function ResearchGapsTab() {
  const { tree, graph, selectedPersonId, setSelectedPerson, setActiveModule } = useApp();

  const handlePersonClick = (id: string) => {
    setSelectedPerson(id);
    setActiveModule('person-stats');
  };

  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set(['integrity']));
  
  // LocalStorage state for notes and statuses
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('gedcom_gaps_notes') || '{}'); } catch { return {}; }
  });
  const [statuses, setStatuses] = useState<Record<string, 'VERIFIED'|'FIXED'|'NONE'>>(() => {
    try { return JSON.parse(localStorage.getItem('gedcom_gaps_statuses') || '{}'); } catch { return {}; }
  });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');

  const togglePanel = (id: string) => {
    setOpenPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [expandedTrees, setExpandedTrees] = useState<Set<string>>(new Set());
  const toggleTree = (id: string) => {
    setExpandedTrees(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleStatusChange = (id: string, status: 'VERIFIED'|'FIXED'|'NONE') => {
    const newStatuses = { ...statuses, [id]: status };
    setStatuses(newStatuses);
    localStorage.setItem('gedcom_gaps_statuses', JSON.stringify(newStatuses));
  };

  const startEditingNote = (id: string) => {
    setTempNoteText(notes[id] || '');
    setEditingNoteId(id);
  };

  const saveNote = (id: string) => {
    const newNotes = { ...notes, [id]: tempNoteText };
    setNotes(newNotes);
    localStorage.setItem('gedcom_gaps_notes', JSON.stringify(newNotes));
    setEditingNoteId(null);
  };

  // Memoized Analyzers
  const coverage = useMemo(() => tree ? analyzeFieldCoverage(tree) : null, [tree]);
  const anomalies = useMemo(() => tree ? analyzeDataIntegrity(tree) : [], [tree]);
  const priorities = useMemo(() => tree && graph ? findResearchPriorities(tree, selectedPersonId, graph) : [], [tree, graph, selectedPersonId]);
  const disconnectedIndividuals = useMemo(() => tree ? findDisconnectedIndividuals(tree) : [], [tree]);
  const disconnectedTrees = useMemo(() => tree && graph ? findDisconnectedTrees(tree, graph) : [], [tree, graph]);

  if (!tree || !coverage) return null;

  const getCompletionPercentage = () => {
    const fields = [
      coverage.hasName, coverage.hasBirthYear, coverage.hasBirthPlace,
      coverage.hasDeathYear, coverage.hasDeathPlace, coverage.knownParents
    ];
    const maxFields = [
      coverage.totalPersons, coverage.totalPersons, coverage.totalPersons,
      coverage.totalPersons, coverage.totalPersons, coverage.expectedParents
    ];
    
    const sumFilled = fields.reduce((a,b)=>a+b, 0);
    const sumMax = maxFields.reduce((a,b)=>a+b, 0);
    if (sumMax === 0) return 0;
    return Math.round((sumFilled / sumMax) * 100);
  };

  const overallPercentage = getCompletionPercentage();

  const exportCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = () => {
    const rows = priorities.slice(0, 50).map(p => {
      const person = tree?.persons.get(p.personId);
      return [person?.names[0]?.full || 'Nepoznato', `Nema ${p.missingFields.join(', ')}`, p.score.toString()];
    });
    exportCSV("Praznine_u_istrazivanju.csv", ["Osoba", "Nedostaje", "Prioritet"], rows);
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col h-full animate-fade-in overflow-hidden">
      
      <TabHeader 
        title="Praznine u istraživanju"
        icon={<FileQuestion size={24} className="text-emerald-600" />}
        description="Detektira grane u vašem stablu gdje izravnim precima nedostaju osnovni biografski podaci i mjesta događaja. Predlaže logične prioritete istraživanja."
        helpKey="gaps"
        onExportExcel={handleExportAll}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* --- STATISTIČKI PANELI (Gornji dio) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lijevi panel: Donut chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Postotak dovršenosti</h3>
          
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* SVG Donut */}
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#f1f5f9" strokeWidth="16" />
              <circle cx="80" cy="80" r="70" fill="none" stroke="#10b981" strokeWidth="16" 
                      strokeDasharray="439.8" strokeDashoffset={439.8 - (439.8 * overallPercentage) / 100}
                      className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-black text-slate-800">{overallPercentage}%</span>
              <span className="text-xs font-bold text-slate-400 uppercase">Dovršeno</span>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${overallPercentage > 80 ? 'bg-green-100 text-green-700' : overallPercentage > 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
              {overallPercentage > 80 ? 'Visoka pokrivenost — stabilno' : overallPercentage > 50 ? 'Umjerena pokrivenost — postoje praznine' : 'Niska pokrivenost — kritično'}
            </span>
          </div>
        </div>

        {/* Desni panel: Pokrivenost polja */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Pokrivenost polja</h3>
          
          <div className="space-y-4">
            {[
              { label: 'Ime', val: coverage.hasName, max: coverage.totalPersons, color: 'bg-emerald-500' },
              { label: 'Godina rođenja', val: coverage.hasBirthYear, max: coverage.totalPersons, color: 'bg-emerald-500' },
              { label: 'Mjesto rođenja', val: coverage.hasBirthPlace, max: coverage.totalPersons, color: 'bg-orange-400' },
              { label: 'Godina smrti', val: coverage.hasDeathYear, max: coverage.totalPersons, color: 'bg-red-400' },
              { label: 'Mjesto smrti', val: coverage.hasDeathPlace, max: coverage.totalPersons, color: 'bg-red-400' },
              { label: 'Poznati roditelji', val: coverage.knownParents, max: coverage.expectedParents, color: 'bg-orange-400' },
            ].map((bar, idx) => {
              const pct = bar.max > 0 ? (bar.val / bar.max) * 100 : 0;
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-32 text-xs font-bold text-slate-600 text-right">{bar.label}</div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${bar.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="w-24 text-xs font-bold text-slate-500 text-right">
                    {bar.val.toLocaleString()} / {bar.max.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* --- HARMONIKA PANELI --- */}
      <div className="space-y-4">

        {/* PANEL A: Integritet podataka */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <button onClick={() => togglePanel('integrity')} className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b border-slate-200">
            <div>
              <h3 className="text-lg font-black text-slate-800">Integritet podataka</h3>
              <p className="text-sm font-medium text-slate-500">Detektirani nemogući datumi i nevjerojatni odnosi u stablu.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">{anomalies.filter(a => a.type === 'ERROR').length} Pogrešaka</span>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">{anomalies.filter(a => a.type === 'WARNING').length} Upozorenja</span>
              </div>
              <Download size={20} className="text-slate-400 hover:text-emerald-600 transition-colors" onClick={(e) => {
                e.stopPropagation();
                exportCSV('integritet_podataka.csv', ['ID_OSOBE', 'OSOBA', 'TIP', 'OPIS'], anomalies.map(a => [a.personId, tree.persons.get(a.personId)?.names[0]?.full || 'Nepoznato', a.type, a.description]));
              }} />
              {openPanels.has('integrity') ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </div>
          </button>
          
          {openPanels.has('integrity') && (
            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
              {anomalies.length === 0 && <p className="text-sm text-slate-500 italic">Nisu pronađene anomalije u podacima.</p>}
              {anomalies.map((anomaly, idx) => {
                const isErr = anomaly.type === 'ERROR';
                const p = tree.persons.get(anomaly.personId);
                const status = statuses[anomaly.id] || 'NONE';
                
                return (
                  <div key={idx} className={`p-4 rounded-xl border ${isErr ? 'border-red-100 bg-red-50/30' : 'border-orange-100 bg-orange-50/30'} flex flex-col md:flex-row justify-between gap-4 items-start md:items-center`}>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${isErr ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                          {isErr ? 'POGREŠKA' : 'UPOZORENJE'}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{p?.names[0]?.full || 'Nepoznato'}</span>
                        <span className="text-xs text-slate-400">({anomaly.personId})</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700">{anomaly.description}</p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleStatusChange(anomaly.id, status === 'VERIFIED' ? 'NONE' : 'VERIFIED')} 
                          className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${status === 'VERIFIED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <CheckCircle2 size={14} /> Potvrđeno u redu
                        </button>
                        <button onClick={() => handleStatusChange(anomaly.id, status === 'FIXED' ? 'NONE' : 'FIXED')} 
                          className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${status === 'FIXED' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <XCircle size={14} /> Ispravljeno
                        </button>
                      </div>
                      {editingNoteId !== anomaly.id && (
                        <button onClick={() => startEditingNote(anomaly.id)} className="w-full px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                          <FileEdit size={14} /> {notes[anomaly.id] ? 'Uredi bilješku' : '+ Dodaj bilješku'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Note Editor Modal / Inline */}
              {editingNoteId && (
                <div className="mt-2 p-4 bg-slate-100 border border-slate-200 rounded-xl">
                  <div className="text-xs font-bold text-slate-500 mb-2 uppercase">Istraživačka bilješka (spremljeno na vašem uređaju)...</div>
                  <textarea 
                    value={tempNoteText} 
                    onChange={e => setTempNoteText(e.target.value)}
                    className="w-full text-sm p-3 rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none" 
                    rows={3} 
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setEditingNoteId(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Odustani</button>
                    <button onClick={() => saveNote(editingNoteId)} className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm">Spremi bilješku</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PANEL B: Prioriteti istraživanja */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <button onClick={() => togglePanel('priorities')} className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b border-slate-200">
            <div>
              <h3 className="text-lg font-black text-slate-800">Prioriteti istraživanja</h3>
              <p className="text-sm font-medium text-slate-500">Svi pojedinci s najviše nedostajućih polja — ponderirano prema blizini generacije.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full">{priorities.length} Zadanih zadataka</span>
              <Download size={20} className="text-slate-400 hover:text-emerald-600 transition-colors" onClick={(e) => {
                e.stopPropagation();
                exportCSV('prioriteti_istrazivanja.csv', ['ID', 'OSOBA', 'GENERACIJA', 'NEDOSTAJE'], priorities.map(p => [p.personId, tree.persons.get(p.personId)?.names[0]?.full || 'Nepoznato', p.generation.toString(), p.missingFields.join(', ')]));
              }} />
              {openPanels.has('priorities') ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </div>
          </button>
          
          {openPanels.has('priorities') && (
            <div className="p-0">
              {priorities.map((p, idx) => {
                const person = tree.persons.get(p.personId);
                const isUnknown = !person?.names[0]?.full || person.names[0].full.replace(/\//g, '').trim() === '';
                const status = statuses[`prio_${p.personId}`] || 'NONE';
                
                return (
                  <div key={p.personId} className="border-b border-slate-100 p-4 px-6 flex flex-col md:flex-row items-center gap-6 hover:bg-slate-50/50 transition-colors">
                    <div className="text-xl font-black text-slate-300 w-8 text-center">{idx + 1}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800 text-lg">{isUnknown ? 'Nepoznato' : person?.names[0]?.full}</span>
                        {status === 'FIXED' && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Dovršeno</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-1">
                        <strong className="text-slate-700">Nedostaje:</strong> {p.missingFields.join(', ')}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex gap-2">
                        <button onClick={() => handleStatusChange(`prio_${p.personId}`, status === 'FIXED' ? 'NONE' : 'FIXED')} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors">
                          Dovršeno
                        </button>
                        <button onClick={() => handleStatusChange(`prio_${p.personId}`, status === 'VERIFIED' ? 'NONE' : 'VERIFIED')} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                          Ne sada
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-red-500">{Math.round(p.score)} pts</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Gen {p.generation !== -1 ? p.generation : '?'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PANEL C: Izolirani pojedinci */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <button onClick={() => togglePanel('isolated')} className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b border-slate-200">
            <div>
              <h3 className="text-lg font-black text-slate-800">Izolirani pojedinci</h3>
              <p className="text-sm font-medium text-slate-500">Ljudi bez obiteljskih veza — nisu zabilježeni roditelji, supružnici niti djeca.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full">{disconnectedIndividuals.length} Osoba</span>
              <Download size={20} className="text-slate-400 hover:text-emerald-600 transition-colors" onClick={(e) => {
                e.stopPropagation();
                exportCSV('izolirani_pojedinci.csv', ['ID', 'OSOBA', 'RODJENJE', 'SMRT'], disconnectedIndividuals.map(p => [p.id, p.names[0]?.full || 'Nepoznato', p.birth?.date?.display || '', p.death?.date?.display || '']));
              }} />
              {openPanels.has('isolated') ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </div>
          </button>
          
          {openPanels.has('isolated') && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {disconnectedIndividuals.length === 0 && <p className="text-sm text-slate-500 italic col-span-full">Nema izoliranih pojedinaca u ovom stablu.</p>}
              {disconnectedIndividuals.map(p => (
                <div key={p.id} className="p-4 border border-slate-100 bg-white shadow-sm rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 shrink-0">
                    {p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '?'}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{p.names[0]?.full || 'Nepoznato'}</div>
                    <div className="text-xs font-medium text-slate-500 mt-0.5">
                      {p.birth?.date?.year ? `b. ${p.birth.date.year}` : 'b. ?'} · {p.death?.date?.year ? `d. ${p.death.date.year}` : 'd. ?'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PANEL D: Nepovezana stabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <button onClick={() => togglePanel('disconnected_trees')} className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b border-slate-200">
            <div>
              <h3 className="text-lg font-black text-slate-800">Nepovezana stabla</h3>
              <p className="text-sm font-medium text-slate-500">Male skupine srodnih ljudi koji nisu povezani s vašim glavnim stablom.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full">{disconnectedTrees.length} Skupina</span>
              <Download size={20} className="text-slate-400 hover:text-emerald-600 transition-colors" onClick={(e) => {
                e.stopPropagation();
                exportCSV('nepovezana_stabla.csv', ['SKUPINA', 'VELICINA', 'PREDSTAVNICI'], disconnectedTrees.map(t => [t.dominantSurname, t.size.toString(), t.topPersons.map(p => p.names[0]?.full).join(', ')]));
              }} />
              {openPanels.has('disconnected_trees') ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </div>
          </button>
          
          {openPanels.has('disconnected_trees') && (
            <div className="p-6">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                {disconnectedTrees.length} zasebnih skupina · {disconnectedTrees.reduce((acc, t) => acc + t.size, 0)} ljudi koji nisu povezani s glavnim stablom.
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {disconnectedTrees.length === 0 && <p className="text-sm text-slate-500 italic col-span-full">Svi ljudi s obiteljskim vezama međusobno su povezani u jedno stablo.</p>}
                {disconnectedTrees.map(t => (
                  <div key={t.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                      <h4 className="font-black text-slate-800">{t.dominantSurname}</h4>
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{t.size} ljudi</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 font-medium">
                      {t.topPersons.map(p => (
                        <button key={p.id} onClick={() => handlePersonClick(p.id)} className="bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 hover:text-indigo-700 px-2 py-0.5 rounded transition-colors cursor-pointer focus:outline-none">
                          {p.names[0]?.full || 'Nepoznato'} {p.birth?.date?.year ? `(${p.birth.date.year})` : ''}
                        </button>
                      ))}
                      {t.size > 3 && !expandedTrees.has(t.id) && (
                        <button onClick={() => toggleTree(t.id)} className="text-teal-600 font-bold ml-1 cursor-pointer hover:underline focus:outline-none transition-colors">
                          + {t.size - 3} više
                        </button>
                      )}
                    </div>
                    {expandedTrees.has(t.id) && t.size > 3 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-sm text-slate-600 font-medium animate-fade-in">
                        {t.allPersons?.slice(3).map(p => (
                          <button key={p.id} onClick={() => handlePersonClick(p.id)} className="bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 hover:text-indigo-700 px-2 py-0.5 rounded transition-colors cursor-pointer focus:outline-none">
                            {p.names[0]?.full || 'Nepoznato'} {p.birth?.date?.year ? `(${p.birth.date.year})` : ''}
                          </button>
                        ))}
                        <button onClick={() => toggleTree(t.id)} className="w-full mt-2 text-center text-slate-400 font-bold hover:text-slate-600 focus:outline-none text-xs uppercase tracking-wider transition-colors">
                          Zatvori prikaz
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      </div>
    </div>
  );
}
