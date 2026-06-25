// ============================================================
// Lifespans Module — Generation-based lifespan analytics
// Bar chart + Gantt timeline + Summary table
// ============================================================

import React, { useMemo, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import type { GedcomPerson, Sex } from '../../parser/gedcomTypes';

// ─── Types ──────────────────────────────────────────────────

interface AncestorLifespan {
  personId: string;
  name: string;
  sex: Sex;
  generation: number;
  birthYear?: number;
  deathYear?: number;
  age?: number;
}

interface GenStats {
  generation: number;
  label: string;
  maleAvg: number;
  maleCount: number;
  femaleAvg: number;
  femaleCount: number;
  overallAvg: number;
  totalCount: number;
  people: AncestorLifespan[];
}

// ─── Constants ──────────────────────────────────────────────

const GEN_DEPTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20];

const GENERATION_LABELS: Record<number, string> = {
  1: 'Roditelji',
  2: 'Bake i djedovi',
  3: 'Pradjedovi i prabake',
  4: '2x-Pradjedovi',
  5: '3x-Pradjedovi',
  6: '4x-Pradjedovi',
  7: '5x-Pradjedovi',
  8: '6x-Pradjedovi',
  9: '7x-Pradjedovi',
  10: '8x-Pradjedovi',
};

const GEN_DEPTH_LABELS: Record<number, string> = {
  2: 'Bake i djedovi',
  3: 'Pradjedovi i prabake',
  4: '2x-Pradjedovi i prabake',
  5: '3x-Pradjedovi i prabake',
  6: '4x-Pradjedovi i prabake',
  7: '5x-Pradjedovi i prabake',
  8: '6x-Pradjedovi i prabake',
  9: '7x-Pradjedovi i prabake',
  10: '8x-Pradjedovi i prabake',
  15: '13x-Pradjedovi i prabake',
  20: '18x-Pradjedovi i prabake',
};

function getGenLabel(gen: number): string {
  if (gen === 0) return 'Odabrana osoba';
  if (GENERATION_LABELS[gen]) return GENERATION_LABELS[gen];
  return `${gen - 2}x-Pradjedovi`;
}

const MALE_COLOR = '#60a5fa';
const FEMALE_COLOR = '#f472b6';

// ─── Data Collection ────────────────────────────────────────

function collectAncestorLifespans(
  tree: ReturnType<typeof useApp>['tree'],
  rootId: string,
  maxGen: number
): AncestorLifespan[] {
  if (!tree) return [];
  const results: AncestorLifespan[] = [];
  const visited = new Set<string>();

  function walk(personId: string, gen: number) {
    if (gen > maxGen || visited.has(personId)) return;
    visited.add(personId);
    const p = tree!.persons.get(personId);
    if (!p) return;

    const birthYear = p.birth?.date?.year;
    const deathYear = p.death?.date?.year;
    let age: number | undefined;
    if (birthYear && deathYear) age = deathYear - birthYear;

    if (gen > 0) {
      results.push({
        personId: p.id,
        name: p.names[0]?.full || '[Nepoznato]',
        sex: p.sex,
        generation: gen,
        birthYear,
        deathYear,
        age,
      });
    }

    // Walk parents
    if (p._parents) {
      for (const parentId of p._parents) {
        walk(parentId, gen + 1);
      }
    }
  }

  walk(rootId, 0);
  return results;
}

// ─── Compute Generation Stats ───────────────────────────────

function computeGenStats(data: AncestorLifespan[], maxGen: number): GenStats[] {
  const byGen = new Map<number, AncestorLifespan[]>();
  for (const d of data) {
    if (!byGen.has(d.generation)) byGen.set(d.generation, []);
    byGen.get(d.generation)!.push(d);
  }

  const stats: GenStats[] = [];
  for (let g = 1; g <= maxGen; g++) {
    const people = byGen.get(g) || [];
    const withAge = people.filter(p => p.age && p.age > 0 && p.age < 115);
    const males = withAge.filter(p => p.sex === 'M');
    const females = withAge.filter(p => p.sex === 'F');

    const maleAvg = males.length > 0 ? Math.round(males.reduce((s, p) => s + (p.age || 0), 0) / males.length) : 0;
    const femaleAvg = females.length > 0 ? Math.round(females.reduce((s, p) => s + (p.age || 0), 0) / females.length) : 0;
    const overallAvg = withAge.length > 0 ? Math.round(withAge.reduce((s, p) => s + (p.age || 0), 0) / withAge.length) : 0;

    if (people.length > 0) {
      stats.push({
        generation: g,
        label: getGenLabel(g),
        maleAvg,
        maleCount: males.length,
        femaleAvg,
        femaleCount: females.length,
        overallAvg,
        totalCount: withAge.length,
        people,
      });
    }
  }
  return stats;
}

// ─── Bar Chart Component ────────────────────────────────────

function AvgBarChart({ stats }: { stats: GenStats[] }) {
  const chartData = stats.map(s => ({
    label: s.label,
    Muškarci: s.maleAvg || null,
    Žene: s.femaleAvg || null,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm font-bold">
        Nema dovoljno podataka o životnom vijeku za prikaz grafikona.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          label={{ value: 'Godine', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: 10, fill: '#94a3b8' } }}
        />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px', color: '#fff', fontWeight: 'bold' }}
          formatter={(value: number, name: string) => [`${value} god.`, name]}
          cursor={{ fill: 'rgba(14,165,233,0.05)' }}
        />
        <Bar dataKey="Muškarci" fill={MALE_COLOR} radius={[4, 4, 0, 0]} barSize={28} />
        <Bar dataKey="Žene" fill={FEMALE_COLOR} radius={[4, 4, 0, 0]} barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Gantt Timeline Component ───────────────────────────────

function GanttTimeline({ stats }: { stats: GenStats[] }) {
  const { setSelectedPerson, setActiveModule } = useApp();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Determine global time range
  const allPeople = stats.flatMap(s => s.people);
  const withYears = allPeople.filter(p => p.birthYear);
  if (withYears.length === 0) {
    return <div className="text-center py-12 text-slate-400 font-bold">Nema podataka o godinama rođenja za prikaz.</div>;
  }

  const globalMin = Math.min(...withYears.map(p => p.birthYear!)) - 10;
  const globalMax = Math.max(...withYears.map(p => (p.deathYear || p.birthYear! + (p.age || 70)))) + 10;
  const range = globalMax - globalMin || 1;

  // Generate decade ticks
  const startDecade = Math.ceil(globalMin / 25) * 25;
  const decades: number[] = [];
  for (let y = startDecade; y <= globalMax; y += 25) decades.push(y);

  const BAR_H = 22;
  const GAP = 3;
  const LEFT = 180;
  const WIDTH = 900;
  const CHART_W = WIDTH - LEFT - 20;

  const getX = (year: number) => ((year - globalMin) / range) * CHART_W + LEFT;

  const handleClick = (personId: string) => {
    setSelectedPerson(personId);
    setActiveModule('person-stats');
  };

  const totalHeight = stats.reduce((sum, s) => sum + (s.people.length * (BAR_H + GAP)) + 50, 0) + 30;

  return (
    <div className="overflow-x-auto custom-scrollbar print:overflow-visible print:max-h-none" style={{ maxHeight: 600 }}>
      <svg width={WIDTH} height={totalHeight} style={{ minWidth: WIDTH, fontFamily: 'inherit' }}>
        {stats.map((genStat, gi) => {
          const prevSections = stats.slice(0, gi);
          const yOffset = prevSections.reduce((sum, s) => sum + (s.people.length * (BAR_H + GAP)) + 50, 0);

          const peopleSorted = [...genStat.people].sort((a, b) => (a.birthYear || 9999) - (b.birthYear || 9999));

          return (
            <g key={genStat.generation} transform={`translate(0, ${yOffset})`}>
              {/* Generation header */}
              <foreignObject x={0} y={0} width={WIDTH} height={36}>
                <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-200">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {genStat.label}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {genStat.maleCount > 0 && <span className="text-blue-500">M prosjek {genStat.maleAvg}g ({genStat.maleCount})</span>}
                    {genStat.maleCount > 0 && genStat.femaleCount > 0 && ' · '}
                    {genStat.femaleCount > 0 && <span className="text-pink-500">Ž prosjek {genStat.femaleAvg}g ({genStat.femaleCount})</span>}
                  </span>
                </div>
              </foreignObject>

              {/* Decade grid lines */}
              {decades.map(y => (
                <g key={y}>
                  <line x1={getX(y)} y1={38} x2={getX(y)} y2={38 + peopleSorted.length * (BAR_H + GAP)} stroke="#e2e8f0" strokeWidth={0.5} />
                  {gi === 0 && (
                    <text x={getX(y)} y={38 + peopleSorted.length * (BAR_H + GAP) + 14} textAnchor="middle" fontSize={8} fill="#94a3b8">{y}</text>
                  )}
                </g>
              ))}

              {/* Person bars */}
              {peopleSorted.map((person, pi) => {
                const y = 40 + pi * (BAR_H + GAP);
                const birth = person.birthYear || globalMin;
                const death = person.deathYear || (person.birthYear ? person.birthYear + (person.age || 70) : globalMin + 50);
                const x1 = getX(birth);
                const x2 = Math.max(getX(death), x1 + 3);
                const color = person.sex === 'M' ? MALE_COLOR : person.sex === 'F' ? FEMALE_COLOR : '#94a3b8';
                const isHovered = hoveredId === person.personId;

                return (
                  <g
                    key={person.personId}
                    onMouseEnter={() => setHoveredId(person.personId)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => handleClick(person.personId)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Name */}
                    <text
                      x={LEFT - 6}
                      y={y + BAR_H / 2 + 4}
                      textAnchor="end"
                      fontSize={10}
                      fill={isHovered ? '#0d9488' : '#64748b'}
                      fontWeight={isHovered ? 700 : 500}
                    >
                      {person.name.length > 24 ? person.name.slice(0, 22) + '…' : person.name}
                    </text>

                    {/* Bar bg */}
                    <rect x={LEFT} y={y} width={CHART_W} height={BAR_H} fill={isHovered ? '#f8fafc' : 'transparent'} rx={3} />

                    {/* Life bar */}
                    <rect
                      x={x1} y={y + 3}
                      width={Math.max(3, x2 - x1)}
                      height={BAR_H - 6}
                      fill={color}
                      opacity={isHovered ? 1 : 0.7}
                      rx={3}
                    />

                    {/* Age label on bar */}
                    {person.age && (
                      <text
                        x={x2 + 6}
                        y={y + BAR_H / 2 + 4}
                        fontSize={9}
                        fill="#94a3b8"
                        fontWeight={600}
                      >
                        {person.age}g
                      </text>
                    )}

                    {/* Tooltip */}
                    {isHovered && (
                      <foreignObject x={Math.min(x1, WIDTH - 250)} y={y - 34} width={240} height={30}>
                        <div style={{ background: '#1e293b', color: '#5eead4', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {person.name} · {person.birthYear || '?'}–{person.deathYear || '?'} · {person.age ? `${person.age} god` : 'nepoznato'}
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Set total SVG height */}
        <rect
          x={0} y={0}
          width={1}
          height={stats.reduce((sum, s) => sum + (s.people.length * (BAR_H + GAP)) + 50, 0) + 30}
          fill="transparent"
        />
      </svg>
    </div>
  );
}

// ─── Summary Table ──────────────────────────────────────────

function SummaryTable({ stats }: { stats: GenStats[] }) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Generacija</th>
            <th className="px-5 py-3 text-center text-xs font-black text-blue-400 uppercase tracking-wider">Prosjek muškarci</th>
            <th className="px-5 py-3 text-center text-xs font-black text-pink-400 uppercase tracking-wider">Prosjek žene</th>
            <th className="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Ukupan prosjek</th>
            <th className="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Ukupno osoba</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stats.map(s => (
            <tr key={s.generation} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-5 py-3 font-bold text-slate-700">{s.label}</td>
              <td className="px-5 py-3 text-center">
                {s.maleCount > 0 ? (
                  <div>
                    <span className="font-black text-blue-600">{s.maleAvg}g</span>
                    <div className="text-[10px] text-slate-400">{s.maleCount} {s.maleCount === 1 ? 'muškarac' : 'muškaraca'}</div>
                  </div>
                ) : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-5 py-3 text-center">
                {s.femaleCount > 0 ? (
                  <div>
                    <span className="font-black text-pink-600">{s.femaleAvg}g</span>
                    <div className="text-[10px] text-slate-400">{s.femaleCount} {s.femaleCount === 1 ? 'žena' : 'žena'}</div>
                  </div>
                ) : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-5 py-3 text-center font-black text-slate-700">
                {s.totalCount > 0 ? `${s.overallAvg}g` : '—'}
              </td>
              <td className="px-5 py-3 text-center font-bold text-slate-600">
                {s.totalCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Module ────────────────────────────────────────────

export default function Lifespans() {
  const { tree, selectedPersonId, setSelectedPerson, setActiveModule } = useApp();
  const [maxGen, setMaxGen] = useState(8);

  const allData = useMemo(() => {
    if (!tree || !selectedPersonId) return [];
    return collectAncestorLifespans(tree, selectedPersonId, maxGen);
  }, [tree, selectedPersonId, maxGen]);

  const genStats = useMemo(() => computeGenStats(allData, maxGen), [allData, maxGen]);

  // Overall stats
  const overallStats = useMemo(() => {
    const withAge = allData.filter(d => d.age && d.age > 0 && d.age < 115);
    const avg = withAge.length > 0 ? Math.round(withAge.reduce((s, d) => s + (d.age || 0), 0) / withAge.length) : null;
    const maxAge = withAge.length > 0 ? Math.max(...withAge.map(d => d.age || 0)) : null;
    const maxPerson = maxAge ? withAge.find(d => d.age === maxAge) : null;
    return { avg, maxAge, maxPerson, count: withAge.length, total: allData.length };
  }, [allData]);

  if (!tree) return null;

  if (!selectedPersonId) return null;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* GENERATION DEPTH SELECTOR */}
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider shrink-0">PRIKAZ DO</span>
          <div className="flex items-center gap-1 flex-wrap">
            {GEN_DEPTHS.map(g => (
              <button
                key={g}
                onClick={() => setMaxGen(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all
                  ${maxGen === g
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
              >
                {g}G
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400 font-medium">— {GEN_DEPTH_LABELS[maxGen] || `${maxGen - 2}x-pradjedovi i prabake`}</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-500 font-bold">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-400 inline-block"></span>
            Muškarci
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-pink-400 inline-block"></span>
            Žene
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Ukupno predaka', value: overallStats.total, icon: '👥', color: 'teal' },
          { label: 'S poznatim vijekom', value: overallStats.count, icon: '📊', color: 'blue' },
          { label: 'Prosječni vijek', value: overallStats.avg ? `${overallStats.avg} god.` : '—', icon: '⏱️', color: 'green' },
          { label: 'Najstarija osoba', value: overallStats.maxPerson ? `${overallStats.maxPerson.name.split(' ')[0]} (${overallStats.maxAge}g)` : '—', icon: '🏆', color: 'amber' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl">{s.icon}</div>
            <div className="text-xl font-bold text-[var(--text-primary)]">{s.value}</div>
            <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* BAR CHART */}
      <div className="card p-5">
        <h3 className="font-extrabold text-slate-700 mb-1">Prosječni životni vijek po generacijama</h3>
        <p className="text-xs text-slate-400 font-medium mb-4">Srednja vrijednost proživljenih godina — grupirano po spolu za svaku generaciju predaka</p>
        <AvgBarChart stats={genStats} />
      </div>

      {/* GANTT TIMELINE */}
      <div className="card p-5">
        <h3 className="font-extrabold text-slate-700 mb-1">Vremenska crta životnog vijeka predaka</h3>
        <p className="text-xs text-slate-400 font-medium mb-4">Svaka traka prikazuje raspon od godine rođenja do godine smrti</p>
        <GanttTimeline stats={genStats} />
      </div>

      {/* SUMMARY TABLE */}
      <div className="card p-5">
        <h3 className="font-extrabold text-slate-700 mb-4">Sažetak po generacijama</h3>
        <SummaryTable stats={genStats} />
      </div>
    </div>
  );
}
