
export interface SubItemConfig {
  id: string;
  label: string;
}

export interface ChecklistItemConfig {
  id: string;
  text: string;
  type: 'simple' | 'multi';
  subItems?: SubItemConfig[];
  requiresInput?: boolean; 
  pressureType?: 'number' | 'range';
  inputLabel?: string; 
  layout?: 'list' | 'grid'; // New: Control display layout (1 col or 2 cols)
}

export interface SectionConfig {
  id: string;
  title: string;
  items: ChecklistItemConfig[];
}

export type ItemStatus = 'unchecked' | 'ok' | 'na' | 'flagged';

export interface Rectification {
  method: string;
  photos: string[];
  timestamp: string;
}

export interface HistoryEntry {
  id: string;
  issueNote: string;
  issuePhotos: string[];
  rectification?: Rectification;
  timestamp: string; // Time of defect finding
}

export interface CheckEntry {
  status: ItemStatus;
  isStarred?: boolean; // New: For "Review Needed" functionality
  timestamp: string | null;
  value?: string; // For inputs
  
  // Normal Record
  photos: string[]; 
  note?: string;

  // Current Active Defect
  issueNote?: string;
  issuePhotos: string[]; 
  
  // Current Rectification (Active)
  rectification?: Rectification; 

  // Past Records (for multiple cycles)
  history?: HistoryEntry[];
}

// Flat map of all items (flattening sub-items into unique keys)
export interface ChecklistSession {
  [uniqueId: string]: CheckEntry;
}

export interface AircraftInfo {
  registration: string;
  flightNumber?: string;
  inspectorName: string;
  date: string;
}

export interface AppState {
  step: 'welcome' | 'inspect' | 'review' | 'sign';
  info: AircraftInfo;
  session: ChecklistSession;
  signature: string | null;
  selfie: string | null; // Added selfie field
}
