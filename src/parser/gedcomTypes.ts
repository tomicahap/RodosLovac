// ============================================================
// GEDCOM Type Definitions
// Supports GEDCOM 5.5 / 5.5.1 / 7.0
// ============================================================

export type DateQuality = 'exact' | 'about' | 'estimated' | 'before' | 'after' | 'between' | 'calculated' | 'unknown';

export interface GedcomDate {
  raw: string;           // Original string from GEDCOM
  quality: DateQuality;
  year?: number;
  month?: number;
  day?: number;
  yearEnd?: number;      // For BET...AND ranges
  monthEnd?: number;
  dayEnd?: number;
  isBC?: boolean;
  display: string;       // Human-readable formatted string
}

export type Sex = 'M' | 'F' | 'U' | 'X';

export interface GedcomEvent {
  tag: string;           // BIRT, DEAT, MARR, RESI, OCCU, EVEN, etc.
  date?: GedcomDate;
  place?: string;
  value?: string;        // Free-form value
  note?: string;
  source?: string;
}

export interface GedcomName {
  full: string;          // Full name string
  given?: string;        // Given name(s)
  surname?: string;      // Surname (between //)
  nickname?: string;     // NICK tag
  prefix?: string;       // NPFX
  suffix?: string;       // NSFX
  surnamePrefix?: string; // SPFX
}

export interface GedcomPerson {
  id: string;            // XREF_ID e.g. "@I1@"
  names: GedcomName[];
  sex: Sex;
  birth?: GedcomEvent;
  death?: GedcomEvent;
  events: GedcomEvent[];  // All other events
  familiesAsChild: string[];    // FAM xref IDs where this person is a child
  familiesAsSpouse: string[];   // FAM xref IDs where this person is a spouse
  notes: string[];
  sources: string[];
  // Computed fields (populated by treeGraph)
  _parents?: string[];   // Person IDs
  _children?: string[];  // Person IDs
  _spouses?: string[];   // Person IDs
}

export interface GedcomFamily {
  id: string;            // XREF_ID e.g. "@F1@"
  husband?: string;      // Person ID
  wife?: string;         // Person ID
  children: string[];    // Person IDs
  marriage?: GedcomEvent;
  divorce?: GedcomEvent;
  events: GedcomEvent[];
}

export interface GedcomSource {
  id: string;
  title?: string;
  author?: string;
  publication?: string;
  text?: string;
}

export interface GedcomNote {
  id: string;
  text: string;
}

export interface GedcomTree {
  persons: Map<string, GedcomPerson>;
  families: Map<string, GedcomFamily>;
  sources: Map<string, GedcomSource>;
  notes: Map<string, GedcomNote>;
  submitter?: {
    name?: string;
    language?: string;
  };
  header?: {
    source?: string;
    gedcomVersion?: string;
    charset?: string;
    date?: string;
    fileName?: string;
  };
  stats: TreeStats;
}

export interface TreeStats {
  totalPersons: number;
  totalFamilies: number;
  maleCount: number;
  femaleCount: number;
  unknownSexCount: number;
  withBirthDate: number;
  withDeathDate: number;
  withBirthPlace: number;
  earliestBirth?: number;
  latestBirth?: number;
  uniqueSurnames: string[];
  uniquePlaces: string[];
}

// Graph node used in treeGraph.ts
export interface PersonNode {
  id: string;
  parents: string[];
  children: string[];
  spouses: string[];
}

// Relationship path result
export interface RelationshipPath {
  path: string[];          // Person IDs in order
  description: string;     // Human readable e.g. "grandfather's brother"
  distance: number;        // Number of steps
}

// Cousin result
export interface CousinInfo {
  personId: string;
  degree: number;          // 1 = 1st cousin, 2 = 2nd, etc.
  removal: number;         // Times removed
  commonAncestors: string[];
  label: string;           // "1st cousin", "2nd cousin once removed", etc.
}

// Ancestor entry with generation
export interface AncestorEntry {
  personId: string;
  generation: number;      // 0 = self, 1 = parent, 2 = grandparent...
  ahnentafelNumber?: number; // Ahnentafel numbering (1=self, 2=father, 3=mother...)
}

// Descendant entry with generation
export interface DescendantEntry {
  personId: string;
  generation: number;      // 0 = self, 1 = child, 2 = grandchild...
}

// Lifespan data for charts
export interface LifespanEntry {
  personId: string;
  name: string;
  birthYear?: number;
  deathYear?: number;
  age?: number;
  sex: Sex;
  generation: number;
}

// Geocoded location
export interface GeoLocation {
  placeName: string;
  lat: number;
  lng: number;
  country?: string;
  confidence: 'exact' | 'regional' | 'country' | 'unknown';
}

// Migration event
export interface MigrationEvent {
  personId: string;
  personName: string;
  fromPlace?: string;
  fromGeo?: GeoLocation;
  toPlace?: string;
  toGeo?: GeoLocation;
  year?: number;
  eventType: 'immigration' | 'emigration' | 'residence' | 'birth_death';
}

// ============================================================
// Advanced GIS Module Types
// ============================================================

export interface GeoTreeFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat] format for GeoJSON
  };
  properties: {
    personId: string;
    fullName: string;
    eventType: 'BIRT' | 'DEAT' | 'MARR' | 'RESI' | 'MIGR' | 'OTHER';
    year: number;
    description: string;
    avatarUrl?: string;
    branch?: 'Paternal' | 'Maternal' | 'Both';
  };
}

export interface MigrationFlowFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][]; // Array of [lng, lat]
  };
  properties: {
    personId: string;
    fullName: string;
    year: number;
    intensity: number; // For line thickness
    fromPlace: string;
    toPlace: string;
    branch?: 'Paternal' | 'Maternal' | 'Both';
  };
}
