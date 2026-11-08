export type ReportType = 'embouteillage' | 'accident' | 'route_barree' | 'travaux' | 'inondation' | 'route_impraticable';
export type Severity = 1 | 2 | 3;
export type Role = 'usager' | 'taximan' | 'moto';

export interface Report {
  id: string;
  type: ReportType;
  severity: Severity | null;
  lat: number;
  lng: number;
  status: 'actif' | 'confirme' | 'retire';
  confirmations: number;
  contestations: number;
  created_at: string;
  expires_at: string;
}

export interface MyReport extends Omit<Report, 'status'> {
  status: 'actif' | 'confirme' | 'retire' | 'expire';
  points: number;
  place_label: string | null;
}

export interface Me {
  id: string;
  display_name: string;
  role: Role;
  points: number;
  is_admin: boolean;
  rank: number;
  reports_count: number;
  confirmed_count: number;
  useful_votes?: number;
  morning_reports?: number;
}

export interface Leader {
  id: string;
  display_name: string;
  role: Role;
  points: number;
}

export interface Pos {
  lat: number;
  lng: number;
  acc: number;
  ts: number;
}

export interface Hospital {
  id: number;
  name: string;
  lat: number;
  lng: number;
  phone: string | null;
  emergency_24h: boolean;
  verified: boolean;
}

export interface RouteOption {
  hospital: Hospital;
  distance_m: number;
  duration_s: number | null;
  geometry: [number, number][] | null; // [lng, lat]
  avoided: number;
  incidents_on_route: number;
  routed: boolean;
}

export interface EmergencyResult {
  incidents_in_area: number;
  results: RouteOption[];
}

export type Overlay =
  | { kind: 'report' }
  | { kind: 'emergency' }
  | { kind: 'detail'; id: string }
  | { kind: 'auth'; mode: 'login' | 'signup'; reason?: string }
  | { kind: 'privacy' }
  | { kind: 'edit' }
  | { kind: 'account' }
  | { kind: 'drive' }
  | { kind: 'install' }
  | { kind: 'onboarding' };

export type Tab = 'map' | 'nearby' | 'profile';

export interface TrafficCell {
  lat: number;
  lng: number;
  heading_bucket: number;
  vehicles: number;
  speed: number;
  state: 'fluide' | 'modere' | 'dense' | 'bouchon';
  updated_at: string;
}
