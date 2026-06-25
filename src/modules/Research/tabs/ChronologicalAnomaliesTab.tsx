import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { ChronologicalAnomaly, analyzeAnomalies, AnomalyType } from '../utils/anomaliesAnalyzer';
import { AlertTriangle, User, MapPin, Clock, HeartHandshake, Check, FileEdit, Plus } from 'lucide-react';
import { TabHeader } from '../components/TabHeader';

export default function ChronologicalAnomaliesTab() {
  const { tree } = useApp();
  const [anomalies, setAnomalies] = useState<ChronologicalAnomaly[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filter, setFilter] = useState<AnomalyType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!tree) return;
    
    let isMounted = true;
    
    const runAnalysis = async () => {
      setIsAnalyzing(true);
      setAnomalies([]);
      
      const newAnomalies: ChronologicalAnomaly[] = [];
      const generator = analyzeAnomalies(tree);
      
      for await (const chunk of generator) {
        if (!isMounted) break;
        newAnomalies.push(...chunk);
        setAnomalies([...newAnomalies]);
      }
      
      if (isMounted) {
        setIsAnalyzing(false);
      }
    };
    
    runAnalysis();
    
    return () => { isMounted = false; };
  }, [tree]);

  const filtered = anomalies.filter(a => filter === 'all' || a.type === filter);

  const handleExport = () => {
    const rows = [['ID Osobe', 'Ime i Prezime', 'Tip Anomalije', 'Kriticnost', 'Opis']];
    filtered.forEach(a => {
      rows.push([
        a.personId,
        a.personName,
        a.type === 'teleportation' ? 'Teleportacija' : a.type === 'anachronism' ? 'Poredak dogadaja' : 'Preklapanje brakova',
        a.severity,
        a.description.replace(/;/g, ',') // prevent CSV breaking
      ]);
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "kronoloske_anomalije.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getIcon = (type: AnomalyType) => {
    switch (type) {
      case 'teleportation': return <MapPin size={16} />;
      case 'anachronism': return <Clock size={16} />;
      case 'bigamy': return <HeartHandshake size={16} />;
    }
  };

  const getLabel = (type: AnomalyType) => {
    switch (type) {
      case 'teleportation': return 'Teleportacija (Lokacije)';
      case 'anachronism': return 'Poredak događaja';
      case 'bigamy': return 'Preklapanje brakova';
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      
      {/* Top Panel */}
      <div className="shrink-0">
        <TabHeader 
          title="Kronološke anomalije"
          icon={<AlertTriangle size={24} className="text-red-600" />}
          description="Otkriva fizički nemoguće ili povijesno nevjerojatne rasporede događaja, preklapanja lokacija u kratkom vremenskom roku te logičke pogreške na vremenskoj crti obitelji."
          helpKey="anomalies"
          onExportExcel={handleExport}
        />

        <div className="flex items-center gap-6 bg-slate-50 p-4 border-b border-slate-200 print:hidden">
          <div className="text-4xl font-black text-slate-800 shrink-0 min-w-[60px] text-center">
            {isAnalyzing ? <span className="text-slate-300 animate-pulse">...</span> : anomalies.length}
          </div>
          
          <div className="flex flex-wrap gap-2 border-l border-slate-300 pl-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${filter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              Sve
            </button>
            <button
              onClick={() => setFilter('teleportation')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors flex items-center gap-1.5 ${filter === 'teleportation' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              <MapPin size={14} /> Teleportacija (Lokacije)
            </button>
            <button
              onClick={() => setFilter('bigamy')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors flex items-center gap-1.5 ${filter === 'bigamy' ? 'bg-pink-100 text-pink-700 border border-pink-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              <HeartHandshake size={14} /> Preklapanje brakova
            </button>
            <button
              onClick={() => setFilter('anachronism')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors flex items-center gap-1.5 ${filter === 'anachronism' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              <Clock size={14} /> Poredak događaja
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 relative">
        {isAnalyzing && anomalies.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
             <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
             <div className="text-sm font-bold">Analiziranje vremenskih crta...</div>
           </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 mt-10 font-medium">Nisu pronađene anomalije u ovoj kategoriji. Vaša baza je uredna! 🎉</div>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col gap-3 pb-10">
            {filtered.map(a => {
              const isExpanded = expandedId === a.id;
              
              return (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow transition-all">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <div className="flex items-center gap-3">
                      <User size={18} className={`${a.sex === 'M' ? 'text-cyan-500' : a.sex === 'F' ? 'text-pink-500' : 'text-slate-400'}`} />
                      <div className="font-bold text-teal-600 hover:underline">{a.personName}</div>
                      <div className="text-sm text-slate-400 font-medium">({a.lifespan})</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`px-2.5 py-1 rounded-md text-xs font-black tracking-wider ${a.severity === 'NEMOGUĆE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {a.severity}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-5 border-t border-slate-100 bg-slate-50">
                      <div className="flex gap-3 mb-6">
                        <div className={`p-2 rounded-lg h-fit ${a.type === 'teleportation' ? 'bg-indigo-100 text-indigo-600' : a.type === 'bigamy' ? 'bg-pink-100 text-pink-600' : 'bg-amber-100 text-amber-600'}`}>
                          {getIcon(a.type)}
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{getLabel(a.type)}</div>
                          <p className="text-slate-700 font-medium leading-relaxed">{a.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm">
                          <Check size={14} className="text-emerald-500" /> Potvrđeno u redu
                        </button>
                        <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm">
                          <FileEdit size={14} className="text-blue-500" /> Ispravljeno
                        </button>
                        <button className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm">
                          <Plus size={14} className="text-slate-400" /> Dodaj bilješku
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
