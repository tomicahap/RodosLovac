import React from 'react';
import { createPortal } from 'react-dom';
import { X, Info, Beaker, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  helpKey: string;
  title: string;
  onClose: () => void;
}

const HELP_CONTENT: Record<string, { purpose: string; science: string; usage: string }> = {
  'duplicates': {
    purpose: 'Ovaj alat automatski pretražuje cijelu bazu tražeći osobe koje su vjerojatno ista osoba unesena više puta (duplikati).',
    science: 'Algoritam koristi metodu fuzzy podudaranja imena (Levenshteinova udaljenost) i uspoređuje godine rođenja, smrti i pripadajuće obitelji. Pouzdanost se izračunava matematičkim zbrajanjem preklapanja u podacima.',
    usage: 'Pregledajte kartice prema "Vrlo visoka", "Visoka" i "Srednja" pouzdanost. Ako primijetite stvarne duplikate u svojoj bazi (npr. MyHeritage/Ancestry), ručno ih spojite tamo, a aplikacija će to registrirati pri idućem učitavanju GEDCOM-a.'
  },
  'gaps': {
    purpose: 'Detektira grane u vašem stablu gdje izravnim precima nedostaju osnovni biografski podaci.',
    science: 'Aplikacija rekurzivno obilazi samo vaše direktne pretke (Pedigree) i provjerava postojanje imena, prezimena te datuma i mjesta rođenja/smrti. Identificira "rupe" na vremenskoj crti i predlaže istraživačke korake.',
    usage: 'Fokusirajte se prvo na mlađe generacije jer ih je lakše pronaći u matičnim knjigama. Kliknite na "Kopiraj" pored osobe kako biste lako zalijepili njene podatke u web arhivu (npr. FamilySearch) pri pretraživanju.'
  },
  'brickwalls': {
    purpose: 'Pronalazi "Zidove" (Brick Walls) – posljednje poznate pretke na kraju svake grane vašeg obiteljskog stabla.',
    science: 'Grafovska analiza (BFS/DFS) identificira čvorove u stablu koji nemaju unesene roditelje. Oni su terminalne točke vašeg trenutnog znanja.',
    usage: 'Ovo je vaša "To-Do" lista za posjete arhivima. Razvrstajte ih po abecedi ili vremenskoj blizini kako biste strukturirali svoja buduća istraživanja.'
  },
  'naming': {
    purpose: 'Otkriva kulturološke obrasce pri davanju imena u obiteljima. Često su se djeca nazivala po djedovima, bakama ili preminuloj braći.',
    science: 'Uspoređuje imena unutar uže obitelji kroz 3 generacije. Ako se ime djeteta podudara s imenom djeda, bake, ujaka ili preminulog brata/sestre, sustav bilježi podudarnost.',
    usage: 'Koristite ove podatke kada niste sigurni je li neka osoba iz matične knjige prava. Ako obitelj dosljedno prati obrazac imenovanja, to je snažan dokaz srodstva.'
  },
  'collapse': {
    purpose: 'Računa postotak "Gubitka predaka" (Pedigree Collapse) i Endogamije. Pokazuje mjesta gdje su se srodnici međusobno ženili, zbog čega imate manje jedinstvenih predaka od matematičkog ideala.',
    science: 'Pretražuje stablo prema gore tražeći iste pojedince koji se pojavljuju na više mjesta u rodoslovnom stablu. Računa Ahnenverlust faktor – omjer stvarnih i teoretskih predaka.',
    usage: 'Ovaj pad je potpuno normalan za ruralne i izolirane zajednice! Uključite se u detaljni pregled linija kako biste otkrili koje obitelji su se učestalo preplitale.'
  },
  'dna': {
    purpose: 'Identificira najbolje žive kandidate za DNK testiranje s ciljem dokumentiranja i potvrđivanja specifičnih obiteljskih linija.',
    science: 'Integrira Y-DNA (nasljeđivanje isključivo po muškoj liniji), mtDNA (nasljeđivanje po ženskoj liniji) i Autosomalni DNK koristeći točne DNAPainter v4 izračune za centimorgane (cM). Sustav prati graf do danas te upozorava ako postoji samo jedan preživjeli nositelj DNK loze.',
    usage: 'Kliknite na svaku od tri DNK metode. Kada pronađete "Jedinog potomka" označite ga kao kritičnog za testiranje. Kod autosomalnog DNK možete ciljati specifičnog pretka za kojeg želite utvrditi genetsko podudaranje.'
  },
  'anomalies': {
    purpose: 'Skener za logičke pogreške u vremenu i prostoru. Detektira povijesno ili biološki nemoguće situacije u vašim unosima.',
    science: 'Logika ispituje kronologiju. Primjeri: rođenje djeteta godinu dana nakon smrti oca, brak nakon smrti supružnika, preklapanje dvaju obitelji s djecom rođenom u razmaku <7 mjeseci, ili "teleportacija" (rođenje u Zagrebu pa krštenje tjedan poslije u New Yorku u 18. st).',
    usage: 'Ove greške najčešće nastaju krivim spajanjem osoba u softverima poput Family Tree Buildera. Pregledajte anomalije, otvorite ih u svom primarnom programu i popravite.'
  }
};

export function HelpModal({ helpKey, title, onClose }: HelpModalProps) {
  const content = HELP_CONTENT[helpKey] || {
    purpose: 'Nema opisa.',
    science: 'Nema podataka.',
    usage: 'Nema podataka.'
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm print:hidden" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2 text-cyan-700">
            <HelpCircle size={20} />
            <h3 className="font-bold text-[15px]">Kako radi: {title}?</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 text-[13px] text-slate-600 leading-relaxed">
          
          <div>
            <div className="flex items-center gap-2 mb-2 font-bold text-slate-800 text-[14px]">
              <Info size={16} className="text-blue-500" /> Svrha alata
            </div>
            <p>{content.purpose}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 font-bold text-slate-800 text-[14px]">
              <Beaker size={16} className="text-purple-500" /> Znanstvena pozadina
            </div>
            <p>{content.science}</p>
          </div>

          <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-100 text-cyan-800">
            <div className="font-bold mb-1 text-[14px]">Uputa za korištenje</div>
            <p>{content.usage}</p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-800 text-white rounded-lg text-[13px] font-bold hover:bg-slate-700 transition-colors shadow-sm">
            Razumijem
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
