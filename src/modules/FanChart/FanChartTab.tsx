import React, { useEffect, useRef, useMemo, useState, useCallback, useId } from 'react';
import * as d3 from 'd3';
import { useApp } from '../../context/AppContext';
import { Maximize2, Minimize2, Plus, Minus, Target } from 'lucide-react';
import { ColorMode } from './FanChart';

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
  family_children_count?: number | null;
}

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

const getPlaceLand = (place: string | null): string | null => {
  if (!place) return null;
  const parts = place.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2]; // second-to-last, e.g. "Vukovar-Srijem"
  }
  return parts[0] || null;
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
  maxGenerations: number;
  colorMode: ColorMode;
  isHalfFan?: boolean;
}

export default function FanChartTab({ mini, maxGenerations = 4, colorMode = 'generation', isHalfFan = false }: Props) {
  const reactId = useId();
  const idPrefix = reactId.replace(/:/g, '-');
  const { tree, graph, selectedPersonId, setSelectedPerson } = useApp();
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();

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

  const focalPerson = useMemo(() => {
    if (!tree || !selectedPersonId) return null;
    return tree.persons.get(selectedPersonId) || null;
  }, [tree, selectedPersonId]);

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

      if (gen < maxGenerations) {
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
  }, [tree, selectedPersonId, maxGenerations]);

  const nodesByAhn = useMemo(() => {
    const map = new Map<number, AncNode>();
    if (!rootData) return map;
    const traverse = (n: AncNode) => {
      map.set(n.ahnentafel, n);
      n.children?.forEach(traverse);
    };
    traverse(rootData);
    return map;
  }, [rootData]);

  const genAgeStats = useMemo(() => {
    if (!rootData || !tree || nodesByAhn.size === 0) return null;
    
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
  }, [rootData, tree, nodesByAhn]);

  const genAgeLegendCounts = useMemo(() => {
    if (!rootData || !tree || nodesByAhn.size === 0) return null;
    
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
  }, [rootData, tree, nodesByAhn]);

  const familyStats = useMemo(() => {
    if (!rootData || !tree || nodesByAhn.size === 0) return null;

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
  }, [rootData, tree, nodesByAhn]);

  const familyLegendCounts = useMemo(() => {
    if (!rootData || !tree || nodesByAhn.size === 0) return null;

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

  const countryLegendStats = useMemo(() => {
    if (!rootData || !tree) return null;
    const counts = new Map<string, number>();
    let unknownCount = 0;
    
    const traverse = (n: AncNode) => {
      if (n.known) {
        if (n.birth_place) {
          const country = n.birth_place.split(',').pop()?.trim() || 'Nepoznato';
          counts.set(country, (counts.get(country) || 0) + 1);
        } else {
          unknownCount++;
        }
      }
      n.children?.forEach(traverse);
    };
    traverse(rootData);
    
    return {
      list: Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      unknownCount
    };
  }, [rootData, tree]);

  const landsLegendStats = useMemo(() => {
    if (!rootData || !tree) return null;
    const counts = new Map<string, number>();
    let unknownCount = 0;
    
    const traverse = (n: AncNode) => {
      if (n.known) {
        const land = getPlaceLand(n.birth_place);
        if (land) {
          counts.set(land, (counts.get(land) || 0) + 1);
        } else {
          unknownCount++;
        }
      }
      n.children?.forEach(traverse);
    };
    traverse(rootData);
    
    return {
      list: Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      unknownCount
    };
  }, [rootData, tree]);

  // Legend stats
  const legendStats = useMemo(() => {
    if (!rootData) return [];
    const stats: { label: string; known: number; total: number }[] = [];
    for (let g = 0; g <= maxGenerations; g++) {
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
  }, [rootData, maxGenerations]);

  // Color logic
  const getColor = useCallback((node: AncNode, cm: ColorMode): string => {
    if (!node.known) return UNKNOWN_COLOR;
    switch (cm) {
      case 'generation':
        return GENERATION_COLORS[node.generation] ?? GENERATION_COLORS[GENERATION_COLORS.length - 1];
      case 'drzava':
        if (!node.birth_place) return '#cbd5e1';
        return d3.scaleOrdinal(d3.schemeSet2)(node.birth_place.split(',').pop()?.trim() || '');
      case 'lands': {
        const land = getPlaceLand(node.birth_place);
        if (!land) return '#cbd5e1';
        return d3.scaleOrdinal(d3.schemeSet3)(land);
      }
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

  const highlightGroup = useCallback((filterFn: (node: AncNode) => boolean) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('.node-arc')
      .transition().duration(120)
      .style('opacity', (d: any) => {
        if (!d || !d.node) return 0.20;
        return filterFn(d.node) ? 1 : 0.20;
      });
    svg.selectAll('.node-text-container')
      .transition().duration(120)
      .style('opacity', (d: any) => {
        if (!d || !d.node) return 0.20;
        return filterFn(d.node) ? 1 : 0.20;
      });
    svg.selectAll('.node-pill-group')
      .transition().duration(120)
      .style('opacity', (d: any) => {
        if (!d || !d.node) return 0.20;
        return filterFn(d.node) ? 1 : 0.20;
      });
  }, []);

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

    // Shift center down for Half Fan to utilize full height
    const cx = W / 2;
    const cy = isHalfFan ? H - 35 : H / 2;

    const maxRadius = isHalfFan 
      ? Math.min(W / 2 - 25, H - 50)
      : Math.min(W, H) / 2 - 25;

    const outerR0 = Math.max(55, maxRadius * 0.18); 
    const bandWidth = (maxRadius - outerR0) / maxGenerations; 

    const outerR = (gen: number) => gen === 0 ? outerR0 : outerR0 + gen * bandWidth;
    const innerR = (gen: number) => gen === 0 ? 0 : outerR0 + (gen - 1) * bandWidth;

    const arcGen = d3.arc<{ node: AncNode; a0: number; a1: number; ir: number; or: number }>()
      .innerRadius(d => d.ir)
      .outerRadius(d => d.or)
      .startAngle(d => d.a0)
      .endAngle(d => d.a1);

    const allNodes: AncNode[] = [];
    const traverse = (n: AncNode) => {
      allNodes.push(n);
      n.children?.forEach(traverse);
    };
    traverse(rootData);

    g.attr('transform', `translate(${cx},${cy})`);
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(cx, cy));

    const mainG = g;

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

        let placeStr = '';
        if (colorMode === 'drzava' && node.birth_place) {
          placeStr = `<div class="text-xs text-slate-600 mt-0.5">🌍 <strong>Država rođenja:</strong> ${node.birth_place.split(',').pop()?.trim()}</div>`;
        } else if (colorMode === 'lands' && node.birth_place) {
          placeStr = `<div class="text-xs text-slate-600 mt-0.5">🏔️ <strong>Regija/Kraj:</strong> ${getPlaceLand(node.birth_place)}</div>`;
        }

        tooltip.style('display', 'block').html(`
          <div class="font-bold text-slate-800 text-sm mb-1 flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <span class="w-2.5 h-2.5 rounded-full shrink-0 ${node.sex === 'M' ? 'bg-blue-500' : node.sex === 'F' ? 'bg-pink-500' : 'bg-slate-400'}"></span>
            ${node.name}
          </div>
          ${birthStr}
          ${deathStr}
          ${ageStr}
          ${placeStr}
          <div class="text-[10px] text-teal-600 mt-2 border-t border-slate-100 pt-1.5 font-semibold flex items-center gap-1">
            🖱️ Kliknite za novi fokus
          </div>
        `).style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 10) + 'px');
      }
    };
    const hideTip = () => tooltip.style('display', 'none');

    // Draw focal person (Gen 0)
    if (isHalfFan) {
      const focalArcData = { node: rootData, a0: -Math.PI / 2, a1: Math.PI / 2, ir: 0, or: outerR0 };
      const focalPath = arcGen(focalArcData)!;
      
      mainG.append('path')
        .datum(focalArcData)
        .attr('class', 'node-arc node-arc-1')
        .attr('d', focalPath)
        .attr('fill', getSegmentColor(rootData))
        .attr('stroke', '#fff')
        .attr('stroke-width', 3.0)
        .style('cursor', 'default')
        .on('mouseover', (event) => { showTip(event, rootData); })
        .on('mousemove', (event) => { showTip(event, rootData); })
        .on('mouseout', () => { hideTip(); });
    } else {
      const focalArcData = { node: rootData, a0: 0, a1: 2 * Math.PI, ir: 0, or: outerR0 };
      mainG.append('circle')
        .datum(focalArcData)
        .attr('class', 'node-arc node-arc-1')
        .attr('r', outerR0)
        .attr('fill', getSegmentColor(rootData))
        .attr('stroke', '#fff')
        .attr('stroke-width', 3.0)
        .style('cursor', 'default')
        .on('mouseover', (event) => { showTip(event, rootData); })
        .on('mousemove', (event) => { showTip(event, rootData); })
        .on('mouseout', () => { hideTip(); });
    }

    // Focal person text
    const focalArcData = isHalfFan 
      ? { node: rootData, a0: -Math.PI / 2, a1: Math.PI / 2, ir: 0, or: outerR0 }
      : { node: rootData, a0: 0, a1: 2 * Math.PI, ir: 0, or: outerR0 };

    const focalText = mainG.append('text')
      .datum(focalArcData)
      .attr('class', 'node-text-container')
      .attr('text-anchor', 'middle')
      .style('fill', '#fff')
      .style('pointer-events', 'none');

    const nameParts = rootData.name.split(' ');
    const focalFontSize = Math.max(10, outerR0 * 0.21); 
    const yearFontSize = Math.max(8, outerR0 * 0.16);

    // Shift text slightly up for Half Fan since the bottom of the circle is flat
    const textDyOffset = isHalfFan ? -12 : 0;

    if (nameParts.length > 1) {
      focalText.append('tspan').attr('x', 0).attr('dy', `${-0.55 + textDyOffset/16}em`)
        .text(nameParts.slice(0, -1).join(' '))
        .style('font-size', `${focalFontSize}px`)
        .style('font-weight', '800');
      focalText.append('tspan').attr('x', 0).attr('dy', '1.15em')
        .text(nameParts[nameParts.length - 1])
        .style('font-size', `${focalFontSize}px`)
        .style('font-weight', '800');
    } else {
      focalText.append('tspan').attr('x', 0).attr('dy', `${0.25 + textDyOffset/16}em`)
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

    // Filter out focal person and draw ancestor arcs
    const genNodes = allNodes.filter(n => n.generation >= 1);

    genNodes.forEach(node => {
      const g = node.generation;
      
      // Determine side
      let parentAhn = node.ahnentafel;
      while (parentAhn > 3) parentAhn = Math.floor(parentAhn / 2);
      const isFatherSide = parentAhn === 2;

      let startAngle = 0;
      let endAngle = 0;

      if (isHalfFan) {
        // 180° Top Semi-circle angles from -PI/2 to PI/2
        const theta = Math.PI / Math.pow(2, g);
        if (isFatherSide) {
          const idx = node.ahnentafel - Math.pow(2, g);
          startAngle = -Math.PI / 2 + idx * theta;
          endAngle = startAngle + theta;
        } else {
          const idx = node.ahnentafel - 3 * Math.pow(2, g - 1);
          startAngle = idx * theta;
          endAngle = startAngle + theta;
        }
      } else {
        // 360° full circle angles
        const theta = Math.PI / Math.pow(2, g - 1);
        if (isFatherSide) {
          const idx = node.ahnentafel - Math.pow(2, g);
          startAngle = 2 * Math.PI - (idx + 1) * theta;
          endAngle = 2 * Math.PI - idx * theta;
        } else {
          const idx = node.ahnentafel - 3 * Math.pow(2, g - 1);
          startAngle = idx * theta;
          endAngle = (idx + 1) * theta;
        }
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
        .attr('stroke-width', 2.0)
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
            } else {
              // Dim other branches to 80%
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
          
          // Reset highlights
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

      if (!node.known) return;

      const angleSpan = endAngle - startAngle;
      const midAngle = (startAngle + endAngle) / 2;
      const midR = (ir + or) / 2;
      const chordLen = angleSpan * midR;

      // Scale font sizes based on space
      const maxFontSize = Math.min(bandWidth * 0.25, chordLen * 0.11, 10.5);
      const fontSize = Math.max(6.5, maxFontSize);

      if (chordLen < 22) return;

      const flipText = midAngle > Math.PI / 2 && midAngle < 1.5 * Math.PI;

      // Format name (truncate if too long)
      const maxChars = Math.floor(chordLen / (fontSize * 0.58));
      if (maxChars < 3) return; 

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
          const onlyBirth = `${birth}`;
          if (onlyBirth.length <= limit) return onlyBirth;
        }
        return '';
      };

      const yearStr = node.birth_year ? formatYears(node.birth_year, node.death_year, maxYearChars) : '';
      const showTwoLines = !!yearStr;

      let nameArcR = midR;
      if (showTwoLines) {
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

      const textFill = (color === '#cbd5e1' || color === '#f1f5f9' || color === '#e2e8f0' || color === '#fff') ? '#334155' : '#fff';

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
      if (colorMode === 'dob_roditelja' && node.generation === maxGenerations) {
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

    // Add Side labels
    const labelRadius = outerR(maxGenerations) + 15;
    
    // Symmetrical positioning depending on half-fan vs full circle
    const labelY = isHalfFan ? -12 : 0;
    
    mainG.append('text')
      .attr('x', -labelRadius)
      .attr('y', labelY)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '800')
      .style('fill', '#64748b') 
      .style('letter-spacing', '0.05em')
      .text('← OČEVA STRANA');

    mainG.append('text')
      .attr('x', labelRadius)
      .attr('y', labelY)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '800')
      .style('fill', '#64748b')
      .style('letter-spacing', '0.05em')
      .text('MAJČINA STRANA →');

  }, [rootData, colorMode, setSelectedPerson, maxGenerations, idPrefix, dimensions.width, dimensions.height, isHalfFan, nodesByAhn]);

  // Zoom helpers
  const doZoom = (type: 'in' | 'out' | 'reset') => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const W = dimensions.width;
    const H = dimensions.height;
    if (type === 'in') svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 1.35);
    else if (type === 'out') svg.transition().duration(300).call(zoomRef.current.scaleBy as any, 0.75);
    else {
      const cy = isHalfFan ? H - 35 : H / 2;
      svg.transition().duration(400).call(zoomRef.current.transform as any, d3.zoomIdentity.translate(W / 2, cy));
    }
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

  return (
    <div className="flex-1 flex gap-3 px-3 pb-3 overflow-hidden min-h-0">

      {/* Tooltip */}
      <div ref={tooltipRef} className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-3 pointer-events-none hidden text-sm" style={{ maxWidth: '240px' }} />

      {/* SVG Canvas wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {isGenAgeMode && genAgeStats && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 mb-3 shrink-0 print:hidden">
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 mb-3 shrink-0 print:hidden">
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

      {/* Side Legend */}
      <div className="w-[280px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden print:hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 shrink-0">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
            {colorMode === 'generation' ? 'Generacije'
              : colorMode === 'dob_roditelja' ? 'Dob roditelja pri rođenju'
              : colorMode === 'obitelj' ? 'Broj djece u obitelji'
              : colorMode === 'drzava' ? 'Država rođenja'
              : 'Krajevi rođenja'} <span className="font-normal normal-case text-slate-300">· pređite mišem</span>
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isGenAgeMode && genAgeLegendCounts ? (
            <>
              {/* Age Ranges */}
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
                          if (n.ahnentafel <= 1 || !n.known) return false;
                          const child = nodesByAhn.get(Math.floor(n.ahnentafel / 2));
                          if (child && n.birth_year && child.birth_year) {
                            const age = child.birth_year - n.birth_year;
                            return age >= minAge && age <= maxAge;
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
              
              {/* Gender Counts */}
              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between items-center cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors"
                  onMouseEnter={() => highlightGroup(n => n.known && n.ahnentafel > 1 && n.sex === 'M')}
                  onMouseLeave={resetHighlight}
                >
                  <span className="flex items-center gap-1.5"><span className="text-blue-500">♂</span> Muški (Očevi)</span>
                  <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">{genAgeLegendCounts.men}</span>
                </div>
                <div className="flex justify-between items-center cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors"
                  onMouseEnter={() => highlightGroup(n => n.known && n.ahnentafel > 1 && n.sex === 'F')}
                  onMouseLeave={resetHighlight}
                >
                  <span className="flex items-center gap-1.5"><span className="text-pink-500">♀</span> Ženski (Majke)</span>
                  <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">{genAgeLegendCounts.women}</span>
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
                      onMouseEnter={() => highlightGroup(n => checkCategoryMatch(n, r.id))}
                      onMouseLeave={resetHighlight}
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
          ) : colorMode === 'drzava' && countryLegendStats ? (
            <div className="space-y-2.5">
              {countryLegendStats.list.map(item => {
                const color = d3.scaleOrdinal(d3.schemeSet2)(item.label);
                return (
                  <div 
                    key={item.label} 
                    className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                    onMouseEnter={() => highlightGroup(n => n.known && n.birth_place?.split(',').pop()?.trim() === item.label)}
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
              {countryLegendStats.unknownCount > 0 && (
                <div 
                  className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors opacity-70"
                  onMouseEnter={() => highlightGroup(n => !n.known || !n.birth_place)}
                  onMouseLeave={resetHighlight}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded shrink-0 bg-slate-300" />
                    <span className="font-bold text-slate-700">Nepoznato</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{countryLegendStats.unknownCount}</span>
                </div>
              )}
            </div>
          ) : colorMode === 'lands' && landsLegendStats ? (
            <div className="space-y-2.5">
              {landsLegendStats.list.map(item => {
                const color = d3.scaleOrdinal(d3.schemeSet3)(item.label);
                return (
                  <div 
                    key={item.label} 
                    className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                    onMouseEnter={() => highlightGroup(n => n.known && getPlaceLand(n.birth_place) === item.label)}
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
              {landsLegendStats.unknownCount > 0 && (
                <div 
                  className="flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50 p-1.5 rounded-lg transition-colors opacity-70"
                  onMouseEnter={() => highlightGroup(n => !n.known || !getPlaceLand(n.birth_place))}
                  onMouseLeave={resetHighlight}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded shrink-0 bg-slate-300" />
                    <span className="font-bold text-slate-700">Nepoznato</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{landsLegendStats.unknownCount}</span>
                </div>
              )}
            </div>
          ) : (
            legendStats.map((s, i) => (
              <div 
                key={i} 
                className="flex items-start gap-3.5 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                onMouseEnter={() => highlightGroup(n => n.known && n.generation === s.total)} // wait, generation index matches i
                onMouseLeave={resetHighlight}
              >
                <div className="w-4 h-4 rounded-md mt-0.5 shrink-0 shadow-sm"
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
                <p>Boja segmenta označava <strong>starost pretka</strong> u trenutku rođenja njegovog djeteta.</p>
                <p><strong>Broj u kružiću</strong> na rubu prikazuje prosječni generacijski jaz za tu specifičnu liniju predaka.</p>
                <p><strong>Zadržite miš</strong> za praćenje i isticanje direktne linije (ostale linije bit će zasjenjene za 80%).</p>
                <p><strong>Siva boja</strong> označava nedostatak podataka o rođenju.</p>
              </>
            ) : isFamilyMode ? (
              <>
                <p>Boja segmenta označava <strong>broj djece</strong> u obitelji u kojoj je taj predak odrastao (on + braća i sestre).</p>
                <p>Braća i sestre koji su preminuli u <strong>prvoj godini života</strong> nisu pribrojeni.</p>
                <p><strong>Zadržite miš</strong> preko pretka za točan broj i prosjek generacije, ili pređite preko stavke u legendi za isticanje te skupine.</p>
                <p><strong>Siva boja</strong> označava da rodna obitelj tog pretka nije zabilježena u stablu.</p>
              </>
            ) : colorMode === 'drzava' ? (
              <>
                <p>Boja segmenta označava <strong>državu rođenja</strong> pretka.</p>
                <p><strong>Zadržite miš</strong> preko bilo kojeg pretka za detaljan prikaz, ili pređite preko države u legendi za isticanje.</p>
              </>
            ) : colorMode === 'lands' ? (
              <>
                <p>Boja segmenta označava <strong>regiju ili županiju</strong> rođenja pretka.</p>
                <p>Koristan prikaz za praćenje regionalnog podrijetla predaka.</p>
              </>
            ) : (
              <>
                <p><strong className="text-slate-800">Obojani</strong> segmenti imaju poznate pretke.</p>
                <p><strong className="text-slate-800">Sivi</strong> segmenti nedostaju u vašem stablu.</p>
                <p>Zadržite miš za praćenje i isticanje direktne linije (ostale linije bit će zasjenjene za 80%).</p>
              </>
            )}
            <p className="text-[10px] text-slate-400 italic border-t border-slate-100/80 pt-2 mt-1 leading-normal">
              Kliknite za re-centriranje na tog pretka.
            </p>
          </div>
        </div>
      </div>

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
