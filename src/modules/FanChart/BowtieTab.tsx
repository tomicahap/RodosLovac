import React, { useId, useMemo, useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { Maximize2, Minimize2, Plus, Minus, Target, Download, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface TreeNode {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  sex: string;
  generation: number;
  ahnentafel?: number;
  children?: TreeNode[];
  isAncestor?: boolean;
}

export default function BowtieTab() {
  const reactId = useId();
  const idPrefix = reactId.replace(/:/g, '-');
  const { tree, selectedPersonId, setSelectedPerson } = useApp();

  const [ancGens, setAncGens] = useState(4);
  const [descGens, setDescGens] = useState(3);
  
  const focalPerson = selectedPersonId && tree ? tree.persons.get(selectedPersonId) : null;

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

  const ancestorData = useMemo(() => {
    if (!tree || !selectedPersonId) return null;

    const buildNode = (personId: string | null, gen: number, ahn: number): TreeNode => {
      const p = personId ? tree.persons.get(personId) : undefined;
      const node: TreeNode = {
        id: personId || `unk-${ahn}`,
        name: p?.names[0]?.full || 'Nepoznato',
        birth_year: p?.birth?.date?.year ?? null,
        death_year: p?.death?.date?.year ?? null,
        sex: p?.sex || (ahn % 2 === 0 ? 'M' : 'F'),
        generation: gen,
        ahnentafel: ahn,
        isAncestor: true
      };

      if (gen < ancGens) {
        const fatherId = p?._parents?.find(pid => tree.persons.get(pid)?.sex === 'M') || null;
        const motherId = p?._parents?.find(pid => tree.persons.get(pid)?.sex === 'F') || null;
        if (fatherId || motherId) {
          node.children = [
            buildNode(fatherId, gen + 1, ahn * 2),
            buildNode(motherId, gen + 1, ahn * 2 + 1)
          ];
        }
      }
      return node;
    };

    return buildNode(selectedPersonId, 0, 1);
  }, [tree, selectedPersonId, ancGens]);

  const descendantData = useMemo(() => {
    if (!tree || !selectedPersonId) return null;

    const buildNode = (personId: string, gen: number): TreeNode => {
      const p = tree.persons.get(personId);
      const node: TreeNode = {
        id: personId,
        name: p?.names[0]?.full || 'Nepoznato',
        birth_year: p?.birth?.date?.year ?? null,
        death_year: p?.death?.date?.year ?? null,
        sex: p?.sex || 'U',
        generation: gen,
        isAncestor: false
      };

      if (gen < descGens) {
        const childIds = getChildrenOfPerson(personId);
        if (childIds.length > 0) {
          node.children = childIds.map(cid => buildNode(cid, gen + 1));
        }
      }
      return node;
    };

    return buildNode(selectedPersonId, 0);
  }, [tree, selectedPersonId, descGens, getChildrenOfPerson]);

  const getAncestorGenColor = (gen: number) => {
    if (gen === 1) return '#dcfce7'; // teal/green
    if (gen === 2) return '#dbeafe'; // blue
    if (gen === 3) return '#f3e8ff'; // purple
    if (gen === 4) return '#ffedd5'; // orange
    if (gen === 5) return '#fce7f3'; // pink
    if (gen === 6) return '#e0e7ff'; // indigo
    return '#f1f5f9'; // fallback
  };

  const getDescendantColors = (sex: string) => {
    if (sex === 'M') return { bg: '#ffffff', border: '#22c55e', text: '#22c55e' };
    if (sex === 'F') return { bg: '#ffffff', border: '#ec4899', text: '#ec4899' };
    return { bg: '#ffffff', border: '#94a3b8', text: '#94a3b8' };
  };

  useEffect(() => {
    if (!svgRef.current || !ancestorData || !descendantData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = dimensions.width;
    const H = dimensions.height;
    const cx = W / 2;
    const cy = H / 2;

    const mainG = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        mainG.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomRef.current = zoom;
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0));

    const nodeWidth = 160;
    const nodeHeight = 44;
    const hSpacing = 40;
    const vSpacing = 20;

    // Build left tree (Ancestors)
    const ancRoot = d3.hierarchy<TreeNode>(ancestorData);
    d3.tree<TreeNode>().nodeSize([nodeHeight + vSpacing, nodeWidth + hSpacing])(ancRoot);

    // Build right tree (Descendants)
    const descRoot = d3.hierarchy<TreeNode>(descendantData);
    d3.tree<TreeNode>().nodeSize([nodeHeight + vSpacing, nodeWidth + hSpacing])(descRoot);

    // Map coordinates
    // Ancestors grow left: negative X. (d.y from d3.tree represents depth)
    const ancPointNodes = ancRoot.descendants() as d3.HierarchyPointNode<TreeNode>[];
    ancPointNodes.forEach(d => {
      (d as any).x_rendered = cx - d.y;
      (d as any).y_rendered = cy + d.x;
    });

    // Descendants grow right: positive X
    const descPointNodes = descRoot.descendants() as d3.HierarchyPointNode<TreeNode>[];
    descPointNodes.forEach(d => {
      (d as any).x_rendered = cx + d.y;
      (d as any).y_rendered = cy + d.x;
    });

    // We don't want to draw the root twice. We'll draw the root from ancRoot, and skip root from descRoot.
    const ancNodes = ancPointNodes;
    const descNodes = descPointNodes.filter(d => d.depth > 0);

    const allNodes = [...ancNodes, ...descNodes];

    // Links for ancestors
    const ancLinks = ancRoot.links().map(l => ({
      source: l.source,
      target: l.target,
      isAncestor: true
    }));

    // Links for descendants
    const descLinks = descRoot.links().map(l => ({
      source: l.source,
      target: l.target,
      isAncestor: false
    }));

    const allLinks = [...ancLinks, ...descLinks];

    const linkGen = d3.linkHorizontal<any, any>()
      .source(d => {
        // Line starts from parent
        const x = d.isAncestor ? d.source.x_rendered - nodeWidth / 2 : d.source.x_rendered + nodeWidth / 2;
        return [x, d.source.y_rendered];
      })
      .target(d => {
        // Line goes to child
        const x = d.isAncestor ? d.target.x_rendered + nodeWidth / 2 : d.target.x_rendered - nodeWidth / 2;
        return [x, d.target.y_rendered];
      });

    // Draw links
    mainG.selectAll('.link')
      .data(allLinks)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', linkGen as any)
      .style('fill', 'none')
      .style('stroke', '#cbd5e1')
      .style('stroke-width', 2);

    const showTip = (event: MouseEvent, d: any) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      tip.style.display = 'block';
      tip.style.left = `${event.pageX + 15}px`;
      tip.style.top = `${event.pageY + 15}px`;
      tip.innerHTML = `
        <div class="font-bold text-slate-800 text-base mb-1">${d.data.name}</div>
        <div class="text-slate-500 font-medium text-xs">
          ${d.data.birth_year ? `Rođen/a: ${d.data.birth_year}.` : ''}
          ${d.data.death_year ? `<br/>Umro/la: ${d.data.death_year}.` : ''}
        </div>
      `;
    };

    const hideTip = () => {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    };

    // Draw nodes
    const nodeGroups = mainG.selectAll('g.node')
      .data(allNodes)
      .enter()
      .append('g')
      .attr('class', 'node cursor-pointer')
      .attr('transform', (d: any) => `translate(${d.x_rendered},${d.y_rendered})`)
      .on('mouseover', (event, d) => showTip(event, d))
      .on('mousemove', (event, d) => showTip(event, d))
      .on('mouseout', hideTip)
      .on('click', (event, d) => {
        hideTip();
        if (!d.data.id.startsWith('unk-')) {
          setSelectedPerson(d.data.id);
        }
      });

    // Draw cards
    nodeGroups.each(function(d: any) {
      const g = d3.select(this);
      const isRoot = d.depth === 0;

      let bg = '#ffffff';
      let stroke = '#e2e8f0';
      let strokeWidth = 1.5;
      let textColor = '#334155';

      if (isRoot) {
        bg = '#ccfbf1';
        stroke = '#0d9488';
        strokeWidth = 3;
      } else if (d.data.isAncestor) {
        bg = getAncestorGenColor(d.data.generation);
        stroke = d3.color(bg)?.darker(0.5)?.formatHex() || stroke;
      } else {
        const colors = getDescendantColors(d.data.sex);
        bg = colors.bg;
        stroke = colors.border;
      }

      g.append('rect')
        .attr('x', -nodeWidth / 2)
        .attr('y', -nodeHeight / 2)
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .style('fill', bg)
        .style('stroke', stroke)
        .style('stroke-width', strokeWidth);

      // Node Name
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -3)
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', textColor)
        .style('pointer-events', 'none')
        .text(d.data.name.length > 22 ? d.data.name.slice(0, 20) + '…' : d.data.name);

      // Years
      const yrs = [];
      if (d.data.birth_year) yrs.push(`b. ${d.data.birth_year}`);
      if (d.data.death_year) yrs.push(`d. ${d.data.death_year}`);

      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 12)
        .style('font-size', '10px')
        .style('font-weight', '500')
        .style('fill', '#64748b')
        .style('pointer-events', 'none')
        .text(yrs.join('  '));
    });

  }, [ancestorData, descendantData, dimensions]);

  const doZoom = (type: 'in' | 'out' | 'reset') => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    if (type === 'in') svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 1.3);
    else if (type === 'out') svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 0.7);
    else svg.transition().duration(400).call(zoomRef.current.transform as any, d3.zoomIdentity.translate(0, 0));
  };

  if (!selectedPersonId) return null;

  return (
    <div className="flex-1 flex flex-col gap-3 px-3 pb-3 overflow-hidden min-h-0">
      <div ref={tooltipRef} className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-3 pointer-events-none hidden" />

      {/* Header Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-3 shrink-0 print:hidden">
        <div className="flex items-center justify-between gap-4">
          
          {/* Focal Person */}
          <div className="flex items-center gap-4 flex-1">
            {focalPerson ? (
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-4 shadow-sm shrink-0
                  ${focalPerson.sex === 'M' ? 'bg-teal-50 border-teal-200 text-teal-600'
                  : focalPerson.sex === 'F' ? 'bg-pink-50 border-pink-200 text-pink-500'
                  : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                  {focalPerson.sex === 'M' ? '♂' : focalPerson.sex === 'F' ? '♀' : '?'}
                </div>
                <div>
                  <h2 className="font-extrabold text-lg text-slate-800 leading-tight">{focalPerson.names[0]?.full || 'Nepoznato'}</h2>
                  <div className="text-xs text-slate-500 font-medium">
                    {focalPerson.birth?.date?.year ? `Rođen/a ${focalPerson.birth.date.year}.` : 'Nepoznata godina rođenja'}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Generations Controls */}
          <div className="flex items-center gap-6 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Preci (Lijevo)</span>
              <div className="flex items-center gap-1">
                {[2, 3, 4, 5].map(g => (
                  <button key={g} onClick={() => setAncGens(g)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      ancGens === g ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                    }`}>
                    {g}G
                  </button>
                ))}
              </div>
            </div>
            
            <div className="w-px h-8 bg-slate-200" />
            
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Potomci (Desno)</span>
              <div className="flex items-center gap-1">
                {[2, 3, 4].map(g => (
                  <button key={g} onClick={() => setDescGens(g)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      descGens === g ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                    }`}>
                    {g}G
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm">
              <Download size={14} /> PDF
            </button>
            <button onClick={() => setSelectedPerson(null)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors">
              <X size={14} /> Očisti
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 mr-2">Boje predaka:</span>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#dcfce7] border border-[#86efac]"></span> Gen 1</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#dbeafe] border border-[#93c5fd]"></span> Gen 2</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f3e8ff] border border-[#d8b4fe]"></span> Gen 3</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#ffedd5] border border-[#fdba74]"></span> Gen 4</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#fce7f3] border border-[#f9a8d4]"></span> Gen 5</div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 mr-2">Boje potomaka:</span>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border-2 border-[#22c55e]"></span> Muški</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border-2 border-[#ec4899]"></span> Ženski</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border-2 border-[#94a3b8]"></span> Nepoznato</div>
          </div>
        </div>
      </div>

      {/* Canvas */}
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
