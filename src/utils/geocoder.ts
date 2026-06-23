// ============================================================
// Geocoder — place name → lat/lng
// Uses bundled country centroid table first, then Nominatim as fallback
// All calls are browser-side, no API key required
// ============================================================

import type { GeoLocation } from '../parser/gedcomTypes';

// ─── Bundled country/city centroid table ─────────────────────

const PLACE_CENTROIDS: Record<string, [number, number]> = {
  // Continents / regions
  'europe': [54, 25],
  'north america': [40, -100],
  'south america': [-15, -60],
  'africa': [0, 25],
  'asia': [40, 90],
  'australia': [-25, 133],

  // Countries
  'croatia': [45.1, 15.2],
  'hrvatska': [45.1, 15.2],
  'slovenia': [46.1, 14.8],
  'slovenija': [46.1, 14.8],
  'bosnia': [44.0, 17.5],
  'bosnia and herzegovina': [44.0, 17.5],
  'bosna i hercegovina': [44.0, 17.5],
  'serbia': [44.0, 21.0],
  'srbija': [44.0, 21.0],
  'germany': [51.2, 10.5],
  'deutschland': [51.2, 10.5],
  'austria': [47.5, 14.5],
  'österreich': [47.5, 14.5],
  'hungary': [47.2, 19.4],
  'magyarország': [47.2, 19.4],
  'italy': [42.8, 12.8],
  'italia': [42.8, 12.8],
  'france': [46.6, 2.3],
  'switzerland': [47.0, 8.3],
  'schweiz': [47.0, 8.3],
  'united kingdom': [55.4, -3.4],
  'england': [52.5, -1.5],
  'poland': [52.0, 19.8],
  'polska': [52.0, 19.8],
  'czech republic': [49.8, 15.5],
  'czechia': [49.8, 15.5],
  'slovakia': [48.7, 19.7],
  'romania': [45.7, 24.8],
  'bulgaria': [42.7, 25.5],
  'greece': [39.1, 22.0],
  'ukraine': [49.0, 32.0],
  'russia': [61.5, 105.3],
  'united states': [39.5, -98.4],
  'usa': [39.5, -98.4],
  'america': [39.5, -98.4],
  'canada': [56.1, -106.3],
  'argentina': [-38.4, -63.6],
  'brazil': [-14.2, -51.9],
  'new zealand': [-40.9, 174.9],
  'south africa': [-28.5, 24.7],

  // Croatian cities
  'zagreb': [45.815, 15.981],
  'split': [43.508, 16.440],
  'rijeka': [45.327, 14.442],
  'osijek': [45.554, 18.695],
  'zadar': [44.119, 15.231],
  'dubrovnik': [42.640, 18.110],
  'pula': [44.866, 13.849],
  'varaždin': [46.304, 16.336],
  'karlovac': [45.487, 15.548],
  'sisak': [45.467, 16.376],
  'slavonski brod': [45.160, 18.016],
  'bjelovar': [45.900, 16.843],
  'čakovec': [46.383, 16.433],
  'koprivnica': [46.162, 16.832],
  'virovitica': [45.831, 17.383],
  'požega': [45.341, 17.686],
  'đakovo': [45.308, 18.411],
  'vinkovci': [45.288, 18.804],
  'vukovar': [45.351, 18.998],
  'šibenik': [43.736, 15.895],
  'makarska': [43.296, 17.018],
  'rovinj': [45.082, 13.638],
  'porec': [45.226, 13.594],
  'umag': [45.435, 13.524],

  // Slovenian cities
  'ljubljana': [46.051, 14.506],
  'maribor': [46.556, 15.646],
  'koper': [45.548, 13.730],
  'celje': [46.231, 15.268],

  // German cities
  'munich': [48.137, 11.576],
  'münchen': [48.137, 11.576],
  'berlin': [52.520, 13.405],
  'hamburg': [53.575, 10.015],
  'frankfurt': [50.110, 8.682],
  'cologne': [50.938, 6.960],
  'köln': [50.938, 6.960],
  'stuttgart': [48.776, 9.183],
  'nuremberg': [49.453, 11.078],
  'nürnberg': [49.453, 11.078],

  // Austrian cities
  'vienna': [48.208, 16.373],
  'wien': [48.208, 16.373],
  'graz': [47.070, 15.439],
  'linz': [48.306, 14.286],
  'salzburg': [47.812, 13.055],

  // US cities/states
  'new york': [40.714, -74.006],
  'los angeles': [34.052, -118.244],
  'chicago': [41.878, -87.630],
  'houston': [29.760, -95.370],
  'philadelphia': [39.952, -75.162],
  'cleveland': [41.500, -81.695],
  'pittsburgh': [40.440, -79.996],
  'detroit': [42.331, -83.046],
  'buffalo': [42.886, -78.879],
  'milwaukee': [43.039, -87.907],
  'st. louis': [38.627, -90.197],
  'kansas city': [39.099, -94.578],
  'boston': [42.361, -71.058],
  'ohio': [40.367, -82.997],
  'pennsylvania': [40.590, -77.209],
  'illinois': [40.633, -89.399],
  'michigan': [44.315, -85.603],
  'new york state': [42.165, -74.948],
  'california': [36.778, -119.418],
  'texas': [31.169, -99.730],
  'florida': [27.664, -81.516],

  // South American cities
  'buenos aires': [-34.614, -58.445],
  'sao paulo': [-23.549, -46.633],
  'rio de janeiro': [-22.906, -43.173],
  'santiago': [-33.457, -70.648],

  // Other major cities
  'paris': [48.857, 2.352],
  'london': [51.507, -0.128],
  'madrid': [40.417, -3.703],
  'barcelona': [41.385, 2.173],
  'rome': [41.902, 12.496],
  'amsterdam': [52.374, 4.898],
  'brussels': [50.851, 4.352],
  'zurich': [47.377, 8.541],
  'geneva': [46.204, 6.143],
  'prague': [50.088, 14.420],
  'budapest': [47.498, 19.040],
  'warsaw': [52.233, 21.011],
  'stockholm': [59.334, 18.063],
  'oslo': [59.914, 10.740],
  'copenhagen': [55.676, 12.568],
  'athens': [37.979, 23.716],
  'istanbul': [41.013, 28.950],

  // Bosnia & Serbia
  'sarajevo': [43.852, 18.385],
  'banja luka': [44.774, 17.191],
  'beograd': [44.802, 20.465],
  'belgrade': [44.802, 20.465],
  'novi sad': [45.267, 19.833],
};

// ─── Session / Local cache ────────────────────────────────────────

const CACHE_KEY = 'predci_geocache';
const geocodeCache = new Map<string, GeoLocation | null>();

// Initialize cache from localStorage
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    Object.entries(parsed).forEach(([k, v]) => geocodeCache.set(k, v as GeoLocation | null));
  }
} catch (e) {
  console.warn('Failed to load geocache from localStorage', e);
}

function persistCache() {
  try {
    const obj = Object.fromEntries(geocodeCache.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save geocache to localStorage', e);
  }
}

// ─── Place name parser ────────────────────────────────────────

function normalizePlaceName(raw: string): string {
  return raw.toLowerCase()
    .replace(/[,.()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractParts(raw: string): string[] {
  // GEDCOM PLAC format: "City, State/County, Country"
  return raw.split(',').map(p => p.trim()).filter(Boolean);
}

function lookupLocal(raw: string): GeoLocation | null {
  const parts = extractParts(raw);

  // Try each part from most specific to least specific
  for (const part of parts) {
    const key = normalizePlaceName(part);
    if (PLACE_CENTROIDS[key]) {
      const [lat, lng] = PLACE_CENTROIDS[key];
      // Determine confidence
      const confidence: GeoLocation['confidence'] = parts[0] === part ? 'exact' :
        parts.length > 1 && parts[parts.length - 1] === part ? 'country' : 'regional';
      return {
        placeName: raw,
        lat, lng,
        country: parts[parts.length - 1],
        confidence,
      };
    }
  }

  // Try combined "City, Country" lookups
  if (parts.length >= 2) {
    const cityCountry = normalizePlaceName(`${parts[0]} ${parts[parts.length - 1]}`);
    if (PLACE_CENTROIDS[cityCountry]) {
      const [lat, lng] = PLACE_CENTROIDS[cityCountry];
      return { placeName: raw, lat, lng, country: parts[parts.length - 1], confidence: 'regional' };
    }
  }

  return null;
}

// ─── Nominatim fallback (rate-limited) ───────────────────────

let lastNominatimCall = 0;
const NOMINATIM_DELAY = 1200; // ms between calls (OSM fair use)

async function geocodeViaNominatim(placeName: string): Promise<GeoLocation | null> {
  const now = Date.now();
  const wait = NOMINATIM_DELAY - (now - lastNominatimCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'PREDCI-GEDCOM-Analyzer/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    const { lat, lon, display_name } = data[0];
    return {
      placeName,
      lat: parseFloat(lat),
      lng: parseFloat(lon),
      country: display_name?.split(',').pop()?.trim(),
      confidence: 'exact',
    };
  } catch {
    return null;
  }
}

// ─── Main geocode function ────────────────────────────────────

export async function geocodePlace(placeName: string, useNominatim = false): Promise<GeoLocation | null> {
  if (!placeName?.trim()) return null;

  const cacheKey = placeName.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey)!;

  // Try local lookup first
  const local = lookupLocal(placeName);
  if (local) {
    geocodeCache.set(cacheKey, local);
    persistCache();
    return local;
  }

  // Nominatim fallback (only if explicitly enabled)
  if (useNominatim) {
    const remote = await geocodeViaNominatim(placeName);
    geocodeCache.set(cacheKey, remote);
    persistCache();
    return remote;
  }

  geocodeCache.set(cacheKey, null);
  persistCache();
  return null;
}

/**
 * Batch geocode multiple places, deduplicating requests.
 * Returns a map of placeName → GeoLocation.
 */
export async function batchGeocode(
  places: string[],
  useNominatim = false,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, GeoLocation>> {
  const unique = Array.from(new Set(places.filter(Boolean)));
  const result = new Map<string, GeoLocation>();
  let done = 0;

  for (const place of unique) {
    const geo = await geocodePlace(place, useNominatim);
    if (geo) result.set(place, geo);
    done++;
    onProgress?.(done, unique.length);
  }

  return result;
}

export function clearGeocodeCache() {
  geocodeCache.clear();
  localStorage.removeItem(CACHE_KEY);
}
