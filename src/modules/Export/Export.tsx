// ============================================================
// Export Module — PNG/PDF export of tree stats and visualizations
// ============================================================

import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HelpButton, HelpModal } from '../../components/HelpModal';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

// Stats card rendered on a canvas for social sharing
function StatsCard({ tree }: { tree: NonNullable<ReturnType<typeof useApp>['tree']> }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { fileName } = useApp();

  const exportPNG = async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'predci-stats.png';
      a.click();
    } catch (e) {
      alert('Greška pri izvozu: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const stats = tree.stats;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-[var(--text-primary)]">Stats kartica za dijeljenje</h4>
        <button className="btn btn-primary" onClick={exportPNG}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Preuzmi PNG
        </button>
      </div>

      {/* The card itself */}
      <div
        ref={cardRef}
        style={{
          width: 480,
          padding: 32,
          background: 'linear-gradient(135deg, #0f1629 0%, #1a2540 50%, #131859 100%)',
          borderRadius: 20,
          fontFamily: 'Inter, sans-serif',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decoration */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(59,91,252,0.2)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(139,92,246,0.2)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 36 }}>🌳</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>PREDCI</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{fileName || 'Obiteljsko stablo'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Osoba', value: stats.totalPersons.toLocaleString(), icon: '👥' },
              { label: 'Obitelji', value: stats.totalFamilies.toLocaleString(), icon: '🏠' },
              { label: 'Prezimena', value: stats.uniqueSurnames.length.toLocaleString(), icon: '📛' },
              { label: 'Muškarci', value: stats.maleCount.toLocaleString(), icon: '♂' },
              { label: 'Žene', value: stats.femaleCount.toLocaleString(), icon: '♀' },
              { label: 'Lokacija', value: stats.uniquePlaces.length.toLocaleString(), icon: '📍' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', padding: '12px', borderRadius: 12 }}>
                <div style={{ fontSize: 18 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{s.value}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {(stats.earliestBirth || stats.latestBirth) && (
            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Vremenski raspon</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {stats.earliestBirth} – {stats.latestBirth}
                <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>({(stats.latestBirth || 0) - (stats.earliestBirth || 0)} godina)</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 10, opacity: 0.4 }}>Generirano s PREDCI • 100% privatno</div>
            <div style={{ fontSize: 10, opacity: 0.4 }}>{new Date().toLocaleDateString('hr-HR')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// PDF export
async function exportPDF(tree: NonNullable<ReturnType<typeof useApp>['tree']>, fileName: string | null) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const stats = tree.stats;

  // Header
  doc.setFillColor(15, 22, 41);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('🌳 PREDCI — Izvještaj stabla', 20, 22);
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 180);
  doc.text(fileName || 'Obiteljsko stablo', 20, 32);
  doc.text(new Date().toLocaleDateString('hr-HR'), 170, 32);

  // Stats
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('Statistika stabla', 20, 55);
  doc.setFontSize(10);

  const statsData = [
    ['Ukupno osoba', stats.totalPersons.toLocaleString()],
    ['Ukupno obitelji', stats.totalFamilies.toLocaleString()],
    ['Muškarci', stats.maleCount.toLocaleString()],
    ['Žene', stats.femaleCount.toLocaleString()],
    ['Jedinstvena prezimena', stats.uniqueSurnames.length.toLocaleString()],
    ['Jedinstvene lokacije', stats.uniquePlaces.length.toLocaleString()],
    ['Osoba s datumom r.', stats.withBirthDate.toLocaleString()],
    ['Osoba s datumom s.', stats.withDeathDate.toLocaleString()],
    ['Najstarije godište', stats.earliestBirth?.toString() || '—'],
    ['Najmlađe godište', stats.latestBirth?.toString() || '—'],
  ];

  let y = 65;
  for (const [label, value] of statsData) {
    doc.setTextColor(80, 80, 80);
    doc.text(label + ':', 20, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(value, 90, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
  }

  // Surnames
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Prezimena u stablu', 20, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const surnameText = stats.uniqueSurnames.slice(0, 80).join(', ');
  const wrapped = doc.splitTextToSize(surnameText, 170);
  doc.text(wrapped, 20, y);
  y += wrapped.length * 5 + 10;

  // Footer
  doc.setFillColor(15, 22, 41);
  doc.rect(0, 280, 210, 17, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('Generirano s PREDCI — GEDCOM Analizator • 100% privatno, sve lokalno u browseru', 20, 290);

  doc.save('predci-izvjestaj.pdf');
}

export default function Export() {
  const { tree, fileName } = useApp();
  const [exportingPDF, setExportingPDF] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handlePDFExport = async () => {
    if (!tree) return;
    setExportingPDF(true);
    try {
      await exportPDF(tree, fileName);
    } catch (e) {
      alert('Greška: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExportingPDF(false);
    }
  };

  if (!tree) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Izvoz</h2>
          <p className="section-subtitle">Generiraj izvještaje, slike i PDF dokumente</p>
        </div>
      </div>

      {/* PDF Export */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-2xl flex-shrink-0">
            📄
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">PDF Izvještaj</h4>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Sažetak statistike stabla, prezimena i vremenskog raspona u PDF formatu
            </p>
            <button
              className="btn btn-primary mt-3"
              onClick={handlePDFExport}
              disabled={exportingPDF}
            >
              {exportingPDF ? (
                <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span> Generiranje...</>
              ) : (
                <>📥 Preuzmi PDF</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats card for social sharing */}
      <div className="card p-5">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-2xl flex-shrink-0">
            🖼️
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[var(--text-primary)]">Stats kartica (PNG)</h4>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Slika s ključnim statistikama za dijeljenje na društvenim mrežama
            </p>
          </div>
        </div>
        <StatsCard tree={tree} />
      </div>

      {/* GEDCOM tips */}
      <div className="card p-5">
        <h4 className="font-semibold text-sm text-[var(--text-primary)] mb-3">ℹ️ O GEDCOM formatu</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[var(--text-secondary)]">
          {[
            { app: 'Ancestry', steps: 'Trees → Stablo → Export tree → .ged' },
            { app: 'MyHeritage', steps: 'Manage tree → Export → GEDCOM' },
            { app: 'RootsMagic', steps: 'File → Export → GEDCOM' },
            { app: 'Family Tree Maker', steps: 'File → Export → GEDCOM' },
            { app: 'Gramps', steps: 'Family Trees → Export → GEDCOM' },
            { app: 'Geneanet', steps: 'My tree → Actions → Export GEDCOM' },
          ].map(({ app, steps }) => (
            <div key={app} className="flex gap-2">
              <span className="text-[var(--brand-color)] font-medium w-28 flex-shrink-0">{app}:</span>
              <span className="text-xs text-[var(--text-muted)]">{steps}</span>
            </div>
          ))}
        </div>
      </div>

      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title="Izvoz podataka"
      >
        <div className="space-y-4">
          <p>
            Modul <strong>Izvoz</strong> omogućuje vam spremanje, preuzimanje i dijeljenje statistika vašeg obiteljskog stabla na jednostavan i vizualno atraktivan način.
          </p>
          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 mt-3">Opcije izvoza:</h4>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>PDF Izvještaj:</strong> Generira višestranični službeni dokument u PDF formatu koji sadrži detaljnu statistiku stabla (spol, broj osoba, obitelji, jedinstvena prezimena, jedinstvene lokacije te najstarije/najmlađe godine rođenja).
            </li>
            <li>
              <strong>Stats kartica (PNG):</strong> Generira modernu i prekrasno dizajniranu sliku (karticu za dijeljenje) s najvažnijim brojkama vašeg stabla na tamnoj, gradientnoj pozadini. Savršeno za slanje rođacima na WhatsApp ili dijeljenje na društvenim mrežama.
            </li>
          </ul>
        </div>
      </HelpModal>
    </div>
  );
}
