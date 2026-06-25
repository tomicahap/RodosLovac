import React, { useId, useMemo, useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { Maximize2, Minimize2, Plus, Minus, Target } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface Props {
  maxGenerations?: number;
  setMaxGenerations?: (g: number) => void;
}

interface TreeNode {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  sex: string;
  generation: number;
  children?: TreeNode[];
}

export default function DescendantsSunburstTab({ maxGenerations = 4, setMaxGenerations }: Props) {
  const reactId = useId();
  const idPrefix = reactId.replace(/:/g, '-');
  const { tree, selectedPersonId, setSelectedPerson } = useApp();
  
  // The actual focal person we are charting (allows drill-down without changing app's global selectedPersonId)
  const [focalPersonId, setFocalPersonId] = useState<string | null>(selectedPersonId);

  // Sync focalPersonId if global selectedPersonId changes
  useEffect(() => {
    setFocalPersonId(selectedPersonId);
  }, [selectedPersonId]);

  const focalPerson = focalPersonId && tree ? tree.persons.get(focalPersonId) : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error("Greška pri ulasku u cijeli zaslon:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  // Construct Descendants Tree Data
  const getChildrenOfPerson = useMemo(() => {
    if (!tree) return () => [];
    return (pid: string) => {
      const p = tree.persons.get(pid);
      if (!p || !p.familiesAsSpouse) return [];
      const childrenIds: string[] = [];
      for (const fId of p.familiesAsSpouse) {
        const fam = tree.families.get(fId);
        if (fam && fam.children) {
          childrenIds.push(...fam.children);
        }
      }
      return childrenIds;
    };
  }, [tree]);

  const descendantData = useMemo(() => {
    if (!tree || !focalPersonId) return null;

    const buildNode = (personId: string, gen: number): TreeNode => {
      const p = tree.persons.get(personId);
      const bYear = p?.birth?.date?.year ?? null;
      const dYear = p?.death?.date?.year ?? null;

      const node: TreeNode = {
        id: personId,
        name: p?.names[0]?.full || 'Nepoznato',
        birth_year: bYear,
        death_year: dYear,
        sex: p?.sex || 'U',
        generation: gen,
      };

      if (gen < maxGenerations) {
        const childIds = getChildrenOfPerson(personId);
        if (childIds.length > 0) {
          node.children = childIds.map(cid => buildNode(cid, gen + 1));
        }
      }
      return node;
    };

    return buildNode(focalPersonId, 0);
  }, [tree, focalPersonId, maxGenerations, getChildrenOfPerson]);

  // Base palette for children branches
  const colorPalette = [
    '#2dd4bf', '#3b82f6', '#f97316', '#a855f7', 
    '#ec4899', '#eab308', '#ef4444', '#84cc16', 
    '#06b6d4', '#6366f1', '#f43f5e', '#14b8a6'
  ];

  // Render D3 chart
  useEffect(() => {
    if (!svgRef.current || !descendantData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = dimensions.width;
    const H = dimensions.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) / 2 - 20;

    const mainG = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        mainG.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;
    svg.call(zoom.transform, d3.zoomIdentity.translate(cx, cy));

    const root = d3.hierarchy<TreeNode>(descendantData)
      .sum(d => d.children && d.children.length > 0 ? 0 : 1) // count leaves
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition<TreeNode>().size([2 * Math.PI, root.height + 1]);
    partition(root);
    
    const rootRect = root as d3.HierarchyRectangularNode<TreeNode>;

    const arc = d3.arc<d3.HierarchyRectangularNode<TreeNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0 * (radius / (rootRect.height + 1)))
      .outerRadius(d => Math.max(d.y0 * (radius / (rootRect.height + 1)), d.y1 * (radius / (rootRect.height + 1)) - 1));

    // Assign colors to top-level children
    const branchColors = new Map<string, string>();
    if (rootRect.children) {
      rootRect.children.forEach((child, i) => {
        branchColors.set(child.data.id, colorPalette[i % colorPalette.length]);
      });
    }

    const getNodeColor = (d: d3.HierarchyRectangularNode<TreeNode>) => {
      if (d.depth === 0) return '#f8fafc'; // root color
      // Find ancestor at depth 1
      let ancestor = d;
      while (ancestor.depth > 1 && ancestor.parent) {
        ancestor = ancestor.parent;
      }
      const baseColor = branchColors.get(ancestor.data.id) || '#cbd5e1';
      // Lighter for deeper nodes
      let color = d3.color(baseColor);
      if (color) {
        for (let i = 1; i < d.depth; i++) {
          color = color.brighter(0.4);
        }
        return color.formatHex();
      }
      return baseColor;
    };

    const formatYears = (d: TreeNode) => {
      if (d.birth_year && d.death_year) return `${d.birth_year}–${d.death_year}`;
      if (d.birth_year) return `r. ${d.birth_year}`;
      return '';
    };

    // Tooltip logic
    const showTip = (event: MouseEvent, d: d3.HierarchyRectangularNode<TreeNode>) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      tip.style.display = 'block';
      tip.style.left = `${event.pageX + 15}px`;
      tip.style.top = `${event.pageY + 15}px`;
      
      const descendantsCount = d.descendants().length - 1;
      tip.innerHTML = `
        <div class="font-bold text-slate-800 text-base mb-1">${d.data.name}</div>
        <div class="text-slate-500 font-medium text-xs mb-2">${formatYears(d.data)}</div>
        ${descendantsCount > 0 ? `<div class="text-teal-600 font-bold text-xs bg-teal-50 px-2 py-1 rounded inline-block">Potomaka: ${descendantsCount}</div>` : ''}
      `;
    };

    const hideTip = () => {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    };

    const nodeGroups = mainG.selectAll('g.node')
      .data(rootRect.descendants())
      .enter()
      .append('g')
      .attr('class', 'node cursor-pointer');

    // Draw wedges
    nodeGroups.append('path')
      .attr('class', 'node-path')
      .attr('d', arc as any)
      .style('fill', d => getNodeColor(d))
      .style('stroke', '#ffffff')
      .style('stroke-width', 1.5)
      .on('mouseover', function(event, d) {
        showTip(event, d);
        // Highlight branch
        let ancestor = d;
        while (ancestor.depth > 1 && ancestor.parent) { ancestor = ancestor.parent; }
        const branchId = ancestor.depth === 1 ? ancestor.data.id : null;
        
        mainG.selectAll('path.node-path')
          .transition().duration(200)
          .style('opacity', (n: any) => {
            if (n.depth === 0) return 1;
            let a = n;
            while (a.depth > 1 && a.parent) { a = a.parent; }
            return a.data.id === branchId ? 1 : 0.2;
          });
      })
      .on('mousemove', (event, d) => showTip(event, d))
      .on('mouseout', function() {
        hideTip();
        mainG.selectAll('path.node-path').transition().duration(200).style('opacity', 1);
      })
      .on('click', (event, d) => {
        hideTip();
        if (d.data.id !== focalPersonId) {
          setFocalPersonId(d.data.id);
        }
      });

    // Draw text
    nodeGroups.each(function(d) {
      const g = d3.select(this);
      
      if (d.depth === 0) {
        // Root node text
        const totalDescendants = rootRect.descendants().length - 1;
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -10)
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .style('fill', '#334155')
          .style('pointer-events', 'none')
          .text(d.data.name.slice(0, 20));
        
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 8)
          .style('font-size', '10px')
          .style('font-weight', '500')
          .style('fill', '#64748b')
          .style('pointer-events', 'none')
          .text(formatYears(d.data));

        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 25)
          .style('font-size', '11px')
          .style('font-weight', 'bold')
          .style('fill', '#0d9488')
          .style('pointer-events', 'none')
          .text(`${totalDescendants} potomaka`);
        return;
      }

      // Curved text for wedges
      const startAngle = d.x0;
      const endAngle = d.x1;
      const angleDiff = endAngle - startAngle;
      
      // Don't draw text if wedge is too thin
      if (angleDiff < 0.04) return;

      const innerR = d.y0 * (radius / (rootRect.height + 1));
      const outerR = d.y1 * (radius / (rootRect.height + 1));
      const midR = innerR + (outerR - innerR) / 2;

      // Arc path for text
      const arcLen = midR * angleDiff;
      const maxChars = Math.floor(arcLen / 6); // approx 6px per char
      
      if (maxChars < 3) return; // Too small for even 3 chars

      let displayName = d.data.name;
      if (displayName.length > maxChars) {
        displayName = displayName.slice(0, maxChars - 1) + '…';
      }

      const midAngle = startAngle + angleDiff / 2;
      const flip = midAngle > Math.PI / 2 && midAngle < (Math.PI * 3) / 2;

      // SVG path generator function for the curve
      const describeArc = (r: number, start: number, end: number, flipDir: boolean) => {
        const pStart = [r * Math.cos(start - Math.PI / 2), r * Math.sin(start - Math.PI / 2)];
        const pEnd = [r * Math.cos(end - Math.PI / 2), r * Math.sin(end - Math.PI / 2)];
        if (flipDir) {
          return `M ${pEnd[0]} ${pEnd[1]} A ${r} ${r} 0 0 0 ${pStart[0]} ${pStart[1]}`;
        }
        return `M ${pStart[0]} ${pStart[1]} A ${r} ${r} 0 0 1 ${pEnd[0]} ${pEnd[1]}`;
      };

      const pathId = `arc-${idPrefix}-${d.data.id}-${d.depth}`;
      const nameR = d.data.birth_year ? (flip ? midR + 6 : midR - 6) : midR;

      mainG.append('defs').append('path')
        .attr('id', pathId)
        .attr('d', describeArc(nameR, startAngle, endAngle, flip));

      const isDarkBg = d.depth === 1; // 1st ring has darker colors
      const textFill = isDarkBg ? '#ffffff' : '#334155';

      g.append('text')
        .append('textPath')
        .attr('href', `#${pathId}`)
        .attr('startOffset', '50%')
        .attr('text-anchor', 'middle')
        .text(displayName)
        .style('font-size', '10px')
        .style('fill', textFill)
        .style('font-weight', '600')
        .style('pointer-events', 'none')
        .attr('dominant-baseline', 'central');

      if (d.data.birth_year) {
        const yearR = flip ? midR - 6 : midR + 6;
        const yearPathId = `arc-yr-${idPrefix}-${d.data.id}-${d.depth}`;
        mainG.append('defs').append('path')
          .attr('id', yearPathId)
          .attr('d', describeArc(yearR, startAngle, endAngle, flip));

        const yrStr = formatYears(d.data);
        const yrMaxChars = Math.floor(arcLen / 5);
        if (yrStr.length <= yrMaxChars) {
          g.append('text')
            .append('textPath')
            .attr('href', `#${yearPathId}`)
            .attr('startOffset', '50%')
            .attr('text-anchor', 'middle')
            .text(yrStr)
            .style('font-size', '8px')
            .style('fill', isDarkBg ? 'rgba(255,255,255,0.8)' : '#64748b')
            .style('font-weight', '500')
            .style('pointer-events', 'none')
            .attr('dominant-baseline', 'central');
        }
      }
    });

  }, [descendantData, dimensions, idPrefix, focalPersonId]);

  const doZoom = (type: 'in' | 'out' | 'reset') => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    if (type === 'in') svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 1.3);
    else if (type === 'out') svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 0.7);
    else {
      const W = dimensions.width;
      const H = dimensions.height;
      svg.transition().duration(400).call(zoomRef.current.transform as any, d3.zoomIdentity.translate(W / 2, H / 2));
    }
  };

  // Generate Legend Data
  const legendData = useMemo(() => {
    if (!descendantData || !descendantData.children) return [];
    const rootHierarchy = d3.hierarchy<TreeNode>(descendantData);
    const totalDesc = rootHierarchy.descendants().length - 1;
    if (totalDesc === 0) return [];

    return descendantData.children.map((child, i) => {
      const childH = d3.hierarchy(child);
      const descCount = childH.descendants().length; // includes the child itself
      return {
        id: child.id,
        name: child.name,
        color: colorPalette[i % colorPalette.length],
        count: descCount,
        percent: Math.round((descCount / totalDesc) * 100)
      };
    }).sort((a, b) => b.count - a.count);
  }, [descendantData]);

  if (!selectedPersonId) return null;

  return (
    <div className="flex-1 flex flex-col gap-3 px-3 pb-3 overflow-hidden min-h-0">
      <div ref={tooltipRef} className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-3 pointer-events-none hidden" />

      {/* Header and Legend */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col shrink-0 print:hidden gap-4">
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {focalPerson ? (
              <div className="flex items-center gap-4 w-full px-2">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl border-4 shadow-sm shrink-0
                  ${focalPerson.sex === 'M' ? 'bg-blue-50 border-blue-200 text-blue-500'
                  : focalPerson.sex === 'F' ? 'bg-pink-50 border-pink-200 text-pink-500'
                  : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                  {focalPerson.sex === 'M' ? '♂' : focalPerson.sex === 'F' ? '♀' : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold text-xl text-slate-800 truncate leading-tight">{focalPerson.names[0]?.full || 'Nepoznato'}</h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-500 font-medium">
                    {focalPerson.birth?.date?.year && focalPerson.death?.date?.year ? (
                      <span>Rođen/a {focalPerson.birth.date.year}. – Umro/la {focalPerson.death.date.year}.</span>
                    ) : focalPerson.birth?.date?.year ? (
                      <span>Rođen/a {focalPerson.birth.date.year}.</span>
                    ) : <span>Nepoznata godina rođenja</span>}
                    
                    {descendantData && (
                      <span className="flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-bold">
                        👥 Prikazano {d3.hierarchy(descendantData).descendants().length - 1} potomaka
                      </span>
                    )}

                    {focalPersonId !== selectedPersonId && (
                      <button onClick={() => setFocalPersonId(selectedPersonId)} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-bold shadow-sm">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Nazad na ishodišnu osobu
                      </button>
                    )}

                    <button onClick={() => setSelectedPerson(null)} className="ml-auto px-2 py-0.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold" title="Zatvori osobu">
                      Zatvori
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Generations picker */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Generacije:</span>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0.5 shadow-inner">
              {[3, 4, 5, 6, 7].map(g => (
                <button key={g} onClick={() => setMaxGenerations?.(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                    maxGenerations === g
                      ? 'bg-white text-teal-600 shadow-sm border border-teal-100 scale-105'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                  {g} gen
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Branches Legend */}
        {legendData.length > 0 && (
          <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Grane djece:</span>
            {legendData.map(l => (
              <div 
                key={l.id} 
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-md transition-colors"
                onMouseEnter={() => {
                  if (svgRef.current) {
                    d3.select(svgRef.current).selectAll('path.node-path').transition().duration(200)
                      .style('opacity', function(d: any) {
                        if (d.depth === 0) return 1;
                        let a = d;
                        while (a.depth > 1 && a.parent) { a = a.parent; }
                        return a.data.id === l.id ? 1 : 0.15;
                      });
                  }
                }}
                onMouseLeave={() => {
                  if (svgRef.current) {
                    d3.select(svgRef.current).selectAll('path.node-path').transition().duration(200).style('opacity', 1);
                  }
                }}
                onClick={() => setFocalPersonId(l.id)}
                title="Klikni za centriranje na ovu granu"
              >
                <span className="w-3 h-3 rounded shadow-sm border border-black/10" style={{ backgroundColor: l.color }}></span>
                <span>{l.name.split(' ')[0]}</span>
                <span className="text-slate-400 font-medium ml-1">{l.count} ({l.percent}%)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SVG Canvas Area */}
      <div className="flex-1 relative bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none" ref={containerRef}>
        <button onClick={toggleFullscreen} className="absolute top-3 left-3 z-10 w-8 h-8 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors print:hidden" title={isFullscreen ? "Izađi iz cijelog zaslona" : "Cijeli zaslon"}>
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <div className="absolute top-3 right-3 z-10 flex items-center bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden print:hidden">
          <button onClick={() => doZoom('in')} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-teal-600 border-r border-slate-200 transition-colors" title="Povećaj"><Plus size={15} /></button>
          <button onClick={() => doZoom('reset')} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-teal-600 border-r border-slate-200 transition-colors" title="Centriraj"><Target size={15} /></button>
          <button onClick={() => doZoom('out')} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-teal-600 transition-colors" title="Smanji"><Minus size={15} /></button>
        </div>
        <svg ref={svgRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none" />
      </div>
    </div>
  );
}
