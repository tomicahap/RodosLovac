import React, { useEffect, useRef, useMemo, useState, useCallback, useId } from 'react';
import * as d3 from 'd3';
import { useApp } from '../../context/AppContext';
import { Maximize2, Minimize2, Plus, Minus, Target, Download, X } from 'lucide-react';
import { ColorMode, ChartTab } from './FanChart';
import { getCountryFromPlace, getPlaceLand } from '../../utils/countryHelper';

interface TreeNode {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  birth_place: string | null;
  death_place: string | null;
  sex: string;
  generation: number;
  ahnentafel?: number;
  family_children_count?: number | null;
  children?: TreeNode[];
}

const FAMILY_CATEGORIES = [
  { id: 'only_child', label: 'Jedino dijete', color: '#4f46e5', match: (n: number | null | undefined) => n === 1 },
  { id: '2', label: '2', color: '#0ea5e9', match: (n: number | null | undefined) => n === 2 },
  { id: '3', label: '3', color: '#10b981', match: (n: number | null | undefined) => n === 3 },
  { id: '4_5', label: '4–5', color: '#a855f7', match: (n: number | null | undefined) => n !== null && n !== undefined && n >= 4 && n <= 5 },
  { id: '6_7', label: '6–7', color: '#f97316', match: (n: number | null | undefined) => n !== null && n !== undefined && n >= 6 && n <= 7 },
  { id: '8_9', label: '8–9', color: '#ef4444', match: (n: number | null | undefined) => n !== null && n !== undefined && n >= 8 && n <= 9 },
  { id: '10_plus', label: '10 +', color: '#991b1b', match: (n: number | null | undefined) => n !== null && n !== undefined && n >= 10 },
  { id: 'not_in_tree', label: 'Nije u stablu', color: '#94a3b8', match: (n: number | null | undefined) => n === null || n === undefined || n === 0 },
];

const GEN_AGE_RANGES = [
  { label: '20–24', color: '#2563eb' },
  { label: '25–29', color: '#06b6d4' },
  { label: '30–34', color: '#10b981' },
  { label: '35–39', color: '#a855f7' },
  { label: '40–44', color: '#f97316' },
  { label: '45–49', color: '#ef4444' },
];

const getGenAgeColor = (age: number): string => {
  if (age < 20) return '#60a5fa';
  if (age <= 24) return '#2563eb';
  if (age <= 29) return '#06b6d4';
  if (age <= 34) return '#10b981';
  if (age <= 39) return '#a855f7';
  if (age <= 44) return '#f97316';
  if (age <= 49) return '#ef4444';
  return '#be123c';
};

const GENERATION_COLORS = [
  '#0f766e', // Gen 0
  '#0d9488', // Gen 1
  '#0891b2', // Gen 2
  '#2563eb', // Gen 3
  '#4f46e5', // Gen 4
  '#7c3aed', // Gen 5
  '#9333ea', // Gen 6
  '#c084fc', // Gen 7
];

const getGenerationLabelCroatian = (gen: number, sex: string): string => {
  if (gen === 0) return 'ODABRANA OSOBA';
  if (gen === 1) return sex === 'M' ? 'OTAC/SIN' : 'MAJKA/KĆI';
  if (gen === 2) return sex === 'M' ? 'DJED/UNUK' : 'BAKA/UNUKA';
  return `${gen} gen.`;
};

const UNKNOWN_COLOR = '#f1f5f9';

interface Props {
  viewType: ChartTab; // 'ancestors' | 'descendants' | 'bowtie'
  maxGenerations: number;
  setMaxGenerations?: (g: number) => void;
  colorMode: ColorMode;
  setColorMode?: (c: ColorMode) => void;
}

export default function FamilyTreeTab({ viewType, maxGenerations = 4, setMaxGenerations, colorMode = 'generation', setColorMode }: Props) {
  const reactId = useId();
  const idPrefix = reactId.replace(/:/g, '-');
  const { tree, selectedPersonId, setSelectedPerson } = useApp();
  const selectedPerson = selectedPersonId && tree ? tree.persons.get(selectedPersonId) : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const maxKnownGen = useMemo(() => {
    if (!tree || !selectedPersonId) return 0;
    const calc = (id: string, depth: number, visited: Set<string>): number => {
      if (visited.has(id)) return depth;
      visited.add(id);
      const p = tree.persons.get(id);
      if (!p || !p._parents || p._parents.length === 0) return depth;
      const depths = p._parents.map(pid => calc(pid, depth + 1, new Set(visited)));
      return Math.max(...depths);
    };
    return calc(selectedPersonId, 1, new Set());
  }, [tree, selectedPersonId]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const isGenAgeMode = colorMode === 'dob_roditelja';
  const isFamilyMode = colorMode === 'obitelj';

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: width || 800, height: height || 600 });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Helper to find children
  const getChildrenOfPerson = useCallback((personId: string): string[] => {
    if (!tree) return [];
    const p = tree.persons.get(personId);
    if (!p) return [];
    const children: string[] = [];
    p.familiesAsSpouse.forEach(famId => {
      const fam = tree.families.get(famId);
      if (fam) {
        fam.children.forEach(cid => {
          if (!children.includes(cid)) {
            children.push(cid);
          }
        });
      }
    });
    return children;
  }, [tree]);

  // Construct Ancestors Tree Data
  const ancestorData = useMemo(() => {
    if (!tree || !selectedPersonId) return null;

    const buildNode = (personId: string | null, gen: number, ahn: number): TreeNode => {
      const p = personId ? tree.persons.get(personId) : null;
      const bYear = p?.birth?.date?.year ?? null;
      const dYear = p?.death?.date?.year ?? null;
      const place = p?.birth?.place ?? null;

      let family_children_count: number | null = null;
      if (p && p.familiesAsChild && p.familiesAsChild.length > 0) {
        const fam = tree.families.get(p.familiesAsChild[0]);
        if (fam) {
          const siblings = fam.children.map(cid => tree.persons.get(cid)).filter((sib): sib is any => !!sib);
          const diedInFirstYear = (sib: any) => {
            if (!sib.birth || !sib.death) return false;
            const bYear = sib.birth.date?.year;
            const dYear = sib.death.date?.year;
            if (bYear === undefined || dYear === undefined) return false;
            return (dYear - bYear) <= 1; // simple fallback
          };
          family_children_count = siblings.filter(sib => !diedInFirstYear(sib)).length;
        }
      }

      const node: TreeNode = {
        id: personId || `unk-${ahn}`,
        name: p?.names[0]?.full || 'Nepoznato',
        birth_year: bYear,
        death_year: dYear,
        birth_place: place,
        death_place: p?.death?.place ?? null,
        sex: p?.sex || (ahn % 2 === 0 ? 'M' : 'F'),
        generation: gen,
        ahnentafel: ahn,
        family_children_count
      };

      if (gen < maxGenerations) {
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
  }, [tree, selectedPersonId, maxGenerations]);

  // Construct Descendants Tree Data
  const descendantData = useMemo(() => {
    if (!tree || !selectedPersonId) return null;

    const buildNode = (personId: string, gen: number): TreeNode => {
      const p = tree.persons.get(personId)!;
      const bYear = p.birth?.date?.year ?? null;
      const dYear = p.death?.date?.year ?? null;
      const place = p.birth?.place ?? null;

      let family_children_count: number | null = null;
      if (p.familiesAsChild && p.familiesAsChild.length > 0) {
        const fam = tree.families.get(p.familiesAsChild[0]);
        if (fam) {
          family_children_count = fam.children.length;
        }
      }

      const node: TreeNode = {
        id: p.id,
        name: p.names[0]?.full || 'Nepoznato',
        birth_year: bYear,
        death_year: dYear,
        birth_place: place,
        death_place: p.death?.place ?? null,
        sex: p.sex,
        generation: gen,
        family_children_count
      };

      if (gen < maxGenerations) {
        const childIds = getChildrenOfPerson(personId);
        if (childIds.length > 0) {
          node.children = childIds.map(cid => buildNode(cid, gen + 1));
        }
      }
      return node;
    };

    return buildNode(selectedPersonId, 0);
  }, [tree, selectedPersonId, maxGenerations, getChildrenOfPerson]);

  // Combined counts for legends
  const allNodesList = useMemo(() => {
    const list: TreeNode[] = [];
    const traverse = (n: TreeNode) => {
      list.push(n);
      n.children?.forEach(traverse);
    };
    if (viewType === 'ancestors' && ancestorData) traverse(ancestorData);
    else if (viewType === 'descendants' && descendantData) traverse(descendantData);
    else if (viewType === 'bowtie') {
      if (ancestorData) traverse(ancestorData);
      if (descendantData) traverse(descendantData);
    }
    return list;
  }, [viewType, ancestorData, descendantData]);

  // Calculations for stats / legends
  const genAgeLegendCounts = useMemo(() => {
    const counts = {
      '20-24': 0, '25-29': 0, '30-34': 0, '35-39': 0, '40-44': 0, '45-49': 0, 'others': 0, 'men': 0, 'women': 0
    };
    const nodesMap = new Map<string, TreeNode>();
    allNodesList.forEach(n => nodesMap.set(n.id, n));

    allNodesList.forEach(n => {
      // Find its child in ancestors (or parent in descendants)
      // To keep it simple: if node is in ancestor tree and has an ahnentafel
      if (n.ahnentafel && n.ahnentafel > 1) {
        const childAhn = Math.floor(n.ahnentafel / 2);
        const child = allNodesList.find(c => c.ahnentafel === childAhn);
        if (child && n.birth_year && child.birth_year) {
          const age = child.birth_year - n.birth_year;
          if (age >= 20 && age <= 24) counts['20-24']++;
          else if (age >= 25 && age <= 29) counts['25-29']++;
          else if (age >= 30 && age <= 34) counts['30-34']++;
          else if (age >= 35 && age <= 39) counts['35-39']++;
          else if (age >= 40 && age <= 44) counts['40-44']++;
          else if (age >= 45 && age <= 49) counts['45-49']++;
          else counts['others']++;
          
          if (n.sex === 'M') counts['men']++;
          else if (n.sex === 'F') counts['women']++;
        }
      }
    });
    return counts;
  }, [allNodesList]);

  const familyLegendCounts = useMemo(() => {
    const counts = { only_child: 0, '2': 0, '3': 0, '4_5': 0, '6_7': 0, '8_9': 0, '10_plus': 0, 'not_in_tree': 0 };
    allNodesList.forEach(node => {
      const count = node.family_children_count;
      if (count === null || count === undefined || count === 0) counts.not_in_tree++;
      else if (count === 1) counts.only_child++;
      else if (count === 2) counts['2']++;
      else if (count === 3) counts['3']++;
      else if (count >= 4 && count <= 5) counts['4_5']++;
      else if (count >= 6 && count <= 7) counts['6_7']++;
      else if (count >= 8 && count <= 9) counts['8_9']++;
      else counts['10_plus']++;
    });
    return counts;
  }, [allNodesList]);

  const countryLegendStats = useMemo(() => {
    const counts = new Map<string, number>();
    let unknownCount = 0;
    allNodesList.forEach(n => {
      if (n.birth_place) {
        const country = getCountryFromPlace(n.birth_place);
        counts.set(country, (counts.get(country) || 0) + 1);
      } else {
        unknownCount++;
      }
    });
    return {
      list: Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a,b) => b.count - a.count),
      unknownCount
    };
  }, [allNodesList]);

  const landsLegendStats = useMemo(() => {
    const counts = new Map<string, number>();
    let unknownCount = 0;
    allNodesList.forEach(n => {
      const land = getPlaceLand(n.birth_place);
      if (land) {
        counts.set(land, (counts.get(land) || 0) + 1);
      } else {
        unknownCount++;
      }
    });
    return {
      list: Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a,b) => b.count - a.count),
      unknownCount
    };
  }, [allNodesList]);

  // Legend stats
  const legendStats = useMemo(() => {
    if (!ancestorData) return [];
    const stats: { label: string; known: number; total: number }[] = [];
    const GEN_LABELS = [
      'Odabrana osoba',
      'Roditelji',
      'Djedovi i bake',
      'Pradjedovi i prabake',
      '2× Pradjedovi',
      '3× Pradjedovi',
      '4× Pradjedovi',
      '5× Pradjedovi',
    ];
    for (let g = 0; g <= maxGenerations; g++) {
      const total = Math.pow(2, g);
      const known = g === 0 ? 1 : 0;
      stats.push({ label: GEN_LABELS[g] || `${g}× Pradjedovi`, known, total });
    }
    const countKnown = (node: TreeNode) => {
      if (node.id && !node.id.startsWith('unk-') && node.generation > 0 && node.generation <= maxGenerations) {
        stats[node.generation].known++;
      }
      node.children?.forEach(countKnown);
    };
    ancestorData.children?.forEach(countKnown);
    return stats;
  }, [ancestorData, maxGenerations]);

  // Stable color scales
  const countryColorScale = useMemo(() => d3.scaleOrdinal(d3.schemeSet2), []);
  const landsColorScale = useMemo(() => d3.scaleOrdinal(d3.schemeSet3), []);

  // Color mapper
  const getNodeColor = useCallback((node: TreeNode): string => {
    if (node.id.startsWith('unk-')) return UNKNOWN_COLOR;
    switch (colorMode) {
      case 'generation':
        return GENERATION_COLORS[node.generation] ?? GENERATION_COLORS[GENERATION_COLORS.length - 1];
      case 'drzava':
        if (!node.birth_place) return '#cbd5e1';
        return countryColorScale(getCountryFromPlace(node.birth_place));
      case 'lands': {
        const land = getPlaceLand(node.birth_place);
        if (!land) return '#cbd5e1';
        return landsColorScale(land);
      }
      case 'dob_roditelja': {
        // Find child age gap
        if (node.ahnentafel && node.ahnentafel > 1) {
          const childAhn = Math.floor(node.ahnentafel / 2);
          const child = allNodesList.find(c => c.ahnentafel === childAhn);
          if (child && node.birth_year && child.birth_year) {
            return getGenAgeColor(child.birth_year - node.birth_year);
          }
        }
        return '#cbd5e1';
      }
      case 'obitelj': {
        const count = node.family_children_count;
        if (count === null || count === undefined || count === 0) return '#cbd5e1';
        if (count === 1) return '#4f46e5';
        if (count === 2) return '#0ea5e9';
        if (count === 3) return '#10b981';
        if (count >= 4 && count <= 5) return '#a855f7';
        if (count >= 6 && count <= 7) return '#f97316';
        if (count >= 8 && count <= 9) return '#ef4444';
        return '#991b1b';
      }
      default:
        return UNKNOWN_COLOR;
    }
  }, [colorMode, allNodesList]);

  const highlightGroup = useCallback((filterFn: (node: TreeNode) => boolean) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('.node-card')
      .transition().duration(120)
      .style('opacity', (d: any) => d && filterFn(d.data) ? 1 : 0.20);
    svg.selectAll('.tree-link')
      .transition().duration(120)
      .style('opacity', (d: any) => d && filterFn(d.source.data) && filterFn(d.target.data) ? 1 : 0.15);
  }, []);

  const resetHighlight = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('.node-card').transition().duration(120).style('opacity', 1);
    svg.selectAll('.tree-link').transition().duration(120).style('opacity', 0.6);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !selectedPersonId) return;

    const W = dimensions.width;
    const H = dimensions.height;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', W).attr('height', H);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom as any);
    zoomRef.current = zoom;

    const cx = W / 2;
    const cy = H / 2;

    const isAncestors = viewType === 'ancestors';
    const nodeWidth = isAncestors ? 160 : 145;
    const nodeHeight = isAncestors ? 54 : 44;

    // Build hierarchy layouts
    let nodes: any[] = [];
    let links: any[] = [];

    if (viewType === 'ancestors' && ancestorData) {
      const root = d3.hierarchy(ancestorData);
      d3.tree<TreeNode>().nodeSize([nodeWidth + 40, 120])(root);
      
      root.descendants().forEach((d: any) => {
        // grows UPWARDS, centered at cx
        d.x_rendered = cx + d.x;
        d.y_rendered = Math.max(H - 100, maxGenerations * 120 + 100) - d.y;
      });
      nodes = root.descendants();
      links = root.links();
      svg.call(zoom.transform as any, d3.zoomIdentity.translate(0, 0));
    } 
    else if (viewType === 'descendants' && descendantData) {
      const root = d3.hierarchy(descendantData);
      d3.tree<TreeNode>().size([H - 80, W - 250])(root);
      
      root.descendants().forEach((d: any) => {
        d.x_rendered = d.y + 40;
        d.y_rendered = d.x + 40;
      });
      nodes = root.descendants();
      links = root.links();
      svg.call(zoom.transform as any, d3.zoomIdentity.translate(0, 0));
    } 
    else if (viewType === 'bowtie' && ancestorData && descendantData) {
      // Symmetrical layout
      // Left side: Ancestors
      const ancRoot = d3.hierarchy(ancestorData);
      d3.tree<TreeNode>().size([H - 80, cx - 120])(ancRoot);
      ancRoot.descendants().forEach((d: any) => {
        d.x_rendered = cx - d.y; // growing leftwards
        d.y_rendered = d.x + 40;
      });

      // Right side: Descendants
      const descRoot = d3.hierarchy(descendantData);
      d3.tree<TreeNode>().size([H - 80, cx - 120])(descRoot);
      descRoot.descendants().forEach((d: any) => {
        d.x_rendered = cx + d.y; // growing rightwards
        d.y_rendered = d.x + 40;
      });

      nodes = [...ancRoot.descendants(), ...descRoot.descendants().filter(d => d.depth > 0)] as any;
      links = [...ancRoot.links(), ...descRoot.links()] as any;
      svg.call(zoom.transform as any, d3.zoomIdentity.translate(0, 0));
    }

    // Bézier link drawer
    const linkGenerator = (d: any) => {
      const sx = d.source.x_rendered;
      const sy = d.source.y_rendered;
      const tx = d.target.x_rendered;
      const ty = d.target.y_rendered;
      if (viewType === 'ancestors') {
        const topY = sy - nodeHeight / 2;
        const botY = ty + nodeHeight / 2;
        const midY = (topY + botY) / 2;
        return `M ${sx} ${topY} L ${sx} ${midY} C ${sx} ${(midY + botY) / 2}, ${tx} ${(midY + botY) / 2}, ${tx} ${botY}`;
      } else {
        return `M ${sx} ${sy} C ${(sx + tx) / 2} ${sy}, ${(sx + tx) / 2} ${ty}, ${tx} ${ty}`;
      }
    };

    // Trace paths helper
    const getPathIds = (node: d3.HierarchyNode<TreeNode>): Set<string> => {
      const set = new Set<string>();
      let curr: d3.HierarchyNode<TreeNode> | null = node;
      while (curr) {
        set.add(curr.data.id);
        curr = curr.parent;
      }
      return set;
    };

    // Draw links
    g.selectAll('.tree-link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'tree-link')
      .attr('d', linkGenerator as any)
      .attr('fill', 'none')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2.0)
      .style('opacity', 0.6)
      .style('pointer-events', 'none');

    // Draw node cards
    const nodeGroups = g.selectAll('.node-card-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-card')
      .attr('transform', (d: any) => `translate(${d.x_rendered - nodeWidth / 2},${d.y_rendered - nodeHeight / 2})`)
      .style('cursor', 'pointer');

    const tooltip = d3.select(tooltipRef.current);
    const showTip = (event: MouseEvent, d: d3.HierarchyPointNode<TreeNode>) => {
      const node = d.data;
      if (node.id.startsWith('unk-')) return;
      
      const p = tree?.persons.get(node.id);
      const birthDate = p?.birth?.date?.display || p?.birth?.date?.raw || '';
      const birthPlace = p?.birth?.place || '';
      const deathDate = p?.death?.date?.display || p?.death?.date?.raw || '';
      const deathPlace = p?.death?.place || '';

      const sex = node.sex;
      const genLabel = getGenerationLabelCroatian(node.generation, sex);
      
      let extraInfo = '';
      if (colorMode === 'obitelj') {
        const count = node.family_children_count;
        extraInfo = count 
          ? `<div class="text-xs text-slate-700 mt-1.5">👨‍👩‍👧‍👦 <strong>Djeca u obitelji:</strong> <span class="font-bold text-indigo-600">${count}</span></div>`
          : `<div class="text-xs text-slate-500 mt-1.5">👨‍👩‍👧‍👦 <strong>Obitelj:</strong> Nepoznato</div>`;
      } else if (colorMode === 'dob_roditelja' && d.parent) {
        const child = d.parent.data;
        if (node.birth_year && child.birth_year) {
          const age = child.birth_year - node.birth_year;
          extraInfo = `<div class="text-xs text-slate-600 mt-1.5">👶 <strong>Starost pri rođenju djeteta:</strong> <span class="font-bold text-teal-600">${age} god.</span></div>`;
        }
      } else {
        if (node.birth_place) {
          extraInfo = `<div class="text-xs text-slate-600 mt-1.5">🌍 <strong>Lokacija:</strong> ${node.birth_place}</div>`;
        }
      }

      let ageStr = '';
      if (node.birth_year && node.death_year) {
        ageStr = `<div class="text-xs text-slate-500 mt-0.5">⏳ Životni vijek: ${node.death_year - node.birth_year} god.</div>`;
      }

      tooltip.style('display', 'block').html(`
        <div class="font-bold text-slate-800 text-sm mb-0.5 flex items-center gap-1.5 border-b border-slate-100 pb-1">
          <span class="w-2.5 h-2.5 rounded-full shrink-0 ${sex === 'M' ? 'bg-blue-500' : sex === 'F' ? 'bg-pink-500' : 'bg-slate-400'}"></span>
          ${node.name}
        </div>
        <div class="text-[9px] text-teal-600 font-bold uppercase tracking-wider mb-1">${genLabel}</div>
        <div class="text-xs text-slate-500">📅 Rođenje: ${[birthDate].filter(Boolean).join(', ') || 'Nepoznato'}</div>
        <div class="text-xs text-slate-500">🕯️ Smrt: ${[deathDate].filter(Boolean).join(', ') || 'Nepoznato'}</div>
        ${ageStr}
        ${extraInfo}
        <div class="text-[9px] text-slate-400 mt-2 border-t border-slate-100 pt-1">Kliknite za novi fokus</div>
      `).style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 10) + 'px');
    };

    const hideTip = () => tooltip.style('display', 'none');

    // Draw card backgrounds
    nodeGroups.append('rect')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('rx', 10)
      .attr('fill', d => {
        if (viewType === 'ancestors') {
          if (d.data.generation === 0) return '#ccfbf1'; // Teal for focal person
          return d.data.sex === 'M' ? '#dcfce7' : d.data.sex === 'F' ? '#fce7f3' : '#f1f5f9';
        }
        return '#fff';
      })
      .attr('stroke', d => {
        if (viewType === 'ancestors') {
          if (d.data.generation === 0) return '#0d9488'; // Teal
          return d.data.sex === 'M' ? '#22c55e' : d.data.sex === 'F' ? '#ec4899' : '#cbd5e1';
        }
        return getNodeColor(d.data);
      })
      .attr('stroke-width', d => viewType === 'ancestors' && d.data.generation === 0 ? 2.5 : 1.5)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.04))');

    // Gender accent indicator (pill on left side of card) - Hide for Ancestors since whole card is colored
    nodeGroups.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 6)
      .attr('height', nodeHeight)
      .attr('rx', 3)
      .attr('fill', d => d.data.sex === 'M' ? '#3b82f6' : d.data.sex === 'F' ? '#ec4899' : '#94a3b8')
      .style('display', viewType === 'ancestors' ? 'none' : 'block');

    // Name text
    nodeGroups.append('text')
      .attr('x', viewType === 'ancestors' ? nodeWidth / 2 : 14)
      .attr('y', viewType === 'ancestors' ? 22 : 17)
      .attr('text-anchor', viewType === 'ancestors' ? 'middle' : 'start')
      .text(d => {
        const full = d.data.name;
        const maxLen = viewType === 'ancestors' ? 22 : 18;
        return full.length > maxLen + 2 ? full.slice(0, maxLen) + '…' : full;
      })
      .style('font-size', viewType === 'ancestors' ? '12px' : '11px')
      .style('font-weight', '800')
      .style('fill', '#1e293b');

    // Birth/death year text
    nodeGroups.append('text')
      .attr('x', viewType === 'ancestors' ? nodeWidth / 2 : 14)
      .attr('y', viewType === 'ancestors' ? 38 : 31)
      .attr('text-anchor', viewType === 'ancestors' ? 'middle' : 'start')
      .text(d => {
        if (!d.data.birth_year && !d.data.death_year) return viewType === 'ancestors' ? '' : 'Godina nepoznata';
        
        if (viewType === 'ancestors') {
          if (d.data.birth_year && d.data.death_year) return `b. ${d.data.birth_year} d. ${d.data.death_year}`;
          if (d.data.birth_year) return `b. ${d.data.birth_year}`;
          if (d.data.death_year) return `d. ${d.data.death_year}`;
          return '';
        }

        if (!d.data.birth_year) return 'Godina nepoznata';
        return d.data.death_year 
          ? `${d.data.birth_year}–${d.data.death_year}` 
          : `r. ${d.data.birth_year}`;
      })
      .style('font-size', '9px')
      .style('font-weight', '600')
      .style('fill', '#64748b');

    // Interactive Hover and highlighting path
    nodeGroups
      .on('mouseover', function(event, d) {
        if (d.data.id.startsWith('unk-')) return;
        showTip(event, d);
        
        // Highlight path to center
        const pathIds = getPathIds(d);
        g.selectAll('.node-card')
          .transition().duration(120)
          .style('opacity', (n: any) => n && pathIds.has(n.data.id) ? 1 : 0.20);

        g.selectAll('.tree-link')
          .transition().duration(120)
          .style('opacity', (l: any) => l && pathIds.has(l.source.data.id) && pathIds.has(l.target.data.id) ? 1.0 : 0.15)
          .attr('stroke-width', (l: any) => l && pathIds.has(l.source.data.id) && pathIds.has(l.target.data.id) ? 3.0 : 2.0)
          .attr('stroke', (l: any) => l && pathIds.has(l.source.data.id) && pathIds.has(l.target.data.id) ? '#0ea5e9' : '#cbd5e1');
      })
      .on('mousemove', (event, d) => showTip(event, d))
      .on('mouseout', function() {
        hideTip();
        
        // Reset styles
        g.selectAll('.node-card').transition().duration(120).style('opacity', 1);
        g.selectAll('.tree-link')
          .transition().duration(120)
          .style('opacity', 0.6)
          .attr('stroke-width', 2.0)
          .attr('stroke', '#cbd5e1');
      })
      .on('click', (event, d) => {
        if (d.data.id && !d.data.id.startsWith('unk-')) {
          setSelectedPerson(d.data.id);
          hideTip();
        }
      });

  }, [selectedPersonId, viewType, maxGenerations, colorMode, ancestorData, descendantData, getNodeColor, tree, setSelectedPerson]);

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
      {/* Tooltip */}
      <div ref={tooltipRef} className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-3 pointer-events-none hidden text-sm" style={{ maxWidth: '240px' }} />

      {/* Top Header Controls Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 print:hidden">
        {/* Selected Person Details - Large and Visible */}
        <div className="flex items-center gap-4 flex-1">
          {selectedPerson ? (
            <div className="flex items-center gap-4 w-full px-2">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl border-4 shadow-sm shrink-0
                ${selectedPerson.sex === 'M' ? 'bg-blue-50 border-blue-200 text-blue-500'
                : selectedPerson.sex === 'F' ? 'bg-pink-50 border-pink-200 text-pink-500'
                : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                {selectedPerson.sex === 'M' ? '♂' : selectedPerson.sex === 'F' ? '♀' : '?'}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-extrabold text-xl text-slate-800 truncate leading-tight">{selectedPerson.names[0]?.full || 'Nepoznato'}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-500 font-medium">
                  {selectedPerson.birth?.date?.year && selectedPerson.death?.date?.year ? (
                    <span>Rođen/a {selectedPerson.birth.date.year}. – Umro/la {selectedPerson.death.date.year}.</span>
                  ) : selectedPerson.birth?.date?.year ? (
                    <span>Rođen/a {selectedPerson.birth.date.year}.</span>
                  ) : <span>Nepoznata godina rođenja</span>}
                  
                  <span className="flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-bold">
                    🌳 {maxKnownGen} generacija predaka
                  </span>
                  
                  {viewType === 'ancestors' && ancestorData && (
                    <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">
                      👥 Prikazano {d3.hierarchy(ancestorData).descendants().length - 1} predaka
                    </span>
                  )}

                  <button onClick={() => setSelectedPerson(null)} className="ml-auto px-2 py-0.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold" title="Zatvori osobu">
                    Zatvori
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 font-medium italic py-3 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl w-full text-center">
              Kliknite na osobu u grafu kako biste postavili fokus na nju
            </div>
          )}
        </div>

        {/* Options Panel on the Right */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          {/* Generations picker */}
          <div className="flex items-center gap-2">
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

          {/* Color modes list */}
          {viewType !== 'ancestors' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vrsta prikaza:</span>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0.5 shadow-inner">
                {([
                  { id: 'generation', label: 'Generacijski slojevi' },
                  { id: 'dob_roditelja', label: 'Generacijska dob' },
                  { id: 'obitelj', label: 'Brojnost obitelji' },
                  { id: 'drzava', label: 'Država rođenja' },
                  { id: 'lands', label: 'Kraj rođenja (regija)' },
                ] as { id: ColorMode; label: string }[]).map(c => (
                  <button key={c.id} onClick={() => setColorMode?.(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      colorMode === c.id
                        ? 'bg-white text-teal-600 shadow-sm border border-teal-100 scale-105'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {viewType === 'ancestors' && (
        <div className="flex justify-center items-center gap-6 pt-1 pb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#dcfce7] border border-[#22c55e]"></span> Muški preci
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#fce7f3] border border-[#ec4899]"></span> Ženski preci
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#f1f5f9] border border-[#cbd5e1]"></span> Nepoznat rod
          </div>
        </div>
      )}

      {/* Main content row */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* SVG Canvas wrapper */}
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

        {/* Side Legend */}
        {viewType !== 'ancestors' && (
          <div className="w-[300px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden print:hidden">
          {/* Legend Title */}
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Kazalo: {colorMode === 'generation' ? 'Generacije'
                : colorMode === 'dob_roditelja' ? 'Generacijska dob'
                : colorMode === 'obitelj' ? 'Veličina obitelji'
                : colorMode === 'drzava' ? 'Država rođenja'
                : 'Krajevi rođenja'} <span className="font-normal normal-case text-slate-300">· pređite mišem</span>
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {isGenAgeMode && genAgeLegendCounts ? (
              <>
                <div className="space-y-2.5">
                  {GEN_AGE_RANGES.map(r => {
                    const rangeKey = r.label.replace('–', '-') as keyof typeof genAgeLegendCounts;
                    const count = genAgeLegendCounts[rangeKey] || 0;
                    return (
                      <div 
                        key={r.label} 
                        className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                        onMouseEnter={() => {
                          const [minAge, maxAge] = r.label.split('–').map(Number);
                          highlightGroup(n => {
                            if (n.ahnentafel && n.ahnentafel > 1) {
                              const child = allNodesList.find(c => c.ahnentafel === Math.floor(n.ahnentafel! / 2));
                              if (child && n.birth_year && child.birth_year) {
                                const age = child.birth_year - n.birth_year;
                                return age >= minAge && age <= maxAge;
                              }
                            }
                            return false;
                          });
                        }}
                        onMouseLeave={resetHighlight}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-3.5 h-3.5 rounded shrink-0 shadow-sm" style={{ backgroundColor: r.color }} />
                          <span className="font-bold text-slate-700">{r.label} god.</span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{count}</span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="h-px bg-slate-100" />
                
                <div className="space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between items-center cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors"
                    onMouseEnter={() => highlightGroup(n => n.sex === 'M')}
                    onMouseLeave={resetHighlight}
                  >
                    <span className="flex items-center gap-1.5"><span className="text-blue-500">♂</span> Muški</span>
                    <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">{genAgeLegendCounts.men}</span>
                  </div>
                  <div className="flex justify-between items-center cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors"
                    onMouseEnter={() => highlightGroup(n => n.sex === 'F')}
                    onMouseLeave={resetHighlight}
                  >
                    <span className="flex items-center gap-1.5"><span className="text-pink-500">♀</span> Ženski</span>
                    <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">{genAgeLegendCounts.women}</span>
                  </div>
                </div>
              </>
            ) : isFamilyMode && familyLegendCounts ? (
              <>
                <div className="space-y-2.5">
                  {FAMILY_CATEGORIES.map(r => {
                    const countKey = r.id as keyof typeof familyLegendCounts;
                    const count = familyLegendCounts[countKey] || 0;
                    return (
                      <div 
                        key={r.id} 
                        className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                        onMouseEnter={() => highlightGroup(n => {
                          const val = n.family_children_count;
                          if (r.id === 'not_in_tree') return val === null || val === undefined || val === 0;
                          if (r.id === 'only_child') return val === 1;
                          if (r.id === '2') return val === 2;
                          if (r.id === '3') return val === 3;
                          if (r.id === '4_5') return val !== null && val !== undefined && val >= 4 && val <= 5;
                          if (r.id === '6_7') return val !== null && val !== undefined && val >= 6 && val <= 7;
                          if (r.id === '8_9') return val !== null && val !== undefined && val >= 8 && val <= 9;
                          if (r.id === '10_plus') return val !== null && val !== undefined && val >= 10;
                          return false;
                        })}
                        onMouseLeave={resetHighlight}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-3.5 h-3.5 rounded shrink-0 shadow-sm" style={{ backgroundColor: r.color }} />
                          <span className="font-bold text-slate-700">{r.label}</span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : colorMode === 'drzava' && countryLegendStats ? (
              <div className="space-y-2.5">
                {countryLegendStats.list.map(item => {
                  const color = countryColorScale(item.label);
                  return (
                    <div 
                      key={item.label} 
                      className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                      onMouseEnter={() => highlightGroup(n => getCountryFromPlace(n.birth_place) === item.label)}
                      onMouseLeave={resetHighlight}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                        <span className="font-bold text-slate-700">{item.label}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : colorMode === 'lands' && landsLegendStats ? (
              <div className="space-y-2.5">
                {landsLegendStats.list.map(item => {
                  const color = landsColorScale(item.label);
                  return (
                    <div 
                      key={item.label} 
                      className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                      onMouseEnter={() => highlightGroup(n => getPlaceLand(n.birth_place) === item.label)}
                      onMouseLeave={resetHighlight}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                        <span className="font-bold text-slate-700">{item.label}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              legendStats.map((s, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-3.5 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                  onMouseEnter={() => highlightGroup(n => n.generation === i)}
                  onMouseLeave={resetHighlight}
                >
                  <div className="w-4 h-4 rounded-md mt-0.5 shrink-0 shadow-sm"
                    style={{ backgroundColor: i < GENERATION_COLORS.length ? GENERATION_COLORS[i] : '#94a3b8' }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-slate-800 leading-snug truncate">
                      {s.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {s.known} osoba u stablu
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>

      {/* Description / Instructions */}
      {viewType !== 'ancestors' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0 print:hidden text-xs text-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Upute i pojašnjenje</span>
              <div className="leading-relaxed">
                {isGenAgeMode ? (
                  <>
                    Boja segmenta označava <strong>starost pretka</strong> u trenutku rođenja njegovog djeteta. 
                    Broj u kružiću na rubu prikazuje prosječni generacijski jaz za tu specifičnu liniju predaka. 
                    Siva boja označava nedostatak podataka o rođenju.
                  </>
                ) : isFamilyMode ? (
                  <>
                    Boja segmenta označava <strong>broj djece</strong> u obitelji u kojoj je taj predak odrastao (on + braća i sestre). 
                    Braća i sestre koji su preminuli u prvoj godini života nisu pribrojeni. 
                    Siva boja označava da rodna obitelj tog pretka nije zabilježena u stablu.
                  </>
                ) : colorMode === 'drzava' ? (
                  <>
                    Boja segmenta označava <strong>državu rođenja</strong> pretka. 
                    Zadržite miš preko bilo kojeg pretka za detaljan prikaz, ili pređite preko države u legendi za isticanje.
                  </>
                ) : colorMode === 'lands' ? (
                  <>
                    Boja segmenta označava <strong>regiju ili županiju</strong> rođenja pretka. 
                    Koristan prikaz za praćenje regionalnog podrijetla predaka.
                  </>
                ) : (
                  <>
                    Obojani segmenti imaju poznate pretke, dok sivi segmenti nedostaju u vašem stablu. 
                    Zadržite miš za praćenje i isticanje direktne linije (ostale linije bit će zasjenjene za 80%).
                  </>
                )}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 md:text-right italic">
              Zadržite miš iznad bilo kojeg pretka za praćenje njegove linije. Kliknite na pretka za re-centriranje grafa na njega.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
