// ============================================================
// Lifespans Module — bar charts + swim-lane timeline
// ============================================================

import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import type { LifespanEntry } from '../../parser/gedcomTypes';
import { HelpButton, HelpModal } from '../../components/HelpModal';

const COLORS: Record<string, string> = { M: '#60a5fa', F: '#f472b6', U: '#94a3b8', X: '#94a3b8' };

// ─── Average lifespan by generation ─────────────────────────

function AvgByGeneration({ data }: { data: LifespanEntry[] }) {
  const chartData = useMemo(() => {
    const byGen = new Map<number, { total: number; count: number; male: number; mCount: number; female: number; fCount: number }>();

    for (const entry of data) {
      if (!entry.age || entry.age < 1 || entry.age > 115) continue;
      if (!byGen.has(entry.generation)) {
        byGen.set(entry.generation, { total: 0, count: 0, male: 0, mCount: 0, female: 0, fCount: 0 });
      }
      const g = byGen.get(entry.generation)!;
      g.total += entry.age;
      g.count++;
      if (entry.sex === 'M') { g.male += entry.age; g.mCount++; }
      if (entry.sex === 'F') { g.female += entry.age; g.fCount++; }
    }

    return Array.from(byGen.entries())
      .filter(([, v]) => v.count >= 2)
      .sort(([a], [b]) => a - b)
      .slice(0, 10)
      .map(([gen, v]) => ({
        label: gen === 0 ? 'Korijenski' : gen > 0 ? `Predak G${gen}` : `Potomak G${Math.abs(gen)}`,
        avg: Math.round(v.total / v.count),
        muški: v.mCount > 0 ? Math.round(v.male / v.mCount) : 0,
        ženski: v.fCount > 0 ? Math.round(v.female / v.fCount) : 0,
        count: v.count,
      }));
  }, [data]);

  if (chartData.length === 0) return (
    <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
      Nema dovoljno podataka o životnom vijeku
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          angle={-35}
          textAnchor="end"
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          label={{ value: 'Godine', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: 10, fill: 'var(--text-muted)' } }}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}
          formatter={(value, name) => [`${value} god.`, name]}
        />
        <Bar dataKey="avg" name="Prosjek" fill="#608bff" radius={[3, 3, 0, 0]} />
        <Bar dataKey="muški" name="Muškarci" fill="#60a5fa" radius={[3, 3, 0, 0]} />
        <Bar dataKey="ženski" name="Žene" fill="#f472b6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Swim-lane timeline ───────────────────────────────────────

const LANE_HEIGHT = 24;
const LANE_PADDING = 4;

function SwimLane({ data, minYear, maxYear }: { data: LifespanEntry[]; minYear: number; maxYear: number }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const range = maxYear - minYear || 1;
  const { setSelectedPerson } = useApp();

  const filtered = useMemo(() =>
    data
      .filter(d => d.birthYear && (d.birthYear >= minYear - 50))
      .sort((a, b) => (a.birthYear || 0) - (b.birthYear || 0))
      .slice(0, 300),
    [data, minYear]
  );

  if (filtered.length === 0) return (
    <div className="text-center p-8 text-[var(--text-muted)]">Nema podataka za prikaz</div>
  );

  const totalHeight = filtered.length * (LANE_HEIGHT + LANE_PADDING);
  const WIDTH = 700;
  const LEFT_MARGIN = 160;

  const getX = (year: number) => ((year - minYear) / range) * (WIDTH - LEFT_MARGIN - 20) + LEFT_MARGIN;

  // Tick marks every decade
  const decades = [];
  for (let y = Math.ceil(minYear / 10) * 10; y <= maxYear; y += 10) {
    decades.push(y);
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: 500 }}>
      <svg width={WIDTH} height={totalHeight + 30} style={{ minWidth: WIDTH, fontFamily: 'inherit' }}>
        {/* Decade lines */}
        {decades.map(y => (
          <g key={y}>
            <line
              x1={getX(y)} y1={0} x2={getX(y)} y2={totalHeight}
              stroke="var(--border-color)" strokeWidth={0.5}
            />
            <text x={getX(y)} y={totalHeight + 18} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
              {y}
            </text>
          </g>
        ))}

        {/* Person bars */}
        {filtered.map((entry, i) => {
          const y = i * (LANE_HEIGHT + LANE_PADDING);
          const birth = entry.birthYear || minYear;
          const death = entry.deathYear || Math.min(maxYear, birth + (entry.age || 80));
          const x1 = getX(birth);
          const x2 = Math.max(getX(death), x1 + 2);
          const color = COLORS[entry.sex] || COLORS.U;
          const isHovered = hoveredId === entry.personId;

          return (
            <g key={entry.personId}
              onMouseEnter={() => setHoveredId(entry.personId)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setSelectedPerson(entry.personId)}
              style={{ cursor: 'pointer' }}
            >
              {/* Name label */}
              <text
                x={LEFT_MARGIN - 6}
                y={y + LANE_HEIGHT / 2 + 4}
                textAnchor="end"
                fontSize={9.5}
                fill={isHovered ? 'var(--brand-color)' : 'var(--text-muted)'}
                fontWeight={isHovered ? '600' : '400'}
              >
                {entry.name.length > 22 ? entry.name.slice(0, 20) + '…' : entry.name}
              </text>

              {/* Background row */}
              <rect
                x={LEFT_MARGIN}
                y={y}
                width={WIDTH - LEFT_MARGIN - 20}
                height={LANE_HEIGHT}
                fill={isHovered ? 'var(--bg-secondary)' : 'transparent'}
                rx={3}
              />

              {/* Lifespan bar */}
              <rect
                x={x1}
                y={y + 4}
                width={Math.max(3, x2 - x1)}
                height={LANE_HEIGHT - 8}
                fill={color}
                opacity={isHovered ? 1 : 0.7}
                rx={2}
              />

              {/* Death indicator */}
              {!entry.deathYear && entry.birthYear && (
                <path
                  d={`M ${x2 - 1} ${y + 6} L ${x2 + 5} ${y + LANE_HEIGHT / 2} L ${x2 - 1} ${y + LANE_HEIGHT - 6}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.5}
                />
              )}

              {/* Hover tooltip */}
              {isHovered && (
                <foreignObject x={Math.min(x1, WIDTH - 180)} y={y - 40} width={180} height={36}>
                  <div className="tooltip-content text-[10px] p-1.5">
                    <strong>{entry.name}</strong><br />
                    {entry.birthYear}–{entry.deathYear || '?'} {entry.age ? `(${entry.age} god.)` : ''}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Main Module ─────────────────────────────────────────────

export default function Lifespans() {
  const { tree, graph, selectedPersonId } = useApp();
  const [view, setView] = useState<'chart' | 'swimlane'>('chart');
  const [helpOpen, setHelpOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'M' | 'F'>('all');
  const [yearFrom, setYearFrom] = useState(1700);
  const [yearTo, setYearTo] = useState(new Date().getFullYear());

  const allData = useMemo(() => {
    if (!graph) return [];
    return graph.getLifespanData(selectedPersonId || undefined);
  }, [graph, selectedPersonId]);

  const filtered = useMemo(() =>
    allData.filter(d => {
      if (filter !== 'all' && d.sex !== filter) return false;
      if (d.birthYear && (d.birthYear < yearFrom || d.birthYear > yearTo)) return false;
      return true;
    }),
    [allData, filter, yearFrom, yearTo]
  );

  const stats = useMemo(() => {
    const withAge = filtered.filter(d => d.age && d.age > 0 && d.age < 115);
    const avgAge = withAge.length > 0
      ? Math.round(withAge.reduce((s, d) => s + (d.age || 0), 0) / withAge.length)
      : null;
    const maxAge = withAge.length > 0 ? Math.max(...withAge.map(d => d.age || 0)) : null;
    const maxPerson = maxAge ? withAge.find(d => d.age === maxAge) : null;
    return { avgAge, maxAge, maxPerson, count: withAge.length };
  }, [filtered]);

  if (!tree || !graph) return null;

  const minYear = allData.reduce((m, d) => d.birthYear ? Math.min(m, d.birthYear) : m, yearTo);
  const maxYear = allData.reduce((m, d) => d.birthYear ? Math.max(m, d.birthYear) : m, minYear);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Životni vijekovi</h2>
          <p className="section-subtitle">Prosječni životni vijek po generaciji i swim-lane timeline predaka</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          {(['chart', 'swimlane'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v ? 'bg-[var(--bg-card)] shadow text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              {v === 'chart' ? '📊 Grafovi' : '📅 Timeline'}
            </button>
          ))}
        </div>

        <select className="input w-32" value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="all">Svi</option>
          <option value="M">Muški</option>
          <option value="F">Ženski</option>
        </select>

        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Od:</span>
          <input type="number" className="input w-20" value={yearFrom} min={1000} max={yearTo}
            onChange={e => setYearFrom(Number(e.target.value))} />
          <span>Do:</span>
          <input type="number" className="input w-20" value={yearTo} min={yearFrom} max={2030}
            onChange={e => setYearTo(Number(e.target.value))} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Osoba s podacima', value: stats.count, icon: '👥', color: 'brand' },
          { label: 'Prosječni životni vijek', value: stats.avgAge ? `${stats.avgAge} god.` : '—', icon: '📊', color: 'green' },
          { label: 'Najstarija osoba', value: stats.maxAge ? `${stats.maxAge} god.` : '—', icon: '🏆', color: 'amber' },
          { label: 'Najstarija: ime', value: stats.maxPerson?.name || '—', icon: '👤', color: 'purple' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl">{s.icon}</div>
            <div className="text-xl font-bold text-[var(--text-primary)]">{s.value}</div>
            <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main view */}
      {view === 'chart' ? (
        <div className="card p-5">
          <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-4">
            Prosječni životni vijek po generaciji
          </h4>
          <AvgByGeneration data={filtered} />
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">
              Timeline predaka (prikazano {Math.min(filtered.length, 300)} od {filtered.length})
            </h4>
            <div className="flex gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400 inline-block"></span> Muškarci</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-400 inline-block"></span> Žene</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400 inline-block"></span> Nepoznato</span>
            </div>
          </div>
          <SwimLane data={filtered} minYear={yearFrom} maxYear={yearTo} />
        </div>
      )}

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Životni vijekovi"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>Životni vijekovi</strong> prikazuje statistiku dugovječnosti i trajanje života vaših predaka na dva načina:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Prosječni životni vijek po generaciji (Grafikon):</strong> Uspoređuje prosječnu životnu dob muškaraca i žena kroz različite generacije predaka (npr. roditelji, djedovi i bake, pradjedovi). To vam omogućuje da vidite kako se životni vijek mijenjao kroz stoljeća.
            </li>
            <li>
              <strong>Timeline predaka (Swim-lane):</strong> Grafički prikazuje točan vremenski raspon života svakog pretka na povijesnoj ljestvici. Pomaže vam uočiti tko su bili suvremenici u obitelji te u kojim su povijesnim razdobljima živjeli.
            </li>
          </ul>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kazalo i objašnjenja:</h4>
          <ul className="list-none pl-1 space-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <span className="w-4 h-3 bg-blue-400 rounded inline-block"></span>
              <strong>Plave linije:</strong> Muškarci
            </li>
            <li className="flex items-center gap-2">
              <span className="w-4 h-3 bg-pink-400 rounded inline-block"></span>
              <strong>Ružičaste linije:</strong> Žene
            </li>
            <li className="flex items-center gap-2">
              <span className="w-4 h-3 bg-gray-400 rounded inline-block"></span>
              <strong>Sive linije/strelice:</strong> Nepoznato (nedostaje točan datum smrti ili se radi o još uvijek živoj osobi).
            </li>
          </ul>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Filtriranje:</h4>
          <p className="text-xs text-slate-500">
            Koristite gumbe za brzi filter po spolu (Svi / M / Ž) te klizače za odabir vremenskog raspona godina rođenja kako biste suzili prikaz samo na određeni povijesni period.
          </p>
        </div>
      </HelpModal>
    </div>
  );
}
