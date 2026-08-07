'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, Users, Search, Mail, Phone, UserPlus,
  Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, UtensilsCrossed,
  ZoomIn, ZoomOut, GripVertical, Circle, Square, CircleEllipsis,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

// ---- Constants ----
const API_BASE = '/api/cms/guests?XTransformPort=3000';
const TABLES_API = '/api/cms/tables?XTransformPort=3000';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ATTENDING: { label: 'Attending', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DECLINED: { label: 'Declined', color: 'bg-red-50 text-red-600 border-red-200' },
  PARTIAL: { label: 'Partial', color: 'bg-sky-50 text-sky-700 border-sky-200' },
};

// Table shape sizes (base px)
const TABLE_DIMS: Record<string, { w: number; h: number }> = {
  circle:    { w: 76, h: 76 },
  rectangle: { w: 120, h: 76 },
  oval:      { w: 100, h: 80 },
};

const SHAPE_ICONS: Record<string, React.ReactNode> = {
  circle: <Circle className="size-3.5" />,
  rectangle: <Square className="size-3.5" />,
  oval: <CircleEllipsis className="size-3.5" />,
};

// ---- Interfaces ----
interface RsvpGuestResponse {
  dietary: string | null;
  name: string;
  attendance: string;
}

interface RsvpSubmissionBrief {
  id: string;
  createdAt: string;
  guests: RsvpGuestResponse[];
}

interface GuestItem {
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

interface SeatingTableItem {
  id: string;
  tableNum: number;
  shape: string;
  capacity: number;
  posX: number;
  posY: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  groupName: string;
  tableNumber: string;
  plusOne: boolean;
  plusOneName: string;
  dietaryNotes: string;
}

const emptyForm: FormData = {
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
type ImportStep = 'upload' | 'preview' | 'result';

interface ParsedRow {
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

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; name: string; error: string }>;
}

const CSV_TEMPLATE_HEADERS = 'name,email,phone,group,tableNumber,plusOne,plusOneName,dietaryNotes';
const CSV_TEMPLATE_EXAMPLE = "John Smith,john@email.com,+65 9123 4567,Bride's Family,1,yes,Jane Smith,Vegetarian";

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
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

function resolveFieldName(row: ParsedRow): string {
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === 'name') return row[key];
  }
  return '';
}

function normalizeRow(row: ParsedRow): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    const normKey = key.toLowerCase().replace(/\s+/g, '');
    normalized[normKey] = row[key];
  }
  return normalized;
}

function rowToPayload(row: ParsedRow) {
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

function downloadTemplate() {
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
function getEffectiveDietary(guest: GuestItem): string | null {
  const rsvpDietary = guest.rsvps?.[0]?.guests
    ?.map((g) => g.dietary)
    .filter((d): d is string => !!d && d.trim().length > 0)
    .join('; ');
  return guest.dietaryNotes || rsvpDietary || null;
}

function truncate(str: string, len: number) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// ---- Main Component ----
export default function CoupleGuests() {
  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<'guests' | 'seating'>('guests');

  // --- Guest state ---
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // --- CSV Import state ---
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDragOver, setImportDragOver] = useState(false);

  const [exporting, setExporting] = useState(false);

  // --- Seating state ---
  const [tables, setTables] = useState<SeatingTableItem[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [canvasScale, setCanvasScale] = useState(100);
  const [reassigningGuestId, setReassigningGuestId] = useState<string | null>(null);

  // Seating panel edit state
  const [editingTableNum, setEditingTableNum] = useState('');
  const [editingShape, setEditingShape] = useState('circle');
  const [editingCapacity, setEditingCapacity] = useState(8);
  const [editingNotes, setEditingNotes] = useState('');
  const [savingTable, setSavingTable] = useState(false);

  // Drag state
  const dragRef = useRef<{ tableId: string; startX: number; startY: number; origPosX: number; origPosY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ======== Guest CRUD ========
  const fetchGuests = useCallback(async () => {
    try {
      setLoading(true);
      let url = API_BASE;
      const params = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (statusFilter !== 'all') params.push(`status=${statusFilter}`);
      if (params.length > 0) url += '&' + params.join('&');
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load guests');
      const data = await res.json();
      setGuests(data.guests ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load guest list', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  // Fetch guests without search/filter (for seating)
  const fetchAllGuests = useCallback(async () => {
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load guests');
      const data = await res.json();
      setGuests(data.guests ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'guests') fetchGuests();
  }, [fetchGuests, activeTab]);

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: GuestItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      email: item.email ?? '',
      phone: item.phone ?? '',
      groupName: item.groupName ?? '',
      tableNumber: item.tableNumber != null ? String(item.tableNumber) : '',
      plusOne: item.plusOne,
      plusOneName: item.plusOneName ?? '',
      dietaryNotes: item.dietaryNotes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Guest name is required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        groupName: form.groupName.trim() || undefined,
        tableNumber: form.tableNumber ? parseInt(form.tableNumber, 10) : undefined,
        plusOne: form.plusOne,
        plusOneName: form.plusOne.trim() || undefined,
        dietaryNotes: form.dietaryNotes.trim() || undefined,
      };
      let res: Response;
      if (editingId) {
        res = await fetch(API_BASE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save guest');
      }
      invalidateWeddingCache();
      toast({ title: 'Success', description: editingId ? 'Guest updated successfully' : 'Guest added successfully' });
      setDialogOpen(false);
      fetchGuests();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save guest', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this guest? This action cannot be undone.')) return;
    try {
      setDeleting(id);
      const res = await fetch(`${API_BASE}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete guest');
      }
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Guest deleted' });
      fetchGuests();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete guest', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const getStatusConfig = (status: string) => STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-50 text-gray-600 border-gray-200' };

  // ======== CSV Import handlers ========
  const resetImportState = () => {
    setImportStep('upload');
    setImportFile(null);
    setImportRows([]);
    setImportHeaders([]);
    setImporting(false);
    setImportResult(null);
    setImportDragOver(false);
  };

  const openImportDialog = () => {
    resetImportState();
    setImportOpen(true);
  };

  const handleImportFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Error', description: 'Please select a .csv file', variant: 'destructive' });
      return;
    }
    setImportFile(file);
  };

  const handleImportNext = async () => {
    if (!importFile) return;
    try {
      const text = await importFile.text();
      const { headers, rows } = parseCSV(text);
      if (rows.length === 0) {
        toast({ title: 'Error', description: 'CSV file is empty or has no data rows', variant: 'destructive' });
        return;
      }
      setImportHeaders(headers);
      setImportRows(rows);
      setImportStep('preview');
    } catch {
      toast({ title: 'Error', description: 'Failed to read CSV file', variant: 'destructive' });
    }
  };

  const handleImportSubmit = async () => {
    try {
      setImporting(true);
      const guests_payload = importRows.map(rowToPayload);
      const res = await fetch('/api/cms/guests/bulk?XTransformPort=3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: guests_payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Import failed');
      }
      const data: ImportResult = await res.json();
      setImportResult(data);
      setImportStep('result');
      invalidateWeddingCache();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Import failed', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportClose = () => {
    setImportOpen(false);
    if (importStep === 'result') fetchGuests();
    resetImportState();
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await fetch('/api/cms/export?XTransformPort=3000&type=guests');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guests-export.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Success', description: 'Export downloaded' });
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // ======== Seating Table CRUD ========
  const fetchTables = useCallback(async () => {
    try {
      setTablesLoading(true);
      const res = await fetch(TABLES_API);
      if (!res.ok) throw new Error('Failed to load tables');
      const data = await res.json();
      setTables(data.tables ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load seating tables', variant: 'destructive' });
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'seating') {
      fetchTables();
      fetchAllGuests();
    }
  }, [activeTab, fetchTables, fetchAllGuests]);

  const handleAddTable = async () => {
    const maxNum = tables.length > 0 ? Math.max(...tables.map((t) => t.tableNum)) : 0;
    const newNum = maxNum + 1;
    // Stagger positions
    const offset = (newNum - 1) * 180;
    const col = offset % 720;
    const row = Math.floor(offset / 720) * 180;
    try {
      const res = await fetch(TABLES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNum: newNum,
          shape: 'circle',
          capacity: 8,
          posX: 120 + col,
          posY: 120 + row,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create table');
      }
      await fetchTables();
      toast({ title: 'Success', description: `Table ${newNum} added` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to add table', variant: 'destructive' });
    }
  };

  const handleDeleteTable = async () => {
    const tbl = tables.find((t) => t.id === selectedTableId);
    if (!tbl) return;
    if (!confirm(`Delete Table ${tbl.tableNum}? All guests at this table will be unassigned.`)) return;
    try {
      const res = await fetch(`${TABLES_API}&id=${tbl.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete table');
      setSelectedTableId(null);
      await fetchTables();
      await fetchAllGuests();
      toast({ title: 'Success', description: `Table ${tbl.tableNum} deleted` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete table', variant: 'destructive' });
    }
  };

  const handleSaveTableEdits = async () => {
    if (!selectedTableId) return;
    try {
      setSavingTable(true);
      const res = await fetch(TABLES_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTableId,
          tableNum: parseInt(editingTableNum, 10),
          shape: editingShape,
          capacity: editingCapacity,
          notes: editingNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update table');
      }
      await fetchTables();
      toast({ title: 'Success', description: 'Table updated' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update table', variant: 'destructive' });
    } finally {
      setSavingTable(false);
    }
  };

  // When a table is selected, populate edit fields
  useEffect(() => {
    const tbl = tables.find((t) => t.id === selectedTableId);
    if (tbl) {
      setEditingTableNum(String(tbl.tableNum));
      setEditingShape(tbl.shape || 'circle');
      setEditingCapacity(tbl.capacity || 8);
      setEditingNotes(tbl.notes || '');
    }
  }, [selectedTableId, tables]);

  // ======== Guest Reassignment ========
  const handleReassignGuest = async (guestId: string, newTableNum: number | null) => {
    const guest = guests.find((g) => g.id === guestId);
    if (!guest) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          name: guest.name,
          tableNumber: newTableNum,
        }),
      });
      if (!res.ok) throw new Error('Failed to reassign guest');
      invalidateWeddingCache();
      await fetchAllGuests();
      toast({ title: 'Success', description: `${guest.name} moved to ${newTableNum != null ? `Table ${newTableNum}` : 'unassigned'}` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to reassign guest', variant: 'destructive' });
    }
  };

  // Canvas click: if a guest is selected and we click a table, reassign them
  const handleCanvasTableClick = (tableId: string) => {
    if (reassigningGuestId) {
      const tbl = tables.find((t) => t.id === tableId);
      if (tbl) {
        handleReassignGuest(reassigningGuestId, tbl.tableNum);
      }
      setReassigningGuestId(null);
    } else {
      setSelectedTableId(tableId === selectedTableId ? null : tableId);
    }
  };

  const handleCanvasGuestClick = (guestId: string) => {
    if (reassigningGuestId === guestId) {
      setReassigningGuestId(null);
    } else {
      setReassigningGuestId(guestId);
    }
  };

  // ======== Drag handlers ========
  const handleDragStart = (e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    const tbl = tables.find((t) => t.id === tableId);
    if (!tbl) return;
    dragRef.current = {
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      origPosX: tbl.posX,
      origPosY: tbl.posY,
    };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / (canvasScale / 100);
      const dy = (ev.clientY - dragRef.current.startY) / (canvasScale / 100);
      const newPosX = Math.max(0, dragRef.current.origPosX + dx);
      const newPosY = Math.max(0, dragRef.current.origPosY + dy);
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, posX: newPosX, posY: newPosY } : t))
      );
    };

    const handleUp = async () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (!dragRef.current) return;
      const moved = tables.find((t) => t.id === tableId);
      if (!moved) { dragRef.current = null; return; }
      // Persist position
      try {
        await fetch(TABLES_API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: tableId, posX: moved.posX, posY: moved.posY }),
        });
      } catch {
        // silent persist
      }
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  // ======== Derived data for seating ========
  const selectedTable = tables.find((t) => t.id === selectedTableId);

  const guestsAtTable = (tableNum: number) =>
    guests.filter((g) => g.tableNumber === tableNum);

  const unassignedGuests = guests.filter((g) => g.tableNumber == null);

  const getGuestCountForTable = (tableNum: number) =>
    guests.filter((g) => g.tableNumber === tableNum).length;

  // ======== Loading ========
  if (loading && activeTab === 'guests') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading your guest list…</p>
      </div>
    );
  }

  // ======== Render ========
  return (
    <div className="space-y-6">
      {/* Page Header — above tabs */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-charcoal-ink">Guest Management</h2>
          <p className="text-sm text-charcoal-ink/50 mt-1">
            Manage your guest list, track RSVPs, and arrange seating.{' '}
            <span className="text-charcoal-ink/70 font-medium">{guests.length} guest{guests.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'guests' && (
            <>
              <Button
                onClick={openImportDialog}
                variant="outline"
                className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
              >
                <Upload className="size-4 mr-1.5" />
                Import CSV
              </Button>
              <Button
                onClick={handleExportCSV}
                disabled={exporting}
                variant="outline"
                className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
              >
                {exporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />}
                Export CSV
              </Button>
              <Button
                onClick={openAddDialog}
                className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
              >
                <Plus className="size-4 mr-1.5" />
                Add Guest
              </Button>
            </>
          )}
          {activeTab === 'seating' && (
            <Button
              onClick={handleAddTable}
              className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
            >
              <Plus className="size-4 mr-1.5" />
              Add Table
            </Button>
          )}
        </div>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* ======== TABS ======== */}
      <div className="flex gap-6 border-b border-champagne-silk">
        <button
          type="button"
          onClick={() => setActiveTab('guests')}
          className={`pb-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 ${
            activeTab === 'guests'
              ? 'text-cinematic-gold border-b-2 border-cinematic-gold'
              : 'text-charcoal-ink/40 hover:text-charcoal-ink/70'
          }`}
        >
          Guest List
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('seating')}
          className={`pb-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 ${
            activeTab === 'seating'
              ? 'text-cinematic-gold border-b-2 border-cinematic-gold'
              : 'text-charcoal-ink/40 hover:text-charcoal-ink/70'
          }`}
        >
          Seating
        </button>
      </div>

      {/* ======== GUEST LIST TAB ======== */}
      {activeTab === 'guests' && (
        <>
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-charcoal-ink/30" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone…"
                className="pl-9 border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ATTENDING">Attending</SelectItem>
                <SelectItem value="DECLINED">Declined</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Empty state */}
          {guests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="size-10 text-champagne-silk" />
              <p className="text-sm text-charcoal-ink/40 font-medium">
                {search || statusFilter !== 'all' ? 'No guests match your filters' : 'No guests yet'}
              </p>
              <p className="text-xs text-charcoal-ink/30">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : 'Click "Add Guest" to start building your guest list.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block max-h-[500px] overflow-y-auto custom-scrollbar rounded-lg border border-charcoal-ink/5">
                <Table>
                  <TableHeader className="sticky top-0 bg-paper-cream z-10">
                    <TableRow className="border-charcoal-ink/5 hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">Name</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">Email</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">Phone</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">Group</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">Table #</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">Dietary</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50 w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guests.map((guest) => {
                      const sc = getStatusConfig(guest.rsvpStatus);
                      const dietary = getEffectiveDietary(guest);
                      return (
                        <TableRow key={guest.id} className="border-charcoal-ink/5">
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-charcoal-ink">{guest.name}</span>
                              <Badge variant="outline" className={`text-[10px] font-medium ${sc.color}`}>
                                {sc.label}
                              </Badge>
                              {guest.plusOne && (
                                <Badge variant="outline" className="text-[10px] font-medium bg-pink-50 text-pink-600 border-pink-200">
                                  <UserPlus className="size-2.5 mr-0.5" />
                                  +1
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-charcoal-ink/50 truncate max-w-[160px]">
                            {guest.email || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-charcoal-ink/50">
                            {guest.phone || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-charcoal-ink/50">
                            {guest.groupName || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {guest.tableNumber != null ? (
                              <button
                                type="button"
                                onClick={() => { setActiveTab('seating'); }}
                                className="text-cinematic-gold font-medium hover:underline"
                              >
                                Table {guest.tableNumber}
                              </button>
                            ) : (
                              <span className="text-charcoal-ink/30">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {dietary ? (
                              <span className="inline-flex items-center gap-1 text-red-600/80">
                                <UtensilsCrossed className="size-3 shrink-0" />
                                <span className="truncate max-w-[100px]">{truncate(dietary, 18)}</span>
                              </span>
                            ) : (
                              <span className="text-charcoal-ink/30">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(guest)}
                                className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(guest.id)}
                                disabled={deleting === guest.id}
                                className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                              >
                                {deleting === guest.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View (shown on mobile only) */}
              <div className="md:hidden space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                {guests.map((guest) => {
                  const sc = getStatusConfig(guest.rsvpStatus);
                  const dietary = getEffectiveDietary(guest);
                  return (
                    <Card
                      key={guest.id}
                      className="border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <h3 className="text-sm font-semibold text-charcoal-ink">{guest.name}</h3>
                              <Badge variant="outline" className={`text-[10px] font-medium ${sc.color}`}>
                                {sc.label}
                              </Badge>
                              {guest.plusOne && (
                                <Badge variant="outline" className="text-[10px] font-medium bg-pink-50 text-pink-600 border-pink-200">
                                  <UserPlus className="size-2.5 mr-0.5" />+1
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap text-xs text-charcoal-ink/50">
                              {guest.email && (
                                <span className="flex items-center gap-1"><Mail className="size-3" />{guest.email}</span>
                              )}
                              {guest.phone && (
                                <span className="flex items-center gap-1"><Phone className="size-3" />{guest.phone}</span>
                              )}
                              {guest.groupName && <span>Group: {guest.groupName}</span>}
                              {guest.tableNumber != null && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('seating')}
                                  className="text-cinematic-gold font-medium"
                                >
                                  Table {guest.tableNumber}
                                </button>
                              )}
                            </div>
                            {guest.plusOneName && (
                              <p className="text-xs text-charcoal-ink/40 mt-1">Plus one: {guest.plusOneName}</p>
                            )}
                            {dietary && (
                              <p className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1">
                                <UtensilsCrossed className="size-3" />
                                {dietary}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(guest)}
                              className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(guest.id)}
                              disabled={deleting === guest.id}
                              className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                            >
                              {deleting === guest.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ======== SEATING TAB ======== */}
      {activeTab === 'seating' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Canvas Area */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* Scale slider */}
            <div className="flex items-center gap-3 px-1">
              <ZoomOut className="size-4 text-charcoal-ink/40 shrink-0" />
              <Slider
                value={[canvasScale]}
                onValueChange={(v) => setCanvasScale(v[0])}
                min={50}
                max={200}
                step={10}
                className="flex-1"
              />
              <ZoomIn className="size-4 text-charcoal-ink/40 shrink-0" />
              <span className="text-xs text-charcoal-ink/50 font-medium w-10 text-right">{canvasScale}%</span>
            </div>

            {/* Reassigning indicator */}
            {reassigningGuestId && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <AlertCircle className="size-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">
                  Click a table to move <strong>{guests.find((g) => g.id === reassigningGuestId)?.name}</strong> there.
                </p>
                <button
                  type="button"
                  onClick={() => setReassigningGuestId(null)}
                  className="ml-auto text-xs text-amber-600 underline hover:text-amber-800"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Canvas */}
            <div
              ref={canvasRef}
              className="relative border border-champagne-silk rounded-lg bg-white overflow-hidden"
              style={{ height: '520px' }}
              onClick={(e) => {
                // Click on empty canvas deselects
                if (e.target === e.currentTarget) {
                  if (reassigningGuestId) {
                    setReassigningGuestId(null);
                  }
                  setSelectedTableId(null);
                }
              }}
            >
              {tablesLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-cinematic-gold" />
                </div>
              ) : tables.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Users className="size-10 text-champagne-silk" />
                  <p className="text-sm text-charcoal-ink/40 font-medium">No tables yet</p>
                  <p className="text-xs text-charcoal-ink/30">Click "Add Table" to start arranging seating.</p>
                </div>
              ) : (
                <div
                  style={{
                    transform: `scale(${canvasScale / 100})`,
                    transformOrigin: 'top left',
                    width: `${2000 * (100 / canvasScale)}px`,
                    height: `${2000 * (100 / canvasScale)}px`,
                  }}
                  className="relative"
                >
                  {tables.map((tbl) => {
                    const dims = TABLE_DIMS[tbl.shape] || TABLE_DIMS.circle;
                    const count = getGuestCountForTable(tbl.tableNum);
                    const isOverCapacity = count > tbl.capacity;
                    const isEmpty = count === 0;
                    const isSelected = tbl.id === selectedTableId;
                    const tableGuests = guestsAtTable(tbl.tableNum);

                    // Border color logic
                    let borderCls = 'border-gray-300';
                    if (isSelected) {
                      borderCls = 'border-cinematic-gold';
                    } else if (isOverCapacity) {
                      borderCls = 'border-red-400';
                    } else if (!isEmpty) {
                      borderCls = 'border-cinematic-gold/60';
                    }

                    // Shape
                    let shapeCls = 'rounded-full';
                    if (tbl.shape === 'rectangle') shapeCls = 'rounded-md';
                    if (tbl.shape === 'oval') shapeCls = 'rounded-[50%]';

                    return (
                      <div
                        key={tbl.id}
                        className="absolute"
                        style={{
                          left: tbl.posX,
                          top: tbl.posY,
                          width: dims.w,
                          height: dims.h,
                        }}
                      >
                        {/* Table shape */}
                        <div
                          onMouseDown={(e) => handleDragStart(e, tbl.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCanvasTableClick(tbl.id);
                          }}
                          className={`absolute inset-0 border-2 ${borderCls} ${shapeCls} bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-shadow duration-200 ${
                            isSelected ? 'shadow-[0_0_0_3px_rgba(212,175,55,0.3)] ring-2 ring-cinematic-gold/30' : 'hover:shadow-md'
                          } ${reassigningGuestId && !isSelected ? 'hover:border-cinematic-gold hover:bg-cinematic-gold/5' : ''}`}
                        >
                          <span className="text-xs font-bold text-charcoal-ink">T{tbl.tableNum}</span>
                          <span className={`text-[10px] font-medium ${isOverCapacity ? 'text-red-500' : 'text-charcoal-ink/50'}`}>
                            {count}/{tbl.capacity}
                          </span>
                          {tbl.notes && (
                            <span className="text-[8px] text-charcoal-ink/30 mt-0.5 max-w-[60px] truncate text-center leading-tight">
                              {tbl.notes}
                            </span>
                          )}
                        </div>

                        {/* Guest labels around table */}
                        {tableGuests.map((guest, gi) => {
                          const dietary = getEffectiveDietary(guest);
                          const angle = (gi / Math.max(tableGuests.length, 1)) * 2 * Math.PI - Math.PI / 2;
                          const radius = (dims.w / 2) + 40;
                          const gx = dims.w / 2 + Math.cos(angle) * radius - 50;
                          const gy = dims.h / 2 + Math.sin(angle) * radius - 10;

                          return (
                            <Tooltip key={guest.id}>
                              <TooltipTrigger asChild>
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCanvasGuestClick(guest.id);
                                  }}
                                  className={`absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap cursor-pointer transition-colors duration-150 ${
                                    reassigningGuestId === guest.id
                                      ? 'bg-cinematic-gold text-charcoal-ink ring-2 ring-cinematic-gold/50'
                                      : 'bg-white border border-charcoal-ink/10 text-charcoal-ink/70 hover:border-cinematic-gold hover:text-charcoal-ink'
                                  }`}
                                  style={{
                                    left: Math.max(0, gx),
                                    top: Math.max(0, gy),
                                  }}
                                >
                                  {guest.name.split(' ')[0]}
                                  {dietary && <UtensilsCrossed className="size-2 text-red-400 shrink-0" />}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-charcoal-ink text-white border-none text-[11px]"
                              >
                                <p className="font-medium">{guest.name}</p>
                                {guest.phone && <p className="text-white/70">{guest.phone}</p>}
                                {dietary && <p className="text-red-300">🍽 {dietary}</p>}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Side Panel (desktop) / Bottom Sheet area (handled via responsive) */}
          {selectedTable && (
            <div className="w-full lg:w-72 shrink-0 space-y-4">
              {/* Desktop panel */}
              <div className="hidden lg:block rounded-lg border border-champagne-silk bg-paper-cream p-4 space-y-4 max-h-[580px] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-[0.08em]">
                    Table {selectedTable.tableNum}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteTable}
                    className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <Separator className="bg-champagne-silk" />

                {/* Edit fields */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-charcoal-ink/70">Table Number</Label>
                    <Input
                      value={editingTableNum}
                      onChange={(e) => setEditingTableNum(e.target.value)}
                      type="number"
                      className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-charcoal-ink/70">Shape</Label>
                    <Select value={editingShape} onValueChange={setEditingShape}>
                      <SelectTrigger className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="circle">
                          <span className="flex items-center gap-2">{SHAPE_ICONS.circle} Circle</span>
                        </SelectItem>
                        <SelectItem value="rectangle">
                          <span className="flex items-center gap-2">{SHAPE_ICONS.rectangle} Rectangle</span>
                        </SelectItem>
                        <SelectItem value="oval">
                          <span className="flex items-center gap-2">{SHAPE_ICONS.oval} Oval</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-charcoal-ink/70">Capacity</Label>
                    <Input
                      value={editingCapacity}
                      onChange={(e) => setEditingCapacity(parseInt(e.target.value, 10) || 1)}
                      type="number"
                      min={1}
                      max={50}
                      className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-charcoal-ink/70">Notes</Label>
                    <Textarea
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="e.g. Near bar, VIP"
                      className="text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 min-h-[60px]"
                    />
                  </div>

                  <Button
                    onClick={handleSaveTableEdits}
                    disabled={savingTable}
                    className="w-full bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50"
                  >
                    {savingTable ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                    Save Changes
                  </Button>
                </div>

                <Separator className="bg-champagne-silk" />

                {/* Guests at this table */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">
                    Guests ({getGuestCountForTable(selectedTable.tableNum)})
                  </h4>
                  <div className="space-y-1.5">
                    {guestsAtTable(selectedTable.tableNum).map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-charcoal-ink/5 px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-charcoal-ink truncate">{g.name}</p>
                          {g.dietaryNotes && (
                            <p className="text-[10px] text-red-500/70 flex items-center gap-0.5">
                              <UtensilsCrossed className="size-2.5" />{truncate(g.dietaryNotes, 20)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReassignGuest(g.id, null)}
                          className="text-[10px] text-red-400 hover:text-red-600 shrink-0 underline"
                          title="Unassign"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {getGuestCountForTable(selectedTable.tableNum) === 0 && (
                      <p className="text-xs text-charcoal-ink/30 italic">No guests assigned</p>
                    )}
                  </div>
                </div>

                <Separator className="bg-champagne-silk" />

                {/* Unassigned guests */}
                {unassignedGuests.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">
                      Unassigned ({unassignedGuests.length})
                    </h4>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {unassignedGuests.map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-charcoal-ink/5 px-2.5 py-1.5"
                        >
                          <p className="text-xs font-medium text-charcoal-ink truncate min-w-0">{g.name}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReassignGuest(g.id, selectedTable.tableNum)}
                            className="h-6 px-2 text-[10px] text-cinematic-gold hover:bg-cinematic-gold/10 shrink-0"
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile bottom panel (shown on mobile/tablet) */}
              <div className="lg:hidden rounded-lg border border-champagne-silk bg-paper-cream p-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-[0.08em]">
                    Table {selectedTable.tableNum}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteTable}
                      className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTableId(null)}
                      className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-charcoal-ink"
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                <Separator className="bg-champagne-silk" />

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-charcoal-ink/70">Table Number</Label>
                    <Input
                      value={editingTableNum}
                      onChange={(e) => setEditingTableNum(e.target.value)}
                      type="number"
                      className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-charcoal-ink/70">Shape</Label>
                    <Select value={editingShape} onValueChange={setEditingShape}>
                      <SelectTrigger className="h-8 text-sm border-charcoal-ink/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="circle">Circle</SelectItem>
                        <SelectItem value="rectangle">Rectangle</SelectItem>
                        <SelectItem value="oval">Oval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-charcoal-ink/70">Capacity</Label>
                    <Input
                      value={editingCapacity}
                      onChange={(e) => setEditingCapacity(parseInt(e.target.value, 10) || 1)}
                      type="number"
                      min={1}
                      max={50}
                      className="h-8 text-sm border-charcoal-ink/10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-charcoal-ink/70">Notes</Label>
                    <Textarea
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="e.g. Near bar, VIP"
                      className="text-sm border-charcoal-ink/10 min-h-[50px]"
                    />
                  </div>

                  <Button
                    onClick={handleSaveTableEdits}
                    disabled={savingTable}
                    className="w-full bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded text-[13px] font-medium uppercase tracking-[0.08em] disabled:opacity-50"
                  >
                    {savingTable ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                    Save Changes
                  </Button>
                </div>

                <Separator className="bg-champagne-silk" />

                {/* Mobile: guests at table */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">
                    Guests ({getGuestCountForTable(selectedTable.tableNum)})
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                    {guestsAtTable(selectedTable.tableNum).map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-charcoal-ink/5 px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-charcoal-ink truncate">{g.name}</p>
                          {g.dietaryNotes && (
                            <p className="text-[10px] text-red-500/70 flex items-center gap-0.5">
                              <UtensilsCrossed className="size-2.5" />{truncate(g.dietaryNotes, 20)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReassignGuest(g.id, null)}
                          className="text-[10px] text-red-400 hover:text-red-600 shrink-0 underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {getGuestCountForTable(selectedTable.tableNum) === 0 && (
                      <p className="text-xs text-charcoal-ink/30 italic">No guests assigned</p>
                    )}
                  </div>
                </div>

                {/* Mobile: unassigned guests */}
                {unassignedGuests.length > 0 && (
                  <>
                    <Separator className="bg-champagne-silk" />
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">
                        Unassigned ({unassignedGuests.length})
                      </h4>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                        {unassignedGuests.map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-charcoal-ink/5 px-2.5 py-1.5"
                          >
                            <p className="text-xs font-medium text-charcoal-ink truncate min-w-0">{g.name}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReassignGuest(g.id, selectedTable.tableNum)}
                              className="h-6 px-2 text-[10px] text-cinematic-gold hover:bg-cinematic-gold/10 shrink-0"
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======== CSV Import Dialog ======== */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) handleImportClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">Import Guests from CSV</DialogTitle>
            <DialogDescription className="text-charcoal-ink/50">
              {importStep === 'upload' && 'Upload a CSV file with your guest list.'}
              {importStep === 'preview' && 'Review the guests before importing.'}
              {importStep === 'result' && 'Import completed.'}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Upload */}
          {importStep === 'upload' && (
            <div className="space-y-4 py-2">
              <div
                onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                onDragLeave={() => setImportDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setImportDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleImportFileSelect(file);
                }}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-200 ${
                  importDragOver
                    ? 'border-cinematic-gold bg-cinematic-gold/5'
                    : importFile
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-charcoal-ink/10 hover:border-charcoal-ink/20'
                }`}
              >
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="csv-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFileSelect(file);
                  }}
                />
                {importFile ? (
                  <div className="space-y-2">
                    <FileSpreadsheet className="size-10 text-emerald-500 mx-auto" />
                    <p className="text-sm font-medium text-charcoal-ink">{importFile.name}</p>
                    <p className="text-xs text-charcoal-ink/40">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setImportFile(null);
                        const input = document.getElementById('csv-file-input') as HTMLInputElement;
                        if (input) input.value = '';
                      }}
                      className="text-xs text-charcoal-ink/40 underline hover:text-red-500 transition-colors"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="size-10 text-charcoal-ink/20 mx-auto" />
                    <p className="text-sm text-charcoal-ink/50">
                      Drag & drop your CSV file here, or{' '}
                      <button
                        type="button"
                        onClick={() => document.getElementById('csv-file-input')?.click()}
                        className="text-cinematic-gold font-medium underline hover:text-cinematic-gold/80 transition-colors"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-xs text-charcoal-ink/30">.csv files only</p>
                  </div>
                )}
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="text-xs text-cinematic-gold font-medium hover:underline transition-colors"
                >
                  ↓ Download CSV Template
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {importStep === 'preview' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/50">
                  Preview
                </p>
                <Badge variant="outline" className="text-[10px] font-medium bg-champagne-silk/30 text-charcoal-ink/70 border-champagne-silk">
                  {importRows.length} guest{importRows.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="rounded-xl border border-charcoal-ink/5 overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-champagne-silk/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-charcoal-ink/50 w-8">#</th>
                        <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-charcoal-ink/50">Name</th>
                        <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-charcoal-ink/50 hidden sm:table-cell">Email</th>
                        <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-charcoal-ink/50 hidden md:table-cell">Group</th>
                        <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-charcoal-ink/50 hidden md:table-cell">Table</th>
                        <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-charcoal-ink/50 hidden lg:table-cell">Plus One</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 10).map((row, idx) => {
                        const name = resolveFieldName(row);
                        const hasError = !name.trim();
                        const n = normalizeRow(row);
                        return (
                          <tr
                            key={idx}
                            className={`border-t border-charcoal-ink/5 ${hasError ? 'bg-red-50/60' : ''}`}
                          >
                            <td className="px-3 py-2 text-charcoal-ink/30 font-mono">{idx + 1}</td>
                            <td className={`px-3 py-2 ${hasError ? 'text-red-500 font-medium' : 'text-charcoal-ink'}`}>
                              {name || <span className="italic text-red-400">Missing name</span>}
                            </td>
                            <td className="px-3 py-2 text-charcoal-ink/50 hidden sm:table-cell truncate max-w-[160px]">
                              {n.email || '—'}
                            </td>
                            <td className="px-3 py-2 text-charcoal-ink/50 hidden md:table-cell">
                              {n.group || n.groupname || '—'}
                            </td>
                            <td className="px-3 py-2 text-charcoal-ink/50 hidden md:table-cell">
                              {n.tablenumber || n.table || '—'}
                            </td>
                            <td className="px-3 py-2 text-charcoal-ink/50 hidden lg:table-cell">
                              {['yes', 'true', '1', 'y'].includes((n.plusone || '').toLowerCase()) ? 'Yes' : 'No'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 10 && (
                  <div className="border-t border-charcoal-ink/5 px-3 py-2 bg-champagne-silk/20 text-center">
                    <p className="text-xs text-charcoal-ink/40">
                      …and {importRows.length - 10} more row{importRows.length - 10 !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>

              {importRows.some((r) => !resolveFieldName(r).trim()) && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <AlertCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Some rows are missing a <strong>name</strong> and will be skipped during import.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Result */}
          {importStep === 'result' && importResult && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <CheckCircle2 className="size-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Successfully imported {importResult.created} guest{importResult.created !== 1 ? 's' : ''}
                  </p>
                  {importResult.updated > 0 && (
                    <p className="text-xs text-sky-600/70 mt-0.5">
                      {importResult.updated} existing guest{importResult.updated !== 1 ? 's' : ''} matched &amp; updated
                      {importResult.created === 0 && ' (no new guests added)'}
                    </p>
                  )}
                  {importResult.skipped > 0 && (
                    <p className="text-xs text-amber-600/70 mt-0.5">
                      {importResult.skipped} row{importResult.skipped !== 1 ? 's' : ''} skipped due to errors
                    </p>
                  )}
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/50">
                    Errors ({importResult.errors.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 divide-y divide-red-100">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="px-3 py-2 flex items-start gap-2">
                        <AlertCircle className="size-3.5 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-red-700">
                            Row {err.row}: {err.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-red-500/70">{err.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            {importStep === 'upload' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(false)}
                  className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportNext}
                  disabled={!importFile}
                  className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50"
                >
                  Next
                </Button>
              </>
            )}
            {importStep === 'preview' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setImportStep('upload'); setImportRows([]); setImportHeaders([]); }}
                  className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
                >
                  Back
                </Button>
                <Button
                  onClick={handleImportSubmit}
                  disabled={importing}
                  className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Importing…
                    </>
                  ) : (
                    `Import ${importRows.length} Guest${importRows.length !== 1 ? 's' : ''}`
                  )}
                </Button>
              </>
            )}
            {importStep === 'result' && (
              <Button
                onClick={handleImportClose}
                className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Add/Edit Guest Dialog ======== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">
              {editingId ? 'Edit Guest' : 'Add New Guest'}
            </DialogTitle>
            <DialogDescription className="text-charcoal-ink/50">
              {editingId ? 'Update guest information below.' : 'Add a new guest to your wedding list.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="guest-name" className="text-sm font-medium text-charcoal-ink/70">
                Full Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="guest-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sarah Tan"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="guest-email" className="text-sm font-medium text-charcoal-ink/70">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="sarah@email.com"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-phone" className="text-sm font-medium text-charcoal-ink/70">Phone</Label>
                <Input
                  id="guest-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+65 9123 4567"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="guest-group" className="text-sm font-medium text-charcoal-ink/70">Group / Family</Label>
                <Input
                  id="guest-group"
                  value={form.groupName}
                  onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                  placeholder="e.g. Bride's Family"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-table" className="text-sm font-medium text-charcoal-ink/70">Table Number</Label>
                <Input
                  id="guest-table"
                  type="number"
                  value={form.tableNumber}
                  onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
                  placeholder="e.g. 5"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-charcoal-ink/5 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-charcoal-ink/70">Plus One</Label>
                <p className="text-xs text-charcoal-ink/40">Guest is allowed to bring a plus one</p>
              </div>
              <Switch
                checked={form.plusOne}
                onCheckedChange={(checked) => setForm({ ...form, plusOne: checked })}
              />
            </div>

            {form.plusOne && (
              <div className="space-y-1.5">
                <Label htmlFor="guest-plusone" className="text-sm font-medium text-charcoal-ink/70">Plus One Name</Label>
                <Input
                  id="guest-plusone"
                  value={form.plusOneName}
                  onChange={(e) => setForm({ ...form, plusOneName: e.target.value })}
                  placeholder="e.g. John Lim"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="guest-dietary" className="text-sm font-medium text-charcoal-ink/70">Dietary Notes</Label>
              <Input
                id="guest-dietary"
                value={form.dietaryNotes}
                onChange={(e) => setForm({ ...form, dietaryNotes: e.target.value })}
                placeholder="e.g. Vegetarian, nut allergy"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : editingId ? (
                'Update Guest'
              ) : (
                'Add Guest'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
