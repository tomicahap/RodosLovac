import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, LayersControl, Marker, Popup, Polyline, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { generateGeoData, PlotType } from './utils/geoDataParser';
import type { GeoTreeFeature, MigrationFlowFeature } from '../../parser/gedcomTypes';
import { Layers, Lock } from 'lucide-react';

const { BaseLayer } = LayersControl;

const GENERATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20];

export default function AdvancedMap() {
  const { tree, graph, selectedPersonId } = useApp();
  
  // States
  const [plotType, setPlotType] = useState<PlotType>('BIRTH');
  const [maxGenerations, setMaxGenerations] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [features, setFeatures] = useState<GeoTreeFeature[]>([]);
  const [flows, setFlows] = useState<MigrationFlowFeature[]>([]);
  const [stats, setStats] = useState({ locationsCount: 0, peopleCount: 0 });

  // Data fetching
  useEffect(() => {
    if (!tree || !graph || !selectedPersonId) return;

    let isMounted = true;
    setLoading(true);

    generateGeoData(tree, graph, selectedPersonId, plotType, maxGenerations, (p) => {
      if (isMounted) setProgress(p);
    }).then(data => {
      if (isMounted) {
        setFeatures(data.features);
        setFlows(data.flows);
        setStats(data.stats);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [tree, graph, selectedPersonId, plotType, maxGenerations]);

  // UI Helpers
  const getGenDescription = (gen: number) => {
    if (gen === 2) return "— roditelji";
    if (gen === 3) return "— djedovi i bake";
    if (gen === 4) return "— pradjedovi i prabake";
    return `— ${gen - 2}x pradjedovi i prabake`;
  };

  const createDotIcon = () => {
    return L.divIcon({
      html: `<div class="w-4 h-4 bg-teal-500 rounded-full border-2 border-white shadow-md"></div>`,
      className: 'custom-dot-icon',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8]
    });
  };

  const createClusterIcon = (cluster: any) => {
    const count = cluster.getChildCount();
    return L.divIcon({
      html: `<div class="w-8 h-8 bg-teal-600 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">${count}</div>`,
      className: 'custom-cluster-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  // Group features by location for popup
  const groupedFeatures = useMemo(() => {
    const map = new Map<string, GeoTreeFeature[]>();
    features.forEach(f => {
      const key = `${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return Array.from(map.values());
  }, [features]);

  if (!selectedPersonId) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
        Odaberite osobu za prikaz karte predaka.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      
      {/* Top Filter Panels (Outside the map) */}
      <div className="flex flex-col gap-3 p-4 shrink-0 max-w-5xl mx-auto w-full z-10">
        
        {/* Row 1: Plot */}
        <div className="bg-white shadow-sm rounded-xl p-2 flex flex-wrap sm:flex-nowrap items-center gap-2 border border-slate-200 w-full">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 shrink-0">Iscrtavanje</span>
          
          <div className="flex gap-1 bg-slate-50 p-1 rounded-lg shrink-0 border border-slate-100">
            <button 
              onClick={() => setPlotType('BIRTH')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${plotType === 'BIRTH' ? 'bg-teal-50 text-teal-700 border border-teal-200 shadow-sm' : 'text-slate-600 hover:text-slate-900 border border-transparent'}`}
            >
              Mjesta rođenja
            </button>
            <button 
              onClick={() => setPlotType('DEATH')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${plotType === 'DEATH' ? 'bg-teal-50 text-teal-700 border border-teal-200 shadow-sm' : 'text-slate-600 hover:text-slate-900 border border-transparent'}`}
            >
              Mjesta smrti
            </button>
            <button 
              onClick={() => setPlotType('MOVES')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${plotType === 'MOVES' ? 'bg-teal-50 text-teal-700 border border-teal-200 shadow-sm' : 'text-slate-600 hover:text-slate-900 border border-transparent'}`}
            >
              Životna kretanja
            </button>
          </div>
          
          <span className="text-sm text-slate-500 font-medium ml-2 hidden lg:block whitespace-nowrap">
            {plotType === 'BIRTH' && '— gdje su preci rođeni'}
            {plotType === 'DEATH' && '— gdje su preci umrli'}
            {plotType === 'MOVES' && '— linije kretanja i sve lokacije'}
          </span>
        </div>

        {/* Row 2: Showing up to */}
        <div className="bg-white shadow-sm rounded-xl p-2 flex items-center gap-2 border border-slate-200 overflow-hidden w-full">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 shrink-0">Prikaz do</span>
          
          <div className="flex gap-1 overflow-x-auto custom-scrollbar no-scrollbar py-1">
            {GENERATIONS.map(gen => (
              <button
                key={gen}
                onClick={() => setMaxGenerations(gen)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold shrink-0 transition-colors ${maxGenerations === gen ? 'bg-teal-500 text-white shadow-sm border border-teal-600' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
              >
                {gen}G
              </button>
            ))}
          </div>

          <span className="text-sm text-slate-500 font-medium ml-2 whitespace-nowrap hidden sm:inline">
            {getGenDescription(maxGenerations)}
          </span>
        </div>

      </div>

      {/* Map Container Area */}
      <div className="flex-1 px-4 pb-4 min-h-[400px] flex flex-col max-w-7xl mx-auto w-full relative">
        <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative bg-white">
          
          {loading && (
            <div className="absolute inset-0 z-[2000] bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-100">
                <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-bold text-slate-700">Analiza lokacija... {progress}%</span>
              </div>
            </div>
          )}

          <MapContainer 
            center={[45.815, 15.981]} 
            zoom={6} 
            zoomControl={false}
            className="w-full h-full z-0"
          >
            <ZoomControl position="topleft" />
            
            <LayersControl position="topright">
              <BaseLayer checked name="CARTO Positron (Zadano)">
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
              </BaseLayer>
              <BaseLayer name="Satelit">
                <TileLayer
                  attribution='&copy; Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </BaseLayer>
            </LayersControl>

            {/* Render Migration Flows if MOVES selected */}
            {plotType === 'MOVES' && flows.map((f, i) => {
              const coords = f.geometry.coordinates.map(c => [c[1], c[0]] as [number, number]);
              return (
                <Polyline 
                  key={`flow-${i}`} 
                  positions={coords} 
                  pathOptions={{ color: '#0d9488', weight: 2, opacity: 0.5, dashArray: '4,6' }} 
                />
              );
            })}

            {/* Render Features with Clustering */}
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={40}
              iconCreateFunction={createClusterIcon}
            >
              {groupedFeatures.map((group, i) => {
                const [lng, lat] = group[0].geometry.coordinates;
                return (
                  <Marker 
                    key={`loc-${i}`} 
                    position={[lat, lng]} 
                    icon={createDotIcon()}
                  >
                    <Popup className="rounded-xl overflow-hidden shadow-xl border-0">
                      <div className="p-1 min-w-[220px]">
                        <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2">
                          📍 {group[0].properties.place}
                        </div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                          {group.map((f, idx) => (
                            <div key={idx} className="flex flex-col">
                              <span className="text-sm font-bold text-teal-700">{f.properties.fullName}</span>
                              <span className="text-xs text-slate-500">{f.properties.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>

        {/* Footer Status Bar (Below the map) */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-sm px-2 text-slate-500">
          <div className="font-bold text-slate-700">
            {stats.peopleCount} {stats.peopleCount === 1 ? 'predak' : 'predaka'} {plotType === 'BIRTH' ? 'rođeno' : plotType === 'DEATH' ? 'umrlo' : 'živjelo'} na {stats.locationsCount} {stats.locationsCount === 1 ? 'lokaciji' : 'lokacija'}
          </div>
          <div className="font-medium hidden md:block">
            Sva mjesta razriješena preko OpenStreetMap
          </div>
          <div className="text-teal-600 font-bold">
            Klikni na bilo koju točku da vidiš tko je tamo {plotType === 'BIRTH' ? 'rođen' : plotType === 'DEATH' ? 'umro' : 'bio'}
          </div>
        </div>

      </div>

    </div>
  );
}
