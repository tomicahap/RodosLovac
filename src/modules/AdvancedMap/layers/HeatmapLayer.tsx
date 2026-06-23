import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { GeoTreeFeature } from '../../../parser/gedcomTypes';

interface Props {
  features: GeoTreeFeature[];
}

export default function HeatmapLayer({ features }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!features || features.length === 0) return;

    // Format: [lat, lng, intensity]
    const points = features.map(f => [
      f.geometry.coordinates[1], // lat
      f.geometry.coordinates[0], // lng
      1 // base intensity
    ] as [number, number, number]);

    // Create heat layer
    const heatLayer = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 10,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, features]);

  return null;
}
