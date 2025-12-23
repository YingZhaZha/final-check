
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

export interface CheckEntry {
  status: ItemStatus;
  timestamp: string | null;
  value?: string; // For inputs
  issueNote?: string;
  photos: string[]; // Combined evidence and issue photos
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
