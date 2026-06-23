import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
// @ts-ignore
import { AntPath } from 'leaflet-ant-path';
import type { MigrationFlowFeature } from '../../../parser/gedcomTypes';

interface Props {
  flows: MigrationFlowFeature[];
}

export default function MigrationFlowLayer({ flows }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!flows || flows.length === 0) return;

    const paths: any[] = [];

    flows.forEach(flow => {
      // Leaflet expects [lat, lng]
      const latLngs = flow.geometry.coordinates.map(c => [c[1], c[0]]);
      
      const color = flow.properties.branch === 'Paternal' ? '#3b82f6' : 
                    flow.properties.branch === 'Maternal' ? '#ec4899' : '#8b5cf6';

      const path = new (AntPath as any)(latLngs, {
        delay: 400,
        dashArray: [10, 20],
        weight: 3,
        color: color,
        pulseColor: '#ffffff',
        paused: false,
        reverse: false,
        hardwareAccelerated: true
      });

      path.bindPopup(`
        <div class="p-1">
          <div class="font-bold border-b pb-1 mb-1">Migracija (${flow.properties.year})</div>
          <div class="text-sm">${flow.properties.fromPlace} →</div>
          <div class="text-sm font-semibold">${flow.properties.toPlace}</div>
          <div class="text-xs text-gray-500 mt-2">${flow.properties.fullName}</div>
        </div>
      `);

      path.addTo(map);
      paths.push(path);
    });

    return () => {
      paths.forEach(p => map.removeLayer(p));
    };
  }, [map, flows]);

  return null;
}
