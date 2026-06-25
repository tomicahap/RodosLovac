// ============================================================
// Research Module — Duplicates, Brick Walls, Gaps, Naming
// Patterns, Pedigree Collapse, DNA Planner
// ============================================================

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts';
import { useApp } from '../../context/AppContext';
import { HelpButton, HelpModal } from '../../components/HelpModal';

type ResearchTab = 'gaps' | 'brickwalls' | 'duplicates' | 'naming' | 'collapse' | 'dna';

const TAB_LABELS: Record<ResearchTab, string> = {
  gaps: '🔍 Praznine',
  brickwalls: '🧱 Zidovi',
  duplicates: '👥 Duplikati',
  naming: '📛 Imena',
  collapse: '🔄 Srodstveni brakovi',
  dna: '🧬 DNA savjeti',
};

export default function Research() {
  const { tree, graph, selectedPersonId, setSelectedPerson } = useApp();
  const [activeTab, setActiveTab] = useState<ResearchTab>('gaps');
  const [helpOpen, setHelpOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'gapScore' | 'name'>('gapScore');

  // ─── Research Gaps ─────────────────────────────────────────

  const researchGaps = useMemo(() => {
    if (!graph) return [];
    return graph.getResearchGaps();
  }, [graph]);

  const sortedGaps = useMemo(() => {
    return [...researchGaps].sort((a, b) =>
      sortBy === 'gapScore' ? b.gapScore - a.gapScore : a.name.localeCompare(b.name)
    );
  }, [researchGaps, sortBy]);

  const gapStats = useMemo(() => ({
    missingBirthDate: researchGaps.filter(g => g.missingBirthDate).length,
    missingBirthPlace: researchGaps.filter(g => g.missingBirthPlace).length,
    missingDeathDate: researchGaps.filter(g => g.missingDeathDate).length,
    missingSources: researchGaps.filter(g => g.missingSources).length,
  }), [researchGaps]);

  // ─── Brick Walls ────────────────────────────────────────────

  const brickWalls = useMemo(() => {
    if (!graph) return [];
    return graph.getBrickWalls();
  }, [graph]);

  // ─── Duplicates ──────────────────────────────────────────────

  const duplicates = useMemo(() => {
    if (!graph) return [];
    return graph.findDuplicates().slice(0, 50);
  }, [graph]);

  // ─── Naming Patterns ─────────────────────────────────────────

  const namingPatterns = useMemo(() => {
    if (!graph) return [];
    return graph.getNamingPatterns().slice(0, 50);
  }, [graph]);

  const topGivenNames = namingPatterns.filter(n => n.type === 'given').slice(0, 20);
  const topSurnames = namingPatterns.filter(n => n.type === 'surname').slice(0, 20);

  // ─── Pedigree Collapse ───────────────────────────────────────

  const collapseData = useMemo(() => {
    if (!graph || !selectedPersonId) return [];
    return graph.getPedigreeCollapse(selectedPersonId, 12);
  }, [graph, selectedPersonId]);

  // ─── DNA Planner ─────────────────────────────────────────────

  const dnaAdvice = useMemo(() => {
    if (!tree || !selectedPersonId) return [];
    const person = tree.persons.get(selectedPersonId);
    if (!person) return [];

    const advice = [];

    // Check paternal line
    const fatherId = person._parents?.find(id => tree.persons.get(id)?.sex === 'M');
    const father = fatherId ? tree.persons.get(fatherId) : undefined;
    if (father && father._parents?.length === 0) {
      advice.push({
        type: 'Y-DNA',
        icon: '🔵',
        priority: 'high',
        description: `Y-DNA test za otkrivanje očeve linije: ${father.names[0]?.full || 'Otac'}`,
        detail: 'Korisno za potvrdu prezimena i muške predačke linije',
      });
    }

    // Check maternal line
    const motherId = person._parents?.find(id => tree.persons.get(id)?.sex === 'F');
    const mother = motherId ? tree.persons.get(motherId) : undefined;
    if (mother && mother._parents?.length === 0) {
      advice.push({
        type: 'mtDNA',
        icon: '🔴',
        priority: 'high',
        description: `Mitohondrijski DNA test za majčinu liniju: ${mother.names[0]?.full || 'Majka'}`,
        detail: 'Pratite majčinu liniju kroz generacije',
      });
    }

    // Autosomal DNA for cousins
    if ((person._children?.length || 0) > 0) {
      advice.push({
        type: 'atDNA',
        icon: '🟢',
        priority: 'medium',
        description: 'Autosomal DNA za provjeru veza s rođacima',
        detail: 'Usporedite rezultate s poznatim primim i drugim rođacima za potvrdu veza',
      });
    }

    // Brick wall ancestors
    const brickWallAncestors = [];
    for (const pid of (person._parents || [])) {
      const parent = tree.persons.get(pid);
      if (parent && (parent._parents?.length || 0) === 0) {
        brickWallAncestors.push(parent.names[0]?.full || pid);
      }
    }
    if (brickWallAncestors.length > 0) {
      advice.push({
        type: 'atDNA',
        icon: '🟡',
        priority: 'medium',
        description: `Test za probijanje genealoškog zida: ${brickWallAncestors.join(', ')}`,
        detail: 'Pronaći nepoznate srodnike koji mogu pomoći u istraživanju',
      });
    }

    // Generic advice if no specific
    if (advice.length === 0) {
      advice.push({
        type: 'atDNA',
        icon: '🟢',
        priority: 'low',
        description: 'Autosomal DNA test — korisno za sve grane stabla',
        detail: 'Identificira srodnike do 5. koljena i može potvrditi genealoške veze',
      });
    }

    return advice;
  }, [tree, selectedPersonId]);

  if (!tree || !graph) return null;

  const totalPersons = tree.stats.totalPersons;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Istraživanje</h2>
          <p className="section-subtitle">Automatska detekcija problema i prijedlozi za istraživanje</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Osoba bez datuma', value: gapStats.missingBirthDate, icon: '📅', pct: Math.round(gapStats.missingBirthDate / totalPersons * 100) },
          { label: 'Osoba bez mjesta', value: gapStats.missingBirthPlace, icon: '📍', pct: Math.round(gapStats.missingBirthPlace / totalPersons * 100) },
          { label: 'Bez izvora', value: gapStats.missingSources, icon: '📚', pct: Math.round(gapStats.missingSources / totalPersons * 100) },
          { label: 'Moguć duplikat', value: duplicates.length, icon: '👥', pct: null },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center gap-2">
              <span className="text-xl">{s.icon}</span>
              <div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{s.value}</div>
                {s.pct !== null && <div className="text-xs text-[var(--text-muted)]">{s.pct}%</div>}
              </div>
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        {(Object.entries(TAB_LABELS) as [ResearchTab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── Research Gaps Tab ─── */}
      {activeTab === 'gaps' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[var(--text-muted)]">Sortiraj po:</span>
            <div className="flex gap-1">
              {(['gapScore', 'name'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    sortBy === s ? 'bg-[var(--brand-light)] text-[var(--brand-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}>
                  {s === 'gapScore' ? 'Praznine' : 'Ime'}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: 480 }}>
              <table className="data-table">
                <thead className="sticky top-0 bg-[var(--bg-card)]">
                  <tr>
                    <th>Ime</th>
                    <th>Datum r.</th>
                    <th>Mjesto r.</th>
                    <th>Datum s.</th>
                    <th>Mjesta s.</th>
                    <th>Izvor</th>
                    <th>Praznine</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGaps.slice(0, 200).map(gap => (
                    <tr key={gap.personId}>
                      <td>
                        <button onClick={() => setSelectedPerson(gap.personId)}
                          className="text-[var(--brand-color)] hover:underline font-medium text-left">
                          {gap.name}
                        </button>
                      </td>
                      {[gap.missingBirthDate, gap.missingBirthPlace, gap.missingDeathDate, gap.missingDeathPlace, gap.missingSources].map((missing, i) => (
                        <td key={i}>{missing ? <span className="badge badge-red text-[10px]">nedostaje</span> : <span className="text-[var(--accent-green)]">✓</span>}</td>
                      ))}
                      <td>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${i < gap.gapScore ? 'bg-red-500' : 'bg-[var(--bg-tertiary)]'}`}></div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Brick Walls Tab ─── */}
      {activeTab === 'brickwalls' && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">Genealoški zidovi</strong> su osobe bez poznatih roditelja —
              tu istraživanje staje. Pronađeno <strong>{brickWalls.length}</strong> takvih osoba.
            </p>
          </div>
          <div className="card overflow-hidden">
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              <table className="data-table">
                <thead className="sticky top-0 bg-[var(--bg-card)]">
                  <tr>
                    <th>Ime</th>
                    <th>Spol</th>
                    <th>Godina r.</th>
                    <th>Mjesta r.</th>
                    <th>Akcija</th>
                  </tr>
                </thead>
                <tbody>
                  {brickWalls.slice(0, 100).map(bw => {
                    const p = tree.persons.get(bw.personId);
                    return p ? (
                      <tr key={bw.personId}>
                        <td className="font-medium">{p.names[0]?.full}</td>
                        <td className={p.sex === 'M' ? 'gender-m' : p.sex === 'F' ? 'gender-f' : 'gender-u'}>
                          {p.sex === 'M' ? '♂ Muški' : p.sex === 'F' ? '♀ Ženski' : '?'}
                        </td>
                        <td className="text-[var(--text-muted)]">{p.birth?.date?.display || '—'}</td>
                        <td className="text-[var(--text-muted)]">{p.birth?.place || '—'}</td>
                        <td>
                          <button onClick={() => setSelectedPerson(bw.personId)}
                            className="btn btn-ghost text-xs py-1 px-2">
                            Odaberi
                          </button>
                        </td>
                      </tr>
                    ) : null;
                  })}
                </tbody>
              </table>
              {brickWalls.length === 0 && (
                <div className="p-8 text-center text-[var(--text-muted)]">
                  <p className="text-2xl mb-2">🎉</p>
                  <p>Nema pronađenih genealoških zidova!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Duplicates Tab ─── */}
      {activeTab === 'duplicates' && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Heuristička detekcija duplikata na temelju sličnosti imena, datuma i spola. 
              Pronađeno <strong>{duplicates.length}</strong> mogućih para duplikata.
            </p>
          </div>
          <div className="space-y-3">
            {duplicates.length === 0 ? (
              <div className="card p-8 text-center text-[var(--text-muted)]">
                <p className="text-2xl mb-2">✅</p>
                <p>Nema pronađenih duplikata</p>
              </div>
            ) : duplicates.map((dup, i) => {
              const pA = tree.persons.get(dup.personA);
              const pB = tree.persons.get(dup.personB);
              if (!pA || !pB) return null;
              return (
                <div key={i} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`badge ${dup.score >= 90 ? 'badge-red' : dup.score >= 80 ? 'badge-amber' : 'badge-gray'}`}>
                      Sličnost: {dup.score}%
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {dup.reasons.map(r => <span key={r} className="badge badge-gray text-[10px]">{r}</span>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[pA, pB].map(p => (
                      <div key={p.id} className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <button onClick={() => setSelectedPerson(p.id)}
                          className="font-semibold text-sm text-[var(--brand-color)] hover:underline">
                          {p.names[0]?.full}
                        </button>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          {p.birth?.date?.display || '?'} · {p.birth?.place?.split(',')[0] || '?'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">ID: {p.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Naming Patterns Tab ─── */}
      {activeTab === 'naming' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h4 className="font-semibold text-sm mb-4">Najpopularnija vlastita imena</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topGivenNames} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-primary)' }} width={75} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" name="Pojavljivanja" radius={[0, 3, 3, 0]}>
                  {topGivenNames.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? '#608bff' : '#8b5cf6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h4 className="font-semibold text-sm mb-4">Najpopularnija prezimena</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topSurnames} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-primary)' }} width={75} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" name="Pojavljivanja" radius={[0, 3, 3, 0]}>
                  {topSurnames.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? '#10b981' : '#06b6d4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── Pedigree Collapse Tab ─── */}
      {activeTab === 'collapse' && (
        <div className="space-y-4">
          {!selectedPersonId ? (
            <div className="card p-6 text-center text-[var(--text-muted)]">Odaberite osobu za analizu srodstvenih brakova</div>
          ) : (
            <>
              <div className="card p-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  <strong>Pedigree collapse</strong> nastaje kad su isti predak prisutan na više mjesta u stablu
                  zbog srodstvenih brakova. Prikazano za odabranu osobu: <strong>{tree.persons.get(selectedPersonId)?.names[0]?.full}</strong>
                </p>
              </div>
              <div className="card p-5">
                <h4 className="font-semibold text-sm mb-4">Postotak srodstvenih brakova po generaciji</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={collapseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="generation" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      label={{ value: 'Generacija', position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: 'var(--text-muted)' } }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      label={{ value: 'Collapse %', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: 10, fill: 'var(--text-muted)' } }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v, n) => [n === 'collapsePercent' ? `${v}%` : v, n === 'collapsePercent' ? 'Collapse' : n === 'totalSlots' ? 'Ukupno mjesta' : 'Jedinstveni predaci']} />
                    <ReferenceLine y={0} stroke="var(--border-color)" />
                    <Line type="monotone" dataKey="collapsePercent" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} name="collapsePercent" />
                    <Line type="monotone" dataKey="totalSlots" stroke="#608bff" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="totalSlots" />
                    <Line type="monotone" dataKey="uniqueAncestors" stroke="#10b981" strokeWidth={1.5} dot={false} name="uniqueAncestors" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="card overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Generacija</th>
                      <th>Ukupno mjesta</th>
                      <th>Jedinstveni predaci</th>
                      <th>Srodstveni brakovi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collapseData.map(row => (
                      <tr key={row.generation}>
                        <td>Gen {row.generation}</td>
                        <td>{row.totalSlots}</td>
                        <td>{row.uniqueAncestors}</td>
                        <td>
                          <span className={`badge ${row.collapsePercent > 20 ? 'badge-red' : row.collapsePercent > 5 ? 'badge-amber' : 'badge-green'}`}>
                            {row.collapsePercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── DNA Planner Tab ─── */}
      {activeTab === 'dna' && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Prijedlozi DNA testova za odabranu osobu: <strong>{tree.persons.get(selectedPersonId || '')?.names[0]?.full || 'Nitko nije odabran'}</strong>
            </p>
          </div>
          {!selectedPersonId ? (
            <div className="card p-6 text-center text-[var(--text-muted)]">Odaberite osobu za DNA savjete</div>
          ) : (
            <div className="space-y-3">
              {dnaAdvice.map((advice, i) => (
                <div key={i} className={`card p-4 border-l-4 ${
                  advice.priority === 'high' ? 'border-l-red-500' :
                  advice.priority === 'medium' ? 'border-l-amber-500' : 'border-l-green-500'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{advice.icon}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${advice.type === 'Y-DNA' ? 'badge-brand' : advice.type === 'mtDNA' ? 'badge-red' : 'badge-green'}`}>
                          {advice.type}
                        </span>
                        <span className={`badge ${advice.priority === 'high' ? 'badge-red' : advice.priority === 'medium' ? 'badge-amber' : 'badge-green'}`}>
                          {advice.priority === 'high' ? 'Visoki' : advice.priority === 'medium' ? 'Srednji' : 'Nizak'} prioritet
                        </span>
                      </div>
                      <p className="font-medium text-sm text-[var(--text-primary)]">{advice.description}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{advice.detail}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="card p-4 bg-[var(--bg-secondary)]">
                <h5 className="font-semibold text-sm mb-2">📖 Opće smjernice za DNA testiranje</h5>
                <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                  <li>• <strong>Autosomal DNA</strong>: Koristan za sve grane, efektivan do ~5. koljena</li>
                  <li>• <strong>Y-DNA</strong>: Prati isključivo mušku (očevu) liniju kroz generacije</li>
                  <li>• <strong>mtDNA</strong>: Prati isključivo žensku (majčinu) liniju kroz generacije</li>
                  <li>• Testirajte što starije srodnike dok je još moguće</li>
                  <li>• Usporedite rezultate s AncestryDNA, 23andMe, MyHeritage bazama</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Praznine i savjeti u istraživanju"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>Istraživanje</strong> služi kao inteligentni asistent koji analizira cjelovitost vašeg obiteljskog stabla, otkriva nelogičnosti i predlaže točne korake za daljnje arhivsko ili DNA istraživanje.
          </p>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Pregled kartica:</h4>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>🔍 Praznine (Gaps):</strong> Analizira kojim osobama nedostaju datumi/mjesta rođenja ili smrti, ili izvori. Praznine su rangirane (crveni kružići) — više praznina znači veći prioritet za popunjavanje podataka.
            </li>
            <li>
              <strong>🧱 Zidovi (Brick Walls):</strong> Prikazuje zadnje poznate pretke u određenim linijama (osobe koje nemaju upisane roditelje). Ti "zidovi" su krajnje točke vašeg trenutnog istraživanja.
            </li>
            <li>
              <strong>👥 Duplikati:</strong> Pronalazi osobe s vrlo sličnim imenima i godinama rođenja koje bi mogle biti dvostruko unesene.
            </li>
            <li>
              <strong>📛 Imena:</strong> Statistika i top ljestvice najpopularnijih vlastitih imena i prezimena u stablu.
            </li>
            <li>
              <strong>🔄 Srodstveni brakovi (Pedigree Collapse):</strong> Računa postotak ponavljanja predaka kroz generacije kako bi se otkrili srodstveni brakovi (kada su supružnici imali zajedničke pretke).
            </li>
            <li>
              <strong>🧬 DNA savjeti:</strong> Izračunava koji bi tip DNA testa (autosomalni, Y-DNA, mtDNA) bio najefikasniji za rješavanje nepoznanica u stablu te predlaže konkretne srodnike koje bi trebalo testirati.
            </li>
          </ul>
        </div>
      </HelpModal>
    </div>
  );
}
