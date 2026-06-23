import React, { useEffect, useRef, useMemo, useState, useCallback, useId } from 'react';
import * as d3 from 'd3';
import { useApp } from '../../context/AppContext';
import { Download, X, Maximize2, Minimize2, Plus, Minus, RotateCcw, Target } from 'lucide-react';
import { HelpModal, HelpButton } from '../../components/HelpModal';

interface AncNode {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  birth_place: string | null;
  generation: number;   // 0 = focal, 1 = parents, etc.
  ahnentafel: number;   // 1 = focal, 2 = father, 3 = mother, ...
  sex: string;
  known: boolean;
  children?: AncNode[];
  family_children_count?: number | null; // added for Obitelj mode
}

type ColorMode = 'generation' | 'obiteljska_grana' | 'drzava' | 'dob_zivota' | 'dob_roditelja' | 'obitelj';

const FAMILY_CATEGORIES = [
  { id: 'only_child', label: 'Jedino dijete', color: '#4f46e5', match: (n: number | null | undefined) => n === 1 },
  { id: '2', label: '2', color: '#0ea5e9', match: (n: number | null | undefined) => n === 2 },
  { id: '3', label: '3', color: '#10b981', match: (n: number | null | undefined) => n === 3 },
  { id: '4_5', label: '4–5', color: '#eab308', match: (n: number | null | undefined) => n !== null && n !== undefined && n >= 4 && n <= 5 },
  { id: '6_7', label: '6–7', color: '#f97316', match: (n: number | null | undefined) => n !== null && n !== undefined && n >= 6 && n <= 7 },
  { id: '8_9', label: '8–9', color: '#ef4444', match: (n: number | null | undefined) => n !== null && n !== undefined && n >= 8 && n <= 9 },
  { id: '10_plus', label: '10 +', color: '#991b1b', match: (n: number | null | undefined) => n !== null && n !== undefined && n >= 10 },
  { id: 'not_in_tree', label: 'Nije u stablu', color: '#94a3b8', match: (n: number | null | undefined) => n === null || n === undefined || n === 0 },
];

const GEN_AGE_RANGES = [
  { label: '20–24', color: '#2563eb' },
  { label: '25–29', color: '#06b6d4' },
  { label: '30–34', color: '#10b981' },
  { label: '35–39', color: '#eab308' },
  { label: '40–44', color: '#f97316' },
  { label: '45–49', color: '#ef4444' },
];

const getGenAgeColor = (age: number): string => {
  if (age < 20) return '#60a5fa'; // light blue
  if (age <= 24) return '#2563eb'; // blue
  if (age <= 29) return '#06b6d4'; // cyan
  if (age <= 34) return '#10b981'; // green
  if (age <= 39) return '#eab308'; // yellow
  if (age <= 44) return '#f97316'; // orange
  if (age <= 49) return '#ef4444'; // red
  return '#be123c'; // deep red
};

const getGenerationLabelCroatian = (gen: number, sex: string): string => {
  if (gen === 0) return 'ODABRANA OSOBA';
  if (gen === 1) return sex === 'M' ? 'OTAC' : 'MAJKA';
  if (gen === 2) return sex === 'M' ? 'DJED' : 'BAKA';
  if (gen === 3) return sex === 'M' ? 'PRADJED' : 'PRABAKA';
  return `${gen - 2}× PRADJED/PRABAKA`;
};

const GENERATION_COLORS = [
  '#0f766e', // Gen 0 – tamni teal (focal)
  '#0d9488', // Gen 1 – teal (parents)
  '#0891b2', // Gen 2 – cyan-teal (grandparents)
  '#2563eb', // Gen 3 – royal plava (great-grandparents)
  '#4f46e5', // Gen 4 – indigo (2x great-grandparents)
  '#7c3aed', // Gen 5 – violet (3x great-grandparents)
  '#9333ea', // Gen 6 – purple (4x great-grandparents)
  '#c084fc', // Gen 7 – purple-400 / light fuchsia (5x great-grandparents)
];

const QUADRANT_COLORS = [
  '#2563eb', // Top-left (FF) - blue
  '#3b82f6', // Bottom-left (FM) - light blue
  '#db2777', // Top-right (MF) - pink
  '#ec4899', // Bottom-right (MM) - light pink
];
const UNKNOWN_COLOR = '#f1f5f9';

const GEN_LABELS = [
  'Odabrana osoba',
  'Roditelji',
  'Djedovi i bake',
  'Pradjedovi i prabake',
  '2× Pradjedovi (Šukundjedovi)',
  '3× Pradjedovi',
  '4× Pradjedovi',
  '5× Pradjedovi',
];

interface Props {
  mini?: boolean;
  maxGenerations?: number;
  isGenAgeMode?: boolean;
  isFamilyMode?: boolean;
  initialColorMode?: ColorMode;
}

export default function FanChartTab({ mini, maxGenerations = 4, isGenAgeMode = false, isFamilyMode = false, initialColorMode = 'generation' }: Props) {
  const reactId = useId();
  const idPrefix = reactId.replace(/:/g, '-');
  const { tree, graph, selectedPersonId, setSelectedPerson } = useApp();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [colorMode, setColorMode] = useState<ColorMode>(initialColorMode);
  const [helpOpen, setHelpOpen] = useState(false);

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
        console.error("Greška pri ulasku u cijeli zaslon:", err);
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

  const [maxGen, setMaxGen] = useState(maxGenerations);

  const focalPerson = useMemo(() => {
    if (!tree || !selectedPersonId) return null;
    return tree.persons.get(selectedPersonId) || null;
  }, [tree, selectedPersonId]);

  // Compute depths
  const ancestorDepth = useMemo(() => {
    if (!graph || !selectedPersonId) return 0;
    return graph.getAncestorDepth(selectedPersonId);
  }, [graph, selectedPersonId]);

  const descendantDepth = useMemo(() => {
    if (!graph || !selectedPersonId) return 0;
    return graph.getDescendantDepth(selectedPersonId);
  }, [graph, selectedPersonId]);

  // Build Ahnentafel tree data
  const rootData = useMemo(() => {
    if (!tree || !selectedPersonId) return null;

    const buildNode = (personId: string | null, gen: number, ahn: number): AncNode => {
      const p = personId ? tree.persons.get(personId) : null;
      const known = !!p;
      const bYear = p?.birth?.date?.year ?? null;
      const dYear = p?.death?.date?.year ?? null;
      const place = p?.birth?.place ?? null;

      let family_children_count: number | null = null;
      if (p && p.familiesAsChild && p.familiesAsChild.length > 0) {
        const famId = p.familiesAsChild[0];
        const fam = tree.families.get(famId);
        if (fam) {
          const siblings = fam.children.map(cid => tree.persons.get(cid)).filter((sib): sib is any => !!sib);
          const diedInFirstYear = (sib: any) => {
            if (!sib.birth || !sib.death) return false;
            const bYear = sib.birth.date?.year;
            const dYear = sib.death.date?.year;
            if (bYear === undefined || dYear === undefined) return false;
            const diff = dYear - bYear;
            if (diff < 0) return true;
            if (diff === 0) return true;
            if (diff === 1) {
              const bMonth = sib.birth.date?.month;
              const dMonth = sib.death.date?.month;
              if (bMonth !== undefined && dMonth !== undefined) {
                if (dMonth < bMonth) return true;
                if (dMonth === bMonth) {
                  const bDay = sib.birth.date?.day;
                  const dDay = sib.death.date?.day;
                  if (bDay !== undefined && dDay !== undefined) {
                    return dDay < bDay;
                  }
                  return true;
                }
              }
            }
            return false;
          };
          family_children_count = siblings.filter(sib => !diedInFirstYear(sib)).length;
        }
      }

      const node: AncNode = {
        id: personId || `unk-${ahn}`,
        name: p?.names[0]?.full || 'Nepoznato',
        birth_year: bYear,
        death_year: dYear,
        birth_place: place,
        generation: gen,
        ahnentafel: ahn,
        sex: p?.sex || (ahn % 2 === 0 ? 'M' : 'F'),
        known,
        family_children_count,
      };

      if (gen < maxGen) {
        const fatherId = p?._parents?.find(pid => tree.persons.get(pid)?.sex === 'M') || null;
        const motherId = p?._parents?.find(pid => tree.persons.get(pid)?.sex === 'F') || null;
        node.children = [
          buildNode(fatherId, gen + 1, ahn * 2),
          buildNode(motherId, gen + 1, ahn * 2 + 1),
        ];
      }

      return node;
    };

    return buildNode(selectedPersonId, 0, 1);
  }, [tree, selectedPersonId, maxGen]);

  const genAgeStats = useMemo(() => {
    if (!rootData || !tree) return null;
    
    const nodesByAhn = new Map<number, AncNode>();
    const traverse = (n: AncNode) => {
      nodesByAhn.set(n.ahnentafel, n);
      n.children?.forEach(traverse);
    };
    traverse(rootData);
    
    const fathersAges: { age: number; name: string }[] = [];
    const mothersAges: { age: number; name: string }[] = [];
    const allAges: { age: number; name: string; sex: string }[] = [];
    
    nodesByAhn.forEach((node, ahn) => {
      if (ahn <= 1) return;
      const childAhn = Math.floor(ahn / 2);
      const child = nodesByAhn.get(childAhn);
      if (node.known && child && child.known && node.birth_year && child.birth_year) {
        const age = child.birth_year - node.birth_year;
        if (age > 0 && age < 100) {
          const entry = { age, name: node.name };
          if (node.sex === 'M') {
            fathersAges.push(entry);
          } else {
            mothersAges.push(entry);
          }
          allAges.push({ age, name: node.name, sex: node.sex });
        }
      }
    });
    
    if (allAges.length === 0) return null;
    
    const avgTotal = d3.mean(allAges, d => d.age) || 0;
    const avgFathers = d3.mean(fathersAges, d => d.age) || 0;
    const avgMothers = d3.mean(mothersAges, d => d.age) || 0;
    
    let youngest = allAges[0];
    let oldest = allAges[0];
    allAges.forEach(entry => {
      if (entry.age < youngest.age) youngest = entry;
      if (entry.age > oldest.age) oldest = entry;
    });
    
    return {
      avgTotal: avgTotal.toFixed(1),
      avgFathers: avgFathers.toFixed(1),
      avgMothers: avgMothers.toFixed(1),
      youngestAge: youngest.age,
      youngestName: youngest.name,
      oldestAge: oldest.age,
      oldestName: oldest.name,
      knownCount: allAges.length
    };
  }, [rootData, tree]);

  const genAgeLegendCounts = useMemo(() => {
    if (!rootData || !tree) return null;
    
    const nodesByAhn = new Map<number, AncNode>();
    const traverse = (n: AncNode) => {
      nodesByAhn.set(n.ahnentafel, n);
      n.children?.forEach(traverse);
    };
    traverse(rootData);
    
    const counts = {
      '20-24': 0,
      '25-29': 0,
      '30-34': 0,
      '35-39': 0,
      '40-44': 0,
      '45-49': 0,
      'others': 0,
      'men': 0,
      'women': 0
    };
    
    nodesByAhn.forEach((node, ahn) => {
      if (ahn <= 1) return;
      const childAhn = Math.floor(ahn / 2);
      const child = nodesByAhn.get(childAhn);
      if (node.known && child && child.known && node.birth_year && child.birth_year) {
        const age = child.birth_year - node.birth_year;
        if (age >= 20 && age <= 24) counts['20-24']++;
        else if (age >= 25 && age <= 29) counts['25-29']++;
        else if (age >= 30 && age <= 34) counts['30-34']++;
        else if (age >= 35 && age <= 39) counts['35-39']++;
        else if (age >= 40 && age <= 44) counts['40-44']++;
        else if (age >= 45 && age <= 49) counts['45-49']++;
        else counts['others']++;
        
        if (node.sex === 'M') counts['men']++;
        else if (node.sex === 'F') counts['women']++;
      }
    });
    
    return counts;
  }, [rootData, tree]);

  const familyStats = useMemo(() => {
    if (!rootData || !tree) return null;

    const nodesByAhn = new Map<number, AncNode>();
    const traverse = (n: AncNode) => {
      nodesByAhn.set(n.ahnentafel, n);
      n.children?.forEach(traverse);
    };
    traverse(rootData);

    const counts: { count: number; name: string }[] = [];

    nodesByAhn.forEach((node) => {
      if (node.known && node.family_children_count !== null && node.family_children_count !== undefined) {
        counts.push({ count: node.family_children_count, name: node.name });
      }
    });

    if (counts.length === 0) return null;

    const avgTotal = d3.mean(counts, d => d.count) || 0;
    
    let largest = counts[0];
    counts.forEach(entry => {
      if (entry.count > largest.count) {
        largest = entry;
      }
    });

    return {
      avgTotal: avgTotal.toFixed(1),
      largestCount: largest.count,
      largestName: largest.name,
      knownCount: counts.length,
    };
  }, [rootData, tree]);

  const familyLegendCounts = useMemo(() => {
    if (!rootData || !tree) return null;

    const nodesByAhn = new Map<number, AncNode>();
    const traverse = (n: AncNode) => {
      nodesByAhn.set(n.ahnentafel, n);
      n.children?.forEach(traverse);
    };
    traverse(rootData);

    const counts = {
      only_child: 0,
      '2': 0,
      '3': 0,
      '4_5': 0,
      '6_7': 0,
      '8_9': 0,
      '10_plus': 0,
      'not_in_tree': 0,
    };

    nodesByAhn.forEach((node) => {
      if (node.known) {
        const count = node.family_children_count;
        if (count === null || count === undefined || count === 0) {
          counts.not_in_tree++;
        } else if (count === 1) {
          counts.only_child++;
        } else if (count === 2) {
          counts['2']++;
        } else if (count === 3) {
          counts['3']++;
        } else if (count >= 4 && count <= 5) {
          counts['4_5']++;
        } else if (count >= 6 && count <= 7) {
          counts['6_7']++;
        } else if (count >= 8 && count <= 9) {
          counts['8_9']++;
        } else {
          counts['10_plus']++;
        }
      }
    });

    return counts;
  }, [rootData, tree]);

  // Legend stats
  const legendStats = useMemo(() => {
    if (!rootData) return [];
    const stats: { label: string; known: number; total: number }[] = [];
    for (let g = 0; g <= maxGen; g++) {
      const total = Math.pow(2, g);
      const known = g === 0 ? 1 : 0;
      stats.push({ label: GEN_LABELS[g] || `${g}× Pradjedovi`, known, total });
    }
    const countKnown = (node: AncNode) => {
      if (node.known && node.generation > 0) {
        stats[node.generation].known++;
      }
      node.children?.forEach(countKnown);
    };
    rootData.children?.forEach(countKnown);
    return stats;
  }, [rootData, maxGen]);

  // Color logic
  const getColor = useCallback((node: AncNode, cm: ColorMode): string => {
    if (!node.known) return UNKNOWN_COLOR;
    switch (cm) {
      case 'generation':
        return GENERATION_COLORS[node.generation] ?? GENERATION_COLORS[GENERATION_COLORS.length - 1];
      case 'obiteljska_grana': {
        if (node.ahnentafel <= 1) return GENERATION_COLORS[0];
        let a = node.ahnentafel;
        while (a > 7) a = Math.floor(a / 2);
        return QUADRANT_COLORS[a - 4] ?? '#94a3b8';
      }
      case 'drzava':
        if (!node.birth_place) return '#94a3b8';
        return d3.scaleOrdinal(d3.schemeSet2)(node.birth_place.split(',').pop()?.trim() || '');
      case 'dob_zivota':
        if (node.birth_year && node.death_year) {
          return d3.scaleSequential(d3.interpolateYlGnBu).domain([0, 90])(node.death_year - node.birth_year);
        }
        return '#cbd5e1';
      case 'dob_roditelja':
        return '#cbd5e1'; // fallback handled locally
      case 'obitelj': {
        const count = node.family_children_count;
        if (count === null || count === undefined || count === 0) return '#cbd5e1';
        if (count === 1) return '#4f46e5';
        if (count === 2) return '#0ea5e9';
        if (count === 3) return '#10b981';
        if (count >= 4 && count <= 5) return '#eab308';
        if (count >= 6 && count <= 7) return '#f97316';
        if (count >= 8 && count <= 9) return '#ef4444';
        return '#991b1b';
      }
      default:
        return UNKNOWN_COLOR;
    }
  }, []);

  const checkCategoryMatch = useCallback((node: AncNode, catId: string): boolean => {
    if (!node.known) return catId === 'not_in_tree';
    const count = node.family_children_count;
    if (count === null || count === undefined || count === 0) return catId === 'not_in_tree';
    if (catId === 'only_child') return count === 1;
    if (catId === '2') return count === 2;
    if (catId === '3') return count === 3;
    if (catId === '4_5') return count >= 4 && count <= 5;
    if (catId === '6_7') return count >= 6 && count <= 7;
    if (catId === '8_9') return count >= 8 && count <= 9;
    if (catId === '10_plus') return count >= 10;
    return false;
  }, []);

  const highlightCategory = useCallback((catId: string) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('.node-arc')
      .transition().duration(120)
      .style('opacity', (d: any) => {
        if (!d || !d.node) return 0.20;
        const matches = checkCategoryMatch(d.node, catId);
        return matches ? 1 : 0.20;
      });
    svg.selectAll('.node-text-container')
      .transition().duration(120)
      .style('opacity', (d: any) => {
        if (!d || !d.node) return 0.20;
        const matches = checkCategoryMatch(d.node, catId);
        return matches ? 1 : 0.20;
      });
    svg.selectAll('.node-pill-group')
      .transition().duration(120)
      .style('opacity', (d: any) => {
        if (!d || !d.node) return 0.20;
        const matches = checkCategoryMatch(d.node, catId);
        return matches ? 1 : 0.20;
      });
  }, [checkCategoryMatch]);

  const resetHighlight = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('.node-arc')
      .transition().duration(120)
      .style('opacity', (d: any) => d && d.node && d.node.known ? 1 : 0.65);
    svg.selectAll('.node-text-container')
      .transition().duration(120)
      .style('opacity', 1);
    svg.selectAll('.node-pill-group')
      .transition().duration(120)
      .style('opacity', 1);
  }, []);

  const getFamilyGenerationAverage = useCallback((gen: number) => {
    const countsInGen: number[] = [];
    const traverse = (n: AncNode) => {
      if (n.generation === gen && n.known && n.family_children_count !== null && n.family_children_count !== undefined) {
        countsInGen.push(n.family_children_count);
      }
      n.children?.forEach(traverse);
    };
    if (rootData) traverse(rootData);
    
    if (countsInGen.length === 0) return { avg: '0.0', count: 0 };
    const avg = d3.mean(countsInGen) || 0;
    return { avg: avg.toFixed(1), count: countsInGen.length };
  }, [rootData]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !rootData) return;

    const renderId = Math.random().toString(36).substring(2, 9);
    const nodesByAhn = new Map<number, AncNode>();
    const traverseNodes = (n: AncNode) => {
      nodesByAhn.set(n.ahnentafel, n);
      n.children?.forEach(traverseNodes);
    };
    traverseNodes(rootData);

    const getLineAhnentafels = (ahn: number): Set<number> => {
      const line = new Set<number>();
      let current = ahn;
      while (current >= 1) {
        line.add(current);
        current = Math.floor(current / 2);
      }
      return line;
    };

    const getLineAgesInfo = (ahn: number): number[] => {
      const ages: number[] = [];
      let current = ahn;
      while (current > 1) {
        const parent = nodesByAhn.get(current);
        const child = nodesByAhn.get(Math.floor(current / 2));
        if (parent?.birth_year && child?.birth_year) {
          ages.push(child.birth_year - parent.birth_year);
        }
        current = Math.floor(current / 2);
      }
      return ages.reverse();
    };

    const getGenerationAverage = (gen: number): { avg: string; count: number } => {
      const ages: number[] = [];
      nodesByAhn.forEach((n, ahn) => {
        if (n.generation === gen && ahn > 1) {
          const child = nodesByAhn.get(Math.floor(ahn / 2));
          if (n.birth_year && child?.birth_year) {
            ages.push(child.birth_year - n.birth_year);
          }
        }
      });
      return {
        avg: ages.length > 0 ? (d3.mean(ages) || 0).toFixed(1) : 'N/A',
        count: ages.length
      };
    };

    const getSegmentColor = (node: AncNode): string => {
      if (!node.known) return UNKNOWN_COLOR;
      if (colorMode === 'dob_roditelja') {
        if (node.ahnentafel <= 1) return GENERATION_COLORS[0];
        const childAhn = Math.floor(node.ahnentafel / 2);
        const child = nodesByAhn.get(childAhn);
        if (child && node.birth_year && child.birth_year) {
          const age = child.birth_year - node.birth_year;
          return getGenAgeColor(age);
        }
        return '#cbd5e1'; // grey for missing dates
      }
      return getColor(node, colorMode);
    };

    const W = dimensions.width;
    const H = dimensions.height;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', W).attr('height', H);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 6])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom as any);
    zoomRef.current = zoom;

    const cx = W / 2;
    const cy = H / 2;

    // Sizing adjustments:
    // 1. Center circle size (outerR0) is proportional (about 18% of maxRadius, min 55px)
    // 2. Padding reduced to 25px to maximize ring widths
    const maxRadius = Math.min(W, H) / 2 - 25;
    const outerR0 = Math.max(55, maxRadius * 0.18); 
    const bandWidth = (maxRadius - outerR0) / maxGen; // Thicker rings that span to the outer limit

    const outerR = (gen: number) => gen === 0 ? outerR0 : outerR0 + gen * bandWidth;
    const innerR = (gen: number) => gen === 0 ? 0 : outerR0 + (gen - 1) * bandWidth;

    // Arc generator (no pad angle to avoid broken arcs, stroke-width handles segment separation)
    const arcGen = d3.arc<{ node: AncNode; a0: number; a1: number; ir: number; or: number }>()
      .innerRadius(d => d.ir)
      .outerRadius(d => d.or)
      .startAngle(d => d.a0)
      .endAngle(d => d.a1);

    // Collect all nodes
    const allNodes: AncNode[] = [];
    const traverse = (n: AncNode) => {
      allNodes.push(n);
      n.children?.forEach(traverse);
    };
    traverse(rootData);

    // Translate to center
    g.attr('transform', `translate(${cx},${cy})`);
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(cx, cy));

    const mainG = g;

    // Draw focal person circle (Gen 0)
    const focalArcData = { node: rootData, a0: 0, a1: 2 * Math.PI, ir: 0, or: outerR0 };
    mainG.append('circle')
      .datum(focalArcData)
      .attr('class', 'node-arc node-arc-1')
      .attr('r', outerR0)
      .attr('fill', getColor(rootData, colorMode))
      .attr('stroke', '#fff')
      .attr('stroke-width', 3.0) // Premium border
      .style('cursor', 'default')
      .on('mouseover', (event) => { showTip(event, rootData); })
      .on('mousemove', (event) => { showTip(event, rootData); })
      .on('mouseout', () => { hideTip(); });

    // Focal person text
    const focalText = mainG.append('text')
      .datum(focalArcData)
      .attr('class', 'node-text-container')
      .attr('text-anchor', 'middle')
      .style('fill', '#fff')
      .style('pointer-events', 'none');

    const nameParts = rootData.name.split(' ');
    const focalFontSize = Math.max(10, outerR0 * 0.21); // Size suited for central circle
    const yearFontSize = Math.max(8, outerR0 * 0.16);

    if (nameParts.length > 1) {
      focalText.append('tspan').attr('x', 0).attr('dy', '-0.55em')
        .text(nameParts.slice(0, -1).join(' '))
        .style('font-size', `${focalFontSize}px`)
        .style('font-weight', '800');
      focalText.append('tspan').attr('x', 0).attr('dy', '1.15em')
        .text(nameParts[nameParts.length - 1])
        .style('font-size', `${focalFontSize}px`)
        .style('font-weight', '800');
    } else {
      focalText.append('tspan').attr('x', 0).attr('dy', '0.25em')
        .text(rootData.name)
        .style('font-size', `${focalFontSize}px`)
        .style('font-weight', '800');
    }
    if (rootData.birth_year) {
      const yearStr = rootData.death_year 
        ? `${rootData.birth_year}–${rootData.death_year}` 
        : `r. ${rootData.birth_year}`;
      focalText.append('tspan').attr('x', 0).attr('dy', '1.3em')
        .text(yearStr)
        .style('font-size', `${yearFontSize}px`)
        .style('font-weight', '500')
        .style('opacity', '0.9');
    }

    // Tooltip helper
    const tooltip = d3.select(tooltipRef.current);
    const showTip = (event: MouseEvent, node: AncNode) => {
      if (!node.known) return;
      
      const p = tree?.persons.get(node.id);
      const birthDate = p?.birth?.date?.display || p?.birth?.date?.raw || '';
      const birthPlace = p?.birth?.place || '';
      const deathDate = p?.death?.date?.display || p?.death?.date?.raw || '';
      const deathPlace = p?.death?.place || '';

      if (colorMode === 'obitelj') {
        const sex = node.sex;
        const genLabel = getGenerationLabelCroatian(node.generation, sex);
        const count = node.family_children_count;
        
        let familyCountStr = '';
        if (count === null || count === undefined) {
          familyCountStr = `<div class="text-xs text-slate-500 mt-1.5">👨‍👩‍👧‍👦 <strong>Rodna obitelj:</strong> Nije u stablu</div>`;
        } else {
          familyCountStr = `<div class="text-xs text-slate-700 mt-1.5">👨‍👩‍👧‍👦 <strong>Broj djece u obitelji:</strong> <span class="font-bold text-indigo-600 text-sm">${count}</span></div>`;
        }

        const genAvgInfo = getFamilyGenerationAverage(node.generation);
        const genAvgStr = `<div class="text-xs text-slate-500 mt-0.5">📈 Prosjek generacije: ${genAvgInfo.avg} djece</div>`;

        tooltip.style('display', 'block').html(`
          <div class="font-bold text-slate-800 text-sm mb-0.5 flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <span class="w-2.5 h-2.5 rounded-full shrink-0 ${sex === 'M' ? 'bg-blue-500' : sex === 'F' ? 'bg-pink-500' : 'bg-slate-400'}"></span>
            ${node.name}
          </div>
          <div class="text-[9px] text-indigo-600 font-bold uppercase tracking-wider mb-1">${genLabel}</div>
          <div class="text-xs text-slate-500">📅 Rođenje: ${[birthDate, birthPlace].filter(Boolean).join(', ') || 'Nepoznato'}</div>
          <div class="text-xs text-slate-500">🕯️ Smrt: ${[deathDate, deathPlace].filter(Boolean).join(', ') || 'Nepoznato'}</div>
          ${familyCountStr}
          ${genAvgStr}
          <div class="text-[10px] text-indigo-600 mt-2 border-t border-slate-100 pt-1.5 font-semibold">
            🖱️ Kliknite za novi fokus
          </div>
        `).style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 10) + 'px');
      } else if (colorMode === 'dob_roditelja') {
        const sex = node.sex;
        const genLabel = getGenerationLabelCroatian(node.generation, sex);
        
        let ageAtChildBirthStr = '';
        let lineAges: number[] = [];
        let lineAvgStr = '';
        let chartAvgDiffStr = '';
        
        if (node.ahnentafel > 1) {
          const child = nodesByAhn.get(Math.floor(node.ahnentafel / 2));
          if (node.birth_year && child?.birth_year) {
            const age = child.birth_year - node.birth_year;
            ageAtChildBirthStr = `<div class="text-xs text-slate-600 mt-1.5">👶 <strong>Starost pri rođenju djeteta:</strong> <span class="font-bold text-teal-600 text-sm">${age} god.</span></div>`;
          }
          
          lineAges = getLineAgesInfo(node.ahnentafel);
          if (lineAges.length > 0) {
            const lineAvg = d3.mean(lineAges) || 0;
            lineAvgStr = `<div class="text-xs text-slate-600 mt-0.5">⏳ <strong>Prosjek linije:</strong> ${lineAvg.toFixed(1)} god.</div>`;
            
            const chartAvg = parseFloat(genAgeStats?.avgTotal || '0');
            if (chartAvg > 0) {
              const diff = lineAvg - chartAvg;
              if (Math.abs(diff) < 1.5) {
                chartAvgDiffStr = ` (oko prosjeka)`;
              } else if (diff > 0) {
                chartAvgDiffStr = ` (+${diff.toFixed(1)} iznad prosjeka)`;
              } else {
                chartAvgDiffStr = ` (${diff.toFixed(1)} ispod prosjeka)`;
              }
            }
          }
        }
        
        const genAvgInfo = getGenerationAverage(node.generation);
        const lineStr = lineAges.length > 0
          ? `<div class="text-xs text-slate-500 mt-0.5">⛓️ <strong>Linija do centra:</strong> ${lineAges.join(' → ')}</div>`
          : '';

        tooltip.style('display', 'block').html(`
          <div class="font-bold text-slate-800 text-sm mb-0.5 flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <span class="w-2.5 h-2.5 rounded-full shrink-0 ${sex === 'M' ? 'bg-blue-500' : sex === 'F' ? 'bg-pink-500' : 'bg-slate-400'}"></span>
            ${node.name}
          </div>
          <div class="text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-1">${genLabel}</div>
          <div class="text-xs text-slate-500">🎂 Rođen/a: ${[birthDate, birthPlace].filter(Boolean).join(', ') || 'Nepoznato'}</div>
          ${ageAtChildBirthStr}
          <div class="text-xs text-slate-600 mt-0.5">👥 Prosjek generacije: ${genAvgInfo.avg} god.</div>
          ${lineStr}
          ${lineAvgStr ? `<div class="text-xs text-slate-600 mt-0.5">📊 Prosječno: <strong>${(d3.mean(lineAges) || 0).toFixed(1)} god.</strong>${chartAvgDiffStr}</div>` : ''}
          <div class="text-[10px] text-teal-600 mt-2 border-t border-slate-100 pt-1.5 font-semibold">
            🖱️ Kliknite za novi fokus
          </div>
        `).style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 10) + 'px');
      } else {
        const birthStr = birthDate || birthPlace
          ? `<div class="text-xs text-slate-600 mt-1">☀️ <strong>Rođenje:</strong> ${[birthDate, birthPlace].filter(Boolean).join(', ')}</div>`
          : '';
        const deathStr = deathDate || deathPlace
          ? `<div class="text-xs text-slate-600 mt-0.5">🕯️ <strong>Smrt:</strong> ${[deathDate, deathPlace].filter(Boolean).join(', ')}</div>`
          : '';
        let ageStr = '';
        if (node.birth_year && node.death_year) {
          ageStr = `<div class="text-xs text-slate-600 mt-0.5">⏳ <strong>Dob u trenutku smrti:</strong> ${node.death_year - node.birth_year} god.</div>`;
        } else if (node.birth_year) {
          const currentYear = new Date().getFullYear();
          const age = currentYear - node.birth_year;
          if (age < 115) {
            ageStr = `<div class="text-xs text-slate-600 mt-0.5">⏳ <strong>Dob:</strong> ~${age} god.</div>`;
          }
        }

        tooltip.style('display', 'block').html(`
          <div class="font-bold text-slate-800 text-sm mb-1 flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <span class="w-2.5 h-2.5 rounded-full shrink-0 ${node.sex === 'M' ? 'bg-blue-500' : node.sex === 'F' ? 'bg-pink-500' : 'bg-slate-400'}"></span>
            ${node.name}
          </div>
          ${birthStr}
          ${deathStr}
          ${ageStr}
          <div class="text-[10px] text-teal-600 mt-2 border-t border-slate-100 pt-1.5 font-semibold flex items-center gap-1">
            🖱️ Kliknite za novi fokus
          </div>
        `).style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 10) + 'px');
      }
    };
    const hideTip = () => tooltip.style('display', 'none');

    // Filter out focal person and draw ancestor arcs
    const genNodes = allNodes.filter(n => n.generation >= 1);

    genNodes.forEach(node => {
      const g = node.generation;
      
      // Determine side
      let parentAhn = node.ahnentafel;
      while (parentAhn > 3) parentAhn = Math.floor(parentAhn / 2);
      const isFatherSide = parentAhn === 2;

      const theta = Math.PI / Math.pow(2, g - 1);
      let startAngle = 0;
      let endAngle = 0;

      if (isFatherSide) {
        const idx = node.ahnentafel - Math.pow(2, g);
        startAngle = 2 * Math.PI - (idx + 1) * theta;
        endAngle = 2 * Math.PI - idx * theta;
      } else {
        const idx = node.ahnentafel - 3 * Math.pow(2, g - 1);
        startAngle = idx * theta;
        endAngle = (idx + 1) * theta;
      }

      const ir = innerR(g);
      const or = outerR(g);
      
      const arcData = { node, a0: startAngle, a1: endAngle, ir, or };
      const path = arcGen(arcData)!;

      const color = getSegmentColor(node);
      
      // Append arc segment
      mainG.append('path')
        .datum(arcData)
        .attr('class', `node-arc node-arc-${node.ahnentafel}`)
        .attr('d', path)
        .attr('fill', color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2.0) // Solid crisp grids
        .style('cursor', node.known ? 'pointer' : 'default')
        .style('opacity', node.known ? 1 : 0.65)
        .on('mouseover', function(event) {
          if (node.known) {
            d3.select(this).attr('stroke', '#000').attr('stroke-width', 2.5);
            showTip(event, node);
            
            // GenAge Highlight Line effect
            if (colorMode === 'dob_roditelja') {
              const lineAhns = getLineAhnentafels(node.ahnentafel);
              mainG.selectAll('.node-arc')
                .transition().duration(120)
                .style('opacity', (d: any) => d && lineAhns.has(d.node.ahnentafel) ? 1 : 0.20);
              mainG.selectAll('.node-text-container')
                .transition().duration(120)
                .style('opacity', (d: any) => d && lineAhns.has(d.node.ahnentafel) ? 1 : 0.20);
              mainG.selectAll('.node-pill-group')
                .transition().duration(120)
                .style('opacity', (d: any) => d && lineAhns.has(d.node.ahnentafel) ? 1 : 0.20);
            }
          }
        })
        .on('mousemove', (event) => { if (node.known) showTip(event, node); })
        .on('mouseout', function() {
          d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2.0);
          hideTip();
          
          // GenAge Reset Highlight
          if (colorMode === 'dob_roditelja') {
            mainG.selectAll('.node-arc')
              .transition().duration(120)
              .style('opacity', (d: any) => d && d.node.known ? 1 : 0.65);
            mainG.selectAll('.node-text-container')
              .transition().duration(120)
              .style('opacity', 1);
            mainG.selectAll('.node-pill-group')
              .transition().duration(120)
              .style('opacity', 1);
          }
        })
        .on('click', () => {
          if (node.known && node.id && !node.id.startsWith('unk-')) {
            setSelectedPerson(node.id);
            hideTip();
          }
        });

      if (!node.known) return;

      const angleSpan = endAngle - startAngle;
      const midAngle = (startAngle + endAngle) / 2;
      const midR = (ir + or) / 2;

      // Chord length at midR
      const chordLen = angleSpan * midR;

      // Scale font sizes based on space
      const maxFontSize = Math.min(bandWidth * 0.25, chordLen * 0.11, 10.5);
      const fontSize = Math.max(6.5, maxFontSize);

      // Hide text if segment is too narrow
      if (chordLen < 22) return;

      const flipText = midAngle > Math.PI / 2 && midAngle < 1.5 * Math.PI;

      // Format name (truncate if too long for chord length, try "Given S." first)
      const maxChars = Math.floor(chordLen / (fontSize * 0.58));
      if (maxChars < 3) return; // Space is way too small, hide completely

      let displayName = node.name;
      if (node.name.length > maxChars) {
        const parts = node.name.split(' ');
        if (parts.length > 1) {
          const given = parts[0];
          const surname = parts[parts.length - 1];
          const shortName = `${given} ${surname[0]}.`;
          if (shortName.length <= maxChars) {
            displayName = shortName;
          } else if (given.length <= maxChars) {
            displayName = given;
          } else {
            displayName = given.slice(0, Math.max(3, maxChars - 1)) + '…';
          }
        } else {
          displayName = node.name.slice(0, Math.max(3, maxChars - 1)) + '…';
        }
      }

      // Dynamic years calculation
      const yearFontSize = Math.max(5.5, fontSize - 1.2);
      const maxYearChars = Math.floor(chordLen / (yearFontSize * 0.55));
      
      const formatYears = (birth: number | null, death: number | null, limit: number): string => {
        if (!birth) return '';
        const birthStr = String(birth);
        if (death) {
          const fullRange = `${birth}–${death}`;
          if (fullRange.length <= limit) return fullRange;
          
          const birthCentury = Math.floor(birth / 100);
          const deathCentury = Math.floor(death / 100);
          if (birthCentury === deathCentury) {
            const shortRange = `${birth}–${death % 100}`;
            if (shortRange.length <= limit) return shortRange;
          }
          if (birthStr.length <= limit) return birthStr;
        } else {
          const onlyBirth = `${birth}`; // using simple year without "b. " to save space in narrow arcs
          if (onlyBirth.length <= limit) return onlyBirth;
        }
        return '';
      };

      const yearStr = node.birth_year ? formatYears(node.birth_year, node.death_year, maxYearChars) : '';
      const showTwoLines = !!yearStr;

      let nameArcR = midR;
      if (showTwoLines) {
        // Shift name line vertically (outward for top half, inward for bottom half)
        nameArcR = flipText ? midR - fontSize * 0.65 : midR + fontSize * 0.65;
      }

      let namePathStr: string;
      if (!flipText) {
        namePathStr = describeArc(0, 0, nameArcR, startAngle, endAngle);
      } else {
        namePathStr = describeArc(0, 0, nameArcR, startAngle, endAngle, true);
      }

      const textArcId = `arc-text-${idPrefix}-${renderId}-${node.ahnentafel}`;
      mainG.append('defs').append('path')
        .attr('id', textArcId)
        .attr('d', namePathStr);

      // Check background color light/dark for text readability
      const textFill = (color === '#cbd5e1' || color === '#f1f5f9' || color === '#e2e8f0') ? '#334155' : '#fff';

      // Render Name (centered on name baseline)
      mainG.append('text')
        .datum(arcData)
        .attr('class', 'node-text-container')
        .append('textPath')
        .attr('href', `#${textArcId}`)
        .attr('startOffset', '50%')
        .attr('text-anchor', 'middle')
        .text(displayName)
        .style('font-size', `${fontSize}px`)
        .style('fill', textFill)
        .style('font-weight', '700')
        .style('pointer-events', 'none')
        .attr('dominant-baseline', 'central');

      // Render Years on a separate line below the name
      if (showTwoLines) {
        const yearArcR = flipText ? midR + fontSize * 0.65 : midR - fontSize * 0.65;
        let yearPathStr = flipText
          ? describeArc(0, 0, yearArcR, startAngle, endAngle, true)
          : describeArc(0, 0, yearArcR, startAngle, endAngle);

        const yearArcId = `arc-year-${idPrefix}-${renderId}-${node.ahnentafel}`;
        mainG.append('defs').append('path')
          .attr('id', yearArcId)
          .attr('d', yearPathStr);

        mainG.append('text')
          .datum(arcData)
          .attr('class', 'node-text-container')
          .append('textPath')
          .attr('href', `#${yearArcId}`)
          .attr('startOffset', '50%')
          .attr('text-anchor', 'middle')
          .text(yearStr)
          .style('font-size', `${yearFontSize}px`)
          .style('fill', textFill)
          .style('font-weight', '500')
          .style('opacity', '0.85')
      }

      // Append pill to the outermost ring in dob_roditelja mode
      if (colorMode === 'dob_roditelja' && node.generation === maxGen) {
        const lineAges = getLineAgesInfo(node.ahnentafel);
        if (lineAges.length > 0) {
          const avg = Math.round(d3.mean(lineAges) || 0);
          const pillColor = getGenAgeColor(avg);
          const pillRadius = Math.max(10, bandWidth * 0.18);
          const pillR = outerR(node.generation);
          const px = pillR * Math.sin(midAngle);
          const py = -pillR * Math.cos(midAngle);

          const pillGroup = mainG.append('g')
            .datum(arcData)
            .attr('class', 'node-pill-group')
            .style('cursor', 'pointer');

          pillGroup.append('circle')
            .attr('cx', px)
            .attr('cy', py)
            .attr('r', pillRadius)
            .attr('fill', pillColor)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);

          pillGroup.append('text')
            .attr('x', px)
            .attr('y', py)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .text(avg)
            .style('font-size', `${pillRadius * 0.95}px`)
            .style('font-weight', '800')
            .style('fill', '#fff')
            .style('pointer-events', 'none');

          // Attach mouse events to trigger highlight of the line
          pillGroup
            .on('mouseover', function(event) {
              const arcPath = mainG.select(`.node-arc-${node.ahnentafel}`);
              if (!arcPath.empty()) {
                arcPath.attr('stroke', '#000').attr('stroke-width', 2.5);
              }
              showTip(event, node);
              const lineAhns = getLineAhnentafels(node.ahnentafel);
              mainG.selectAll('.node-arc')
                .transition().duration(120)
                .style('opacity', (d: any) => d && lineAhns.has(d.node.ahnentafel) ? 1 : 0.20);
              mainG.selectAll('.node-text-container')
                .transition().duration(120)
                .style('opacity', (d: any) => d && lineAhns.has(d.node.ahnentafel) ? 1 : 0.20);
              mainG.selectAll('.node-pill-group')
                .transition().duration(120)
                .style('opacity', (d: any) => d && lineAhns.has(d.node.ahnentafel) ? 1 : 0.20);
            })
            .on('mouseout', function() {
              const arcPath = mainG.select(`.node-arc-${node.ahnentafel}`);
              if (!arcPath.empty()) {
                arcPath.attr('stroke', '#fff').attr('stroke-width', 2.0);
              }
              hideTip();
              mainG.selectAll('.node-arc')
                .transition().duration(120)
                .style('opacity', (d: any) => d && d.node.known ? 1 : 0.65);
              mainG.selectAll('.node-text-container')
                .transition().duration(120)
                .style('opacity', 1);
              mainG.selectAll('.node-pill-group')
                .transition().duration(120)
                .style('opacity', 1);
            })
            .on('click', () => {
              if (node.known && node.id && !node.id.startsWith('unk-')) {
                setSelectedPerson(node.id);
                hideTip();
              }
            });
        }
      }
    });

    // Add Side labels ("Očeva strana" / "Majčina strana")
    const labelRadius = outerR(maxGen) + 15;
    mainG.append('text')
      .attr('x', -labelRadius)
      .attr('y', 0)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '800')
      .style('fill', '#64748b') // slate-500
      .style('letter-spacing', '0.05em')
      .text('← OČEVA STRANA');

    mainG.append('text')
      .attr('x', labelRadius)
      .attr('y', 0)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '800')
      .style('fill', '#64748b')
      .style('letter-spacing', '0.05em')
      .text('MAJČINA STRANA →');

  }, [rootData, colorMode, setSelectedPerson, maxGen, idPrefix, dimensions.width, dimensions.height]);

  // Zoom helpers
  const doZoom = (type: 'in' | 'out' | 'reset') => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const W = dimensions.width;
    const H = dimensions.height;
    if (type === 'in') svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 1.35);
    else if (type === 'out') svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 0.75);
    else svg.transition().duration(400).call(zoomRef.current.transform as any, d3.zoomIdentity.translate(W / 2, H / 2));
  };

  if (!tree) return null;

  if (mini) {
    return (
      <div className="w-full h-full relative" ref={containerRef}>
        <div ref={tooltipRef} className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-3 pointer-events-none hidden text-sm" style={{ maxWidth: '240px' }} />
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      </div>
    );
  }

  const genOptions = [3, 4, 5, 6, 7];

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] overflow-hidden">

      {/* Tooltip */}
      <div ref={tooltipRef} className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-3 pointer-events-none hidden text-sm" style={{ maxWidth: '240px' }} />

      {/* ─── Header Panel ─── */}
      <div className="p-3 shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-4">

          {/* Focal person details */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-2xl border-2 shadow-inner shrink-0
              ${focalPerson?.sex === 'M' ? 'bg-blue-50 border-blue-200 text-blue-500'
              : focalPerson?.sex === 'F' ? 'bg-pink-50 border-pink-200 text-pink-500'
              : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
              {focalPerson?.sex === 'M' ? '♂' : focalPerson?.sex === 'F' ? '♀' : '?'}
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-lg text-teal-700 leading-tight truncate">
                {focalPerson?.names[0]?.full || 'Nepoznato'}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                <span>{focalPerson?.birth?.date?.year ? `Rođen/a ${focalPerson.birth.date.year}` : 'Nepoznata godina'}</span>
                <span className="text-slate-300">|</span>
                <span>gore (predci): <strong>{ancestorDepth} gen.</strong></span>
                <span className="text-slate-300">/</span>
                <span>dolje (potomci): <strong>{descendantDepth} gen.</strong></span>
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Generations picker */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0.5">
            {genOptions.map(g => (
              <button key={g} onClick={() => setMaxGen(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  maxGen === g
                    ? 'bg-white text-teal-600 shadow border border-teal-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}>
                {g}G
              </button>
            ))}
          </div>

          {/* Color modes */}
          {!isGenAgeMode && !isFamilyMode && (
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0.5">
              {([
                { id: 'generation',       label: 'Generacija' },
                { id: 'dob_zivota',       label: 'Životni vijek' },
                { id: 'obiteljska_grana', label: 'Grana' },
                { id: 'drzava',           label: 'Zemlja' },
              ] as { id: ColorMode; label: string }[]).map(c => (
                <button key={c.id} onClick={() => setColorMode(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    colorMode === c.id
                      ? 'bg-white text-teal-600 shadow border border-teal-100'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 text-sm font-bold transition-colors">
              <Download size={13} /> PDF
            </button>
            <button onClick={() => setSelectedPerson(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-bold transition-colors">
              <X size={13} /> Zatvori
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main area ─── */}
      {!selectedPersonId ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <p className="font-semibold text-lg">Odaberite osobu za prikaz grafa</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-3 px-3 pb-3 overflow-hidden min-h-0">

          {/* SVG Canvas wrapper */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {isGenAgeMode && genAgeStats && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 mb-3 shrink-0">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-600">{genAgeStats.avgTotal}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prosječna starost roditelja pri rođenju</span>
                  </div>
                  <div className="hidden sm:block h-6 w-px bg-slate-200" />
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-slate-600 flex items-center gap-1">
                      <span className="text-blue-500">♂</span> {genAgeStats.avgFathers} očevi
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="font-semibold text-slate-600 flex items-center gap-1">
                      <span className="text-pink-500">♀</span> {genAgeStats.avgMothers} majke
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <div>
                    Najmlađi: <strong className="text-slate-700">{genAgeStats.youngestAge} god.</strong> <span className="text-slate-400">({genAgeStats.youngestName})</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div>
                    Najstariji: <strong className="text-slate-700">{genAgeStats.oldestAge} god.</strong> <span className="text-slate-400">({genAgeStats.oldestName})</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">
                    {genAgeStats.knownCount} parova
                  </div>
                </div>
              </div>
            )}

            {isFamilyMode && familyStats && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 mb-3 shrink-0">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-indigo-600">{familyStats.avgTotal}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prosječan broj djece po obitelji</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <div>
                    Najveća obitelj: <strong className="text-slate-700">{familyStats.largestCount} djece</strong> <span className="text-slate-400">({familyStats.largestName})</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                    {familyStats.knownCount} poznatih obitelji
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1 relative bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" ref={containerRef}>
            <button onClick={toggleFullscreen} className="absolute top-3 left-3 z-10 w-8 h-8 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors" title={isFullscreen ? "Izađi iz cijelog zaslona" : "Cijeli zaslon"}>
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <div className="absolute top-3 right-3 z-10 flex items-center bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <button onClick={() => doZoom('in')} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-teal-600 border-r border-slate-200 transition-colors" title="Povećaj"><Plus size={15} /></button>
              <button onClick={() => doZoom('reset')} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-teal-600 border-r border-slate-200 transition-colors" title="Centriraj"><Target size={15} /></button>
              <button onClick={() => doZoom('out')} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-teal-600 transition-colors" title="Smanji"><Minus size={15} /></button>
            </div>
            <svg ref={svgRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none" />
          </div>
        </div>

          {/* Side Legend exactly as user mockup */}
          <div className="w-[280px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 shrink-0">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                {isGenAgeMode ? 'Dob roditelja pri rođenju' : isFamilyMode ? 'Broj djece u obitelji' : 'Generacije'} <span className="font-normal normal-case text-slate-300">· pređite mišem</span>
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {isGenAgeMode && genAgeLegendCounts ? (
                <>
                  {/* Age Ranges */}
                  <div className="space-y-3">
                    {GEN_AGE_RANGES.map(r => {
                      const rangeKey = r.label.replace('–', '-') as keyof typeof genAgeLegendCounts;
                      const count = genAgeLegendCounts[rangeKey] || 0;
                      return (
                        <div key={r.label} className="flex items-center justify-between text-xs">
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
                  
                  {/* Gender Counts */}
                  <div className="space-y-2 text-xs font-semibold text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5"><span className="text-blue-500">♂</span> Muški (Očevi)</span>
                      <span className="text-slate-500">{genAgeLegendCounts.men}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5"><span className="text-pink-500">♀</span> Ženski (Majke)</span>
                      <span className="text-slate-500">{genAgeLegendCounts.women}</span>
                    </div>
                  </div>
                </>
              ) : isFamilyMode && familyLegendCounts ? (
                <>
                  {/* Family Categories */}
                  <div className="space-y-2.5">
                    {FAMILY_CATEGORIES.map(r => {
                      const countKey = r.id as keyof typeof familyLegendCounts;
                      const count = familyLegendCounts[countKey] || 0;
                      return (
                        <div 
                          key={r.id} 
                          className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                          onMouseEnter={() => highlightCategory(r.id)}
                          onMouseLeave={() => resetHighlight()}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-3.5 h-3.5 rounded shrink-0 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: r.color }} />
                            <span className="font-bold text-slate-700">{r.label}</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md transition-colors group-hover:bg-slate-200">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                legendStats.map((s, i) => (
                  <div key={i} className="flex items-start gap-3.5">
                    <div className="w-4 h-4 rounded-md mt-0.5 shrink-0 shadow-sm transition-transform duration-200 hover:scale-110"
                      style={{ backgroundColor: i < GENERATION_COLORS.length ? GENERATION_COLORS[i] : '#94a3b8' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-slate-800 leading-snug truncate">
                        {i === 0 ? (focalPerson?.names[0]?.full || s.label) : s.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {i === 0 ? 'Odabrana osoba' : `${s.known} od ${s.total} poznato`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Legend instructions card */}
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 shrink-0">
              <div className="p-3 bg-white border border-slate-200/60 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-xs text-slate-600 space-y-2 leading-normal">
                {isGenAgeMode ? (
                  <>
                    <p>
                      Boja segmenta označava <strong>starost pretka</strong> u trenutku rođenja njegovog djeteta.
                    </p>
                    <p>
                      <strong>Broj u kružiću</strong> na rubu prikazuje prosječni generacijski jaz za tu specifičnu liniju predaka.
                    </p>
                    <p>
                      <strong>Zadržite miš</strong> za praćenje i isticanje direktne linije (ostale linije bit će zasjenjene za 80%).
                    </p>
                    <p>
                      <strong>Siva boja</strong> označava nedostatak podataka o rođenju.
                    </p>
                  </>
                ) : isFamilyMode ? (
                  <>
                    <p>
                      Boja segmenta označava <strong>broj djece</strong> u obitelji u kojoj je taj predak odrastao (on + braća i sestre).
                    </p>
                    <p>
                      Braća i sestre koji su preminuli u <strong>prvoj godini života</strong> nisu pribrojeni.
                    </p>
                    <p>
                      Broje se isključivo <strong>punokrvna braća i sestre</strong> — polubraća i polusestre nisu uključeni.
                    </p>
                    <p>
                      <strong>Zadržite miš</strong> preko pretka za točan broj i prosjek generacije, ili pređite preko stavke u legendi za isticanje te skupine.
                    </p>
                    <p>
                      <strong>Siva boja</strong> označava da rodna obitelj tog pretka nije zabilježena u stablu.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong className="text-slate-800">Obojani</strong> segmenti imaju poznate pretke.
                    </p>
                    <p>
                      <strong className="text-slate-800">Sivi</strong> segmenti nedostaju u vašem stablu.
                    </p>
                    <p>
                      Zadržite miš za praćenje i isticanje direktne linije (ostale linije bit će zasjenjene za 80%).
                    </p>
                  </>
                )}
                <p className="text-[10px] text-slate-400 italic border-t border-slate-100/80 pt-2 mt-1 leading-normal">
                  Kliknite za re-centriranje na tog pretka.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Help Modal */}
      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={isGenAgeMode ? "Generacijska starost (GenAge)" : isFamilyMode ? "Broj djece u obitelji (Obitelj)" : "Kružni graf (Fan Chart)"}
      >
        {isGenAgeMode ? (
          <div className="space-y-4">
            <p>
              Ovaj modul analizira <strong>starost roditelja pri rođenju djeteta</strong> kroz sve generacije u vašem obiteljskom stablu. To vam omogućuje da vidite generacijski jaz i prosječnu dob rađanja u različitim granama i razdobljima.
            </p>
            <h4 className="font-bold text-slate-800 mt-2 border-b border-slate-100 pb-1">Kako grafikon funkcionira:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Svaki prsten predstavlja jednu generaciju predaka (roditelji, djedovi, pradjedovi).</li>
              <li>Svaki segment je obojan u skladu s dobi koju je taj predak imao u trenutku rođenja djeteta (koje se nalazi u prstenu ispod njega).</li>
              <li><strong>Pill/Kružić na rubu:</strong> Prikazuje prosječnu generacijsku starost za cijelu tu ancestralnu granu (od najudaljenijeg pretka do fokalne osobe).</li>
            </ul>
            <h4 className="font-bold text-slate-800 mt-2 border-b border-slate-100 pb-1">Interakcija:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Isticanje linije:</strong> Prelaskom miša preko pretka, grafikon automatski zasjenjuje sve ostale grane za 80% i ostavlja istaknutom samo direktnu liniju od tog pretka do centra.</li>
              <li>Prosječna dob i precizan niz godina za tu liniju (npr. <span className="font-mono text-teal-600">34 → 39 → 29</span>) prikazuje se u skočnom prozorčiću.</li>
              <li><strong>Re-centriranje:</strong> Klikom na bilo kojeg pretka postavljate ga u središte grafikona.</li>
            </ul>
          </div>
        ) : isFamilyMode ? (
          <div className="space-y-4">
            <p>
              Ovaj modul analizira <strong>broj djece u rodnoj obitelji predaka</strong> (predak + njegova braća i sestre). Pomaže vam vizualizirati veličinu obitelji kroz generacije i uočiti trendove (npr. velike povijesne obitelji u odnosu na manje moderne obitelji).
            </p>
            <h4 className="font-bold text-slate-800 mt-2 border-b border-slate-100 pb-1">Kako grafikon funkcionira:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Svaki segment je obojan prema broju djece u obitelji u kojoj je taj predak odrastao.</li>
              <li><strong>Pravila brojanja:</strong> Broje se isključivo punokrvna braća i sestre (ista oba roditelja). Braća i sestre koji su umrli u prvoj godini života (prije navršenog 1. rođendana) nisu uključeni kako bi se dobila statistika o preživjeloj djeci u kućanstvu.</li>
              <li><strong>Sivi segmenti:</strong> Označavaju da rodna obitelj tog pretka (njegovi roditelji) nije zabilježena u stablu (što je uobičajeno na rubovima stabla).</li>
            </ul>
            <h4 className="font-bold text-slate-800 mt-2 border-b border-slate-100 pb-1">Interakcija i isticanje:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Zadržite miš:</strong> Prelaskom miša preko pretka dobit ćete detalje o njegovom imenu, datumima rođenja i smrti, te točan broj braće i sestara.</li>
              <li><strong>Isticanje iz legende (Legend hover):</strong> Prelaskom miša preko kategorija u legendi na desnoj strani (npr. *Jedino dijete*, *6-7 djece*), grafikon automatski prigušuje sve ostale segmente na 80% kako bi jasno istaknuo one koji pripadaju toj skupini.</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <p>
              <strong>Kružni graf (Fan Chart)</strong> je vizualni prikaz obiteljskog stabla koji u 360 stupnjeva prikazuje sve pretke odabrane osobe.
            </p>
            <h4 className="font-bold text-slate-800 mt-2 border-b border-slate-100 pb-1">Ključne značajke:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Simetrični raspored:</strong> Lijeva strana grafikona prikazuje očevu stranu predaka (označeno s <span className="font-bold">Očeva strana</span>), a desna prikazuje majčinu stranu predaka (označeno s <span className="font-bold">Majčina strana</span>).</li>
              <li><strong>Bojanje po izboru:</strong> Pomoću izbornika na vrhu možete mijenjati bojanje (po generacijama, obiteljskim granama, životnom vijeku ili zemlji rođenja).</li>
              <li><strong>Navigacija:</strong> Zadržite miš iznad pretka za puni pregled datuma i mjesta rođenja i smrti te dobi. Kliknite na segment za re-centriranje na tu osobu.</li>
            </ul>
          </div>
        )}
      </HelpModal>
    </div>
  );
}

// SVG arc path helper
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, reverse = false): string {
  const d3ToTrig = (a: number) => a - Math.PI / 2;
  let sA = d3ToTrig(startAngle);
  let eA = d3ToTrig(endAngle);

  if (reverse) {
    [sA, eA] = [eA, sA];
  }
  const x1 = cx + r * Math.cos(sA);
  const y1 = cy + r * Math.sin(sA);
  const x2 = cx + r * Math.cos(eA);
  const y2 = cy + r * Math.sin(eA);

  const largeArc = Math.abs(eA - sA) > Math.PI + 0.001 ? 1 : 0;
  const sweep = reverse ? 0 : 1;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}
