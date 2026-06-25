// ============================================================
// On This Day Module — events matching a selected date
// ============================================================

import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ChevronDown, ChevronRight, ChevronLeft, Download, FileSpreadsheet } from 'lucide-react';

const MONTH_NAMES = ['', 'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
  'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'];



interface EventItem {
  id: string;
  type: 'birth' | 'death' | 'marriage';
  year?: number;
  yearsAgo?: number;
  isDeceased?: boolean;
  ageAtDeath?: number;
  ageIfAlive?: number;
  currentAge?: number;
  age?: number;
  husbandName?: string;
  wifeName?: string;
  place?: string;
  personName?: string;
  sex?: 'M' | 'F' | 'U' | 'X';
}

function exportToCSV(filename: string, rows: string[][]) {
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
    + rows.map(e => e.join(";")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function OnThisDay() {
  const { tree } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    birthdays: true,
    passings: true,
    anniversaries: true
  });

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };
  const expandAll = () => setExpandedSections({ birthdays: true, passings: true, anniversaries: true });

  const goPrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };
  const goNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = parseInt(e.target.value);
    const d = new Date(currentDate);
    d.setMonth(m - 1);
    setCurrentDate(d);
  };
  
  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value);
    const d = new Date(currentDate);
    d.setDate(val);
    setCurrentDate(d);
  };

  const isToday = () => {
    const t = new Date();
    return t.getDate() === currentDate.getDate() && t.getMonth() === currentDate.getMonth();
  };

  const { birthdays, passings, anniversaries } = useMemo(() => {
    const b: EventItem[] = [];
    const p: EventItem[] = [];
    const a: EventItem[] = [];
    if (!tree) return { birthdays: b, passings: p, anniversaries: a };

    const cDay = currentDate.getDate();
    const cMonth = currentDate.getMonth() + 1;
    const currentYear = new Date().getFullYear();

    for (const person of tree.persons.values()) {
      const name = person.names[0]?.full || 'Nepoznato';
      
      // BIRTHDAYS
      if (person.birth?.date && person.birth.date.day === cDay && person.birth.date.month === cMonth) {
        const bYear = person.birth.date.year;
        const dYear = person.death?.date?.year;
        const isDeceased = !!person.death;
        
        let ageIfAlive = bYear ? currentYear - bYear : undefined;
        let currentAge = (!isDeceased && bYear) ? currentYear - bYear : undefined;
        let ageAtDeath = (isDeceased && bYear && dYear) ? dYear - bYear : undefined;

        b.push({
          id: person.id, type: 'birth', personName: name, sex: person.sex,
          year: bYear, isDeceased, ageIfAlive, currentAge, ageAtDeath
        });
      }

      // PASSINGS
      if (person.death?.date && person.death.date.day === cDay && person.death.date.month === cMonth) {
        const dYear = person.death.date.year;
        const bYear = person.birth?.date?.year;
        const yearsAgo = dYear ? currentYear - dYear : undefined;
        const age = (bYear && dYear) ? dYear - bYear : undefined;

        p.push({
          id: person.id + '_d', type: 'death', personName: name, sex: person.sex,
          year: dYear, yearsAgo, age
        });
      }
    }

    // ANNIVERSARIES
    for (const fam of tree.families.values()) {
      if (fam.marriage?.date && fam.marriage.date.day === cDay && fam.marriage.date.month === cMonth) {
        const mYear = fam.marriage.date.year;
        const yearsAgo = mYear ? currentYear - mYear : undefined;
        
        const husb = fam.husband ? tree.persons.get(fam.husband) : null;
        const wife = fam.wife ? tree.persons.get(fam.wife) : null;

        a.push({
          id: fam.id, type: 'marriage',
          husbandName: husb?.names[0]?.full || 'Nepoznati muž',
          wifeName: wife?.names[0]?.full || 'Nepoznata žena',
          year: mYear, yearsAgo,
          place: fam.marriage.place
        });
      }
    }

    b.sort((x, y) => (y.year || 0) - (x.year || 0));
    p.sort((x, y) => (y.year || 0) - (x.year || 0));
    a.sort((x, y) => (y.year || 0) - (x.year || 0));

    return { birthdays: b, passings: p, anniversaries: a };
  }, [tree, currentDate]);

  const downloadCSV = (e: React.MouseEvent, type: 'birth'|'death'|'marriage'|'all') => {
    e.stopPropagation();
    let rows: string[][] = [];
    if (type === 'birth' || type === 'all') {
      rows.push(['KATEGORIJA', 'IME', 'SPOL', 'RODJEN', 'DOB_STATUS']);
      birthdays.forEach(x => {
        let status = x.isDeceased ? `Danas bi imao/la ${x.ageIfAlive}` : `Trenutno ima ${x.currentAge}`;
        if (x.isDeceased && x.ageAtDeath) status += ` (Preminuo/la u ${x.ageAtDeath}. godini)`;
        rows.push(['Rođendan', x.personName || '', x.sex || '', x.year?.toString() || '', status]);
      });
    }
    if (type === 'death' || type === 'all') {
      rows.push(['KATEGORIJA', 'IME', 'SPOL', 'UMRO', 'DOB_U_SMRTI', 'PRIJE_GODINA']);
      passings.forEach(x => {
        rows.push(['Smrt', x.personName || '', x.sex || '', x.year?.toString() || '', x.age?.toString() || '', x.yearsAgo?.toString() || '']);
      });
    }
    if (type === 'marriage' || type === 'all') {
      rows.push(['KATEGORIJA', 'MUZ', 'ZENA', 'VJENCANI', 'LOKACIJA', 'PRIJE_GODINA']);
      anniversaries.forEach(x => {
        rows.push(['Godišnjica', x.husbandName || '', x.wifeName || '', x.year?.toString() || '', x.place || '', x.yearsAgo?.toString() || '']);
      });
    }
    exportToCSV(`na_danasnji_dan_${type}.csv`, rows);
  };

  const getDaysInMonth = (m: number) => new Date(2024, m, 0).getDate();

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      
      {/* KRONOLOŠKA UPRAVLJAČKA PLOČA */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center relative overflow-hidden flex flex-col items-center">
        {/* Dekorativna pozadina */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-full blur-3xl opacity-50 pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none -ml-20 -mb-20"></div>

        {isToday() && (
          <span className="text-teal-600 font-black tracking-widest uppercase text-xs mb-3 bg-teal-50 px-3 py-1 rounded-full relative z-10">
            Danas
          </span>
        )}

        <div className="flex items-center justify-center gap-6 relative z-10 w-full mb-2">
          <button onClick={goPrevDay} className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700 shadow-sm">
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex flex-col items-center min-w-[280px]">
            <h2 className="text-4xl md:text-5xl font-black text-slate-800 tabular-nums tracking-tight">
              {currentDate.getDate()}. {MONTH_NAMES[currentDate.getMonth() + 1].toLowerCase()} {currentDate.getFullYear()}.
            </h2>

          </div>

          <button onClick={goNextDay} className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700 shadow-sm">
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Kontrole ispod */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 relative z-10">


          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <span className="text-xs font-bold text-slate-400 uppercase">Idi na</span>
            <select value={currentDate.getMonth() + 1} onChange={handleMonthChange} className="bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer border-r border-slate-200 pr-2">
              {MONTH_NAMES.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={currentDate.getDate()} onChange={handleDayChange} className="bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer pl-1">
              {Array.from({length: getDaysInMonth(currentDate.getMonth() + 1)}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}.</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* GLOBALNE KONTROLE ACCORDIONA */}
      <div className="flex justify-between items-center px-2">
        <button onClick={expandAll} className="text-slate-500 font-bold text-sm hover:text-slate-800 transition-colors">
          ▼ Raširi sve
        </button>
        <button onClick={(e) => downloadCSV(e, 'all')} className="flex items-center gap-2 text-teal-600 bg-teal-50 px-4 py-2 rounded-xl font-bold text-sm hover:bg-teal-100 transition-colors">
          <Download size={16} /> Preuzmi sve
        </button>
      </div>

      {/* ACCORDIONI */}
      <div className="space-y-4">
        
        {/* ROĐENDANI */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleSection('birthdays')}
            className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎂</span>
              <div className="text-left">
                <h3 className="font-black text-xl text-slate-800 uppercase tracking-wide">Rođendani</h3>
                <p className="text-sm text-slate-400 font-bold">{birthdays.length} {birthdays.length === 1 ? 'osoba' : 'osoba'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div 
                onClick={(e) => downloadCSV(e, 'birth')}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors cursor-pointer text-sm font-bold"
              >
                <FileSpreadsheet size={16} /> Excel
              </div>
              {expandedSections.birthdays ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
            </div>
          </button>
          
          {expandedSections.birthdays && birthdays.length > 0 && (
            <div className="px-6 pb-6 pt-2 bg-slate-50 border-t border-slate-100 space-y-2">
              {birthdays.map((b, i) => (
                <div key={b.id + i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${b.sex === 'M' ? 'bg-blue-50 text-blue-500' : b.sex === 'F' ? 'bg-pink-50 text-pink-500' : 'bg-slate-100 text-slate-400'}`}>
                      {b.sex === 'M' ? '♂' : b.sex === 'F' ? '♀' : '?'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{b.personName}</div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        {b.isDeceased ? (
                          <>Danas bi imao/la <span className="font-bold">{b.ageIfAlive || '?'}</span> {b.ageAtDeath ? <span className="text-xs ml-1 opacity-70">(Preminuo/la u {b.ageAtDeath}. godini)</span> : ''}</>
                        ) : (
                          <>Trenutno ima <span className="font-bold">{b.currentAge || '?'}</span> god.</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-teal-600 font-bold">Rođen/a {b.year || '?'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {expandedSections.birthdays && birthdays.length === 0 && (
            <div className="px-6 pb-6 text-center text-slate-400 text-sm italic border-t border-slate-100 pt-6">Nema zabilježenih rođendana na ovaj datum.</div>
          )}
        </div>

        {/* SMRTI */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleSection('passings')}
            className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🕊️</span>
              <div className="text-left">
                <h3 className="font-black text-xl text-slate-800 uppercase tracking-wide">Smrti</h3>
                <p className="text-sm text-slate-400 font-bold">{passings.length} {passings.length === 1 ? 'osoba' : 'osoba'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div 
                onClick={(e) => downloadCSV(e, 'death')}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors cursor-pointer text-sm font-bold"
              >
                <FileSpreadsheet size={16} /> Excel
              </div>
              {expandedSections.passings ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
            </div>
          </button>
          
          {expandedSections.passings && passings.length > 0 && (
            <div className="px-6 pb-6 pt-2 bg-slate-50 border-t border-slate-100 space-y-2">
              {passings.map((p, i) => (
                <div key={p.id + i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${p.sex === 'M' ? 'bg-blue-50 text-blue-500' : p.sex === 'F' ? 'bg-pink-50 text-pink-500' : 'bg-slate-100 text-slate-400'}`}>
                      {p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '?'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{p.personName}</div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        Umro/la {p.year || '?'} · Dob: {p.age || '?'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 font-bold">{p.yearsAgo ? `Prije ${p.yearsAgo} god.` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {expandedSections.passings && passings.length === 0 && (
            <div className="px-6 pb-6 text-center text-slate-400 text-sm italic border-t border-slate-100 pt-6">Nema zabilježenih smrti na ovaj datum.</div>
          )}
        </div>

        {/* GODIŠNJICE BRAKA */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleSection('anniversaries')}
            className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">💍</span>
              <div className="text-left">
                <h3 className="font-black text-xl text-slate-800 uppercase tracking-wide">Godišnjice braka</h3>
                <p className="text-sm text-slate-400 font-bold">{anniversaries.length} parova</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div 
                onClick={(e) => downloadCSV(e, 'marriage')}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors cursor-pointer text-sm font-bold"
              >
                <FileSpreadsheet size={16} /> Excel
              </div>
              {expandedSections.anniversaries ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
            </div>
          </button>
          
          {expandedSections.anniversaries && anniversaries.length > 0 && (
            <div className="px-6 pb-6 pt-2 bg-slate-50 border-t border-slate-100 space-y-2">
              {anniversaries.map((a, i) => (
                <div key={a.id + i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="font-bold text-slate-800">{a.husbandName} & {a.wifeName}</div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      {a.place ? `u mjestu ${a.place.split(',')[0]} · ` : ''}{a.yearsAgo ? `prije ${a.yearsAgo} god.` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-teal-600 font-bold">Vjenčani {a.year || '?'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {expandedSections.anniversaries && anniversaries.length === 0 && (
            <div className="px-6 pb-6 text-center text-slate-400 text-sm italic border-t border-slate-100 pt-6">Nema zabilježenih vjenčanja na ovaj datum.</div>
          )}
        </div>

      </div>

      {/* FOOTER */}
      <div className="text-center mt-12 mb-4">
        <p className="text-xs font-semibold text-slate-400 max-w-xl mx-auto leading-relaxed">
          Prikazuju se samo događaji s potpunim danom, mjesecom i godinom u vašem GEDCOM-u. Približni datumi (ABT, BEF, AFT) su isključeni iz ove kalkulacije kako bi se osigurala točnost "Na današnji dan" funkcije.
        </p>
      </div>
      
    </div>
  );
}
