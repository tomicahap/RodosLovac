import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import type { GeoTreeFeature } from '../../../parser/gedcomTypes';

interface Props {
  features: GeoTreeFeature[];
}

export default function SmartClusterLayer({ features }: Props) {
  
  const createCustomIcon = (feature: GeoTreeFeature) => {
    let bgColor = 'bg-gray-500';
    let icon = '';

    if (feature.properties.eventType === 'BIRT') {
      bgColor = 'bg-blue-500';
      icon = '🌟';
    } else if (feature.properties.eventType === 'DEAT') {
      bgColor = 'bg-red-500';
      icon = '✝';
    } else if (feature.properties.eventType === 'MARR') {
      bgColor = 'bg-amber-500';
      icon = '💍';
    }

    const html = `
      <div class="relative w-8 h-8 flex items-center justify-center rounded-full ${bgColor} text-white shadow-md border-2 border-white transform hover:scale-110 transition-transform">
        <span class="text-sm">${icon}</span>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-cluster-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={40}
      spiderfyOnMaxZoom={true}
    >
      {features.map((f, i) => {
        const [lng, lat] = f.geometry.coordinates;
        return (
          <Marker 
            key={`${f.properties.personId}-${i}`} 
            position={[lat, lng]} 
            icon={createCustomIcon(f)}
          >
            <Popup className="advanced-map-popup">
              <div className="p-1 min-w-[200px]">
                <div className="font-bold text-gray-900 border-b pb-2 mb-2">
                  {f.properties.fullName}
                </div>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700">
                    {f.properties.eventType}
                  </span>
                  <span className="font-semibold">{f.properties.year}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{f.properties.description}</p>
                <div className="text-xs text-gray-400">Grana: {f.properties.branch === 'Paternal' ? 'Očeva' : f.properties.branch === 'Maternal' ? 'Majčina' : 'Obje'}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}
