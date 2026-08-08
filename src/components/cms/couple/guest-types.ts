// ---- Shared constants ----
export const API_BASE = '/api/cms/guests?XTransformPort=3000';
export const TABLES_API = '/api/cms/tables?XTransformPort=3000';

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ATTENDING: { label: 'Attending', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DECLINED: { label: 'Declined', color: 'bg-red-50 text-red-600 border-red-200' },
  PARTIAL: { label: 'Partial', color: 'bg-sky-50 text-sky-700 border-sky-200' },
};

export const TABLE_DIMS: Record<string, { w: number; h: number }> = {
  circle:    { w: 90, h: 90 },
  rectangle: { w: 84, h: 84 },
  oval:      { w: 150, h: 70 },
};

// SHAPE_ICONS needs to be defined in .tsx files that use JSX rendering

// ---- Interfaces ----
export interface RsvpGuestResponse {
  dietary: string | null;
  name: string;
  attendance: string;
}

export interface RsvpSubmissionBrief {
  id: string;
  createdAt: string;
  guests: RsvpGuestResponse[];
}

export interface GuestItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  tableNumber: number | null;
  invitationCode: string;
  rsvpStatus: string;
  plusOne: boolean;
  plusOneName: string | null;
  dietaryNotes: string | null;
  sentVia: string | null;
  sentAt: string | null;
  _count?: { rsvps: number; wishes: number };
  rsvps?: RsvpSubmissionBrief[];
}

export interface SeatingTableItem {
  id: string;
  tableNum: number;
  name: string | null;
  zone: string | null;
  shape: string;
  capacity: number;
  posX: number;
  posY: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuestFormData {
  name: string;
  email: string;
  phone: string;
  groupName: string;
  tableNumber: string;
  plusOne: boolean;
  plusOneName: string;
  dietaryNotes: string;
}

export const emptyGuestForm: GuestFormData = {
  name: '',
  email: '',
  phone: '',
  groupName: '',
  tableNumber: '',
  plusOne: false,
  plusOneName: '',
  dietaryNotes: '',
};

// ---- CSV Import types & helpers ----
export type ImportStep = 'upload' | 'preview' | 'result';

export interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  group: string;
  groupName: string;
  GroupName: string;
  tableNumber: string;
  plusOne: string;
  plusOneName: string;
  dietaryNotes: string;
  rsvpStatus: string;
  [key: string]: string;
}

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; name: string; error: string }>;
}

export const CSV_TEMPLATE_HEADERS = 'name,email,phone,group,tableNumber,plusOne,plusOneName,dietaryNotes';
export const CSV_TEMPLATE_EXAMPLE = "John Smith,john@email.com,+65 9123 4567,Bride's Family,1,yes,Jane Smith,Vegetarian";

export function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const cleanText = text.replace(/^\ufeff/, '');
  const lines = cleanText.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: ParsedRow = {} as ParsedRow;
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

export function resolveFieldName(row: ParsedRow): string {
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === 'name') return row[key];
  }
  return '';
}

export function normalizeRow(row: ParsedRow): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    const normKey = key.toLowerCase().replace(/\s+/g, '');
    normalized[normKey] = row[key];
  }
  return normalized;
}

export function rowToPayload(row: ParsedRow) {
  const n = normalizeRow(row);
  const tableRaw = n.tablenumber || n.table || '';
  const tableMatch = tableRaw.match(/\d+/);
  const tableNumber = tableMatch ? parseInt(tableMatch[0], 10) : undefined;
  const rsvpRaw = (n.rsvpstatus || '').toLowerCase().trim();
  let rsvpStatus: string | undefined;
  if (rsvpRaw === 'pending') rsvpStatus = 'PENDING';
  else if (rsvpRaw === 'confirmed' || rsvpRaw === 'attending') rsvpStatus = 'ATTENDING';
  else if (rsvpRaw === 'declined') rsvpStatus = 'DECLINED';
  else if (rsvpRaw === 'partial') rsvpStatus = 'PARTIAL';
  return {
    name: (n.name || '').trim(),
    email: (n.email || '').trim() || undefined,
    phone: (n.phone || '').trim() || undefined,
    group: (n.group || n.groupname || '').trim() || undefined,
    tableNumber,
    plusOne: ['yes', 'true', '1', 'y'].includes((n.plusone || '').toLowerCase()),
    plusOneName: (n.plusonename || '').trim() || undefined,
    dietaryNotes: (n.dietarynotes || n.dietary || '').trim() || undefined,
    rsvpStatus,
  };
}

export function downloadCSVTemplate() {
  const csv = `${CSV_TEMPLATE_HEADERS}\n${CSV_TEMPLATE_EXAMPLE}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'guest-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Helpers ----
export function getEffectiveDietary(guest: GuestItem): string | null {
  const rsvpDietary = guest.rsvps?.[0]?.guests
    ?.map((g) => g.dietary)
    .filter((d): d is string => !!d && d.trim().length > 0)
    .join('; ');
  return guest.dietaryNotes || rsvpDietary || null;
}

export function truncate(str: string, len: number) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '\u2026' : str;
}

export function dietaryBadgeColor(dietary: string): string {
  const d = dietary.toLowerCase();
  if (d.includes('vegan')) return 'bg-green-100 text-green-700';
  if (d.includes('vegetarian')) return 'bg-emerald-100 text-emerald-700';
  if (d.includes('halal')) return 'bg-blue-100 text-blue-700';
  if (d.includes('kosher')) return 'bg-indigo-100 text-indigo-700';
  if (d.includes('gluten') || d.includes('celiac')) return 'bg-amber-100 text-amber-700';
  if (d.includes('nut') || d.includes('allerg')) return 'bg-red-100 text-red-700';
  return 'bg-orange-100 text-orange-700';
}

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-50 text-gray-600 border-gray-200' };
}
