import React, { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import * as d3 from 'd3';
import { GedcomPerson } from '../../../parser/gedcomTypes';

interface ArcData {
  personId?: string;
  name: string;
  years: string;
  ahnentafel: number;
  generation: number;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
}

function getYears(p?: GedcomPerson) {
  if (!p) return '';
  const b = p.birth?.date?.year || '';
  const d = p.death?.date?.year || '';
  if (b && d) return `${b}-${d}`;
  if (b) return `r. ${b}`;
  return '';
}

export default function SimpleOverviewFanChart() {
  const { tree, graph, selectedPersonId, setSelectedPerson, setActiveModule } = useApp();

  const arcsData = useMemo(() => {
    if (!tree || !graph || !selectedPersonId) return [];

    const ancestors = graph.getAncestors(selectedPersonId, 2);
    
    const rootP = tree.persons.get(selectedPersonId);
    const nodes: { personId?: string, name: string, years: string, ahnentafel: number, generation: number }[] = [];
    
    nodes.push({
      personId: selectedPersonId,
      name: rootP?.names[0]?.full || 'Nepoznato',
      years: getYears(rootP),
      ahnentafel: 1,
      generation: 0
    });

    for (const a of ancestors) {
      const p = tree.persons.get(a.personId);
      nodes.push({
        personId: a.personId,
        name: p?.names[0]?.full || 'Nepoznato',
        years: getYears(p),
        ahnentafel: a.ahnentafelNumber || 1,
        generation: a.generation
      });
    }
    
    const totalGenerations = 3; 
    const arcs: ArcData[] = [];
    
    const maxR = 250;
    const ringWidth = maxR / totalGenerations;

    for (let gen = 0; gen < totalGenerations; gen++) {
      const count = Math.pow(2, gen);
      const span = (Math.PI * 2) / count;
      const innerRadius = gen * ringWidth;
      const outerRadius = (gen + 1) * ringWidth;

      for (let i = 0; i < count; i++) {
        const ahnen = Math.pow(2, gen) + i;
        const node = nodes.find(n => n.ahnentafel === ahnen);
        
        let startAngle = i * span - Math.PI;
        let endAngle = (i + 1) * span - Math.PI;

        arcs.push({
          personId: node?.personId,
          name: node?.name || (gen > 0 ? 'Nepoznato' : ''),
          years: node?.years || '',
          ahnentafel: ahnen,
          generation: gen,
          startAngle,
          endAngle,
          innerRadius,
          outerRadius
        });
      }
    }
    
    return arcs;
  }, [tree, graph, selectedPersonId]);

  if (arcsData.length === 0) return null;

  const arcGenerator = d3.arc<ArcData>()
    .innerRadius(d => d.innerRadius)
    .outerRadius(d => d.outerRadius)
    .startAngle(d => d.startAngle)
    .endAngle(d => d.endAngle)
    .padAngle(0.005)
    .padRadius(150);

  const handlePersonClick = (id?: string) => {
    if (!id) return;
    setSelectedPerson(id);
    setActiveModule('person-stats');
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative bg-white dark:bg-slate-900 rounded-xl">
      <svg viewBox="-260 -260 520 520" className="w-full h-full max-w-[500px] max-h-[500px]">
        {arcsData.map(d => {
          const GENERATION_COLORS = ['#0f766e', '#0d9488', '#0891b2', '#2563eb', '#4f46e5', '#7c3aed', '#9333ea', '#c084fc'];
          let fill = '#f1f5f9';
          if (d.personId) {
             fill = GENERATION_COLORS[d.generation] || '#0891b2'; 
          }

          const pathD = arcGenerator(d) || '';
          
          let centroid = [0, 0];
          if (d.generation > 0) {
             centroid = arcGenerator.centroid(d);
          }
          
          return (
            <g 
              key={d.ahnentafel} 
              onClick={() => handlePersonClick(d.personId)}
              className={d.personId ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
            >
              <path d={pathD} fill={fill} stroke="#ffffff" strokeWidth="2" className="dark:stroke-slate-800" />
              
              {d.name && d.generation === 0 && (
                <text x={0} y={0} textAnchor="middle" className="text-[12px] font-bold fill-white" pointerEvents="none">
                  <tspan x="0" dy="-0.8em">{d.name.split(' ')[0]}</tspan>
                  <tspan x="0" dy="1.2em">{d.name.split(' ').slice(1).join(' ')}</tspan>
                  {d.years && <tspan x="0" dy="1.4em" className="text-[9px] font-normal fill-white/80">{d.years}</tspan>}
                </text>
              )}

              {d.name && d.generation > 0 && (
                <text 
                  transform={`translate(${centroid[0]}, ${centroid[1]})`}
                  textAnchor="middle" 
                  className={`text-[10px] font-bold ${!d.personId ? 'fill-slate-400' : 'fill-white'}`}
                  pointerEvents="none"
                >
                  <tspan x="0" dy="-0.8em">{d.name.split(' ')[0]}</tspan>
                  <tspan x="0" dy="1.2em">{d.name.split(' ').slice(1).join(' ')}</tspan>
                  {d.years && <tspan x="0" dy="1.4em" className="text-[8px] font-normal fill-white/80">{d.years}</tspan>}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
