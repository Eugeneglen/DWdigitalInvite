// ---- Shared constants ----
export const API_BASE = '/api/cms/guests?XTransformPort=3000';
export const TABLES_API = '/api/cms/tables?XTransformPort=3000';
export const GUEST_STATS_API = '/api/cms/guests/stats?XTransformPort=3000';
export const CHECKIN_API = '/api/cms/guests/checkin?XTransformPort=3000';

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ATTENDING: { label: 'Attending', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DECLINED: { label: 'Declined', color: 'bg-red-50 text-red-600 border-red-200' },
  PARTIAL: { label: 'Partial', color: 'bg-sky-50 text-sky-700 border-sky-200' },
};

export const CHECKIN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NOT_ARRIVED: { label: 'Not Arrived', color: 'bg-gray-50 text-gray-500 border-gray-200' },
  CHECKED_IN: { label: 'Checked In', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NO_SHOW: { label: 'No Show', color: 'bg-red-50 text-red-600 border-red-200' },
};

export const SIDE_OPTIONS = [
  { value: 'GROOM', label: 'Groom\'s Side', emoji: '🤵' },
  { value: 'BRIDE', label: 'Bride\'s Side', emoji: '👰' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'RELATIVES', label: 'Relatives' },
  { value: 'FRIENDS', label: 'Friends' },
  { value: 'COLLEAGUES', label: 'Colleagues' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'PARENTS_GUESTS', label: 'Parents\' Guests' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { value: 'PARENT', label: 'Parent' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'RELATIVE', label: 'Relative' },
  { value: 'FRIEND', label: 'Friend' },
  { value: 'COLLEAGUE', label: 'Colleague' },
  { value: 'BUSINESS', label: 'Business Contact' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const TABLE_DIMS: Record<string, { w: number; h: number }> = {
  circle:    { w: 76, h: 76 },
  rectangle: { w: 120, h: 76 },
  oval:      { w: 100, h: 80 },
};

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
  chineseName: string | null;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  side: string | null;          // GROOM | BRIDE
  relationship: string | null;  // PARENT | SIBLING | RELATIVE | FRIEND | COLLEAGUE | BUSINESS | OTHER
  invitedBy: string | null;     // who invited this guest
  category: string | null;      // RELATIVES | FRIENDS | COLLEAGUES | BUSINESS | PARENTS_GUESTS | OTHER
  tableNumber: number | null;
  invitationCode: string;
  rsvpStatus: string;
  plusOne: boolean;
  plusOneName: string | null;
  seatCount: number;
  dietaryNotes: string | null;
  isVip: boolean;
  isElderly: boolean;
  needsBabyChair: boolean;
  specialNotes: string | null;
  sentVia: string | null;
  sentAt: string | null;
  checkInStatus: string | null;
  checkInTime: string | null;
  actualPartySize: number | null;
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
  chineseName: string;
  email: string;
  phone: string;
  groupName: string;
  side: string;
  relationship: string;
  invitedBy: string;
  category: string;
  tableNumber: string;
  plusOne: boolean;
  plusOneName: string;
  seatCount: string;
  dietaryNotes: string;
  isVip: boolean;
  isElderly: boolean;
  needsBabyChair: boolean;
  specialNotes: string;
}

export const emptyGuestForm: GuestFormData = {
  name: '',
  chineseName: '',
  email: '',
  phone: '',
  groupName: '',
  side: '',
  relationship: '',
  invitedBy: '',
  category: '',
  tableNumber: '',
  plusOne: false,
  plusOneName: '',
  seatCount: '1',
  dietaryNotes: '',
  isVip: false,
  isElderly: false,
  needsBabyChair: false,
  specialNotes: '',
};

export interface GuestStats {
  total: number;
  groomSide: number;
  brideSide: number;
  unassignedSide: number;
  attending: number;
  declined: number;
  pending: number;
  partial: number;
  totalSeats: number;
  checkedIn: number;
  notArrived: number;
  noShow: number;
  vipCount: number;
  elderlyCount: number;
  babyChairCount: number;
  unassignedTable: number;
  byCategory: Record<string, number>;
  byRelationship: Record<string, number>;
}

// ---- CSV Import types & helpers ----
export type ImportStep = 'upload' | 'preview' | 'result';

export interface ParsedRow {
  name: string;
  chineseName: string;
  email: string;
  phone: string;
  group: string;
  groupName: string;
  GroupName: string;
  side: string;
  relationship: string;
  invitedBy: string;
  category: string;
  tableNumber: string;
  plusOne: string;
  plusOneName: string;
  seatCount: string;
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

export const CSV_TEMPLATE_HEADERS = 'name,chineseName,email,phone,group,side,relationship,category,tableNumber,dietaryNotes,rsvpStatus';

const REFERENCE_ROWS = [
  'Reference ↓, , , , ,Valid Options ↓,Valid Options ↓,Valid Options ↓, ,Valid Options ↓,Valid Options ↓',
  ', , , , ,GROOM or BRIDE,PARENT / SIBLING / RELATIVE / FRIEND / COLLEAGUE / BUSINESS / OTHER,RELATIVES / FRIENDS / COLLEAGUES / BUSINESS / PARENTS_GUESTS / OTHER, ,Free text e.g. Halal / Vegetarian / No Seafood / Vegan / No Nuts,PENDING / ATTENDING / DECLINED / PARTIAL',
];

const EXAMPLE_ROWS = [
  'John Smith,陈大明,john@email.com,+65 9123 4567,Bride\'s Family,BRIDE,RELATIVE,RELATIVES,1,Vegetarian,ATTENDING',
  'Mary Tan,陈美玲,mary@email.com,+65 8765 4321,Groom\'s Friends,GROOM,FRIEND,FRIENDS,2,Halal,ATTENDING',
  'Ahmad Bin Ali,阿末,Ahmad@email.com,+65 9876 5432,Groom\'s Relatives,GROOM,PARENT,PARENTS_GUESTS,3,No Seafood,ATTENDING',
  'Siti Binte Osman,斯蒂,siti@email.com,+65 8123 4567,Bride\'s Colleagues,BRIDE,COLLEAGUE,COLLEAGUES,,DECLINED',
];

export function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const cleanText = text.replace(/^\ufeff/, '');
  const lines = cleanText.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // RFC 4180 compliant: handles quoted fields containing commas
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') { inQ = true; }
        else if (ch === ',') { fields.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]).map((v) => v.replace(/^"|"$/g, ''));
    const row: ParsedRow = {} as ParsedRow;
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
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
  const sideRaw = (n.side || '').toUpperCase().trim();
  const side = ['GROOM', 'BRIDE'].includes(sideRaw) ? sideRaw : undefined;
  const seatCount = parseInt(n.seatcount || '1', 10) || 1;
  return {
    name: (n.name || '').trim(),
    chineseName: (n.chinesename || '').trim() || undefined,
    email: (n.email || '').trim() || undefined,
    phone: (n.phone || '').trim() || undefined,
    group: (n.group || n.groupname || '').trim() || undefined,
    side,
    relationship: (n.relationship || '').trim() || undefined,
    invitedBy: (n.invitedby || '').trim() || undefined,
    category: (n.category || '').trim() || undefined,
    tableNumber,
    plusOne: ['yes', 'true', '1', 'y'].includes((n.plusone || '').toLowerCase()),
    plusOneName: (n.plusonename || '').trim() || undefined,
    seatCount,
    dietaryNotes: (n.dietarynotes || n.dietary || '').trim() || undefined,
    rsvpStatus,
    isVip: ['yes', 'true', '1', 'y'].includes((n.isvip || '').toLowerCase()),
    isElderly: ['yes', 'true', '1', 'y'].includes((n.iselderly || '').toLowerCase()),
    needsBabyChair: ['yes', 'true', '1', 'y'].includes((n.needsbabychair || '').toLowerCase()),
    specialNotes: (n.specialnotes || '').trim() || undefined,
  };
}

export function downloadCSVTemplate() {
  const csv = [CSV_TEMPLATE_HEADERS, ...EXAMPLE_ROWS, '', ...REFERENCE_ROWS].join('\n');
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

export function getCheckInStatusConfig(status: string) {
  return CHECKIN_STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-50 text-gray-600 border-gray-200' };
}

export function getGuestDisplayName(guest: GuestItem): string {
  if (guest.chineseName && guest.name) return `${guest.name} (${guest.chineseName})`;
  return guest.name;
}

export function getGuestSeatCount(guest: GuestItem): number {
  if (guest.actualPartySize != null && guest.actualPartySize > 0) return guest.actualPartySize;
  return guest.seatCount || 1;
}
