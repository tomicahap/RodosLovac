import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, Activity, Map as MapIcon, Calendar, 
  Search, ShieldCheck, Heart, AlertTriangle, 
  Info, ChevronRight, Award, MapPin, BarChart3,
  FileCheck
} from 'lucide-react';
import FanChart from '../FanChart/FanChart';
import AncestorMap from '../AncestorMap/AncestorMap';
import { runValidation } from '../../parser/validationEngine';
import IntegrityModal from './modals/IntegrityModal';
import CoverageModal from './modals/CoverageModal';
import EvidenceModal from './modals/EvidenceModal';
import PersonsListModal from './modals/PersonsListModal';
import SurnamesModal from './modals/SurnamesModal';
import CouplesModal from './modals/CouplesModal';
import LifespanGraphModal from './modals/LifespanGraphModal';
import OldestRecordModal from './modals/OldestRecordModal';
import DemographicsModal from './modals/DemographicsModal';
import ConnectionsModal from './modals/ConnectionsModal';
import PersonsGlobalStatsModal from './modals/PersonsGlobalStatsModal';
import HomePersonDashboard from './components/HomePersonDashboard';
import TreeHealthCard from './components/TreeHealthCard';
import DemographicsCards from './components/DemographicsCards';
import NotableFactsCard from './components/NotableFactsCard';
import MapsDiscoveryNav from './components/MapsDiscoveryNav';
import ResearchExportCard from './components/ResearchExportCard';
import FeaturesGrid from './components/FeaturesGrid';
import { HelpButton, HelpModal } from '../../components/HelpModal';

export default function Overview() {
  const { tree, graph, setActiveModule, setSelectedPerson } = useApp();
  const [activeModal, setActiveModal] = useState<'integrity' | 'coverage' | 'evidence' | 'connections' | 'persons' | 'surnames' | 'couples' | 'lifespan' | 'oldest' | 'demographics' | 'global-persons' | null>(null);
  const [selectedSurname, setSelectedSurname] = useState<string | null>(null);
  const [filterPersonIds, setFilterPersonIds] = useState<string[] | null>(null);
  const [listTitle, setListTitle] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const analytics = useMemo(() => {
    if (!graph) return null;
    return graph.getOverviewAnalytics();
  }, [graph]);

  const validation = useMemo(() => {
    if (!tree) return null;
    return runValidation(tree);
  }, [tree]);

  if (!tree || !analytics || !validation) return null;

  const { stats } = tree;

  // Local scores are now handled by validationEngine.ts healthReport.

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      
      {/* Modals */}
      {activeModal === 'integrity' && validation && (
        <IntegrityModal 
          errors={validation.errors} 
          warnings={validation.warnings} 
          onClose={() => setActiveModal(null)} 
          onResearchClick={() => setActiveModule('research')}
          onPersonClick={(id) => { setSelectedPerson(id); setActiveModule('person-stats'); }}
        />
      )}
      {activeModal === 'coverage' && validation && (
        <CoverageModal 
          coverage={validation.coverage} 
          onClose={() => setActiveModal(null)} 
          onResearchClick={() => setActiveModule('research')}
          onShowActionProfiles={(title, ids) => {
            setListTitle(title);
            setFilterPersonIds(ids);
            setActiveModal('persons');
          }}
        />
      )}
      {activeModal === 'evidence' && validation && (
        <EvidenceModal 
          evidence={validation.evidence} 
          totalPersons={tree.persons.size} 
          onClose={() => setActiveModal(null)} 
          onResearchClick={() => setActiveModule('research')}
          onShowActionProfiles={(title, ids) => {
            setListTitle(title);
            setFilterPersonIds(ids);
            setActiveModal('persons');
          }}
        />
      )}
      {/* Inline Views moved down */}
      {/* Page Header */}
      <div className="section-header mb-0 mt-4">
        <div>
          <h2 className="section-title">Nadzorna ploča stabla</h2>
          <p className="section-subtitle">Pregled zdravlja obiteljskog stabla, demografije i prečaci za istraživanje</p>
        </div>
      </div>

      {/* A. Call-to-Action & Notices */}
      <div className="flex flex-col gap-4 mt-4">
        {/* Success Alert */}
        <div className="bg-teal-600 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-teal-200" />
            <div>
              <h3 className="font-semibold text-base">Vaše stablo je spremno.</h3>
              <p className="text-teal-100 text-sm">
                {stats.totalPersons} osoba • {stats.uniqueSurnames.length} prezimena. Odakle želite početi?
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => setActiveModule('person-stats')} className="btn bg-white text-teal-700 hover:bg-teal-50 shadow-sm flex-1 sm:flex-none justify-center">
              Statistika osobe
            </button>
            <button onClick={() => setActiveModule('research')} className="btn bg-teal-700 text-white hover:bg-teal-800 border-transparent flex-1 sm:flex-none justify-center">
              Praznine u istraživanju
            </button>
          </div>
        </div>
      </div>

      {/* B. Top Navigation Metrics */}
      <MapsDiscoveryNav onOpenModal={(id) => setActiveModal(id as any)} />

      {/* Inline Views */}
      {activeModal === 'persons' && (
        <PersonsListModal 
          tree={tree} 
          initialSurnameFilter={selectedSurname}
          filterIds={filterPersonIds}
          title={listTitle}
          onClose={() => { setActiveModal(null); setSelectedSurname(null); setFilterPersonIds(null); setListTitle(null); }}
          onPersonClick={(id) => { setSelectedPerson(id); setActiveModule('person-stats'); }}
        />
      )}
      {activeModal === 'surnames' && (
        <SurnamesModal 
          tree={tree}
          onClose={() => setActiveModal(null)}
          onSurnameSelect={(surname) => { setSelectedSurname(surname); setActiveModal('persons'); }}
        />
      )}
      {activeModal === 'couples' && (
        <CouplesModal 
          tree={tree}
          onClose={() => setActiveModal(null)}
          onPersonClick={(id) => { setSelectedPerson(id); setActiveModule('person-stats'); }}
        />
      )}
      {activeModal === 'lifespan' && (
        <LifespanGraphModal 
          tree={tree}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'oldest' && (
        <OldestRecordModal 
          tree={tree}
          onClose={() => setActiveModal(null)}
          onPersonClick={(id) => { setSelectedPerson(id); setActiveModule('person-stats'); }}
        />
      )}
      {activeModal === 'demographics' && (
        <DemographicsModal 
          tree={tree}
          onClose={() => setActiveModal(null)}
          onPersonClick={(id) => { setSelectedPerson(id); setActiveModule('person-stats'); }}
        />
      )}
      {activeModal === 'connections' && (
        <ConnectionsModal 
          tree={tree}
          onClose={() => setActiveModal(null)}
          onPersonClick={(id) => { setSelectedPerson(id); setActiveModule('person-stats'); }}
          onShowActionProfiles={(title, ids) => {
            setListTitle(title);
            setFilterPersonIds(ids);
            setActiveModal('persons');
          }}
        />
      )}
      {activeModal === 'global-persons' && (
        <PersonsGlobalStatsModal 
          tree={tree}
          onClose={() => setActiveModal(null)}
          onShowActionProfiles={(title, ids) => {
            setListTitle(title);
            setFilterPersonIds(ids);
            setActiveModal('persons');
          }}
        />
      )}

      {/* C. Home Person Family (Map & Pie Chart) */}
      {!['persons', 'surnames', 'couples', 'lifespan', 'oldest', 'demographics', 'connections', 'global-persons'].includes(activeModal || '') && (
        <HomePersonDashboard />
      )}

      {/* D. Visualizations Grid */}
      {!['persons', 'surnames', 'couples', 'lifespan', 'oldest', 'demographics', 'connections', 'global-persons'].includes(activeModal || '') && (
        <div className="grid lg:grid-cols-3 gap-6">
          <TreeHealthCard 
            onActionClick={(id) => setActiveModal(id as any)} 
            onShowActionProfiles={(title, ids) => {
              setListTitle(title);
              setFilterPersonIds(ids);
              setActiveModal('persons');
            }}
          />
          <DemographicsCards />
        </div>
      )}

      {/* E. Research & Export Card */}
      {!['persons', 'surnames', 'couples', 'lifespan', 'oldest', 'demographics', 'connections', 'global-persons'].includes(activeModal || '') && (
        <ResearchExportCard 
          onShowActionProfiles={(title, ids) => {
            setListTitle(title);
            setFilterPersonIds(ids);
            setActiveModal('persons');
          }}
        />
      )}

      {/* F. Features Grid */}
      {!['persons', 'surnames', 'couples', 'lifespan', 'oldest', 'demographics', 'connections', 'global-persons'].includes(activeModal || '') && (
        <div className="mt-8">
          <FeaturesGrid />
        </div>
      )}

      {/* G. Notable Facts & This Week (Moved to VERY bottom) */}
      {!['persons', 'surnames', 'couples', 'lifespan', 'oldest', 'demographics', 'connections', 'global-persons'].includes(activeModal || '') && (
        <div className="mt-8">
          <NotableFactsCard />
        </div>
      )}

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Nadzorna ploča stabla"
      >
        <div className="space-y-4">
          <p>
            Dobrodošli na <strong>Nadzornu ploču (Overview)</strong>! Ovo je središnje mjesto za analizu vašeg GEDCOM obiteljskog stabla.
          </p>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Glavne sekcije i mogućnosti:</h4>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Zdravlje stabla (Tree Health):</strong> Pokazuje postotak cjelovitosti vašeg stabla. Prikazuje broj grešaka integriteta (npr. roditelji rođeni nakon djece), pokrivenost vremenskim podacima i dokaze o izvorima. Klikom na karticu otvarate detaljne popise osoba s tim problemima.
            </li>
            <li>
              <strong>Kartice demografije (Demographics):</strong> Brza statistika prosječne dobi preminuća, najčešćih mjesta prebivališta te najstarijih zapisa u vašem stablu.
            </li>
            <li>
              <strong>Glavna osoba (Focal Person Dashboard):</strong> Prikazuje detalje o korijenskoj osobi stabla (obično vi ili osoba od koje ste počeli stablo), njezinu užu obitelj, geografsku kartu s lokacijama njezinih predaka te brzi grafički mini fanchart.
            </li>
            <li>
              <strong>Istraživanje i izvoz:</strong> Prečaci za analizu praznina u istraživanju ili generiranje PDF izvještaja.
            </li>
          </ul>
        </div>
      </HelpModal>
    </div>
  );
}
