import React, { useState } from 'react';
import { useApp, type AppModule } from '../context/AppContext';
import { Settings, HelpCircle, FileUp, Moon, Sun, X, Activity, Users, LayoutDashboard, BarChart3, Map, Calendar, Search, Download } from 'lucide-react';
import PersonSearch from './PersonSearch';
import DetectiveIcon from './DetectiveIcon';
import { HelpModal } from './HelpModal';

export default function AppHeader() {
  const { tree, fileName, theme, toggleTheme, resetTree, activeModule, setActiveModule, appVersion, uploadCount } = useApp();
  const [helpOpen, setHelpOpen] = useState(false);

  const NAV_ITEMS: { id: AppModule; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Pregled', icon: <LayoutDashboard size={16} /> },
    { id: 'person-stats', label: 'Statistika', icon: <Users size={16} /> },
    { id: 'relationships', label: 'Srodnost', icon: <Activity size={16} /> },
    { id: 'fan-chart', label: 'Grafovi', icon: <BarChart3 size={16} /> },
    { id: 'maps', label: 'Karte', icon: <Map size={16} /> },
    { id: 'lifespans', label: 'Životni vijek', icon: <Activity size={16} /> },
    { id: 'on-this-day', label: 'Na današnji dan', icon: <Calendar size={16} /> },
    { id: 'research', label: 'Istraživanje', icon: <Search size={16} /> },
    { id: 'export', label: 'Izvoz', icon: <Download size={16} /> },
  ];

  const getHelpContent = () => {
    switch (activeModule) {
      case 'landing':
        return (
          <div className="space-y-4">
            <p>
              Dobrodošli u <strong>RodosLovac</strong>! Kako biste započeli s analizom, učitajte svoju obiteljsku datoteku u standardnom GEDCOM formatu (<code>.ged</code> ili <code>.gedcom</code>) ili isprobajte jedno od naših demo stabala.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kako koristiti RodosLovac:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>Učitavanje stabla:</strong> Kliknite na polje za učitavanje ili povucite datoteku izravno s vašeg računala. Datoteka se obrađuje isključivo u vašem pregledniku i nigdje se ne šalje — sve je 100% lokalno i privatno.</li>
              <li><strong>Demo stabla:</strong> Ako trenutno nemate svoju datoteku, kliknite na neko od ponuđenih demo stabala (malo, srednje ili veliko) kako biste isprobali sve mogućnosti vizualizacije.</li>
              <li><strong>Pomoć na svakoj stranici:</strong> Crveni znak upitnika <strong>(?)</strong> koji vidite u gornjem desnom kutu zaglavlja uvijek je dostupan na istom mjestu i nudi detaljno objašnjenje, upute i kazalo za modul koji trenutno koristite.</li>
            </ul>
          </div>
        );
      case 'overview':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Nadzorna ploča</strong> pruža cjelokupni pregled zdravlja, demografije i aktivnosti unutar vašeg obiteljskog stabla.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Glavne sekcije:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>Zdravlje stabla (Tree Health):</strong> Provjera integriteta (greške u datumima), pokrivenosti vremenskim podacima i prisutnosti povijesnih izvora. Klikom na karticu otvaraju se popisi problematičnih profila.</li>
              <li><strong>Statistika i demografija:</strong> Brzi pregled prosječne životne dobi, najčešćih lokacija prebivališta te prečaci za istraživanje.</li>
              <li><strong>Glavna osoba (Dashboard):</strong> Detaljan profil, uža obitelj, fanchart i karta kretanja za početnu osobu stabla.</li>
            </ul>
          </div>
        );
      case 'person-stats':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Statistika pojedinca</strong> omogućuje dubinsku analizu bilo koje odabrane osobe u stablu.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Opcije:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>Osoba:</strong> Demografski sažetak, generacijska zastupljenost predaka/potomaka i preostale praznine za istraživanje.</li>
              <li><strong>Vremeplov:</strong> Slikovni i kronološki tijek života osobe i uže obitelji (rođenja, brakovi, selidbe, smrti) na grafički privlačnoj vremenskoj traci.</li>
              <li><strong>Roditelji i rođaci:</strong> Tablica srodstava s točnim stupnjevima i linijama. Klikom na osobu pokreće se <strong>vizualizator putanje srodstva</strong> koji grafički crta putanju povezivanja dviju osoba.</li>
            </ul>
          </div>
        );
      case 'relationships':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Srodstva i usporedbe</strong> sadrži napredne alate za komparaciju i povezivanje osoba u stablu.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Mogućnosti:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>Pronađi poveznicu:</strong> Pronalazi najkraći put srodstva između dvije odabrane osobe (Osoba A i B), provjerava krvnu srodnost i crta grafički prikaz odnosa.</li>
              <li><strong>Usporedi osobe:</strong> Uspoređuje životne događaje dviju osoba na paralelnoj vremenskoj ljestvici radi lakšeg pronalaženja preklapanja.</li>
              <li><strong>Usporedi stabla:</strong> Prikazuje preklapanja i statistiku zajedničkih srodnika.</li>
            </ul>
          </div>
        );
      case 'fan-chart':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Kružni graf (Fan Chart) & Generacijska starost (GenAge)</strong> vizualizira pretke odabrane osobe u punih 360 stupnjeva.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kako koristiti:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>Kružni graf (Kružni pregled):</strong> Prikazuje simetrično očevu (lijevo) i majčinu (desno) stranu. Bojanje možete mijenjati po generacijama, obiteljskim granama, životnom vijeku ili zemlji rođenja.</li>
              <li><strong>Generacijska starost (GenAge):</strong> Prikazuje dob predaka u trenutku rođenja djeteta. Obojani segmenti označavaju dobne skupine roditelja, a sivi nedostatak podataka o rođenju.</li>
              <li><strong>Obitelj (Veličina obitelji):</strong> Prikazuje broj djece u rodnoj obitelji predaka (on + braća i sestre, isključujući umrle u prvoj godini). Boja označava veličinu obitelji, od jedinaca do obitelji s 10+ djece.</li>
              <li><strong>Isticanje:</strong> Kada mišem prijeđete preko bilo koje osobe, sve ostale se priguše za 80%. U modu *Obitelj*, pređite mišem preko stavke u legendi kako biste istaknuli sve pretke s tim brojem djece.</li>
              <li><strong>Fokus:</strong> Klikom na bilo kojeg pretka postavljate ga kao centralnu osobu i osvježavate cijeli grafikon.</li>
            </ul>
          </div>
        );
      case 'maps':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Karte</strong> je središnje mjesto za geografsku vizualizaciju vaših predaka.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Dostupne karte:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>Karta predaka:</strong> Prikazuje mjesta rođenja i života vaših predaka uz pomoć klastera i toplinskih karti.</li>
              <li><strong>Karta potomaka:</strong> Geografski prikaz raseljenosti obitelji (u izradi).</li>
              <li><strong>Karta prezimena:</strong> Praćenje geografskog porijekla i migracija nositelja pojedinog prezimena.</li>
              <li><strong>Karta migracija:</strong> Rute preseljenja predaka (od rođenja do smrti) uz vremensku animaciju.</li>
              <li><strong>Popisna karta:</strong> Lokacije predaka s obzirom na godine popisa stanovništva.</li>
              <li><strong>Mjesta:</strong> Abecedni indeks svih mjesta (u izradi).</li>
            </ul>
          </div>
        );

      case 'on-this-day':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Na ovaj dan</strong> prikazuje sve zabilježene događaje iz obiteljskog stabla koji su se dogodili na odabrani dan i mjesec.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Kazalo simbola:</h4>
            <ul className="list-none pl-1 space-y-1.5 text-xs">
              <li>🎂 <strong>Rođendan:</strong> Zelena oznaka. Prikazuje broj godina od rođenja.</li>
              <li>✝ <strong>Godišnjica smrti:</strong> Siva oznaka. Označava godišnjicu preminuća.</li>
              <li>💍 <strong>Dan vjenčanja:</strong> Plava/ljubičasta oznaka. Prikazuje brak i ime supružnika.</li>
              <li>📅 <strong>Ostali događaji:</strong> Narančasta oznaka (krštenja, pokopi, itd.).</li>
              <li><strong>Hebrejski kalendar:</strong> Prikazuje približan hebrejski ekvivalent za odabrani datum.</li>
            </ul>
          </div>
        );
      case 'research':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Istraživanje</strong> je inteligentni sustav za detekciju nedostataka, grešaka i savjeta za istraživanje.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Pregled alata:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>🔍 Praznine (Gaps):</strong> Tablica osoba kojima nedostaju ključni datumi, lokacije ili izvori (sortirano po važnosti).</li>
              <li><strong>🧱 Zidovi (Brick Walls):</strong> Popis zadnjih poznatih predaka kojima nisu upisani roditelji.</li>
              <li><strong>👥 Duplikati:</strong> Pronalazi osobe koje bi mogle biti dvostruko unesene.</li>
              <li><strong>📛 Imena:</strong> Statistika najčešćih imena i prezimena.</li>
              <li><strong>🔄 Srodstveni brakovi (Collapse):</strong> Grafikon i postotak ponavljanja predaka kroz generacije.</li>
              <li><strong>🧬 DNA savjeti:</strong> Preporuka o tome koga testirati (autosomalni, Y-DNA, mtDNA) za rješavanje nepoznanica u stablu.</li>
            </ul>
          </div>
        );
      case 'export':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Izvoz</strong> služi za preuzimanje i dijeljenje statistika vašeg obiteljskog stabla.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Mogućnosti:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>PDF Izvještaj:</strong> Preuzimanje cjelovitog, višestraničnog izvještaja s grafikonima i tablicama za stablo.</li>
              <li><strong>Stats kartica (PNG):</strong> Generiranje moderne slike s ključnim brojkama stabla na gradientnoj pozadini, spremne za dijeljenje s obitelji.</li>
            </ul>
          </div>
        );
      case 'lifespans':
        return (
          <div className="space-y-4">
            <p>
              Modul <strong>Životni vijekovi</strong> analizira dugovječnost predaka.
            </p>
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Značajke:</h4>
            <ul className="list-disc pl-5 space-y-2 text-xs">
              <li><strong>Grafikon po generaciji:</strong> Prikazuje prosječnu životnu dob muškaraca i žena kroz generacije.</li>
              <li><strong>Vremenska crta (Swim-lane):</strong> Crta točne raspone života svakog pretka na povijesnoj skali (plave crte za muškarce, ružičaste za žene, sive za nepoznato).</li>
            </ul>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <p>Odaberite neku od kartica u zaglavlju aplikacije kako biste pokrenuli analizu obiteljskog stabla.</p>
          </div>
        );
    }
  };

  return (
    <header className="flex-col h-auto pt-2 pb-0 px-4 md:px-8 border-b border-[var(--border-color)] bg-[var(--bg-card)] shrink-0 z-10">
      {/* Top Row: Logo, Search, Actions */}
      <div className="flex items-center justify-between w-full h-14">
        {/* Logo & File Name */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00ab84] flex items-center justify-center text-white shadow-sm">
              <DetectiveIcon size={20} />
            </div>
            <div>
              <div className="font-bold text-base text-[var(--text-primary)] leading-tight flex items-center gap-2">
                RodosLovac
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">Alat za naprednu analizu obiteljskih stabala</div>
            </div>
          </div>
          
          {tree && (
            <div className="hidden md:flex items-center ml-4 px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)]">
              <span className="w-2 h-2 rounded-full bg-teal-500 mr-2 animate-pulse"></span>
              <span className="text-xs font-medium text-[var(--text-secondary)] truncate max-w-[200px]">
                {fileName || 'Untitled.ged'}
              </span>
            </div>
          )}
        </div>

        {/* Center: Search */}
        {tree && (
          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <PersonSearch placeholder="Pretraži rođake..." />
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {tree && (
            <button className="btn btn-ghost text-xs hidden sm:flex" onClick={resetTree} title="Promijeni datoteku">
              <FileUp size={16} />
              <span className="hidden md:inline">Promijeni datoteku</span>
            </button>
          )}
          
          <button className="btn btn-ghost p-2" onClick={toggleTheme} title="Promijeni temu">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {tree && (
            <button className="btn btn-ghost p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 ml-1" onClick={resetTree} title="Zatvori stablo">
              <X size={18} />
            </button>
          )}

          <button onClick={() => window.print()} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-bold transition-colors ml-2" title="Spremi trenutnu stranicu kao PDF ili Ispis">
            <Download size={14} /> Spremi PDF
          </button>

          <button 
            className="w-8 h-8 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 shadow-md flex items-center justify-center transition-all hover:scale-105 duration-200 ml-1 animate-pulse-subtle" 
            onClick={() => setHelpOpen(true)}
            title="Pomoć i vodič za trenutnu stranicu"
          >
            <HelpCircle size={18} className="stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Navigation Tabs */}
      {tree && (
        <div className="w-full flex items-center overflow-x-auto overflow-y-hidden gap-1 mt-2 no-scrollbar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeModule === item.id
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400 bg-teal-50/50 dark:bg-teal-900/20'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={activeModule === 'landing' ? "Dobrodošli u RodosLovac" : (NAV_ITEMS.find(n => n.id === activeModule)?.label || "Pomoć")}
      >
        {getHelpContent()}
      </HelpModal>
    </header>
  );
}
