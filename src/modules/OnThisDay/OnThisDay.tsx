// ============================================================
// On This Day Module — events matching a selected date
// ============================================================

import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { GedcomPerson } from '../../parser/gedcomTypes';
import { HelpButton, HelpModal } from '../../components/HelpModal';

interface DayEvent {
  type: 'birth' | 'death' | 'marriage' | 'anniversary' | 'other';
  person: GedcomPerson;
  year?: number;
  age?: number;
  yearsAgo?: number;
  place?: string;
  description: string;
}

const MONTH_NAMES = ['', 'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'];

const EVENT_ICONS: Record<DayEvent['type'], string> = {
  birth: '🎂',
  death: '✝',
  marriage: '💍',
  anniversary: '💑',
  other: '📅',
};

const EVENT_COLORS: Record<DayEvent['type'], string> = {
  birth: 'badge-green',
  death: 'badge-gray',
  marriage: 'badge-brand',
  anniversary: 'badge-purple',
  other: 'badge-amber',
};

const EVENT_LABELS: Record<DayEvent['type'], string> = {
  birth: 'Рођendan',
  death: 'Godišnjica smrti',
  marriage: 'Dan vjenčanja',
  anniversary: 'Godišnjica',
  other: 'Događaj',
};

// ─── Hebrew calendar (simplified conversion) ─────────────────

const HEBREW_MONTHS = ['', 'Tišri', 'Hešvan', 'Kislev', 'Tevet', 'Švat', 'Adar', 'Nisan',
  'Ijar', 'Sivan', 'Tamuz', 'Av', 'Elul'];

function getHebrewDate(date: Date): string {
  // Approximate Hebrew date conversion (Gregorian → Hebrew)
  // This is a simplified approximation, not a full calendar conversion
  const jdn = date.getTime() / 86400000 + 2440587.5; // Julian Day Number
  const year = Math.floor((jdn - 347996.5) / 365.25) + 1;
  const months = Math.floor(((jdn - 347996.5) % 365.25) / 29.53);
  return `${HEBREW_MONTHS[Math.min(months + 1, 13)] || ''} ${Math.round(jdn % 29.5) + 1}, ${year + 3760}`;
}

// ─── Main Component ─────────────────────────────────────────

export default function OnThisDay() {
  const { tree } = useApp();
  const [helpOpen, setHelpOpen] = useState(false);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<{ month: number; day: number }>({
    month: today.getMonth() + 1,
    day: today.getDate(),
  });
  const [showHebrewDate, setShowHebrewDate] = useState(false);
  const [filterType, setFilterType] = useState<DayEvent['type'] | 'all'>('all');
  const currentYear = today.getFullYear();

  const events = useMemo((): DayEvent[] => {
    if (!tree) return [];
    const { month, day } = selectedDate;
    const result: DayEvent[] = [];

    for (const person of tree.persons.values()) {
      const name = person.names[0]?.full || 'Nepoznato';

      // Birthday
      if (person.birth?.date) {
        const d = person.birth.date;
        if (d.month === month && d.day === day) {
          const year = d.year;
          const isDeceased = !!person.death?.date?.year;
          const yearsAgo = year ? currentYear - year : undefined;
          result.push({
            type: isDeceased ? 'birth' : 'birth',
            person,
            year,
            yearsAgo,
            place: person.birth.place,
            description: isDeceased
              ? `Rodio/la se ${year ? `${year}. (${yearsAgo} god. temu)` : ''}`
              : `Proslavljuje ${yearsAgo ? `${yearsAgo}. ` : ''}rođendan`,
          });
        }
      }

      // Death anniversary
      if (person.death?.date) {
        const d = person.death.date;
        if (d.month === month && d.day === day) {
          const year = d.year;
          result.push({
            type: 'death',
            person,
            year,
            yearsAgo: year ? currentYear - year : undefined,
            place: person.death.place,
            description: `Preminuo/la ${year ? `${year}.` : ''}`,
          });
        }
      }

      // Marriage (from families)
      for (const famId of person.familiesAsSpouse) {
        const fam = tree.families.get(famId);
        if (!fam?.marriage?.date) continue;
        const d = fam.marriage.date;
        if (d.month === month && d.day === day) {
          const year = d.year;
          const spouseId = fam.husband === person.id ? fam.wife : fam.husband;
          const spouse = spouseId ? tree.persons.get(spouseId) : undefined;
          result.push({
            type: 'marriage',
            person,
            year,
            yearsAgo: year ? currentYear - year : undefined,
            place: fam.marriage.place,
            description: `Vjenčanje${spouse ? ` s ${spouse.names[0]?.full}` : ''}`,
          });
        }
      }

      // Other events
      for (const ev of person.events) {
        if (!ev.date?.month || !ev.date?.day) continue;
        if (ev.date.month === month && ev.date.day === day) {
          result.push({
            type: 'other',
            person,
            year: ev.date.year,
            yearsAgo: ev.date.year ? currentYear - ev.date.year : undefined,
            place: ev.place,
            description: ev.tag === 'BURI' ? 'Pokop' : ev.tag === 'CHR' ? 'Krštenje' : ev.value || ev.tag,
          });
        }
      }
    }

    return result.sort((a, b) => (a.year || 9999) - (b.year || 9999));
  }, [tree, selectedDate, currentYear]);

  const filtered = useMemo(() =>
    filterType === 'all' ? events : events.filter(e => e.type === filterType),
    [events, filterType]
  );

  const hebrewDate = useMemo(() => {
    const d = new Date(currentYear, selectedDate.month - 1, selectedDate.day);
    return getHebrewDate(d);
  }, [selectedDate, currentYear]);

  const monthDays = useMemo(() => {
    const maxDay = new Date(currentYear, selectedDate.month, 0).getDate();
    return Array.from({ length: maxDay }, (_, i) => i + 1);
  }, [selectedDate.month, currentYear]);

  if (!tree) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Na ovaj dan</h2>
          <p className="section-subtitle">Događaji u obiteljskom stablu koji se podudaraju s odabranim danom</p>
        </div>
      </div>

      {/* Date picker */}
      <div className="card p-5">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Mjesec</label>
              <select className="input w-36" value={selectedDate.month}
                onChange={e => setSelectedDate(d => ({ ...d, month: Number(e.target.value), day: 1 }))}>
                {MONTH_NAMES.slice(1).map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Dan</label>
              <select className="input w-24" value={selectedDate.day}
                onChange={e => setSelectedDate(d => ({ ...d, day: Number(e.target.value) }))}>
                {monthDays.map(d => <option key={d} value={d}>{d}.</option>)}
              </select>
            </div>
            <button className="btn btn-secondary mt-4"
              onClick={() => setSelectedDate({ month: today.getMonth() + 1, day: today.getDate() })}>
              Danas
            </button>
          </div>

          <div className="border-l border-[var(--border-color)] pl-4">
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {selectedDate.day}. {MONTH_NAMES[selectedDate.month]}
            </p>
            {showHebrewDate && (
              <p className="text-sm text-[var(--text-muted)] mt-0.5">🕎 {hebrewDate}</p>
            )}
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1 cursor-pointer">
              <input type="checkbox" checked={showHebrewDate} onChange={e => setShowHebrewDate(e.target.checked)} />
              Prikaži hebrejski datum
            </label>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'birth', 'death', 'marriage', 'other'] as const).map(type => {
          const count = type === 'all' ? events.length : events.filter(e => e.type === type).length;
          return (
            <button key={type} onClick={() => setFilterType(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                filterType === type
                  ? 'bg-[var(--brand-light)] border-[var(--brand-color)] text-[var(--brand-color)]'
                  : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
              }`}>
              {type === 'all' ? '🗓' : EVENT_ICONS[type]}
              {type === 'all' ? 'Svi' : EVENT_LABELS[type]}
              {count > 0 && <span className="font-semibold">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Events list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="font-medium text-[var(--text-primary)]">Nema događaja na ovaj dan</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Odaberi drugi datum ili dodaj više datuma u GEDCOM datoteku
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev, i) => (
            <div key={i} className="card p-4 flex gap-4 items-start hover:border-[var(--brand-color)] transition-colors">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                ev.type === 'birth' ? 'bg-green-500/10' :
                ev.type === 'death' ? 'bg-gray-500/10' :
                ev.type === 'marriage' ? 'bg-blue-500/10' : 'bg-amber-500/10'
              }`}>
                {EVENT_ICONS[ev.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[var(--text-primary)]">{ev.person.names[0]?.full}</span>
                  <span className={`badge ${EVENT_COLORS[ev.type]}`}>{EVENT_LABELS[ev.type]}</span>
                  {ev.year && <span className="text-sm text-[var(--text-muted)]">{ev.year}</span>}
                  {ev.yearsAgo !== undefined && ev.yearsAgo > 0 && (
                    <span className="text-xs text-[var(--text-muted)]">({ev.yearsAgo} god. temu)</span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{ev.description}</p>
                {ev.place && <p className="text-xs text-[var(--text-muted)] mt-0.5">📍 {ev.place}</p>}
              </div>
              <div className={`text-xs text-right flex-shrink-0 ${
                ev.person.sex === 'M' ? 'gender-m' : ev.person.sex === 'F' ? 'gender-f' : 'gender-u'
              }`}>
                {ev.person.sex === 'M' ? '♂' : ev.person.sex === 'F' ? '♀' : '?'}
              </div>
            </div>
          ))}
        </div>
      )}

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Na ovaj dan"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>Na ovaj dan</strong> omogućuje vam pretraživanje i otkrivanje povijesnih događaja u vašoj obitelji (rođenja, vjenčanja, smrti, pokopi, krštenja) koji su se dogodili na točno odabrani dan i mjesec u godini.
          </p>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kako koristiti modul:</h4>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Odabir datuma:</strong> Pomoću padajućih izbornika odaberite mjesec i dan. Aplikacija će automatski pretražiti stablo i izdvojiti sve događaje koji su se dogodili na taj dan kroz povijest.
            </li>
            <li>
              <strong>Hebrejski kalendar:</strong> Uključivanjem opcije prikazuje se približan ekvivalent datuma u hebrejskom (židovskom) kalendaru.
            </li>
            <li>
              <strong>Filtriranje:</strong> Filtrirajte rezultate prema rođendanima, godišnjicama smrti, vjenčanjima ili ostalim događajima.
            </li>
          </ul>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Ikone i boje događaja:</h4>
          <ul className="list-none pl-1 space-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <span className="text-sm">🎂</span>
              <strong>Rođendani:</strong> Zelena oznaka. Prikazuje se koliko je godina prošlo od rođenja osobe.
            </li>
            <li className="flex items-center gap-2">
              <span className="text-sm">✝</span>
              <strong>Godišnjica smrti:</strong> Siva oznaka. Označava datum smrti i broj godina od preminuća.
            </li>
            <li className="flex items-center gap-2">
              <span className="text-sm">💍</span>
              <strong>Vjenčanja / Godišnjice braka:</strong> Plava ili ljubičasta oznaka. Prikazuje vjenčanje i ime supružnika.
            </li>
            <li className="flex items-center gap-2">
              <span className="text-sm">📅</span>
              <strong>Ostali događaji:</strong> Narančasta oznaka. Pokriva događaje poput krštenja, pokopa ili drugih unesenih zabilješki.
            </li>
          </ul>
        </div>
      </HelpModal>
    </div>
  );
}
