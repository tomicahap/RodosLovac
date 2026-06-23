import React, { useCallback, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { DEMO_FILES } from '../demo/demoData';
import { 
  UserCircle2, BarChart3, Activity, Clock, 
  MapPin, Tag, PlaneTakeoff, BookOpen, CalendarDays, 
  Search, Download, ShieldCheck, ArrowRight
} from 'lucide-react';
import DetectiveIcon from './DetectiveIcon';

function LoadingState() {
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    const start = Date.now();
    const duration = 9000;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min((elapsed / duration) * 100, 100);
      setProgress(p);
      if (p >= 100) clearInterval(interval);
    }, 50);
    
    return () => clearInterval(interval);
  }, []);

  let msg = "Učitavam GEDCOM datoteku...";
  if (progress > 33.33) msg = "Analiziram podatke...";
  if (progress > 66.66) msg = "Pripremam izvješće...";

  return (
    <div className="flex flex-col items-center justify-center p-6 animate-fade-in w-full max-w-md mx-auto">
      <div className="relative mb-8 mt-4">
        <div className="absolute inset-0 bg-[#00ab84] rounded-full animate-ping opacity-30 delay-100"></div>
        <div className="absolute -inset-4 border-2 border-dashed border-[#00ab84] rounded-full animate-spin-slow opacity-20"></div>
        <div className="w-20 h-20 bg-[#00ab84] rounded-2xl rotate-3 flex items-center justify-center text-white shadow-xl relative animate-bounce" style={{ animationDuration: '2s' }}>
          <DetectiveIcon size={48} />
        </div>
      </div>
      <h3 className="text-xl font-extrabold text-gray-900 mb-4">{msg}</h3>
      <div className="w-full bg-teal-100 rounded-full h-2.5 overflow-hidden">
        <div className="bg-teal-500 h-2.5 rounded-full transition-all duration-75 ease-linear" style={{ width: `${progress}%` }}></div>
      </div>
      <p className="text-sm font-semibold text-teal-600 mt-2">{Math.floor(progress)}%</p>
    </div>
  );
}

export default function LandingPage() {
  const { loadGedcom, isLoading, loadError, appVersion, uploadCount } = useApp();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ged') && !file.name.toLowerCase().endsWith('.gedcom')) {
      alert('Molimo odaberite .ged ili .gedcom datoteku');
      return;
    }
    const text = await file.text();
    await loadGedcom(text, file.name);
  }, [loadGedcom]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const loadDemo = async (gedcom: string, name: string) => {
    await loadGedcom(gedcom, name);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col lg:flex-row gap-16 lg:gap-24">
        
        {/* Left Column: Upload & Demos */}
        <div className="flex-1 lg:max-w-[550px]">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#00ab84] flex items-center justify-center text-white shadow-sm">
              <DetectiveIcon size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none mb-1">RodosLovac</h1>
              <div className="text-sm font-semibold text-teal-600">Alat za naprednu analizu obiteljskih stabala</div>
            </div>
          </div>

          <h2 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            Pretvorite svoj GEDCOM u vrijedne uvide
          </h2>
          <p className="text-lg text-gray-600 mb-10 leading-relaxed">
            Učitajte .ged datoteku i odmah istražite svoju obiteljsku povijest pomoću interaktivnih grafikona, karti, izvješća i alata za istraživanje.
          </p>

          {/* Upload Box */}
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragOver ? 'border-teal-500 bg-teal-50' : 'border-teal-200 bg-teal-50/30 hover:bg-teal-50/60'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ged,.gedcom"
              className="hidden"
              onChange={handleFileInput}
            />
            <div className="flex flex-col items-center">
              <div className="text-5xl mb-4">📂</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Povucite vašu .ged datoteku ovdje
              </h3>
              <p className="text-gray-500">ili kliknite za pregledavanje</p>
            </div>
          </div>

          {loadError && (
            <div className="mt-4 px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
              <strong>Greška:</strong> {loadError}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mt-6 text-sm font-medium text-teal-700">
            <ShieldCheck size={18} />
            Vaša datoteka se ne učitava na server — čita se lokalno u pregledniku.
          </div>

          <div className="mt-4 px-4 py-3 bg-red-50/80 text-red-800 rounded-xl text-xs border border-red-200/80 flex items-start gap-2.5 shadow-sm">
            <span className="text-base leading-none">💡</span>
            <span>
              <strong>Savjet za korištenje:</strong> U gornjem desnom kutu ekrana nalazi se crveni znak upitnika <strong>(?)</strong>. Klikom na njega na bilo kojoj stranici (pa i ovoj početnoj) dobit ćete detaljne upute, opis mogućnosti i kazalo boja/simbola za trenutni modul.
            </span>
          </div>

          <div className="flex items-center gap-4 my-10">
            <div className="flex-1 h-px bg-gray-200"></div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">ILI ISPROBAJTE DEMO STABLO</div>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Demo Trees List */}
          <div className="space-y-3">
            {DEMO_FILES.map((demo) => (
              <button
                key={demo.id}
                onClick={() => loadDemo(demo.gedcom, demo.name + '.ged')}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-teal-500 hover:shadow-md transition-all group bg-white text-left"
              >
                <div>
                  <div className="font-bold text-gray-900 flex items-center gap-1 group-hover:text-teal-700 transition-colors">
                    {demo.name} <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </div>
                  <div className="text-sm text-gray-500">{demo.description}</div>
                </div>
                <div className="text-xs font-semibold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-md whitespace-nowrap">
                  {demo.id === 'small' ? '40 osoba' : demo.id === 'medium' ? '200 osoba' : '1.000 osoba'}
                </div>
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-center mt-8">
            Podržava GEDCOM iz Ancestry, MyHeritage, RootsMagic, Family Tree Maker i ostalih alata.
          </p>
        </div>

        {/* Right Column: Features List */}
        <div className="flex-1">
          {/* Section 1 */}
          <div className="mb-10">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-6">
              Ljudi & Analiza
            </h3>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <UserCircle2 className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Statistika osoba</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Pregled predaka i potomaka, pronalazač rođaka i staze odnosa.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <BarChart3 className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Grafikoni</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Interaktivni fan chart grafikoni i obiteljska stabla.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <Activity className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Pronalazač srodstva</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Pronađite točan put povezanosti između bilo koje dvije osobe u vašem stablu.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <Clock className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Životni vijek</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Prosječan životni vijek prema generaciji i spolu uz vizualnu vremensku traku.</div>
                </div>
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="mb-10">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-6">
              Karte & Otkrića
            </h3>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <MapPin className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Karta predaka</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Rodna mjesta predaka prikazana na interaktivnoj karti uz filtriranje.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <Tag className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Karta prezimena</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Pregledajte svako prezime i preslikajte njihovo podrijetlo.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <PlaneTakeoff className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Karta migracija</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Pratite migracije predaka kroz generacije u nove zemlje.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <BookOpen className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Popisna karta</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Pogledajte gdje je obitelj živjela tijekom povijesnih popisa stanovništva.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <CalendarDays className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Na današnji dan</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Rođendani, godišnjice i prekretnice u vašem obiteljskom stablu na današnji dan.</div>
                </div>
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 mb-6">
              Istraživanje & Izvoz
            </h3>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <Search className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Istraživanje</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Duplikati, zatvorene linije (brick walls), praznine u istraživanju i DNK preporuke.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <Download className="text-teal-500 shrink-0 mt-1" size={24} strokeWidth={1.5} />
                <div>
                  <div className="font-bold text-gray-900">Izvoz</div>
                  <div className="text-sm text-gray-600 leading-relaxed">Izvješća za ispis i dijeljive slike statistike stabla.</div>
                </div>
              </li>
            </ul>
          </div>

        </div>
      </div>
      
      {/* Bottom Stats */}
      <div className="max-w-7xl mx-auto px-6 pb-6 text-center text-[10px] text-gray-300 uppercase tracking-widest">
        RodosLovac v{appVersion} • {uploadCount} učitavanja
      </div>
    </div>
  );
}
