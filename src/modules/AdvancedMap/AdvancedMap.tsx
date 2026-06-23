import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { generateGeoData } from './utils/geoDataParser';
import type { GeoTreeFeature, MigrationFlowFeature } from '../../parser/gedcomTypes';

// Components
import TemporalSlider from './components/TemporalSlider';
import SmartClusterLayer from './layers/SmartClusterLayer';
import HeatmapLayer from './layers/HeatmapLayer';
import MigrationFlowLayer from './layers/MigrationFlowLayer';
import L from 'leaflet';
import { HelpButton, HelpModal } from '../../components/HelpModal';

const { BaseLayer, Overlay } = LayersControl;

export default function AdvancedMap() {
  const { tree, graph, selectedPersonId } = useApp();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const [features, setFeatures] = useState<GeoTreeFeature[]>([]);
  const [flows, setFlows] = useState<MigrationFlowFeature[]>([]);

  // Filtering state
  const [currentYear, setCurrentYear] = useState(2026);
  const [isPlaying, setIsPlaying] = useState(false);
  const [branchFilter, setBranchFilter] = useState<'All' | 'Paternal' | 'Maternal'>('All');

  // Compute min/max year once
  const { minYear, maxYear } = useMemo(() => {
    let min = 2026, max = 1500;
    features.forEach(f => {
      if (f.properties.year < min) min = f.properties.year;
      if (f.properties.year > max) max = f.properties.year;
    });
    if (min > max) { min = 1500; max = 2026; }
    return { minYear: min, maxYear: max };
  }, [features]);

  useEffect(() => {
    if (!tree || !graph || !selectedPersonId) return;

    let isMounted = true;
    setLoading(true);

    generateGeoData(tree, graph, selectedPersonId, (p) => {
      if (isMounted) setProgress(p);
    }).then(data => {
      if (isMounted) {
        setFeatures(data.features);
        setFlows(data.flows);
        // Set timeline to max year to show all initially
        let max = 1500;
        data.features.forEach(f => { if (f.properties.year > max) max = f.properties.year; });
        setCurrentYear(Math.max(max, 1500));
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [tree, graph, selectedPersonId]);

  // Timeline playback effect
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentYear(prev => {
        if (prev >= maxYear) {
          setIsPlaying(false);
          return maxYear;
        }
        return prev + 5; // jump 5 years at a time
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, maxYear]);

  // Filter data based on year and branch
  const filteredFeatures = useMemo(() => {
    return features.filter(f => {
      if (f.properties.year > currentYear) return false;
      if (branchFilter !== 'All') {
        if (f.properties.branch !== 'Both' && f.properties.branch !== branchFilter) return false;
      }
      return true;
    });
  }, [features, currentYear, branchFilter]);

  const filteredFlows = useMemo(() => {
    return flows.filter(f => {
      if (f.properties.year > currentYear) return false;
      // Only show flows within a 50 year window of current year so they don't clutter forever
      if (currentYear - f.properties.year > 50) return false;
      if (branchFilter !== 'All') {
        if (f.properties.branch !== 'Both' && f.properties.branch !== branchFilter) return false;
      }
      return true;
    });
  }, [flows, currentYear, branchFilter]);

  if (!selectedPersonId) {
    return (
      <div className="card p-12 text-center text-[var(--text-muted)] animate-fade-in">
        <p className="text-4xl mb-3">🌍</p>
        <p className="font-medium">Odaberite osobu za prikaz napredne GIS karte</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in flex flex-col h-full min-h-[800px] max-w-[1600px] mx-auto">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="section-header mb-0">
          <div>
            <h2 className="section-title">GIS Geogenealogija</h2>
            <p className="section-subtitle">Napredna prostorno-vremenska vizualizacija rodoslovlja.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <select 
            className="input text-sm"
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value as any)}
          >
            <option value="All">Sve grane</option>
            <option value="Paternal">Samo očeva linija</option>
            <option value="Maternal">Samo majčina linija</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">Analiza i geokodiranje podataka... {progress}%</span>
          </div>
          <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="card flex-1 relative overflow-hidden z-0 shadow-xl border border-gray-200 dark:border-slate-800 rounded-2xl min-h-[600px]">
        <MapContainer 
          center={[45, 15]} 
          zoom={4} 
          style={{ height: '100%', width: '100%', backgroundColor: '#1a1d24' }} 
          scrollWheelZoom
        >
          <LayersControl position="topright">
            
            <BaseLayer checked name="Čista Karta (CartoDB)">
              <TileLayer
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                className="map-tiles"
              />
            </BaseLayer>
            
            <BaseLayer name="Tamna Karta (CartoDB)">
              <TileLayer
                attribution='&copy; CartoDB'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
            </BaseLayer>

            <BaseLayer name="Povijesna Karta (OpenHistoricalMap)">
              <TileLayer
                attribution='&copy; OpenHistoricalMap'
                url="https://tile-a.openstreetmap.fr/hot/{z}/{x}/{y}.png" // Placeholder for historical WMS if needed
              />
            </BaseLayer>

            <Overlay checked name="Tematske Pribadače (Cluster)">
              <SmartClusterLayer features={filteredFeatures} />
            </Overlay>

            <Overlay name="Toplinska Karta (Heatmap)">
              <HeatmapLayer features={filteredFeatures} />
            </Overlay>

            <Overlay checked name="Migracijski Tokovi (Ant Paths)">
              <MigrationFlowLayer flows={filteredFlows} />
            </Overlay>

          </LayersControl>
        </MapContainer>

        {/* Timeline Slider */}
        {features.length > 0 && (
          <TemporalSlider 
            minYear={minYear}
            maxYear={maxYear}
            currentYear={currentYear}
            onChange={setCurrentYear}
            isPlaying={isPlaying}
            onPlayToggle={() => setIsPlaying(!isPlaying)}
          />
        )}
      </div>

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="GIS Geogenealogija (Karta predaka)"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>GIS Geogenealogija</strong> omogućuje naprednu prostorno-vremensku vizualizaciju vaših predaka na interaktivnoj karti. Povezuje genealoške podatke s geografskim koordinatama mjesta rođenja i smrti.
          </p>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Slojevi karte (kontrolirajte u gornjem desnom kutu):</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Tematske Pribadače (Cluster):</strong> Prikazuje pribadače rođenja i smrti predaka. Kada ima više pribadača blizu, one se grupiraju u klastere s brojevima. Kliknite na klaster za zumiranje.
            </li>
            <li>
              <strong>Toplinska Karta (Heatmap):</strong> Prikazuje gustoću naseljenosti predaka. Što je boja toplija (crvenija), to je više predaka rođeno ili živjelo na tom području.
            </li>
            <li>
              <strong>Migracijski Tokovi (Ant Paths):</strong> Prikazuje animirane linije migracije od mjesta rođenja do mjesta smrti pojedinih predaka.
            </li>
          </ul>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Interaktivna vremenska traka:</h4>
          <p className="text-xs text-slate-500">
            Klizač na dnu omogućuje vam filtriranje i animaciju prikaza kroz povijest. Pritisnite gumb <strong>Play</strong> za pokretanje vremenske animacije i praćenje širenja i selidbi obitelji kroz stoljeća.
          </p>
        </div>
      </HelpModal>
    </div>
  );
}
