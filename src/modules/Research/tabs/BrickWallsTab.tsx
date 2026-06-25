import React, { useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { GedcomTree, GedcomPerson } from '../../../parser/gedcomTypes';
import { Download, ChevronDown, ChevronUp, ChevronRight, CheckCircle2, Eye, StickyNote, X, SquareSquare } from 'lucide-react';
import { TabHeader } from '../components/TabHeader';

interface BrickWall {
  person: GedcomPerson;
  generation: number;
  side: 'Paternal' | 'Maternal' | 'Self';
}

function findBrickWalls(tree: GedcomTree, rootId: string | null): BrickWall[] {
  const walls: BrickWall[] = [];
  if (!rootId) return walls;
  
  const root = tree.persons.get(rootId);
  if (!root) return walls;

  if (!root._parents || root._parents.length === 0) {
    walls.push({ person: root, generation: 0, side: 'Self' });
    return walls;
  }

  const queue: { id: string, gen: number, side: 'Paternal' | 'Maternal' }[] = [];
  const visited = new Set<string>();
  visited.add(rootId);

  const rootParents = root._parents || [];
  for (const pid of rootParents) {
    const p = tree.persons.get(pid);
    if (!p) continue;
    const side = p.sex === 'F' ? 'Maternal' : 'Paternal';
    queue.push({ id: pid, gen: 1, side });
    visited.add(pid);
  }

  while (queue.length > 0) {
    const { id, gen, side } = queue.shift()!;
    const person = tree.persons.get(id);
    if (!person) continue;

    const parents = person._parents || [];
    if (parents.length === 0) {
      walls.push({ person, generation: gen, side });
    } else {
      for (const pid of parents) {
        if (!visited.has(pid)) {
          visited.add(pid);
          queue.push({ id: pid, gen: gen + 1, side });
        }
      }
    }
  }

  return walls.sort((a, b) => a.generation - b.generation);
}

function getGenerationTitle(gen: number): string {
  if (gen === 0) return 'Fokusna osoba';
  if (gen === 1) return 'Roditelj (1 generacija unatrag)';
  if (gen === 2) return 'Djed/Baka (2 generacije unatrag)';
  if (gen === 3) return 'Pradjed/Prabaka (3 generacije unatrag)';
  return `${gen - 2}x Pradjed/Prabaka (${gen} generacija unatrag)`;
}

function getLifeStr(p: GedcomPerson): string {
  const b = p.birth?.date?.year ? `b. ${p.birth.date.year}` : '';
  const d = p.death?.date?.year ? `d. ${p.death.date.year}` : '';
  if (b && d) return `${b} · ${d}`;
  if (b) return b;
  if (d) return d;
  return 'Nepoznato';
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
    + [headers.join(","), ...rows.map(e => e.map(cell => `"${cell?.replace(/"/g, '""') || ''}"`).join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function BrickWallsTab() {
  const { tree, selectedPersonId, setSelectedPerson, setComparePersonId, setActiveModule } = useApp();

  const walls = useMemo(() => {
    if (!tree) return [];
    return findBrickWalls(tree, selectedPersonId);
  }, [tree, selectedPersonId]);

  const rootPerson = selectedPersonId && tree ? tree.persons.get(selectedPersonId) : null;
  const rootName = rootPerson?.names[0]?.full || 'Nepoznato';

  const paternalCount = walls.filter(w => w.side === 'Paternal').length;
  const maternalCount = walls.filter(w => w.side === 'Maternal').length;
  const closestGap = walls.length > 0 ? getGenerationTitle(walls[0].generation) : 'Nema praznina';

  const grouped = useMemo(() => {
    const map = new Map<number, BrickWall[]>();
    walls.forEach(w => {
      const list = map.get(w.generation) || [];
      list.push(w);
      map.set(w.generation, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [walls]);

  // Local Storage States
  const [openPanels, setOpenPanels] = useState<Set<number>>(new Set([grouped[0]?.[0] ?? -1]));
  
  const [statuses, setStatuses] = useState<Record<string, 'WATCH'|'RESOLVED'|'NONE'>>(() => {
    try { return JSON.parse(localStorage.getItem('brick_walls_status') || '{}'); } catch { return {}; }
  });
  
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('brick_walls_notes') || '{}'); } catch { return {}; }
  });

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');

  const togglePanel = (gen: number) => {
    setOpenPanels(prev => {
      const next = new Set(prev);
      if (next.has(gen)) next.delete(gen); else next.add(gen);
      return next;
    });
  };

  const handleStatusChange = (id: string, st: 'WATCH'|'RESOLVED'|'NONE') => {
    const n = { ...statuses, [id]: st };
    setStatuses(n);
    localStorage.setItem('brick_walls_status', JSON.stringify(n));
  };

  const saveNote = (id: string) => {
    const n = { ...notes };
    if (!tempNoteText.trim()) delete n[id];
    else n[id] = tempNoteText;
    setNotes(n);
    localStorage.setItem('brick_walls_notes', JSON.stringify(n));
    setEditingNoteId(null);
  };

  const handleExport = () => {
    const rows = walls.map(w => [
      w.person.names[0]?.full || 'Nepoznato',
      w.side === 'Self' ? 'Sama osoba' : w.side === 'Paternal' ? 'Očeva linija' : 'Majčina linija',
      w.generation.toString(),
      getGenerationTitle(w.generation),
      getLifeStr(w.person)
    ]);
    exportCSV('nepoznanice_zidovi.csv', ['OSOBA', 'LINIJA', 'GENERACIJA', 'OPIS_GENERACIJE', 'ŽIVOTNI_VIJEK'], rows);
  };

  const openPath = (targetId: string) => {
    if (!selectedPersonId) return;
    setComparePersonId(targetId);
    setActiveModule('relationships');
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col animate-fade-in overflow-hidden">
      
      <TabHeader 
        title="Nepoznanice / 'Zidovi'"
        icon={<SquareSquare size={24} className="text-orange-600" />}
        description="Pronalazi posljednje poznate pretke na kraju svake grane vašeg obiteljskog stabla. Služi kao fokusna lista za sljedeće posjete matičnim uredima ili arhivima."
        helpKey="brickwalls"
        onExportExcel={handleExport}
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
        
        {/* 1. GORNJA STATISTIČKA PLOČA (Dashboard) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between shadow-sm gap-6">
        {/* Lijevi dio */}
        <div className="flex-1">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Nepoznanice za</div>
          <h2 className="text-2xl font-black text-teal-600">{rootName}</h2>
        </div>

        {/* Središnji dio */}
        <div className="flex-1 text-center md:border-l md:border-r border-slate-100 px-6">
          <div className="text-4xl font-black text-slate-800 leading-none mb-2">{walls.length}</div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Pronađeno nepoznanica</div>
          <div className="flex items-center justify-center gap-4">
            <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full text-xs">
              {paternalCount} Očeva linija
            </span>
            <span className="bg-fuchsia-50 text-fuchsia-700 font-bold px-3 py-1 rounded-full text-xs">
              {maternalCount} Majčina linija
            </span>
          </div>
        </div>

        {/* Desni dio */}
        <div className="flex-1 text-right">
          <div className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">Najbliža praznina</div>
          <div className="text-sm font-bold text-slate-700 bg-red-50 border border-red-100 inline-block px-4 py-2 rounded-xl">
            {closestGap}
          </div>
        </div>
      </div>

        {/* 2. GLAVNI POPIS PO GENERACIJAMA */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-600">
            Pronađene generacije s prazninama — kliknite na strelicu u kartici za prikaz puta povezivanja
          </h3>
        </div>

        <div className="space-y-4">
          {grouped.length === 0 && (
            <div className="text-center p-12 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-4xl mb-4 block">🎉</span>
              <h3 className="text-lg font-bold text-slate-700">Nema nepoznanica!</h3>
              <p className="text-slate-500">Ova osoba ima popunjeno stablo ili ste došli do kraja poznatih zapisa bez izravnih prekida.</p>
            </div>
          )}

          {grouped.map(([gen, genWalls]) => {
            const isHigh = gen <= 2;
            const isMed = gen === 3 || gen === 4;
            const priorityText = isHigh ? 'Visok prioritet' : isMed ? 'Srednji prioritet' : 'Nizak prioritet';
            const priorityColor = isHigh ? 'text-red-600' : isMed ? 'text-amber-600' : 'text-slate-500';

            return (
              <div key={gen} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button 
                  onClick={() => togglePanel(gen)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {openPanels.has(gen) ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                    <h4 className="text-base font-black text-slate-800">
                      {getGenerationTitle(gen)}
                    </h4>
                    <span className={`text-xs font-bold ${priorityColor}`}>· {priorityText}</span>
                  </div>
                  <div className="bg-slate-200 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">
                    {genWalls.length} nepoznanica
                  </div>
                </button>

                {openPanels.has(gen) && (
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {genWalls.map((w) => {
                      const st = statuses[w.person.id] || 'NONE';
                      const nt = notes[w.person.id];
                      const isResolved = st === 'RESOLVED';
                      
                      return (
                        <div key={w.person.id} className={`flex flex-col border ${isResolved ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-white'} rounded-xl overflow-hidden shadow-sm transition-all`}>
                          
                          {/* Kartica Header */}
                          <div className={`p-4 ${isResolved ? 'opacity-50' : ''}`}>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className={`font-black ${w.person.sex === 'M' ? 'text-blue-500' : w.person.sex === 'F' ? 'text-fuchsia-500' : 'text-slate-400'}`}>
                                  {w.person.sex === 'M' ? '♂' : w.person.sex === 'F' ? '♀' : '?'}
                                </span>
                                <h5 className="font-black text-indigo-950 text-lg line-clamp-1">{w.person.names[0]?.full || 'Nepoznato'}</h5>
                              </div>
                              <button 
                                onClick={() => openPath(w.person.id)}
                                title="Prikaži vezu"
                                className="text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-colors"
                              >
                                <ChevronRight size={20} />
                              </button>
                            </div>
                            <div className="text-sm font-medium text-slate-500 mt-1 pl-6">
                              {getLifeStr(w.person)}
                            </div>
                            <div className="text-xs font-bold text-slate-400 mt-2 pl-6 uppercase tracking-wider">
                              {w.side === 'Paternal' ? 'Očeva linija' : w.side === 'Maternal' ? 'Majčina linija' : ''}
                            </div>
                          </div>

                          {/* Kartica Akcije */}
                          <div className="mt-auto border-t border-slate-100 bg-slate-50 px-4 py-3 flex flex-wrap gap-2 items-center justify-between text-xs font-bold">
                            <button 
                              onClick={() => handleStatusChange(w.person.id, st === 'WATCH' ? 'NONE' : 'WATCH')}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${st === 'WATCH' ? 'text-indigo-700 bg-indigo-100' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                              <Eye size={14} /> {st === 'WATCH' ? 'Prati se' : 'Prati'}
                            </button>
                            <button 
                              onClick={() => handleStatusChange(w.person.id, isResolved ? 'NONE' : 'RESOLVED')}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${isResolved ? 'text-emerald-700 bg-emerald-100' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                              <CheckCircle2 size={14} /> {isResolved ? 'Riješeno' : 'Označi kao riješeno'}
                            </button>
                            <button 
                              onClick={() => { setEditingNoteId(w.person.id); setTempNoteText(nt || ''); }}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${nt ? 'text-amber-700 bg-amber-100' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                              <StickyNote size={14} /> {nt ? 'Uredi bilješku' : '+ Dodaj bilješku'}
                            </button>
                          </div>

                          {/* Notes Editor Inline */}
                          {editingNoteId === w.person.id && (
                            <div className="border-t border-slate-200 bg-amber-50 p-3">
                              <textarea 
                                value={tempNoteText}
                                onChange={e => setTempNoteText(e.target.value)}
                                placeholder="Upišite trag, link na arhivu ili ideju..."
                                className="w-full text-sm p-2 rounded border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none h-20"
                                autoFocus
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setEditingNoteId(null)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-amber-100 rounded">
                                  Odustani
                                </button>
                                <button onClick={() => saveNote(w.person.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded shadow-sm">
                                  Spremi
                                </button>
                              </div>
                            </div>
                          )}
                          {/* Notes Prikaz (ako nije u edit modu i ima note) */}
                          {nt && editingNoteId !== w.person.id && (
                            <div className="border-t border-slate-100 bg-amber-50 p-3 text-xs text-amber-900 whitespace-pre-wrap">
                              <span className="font-bold text-amber-700 uppercase tracking-widest text-[10px] block mb-1">Bilješka</span>
                              {nt}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
