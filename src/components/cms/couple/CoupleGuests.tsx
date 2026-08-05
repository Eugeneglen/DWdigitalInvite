'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, Users, Search, Mail, Phone, UserPlus, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, UtensilsCrossed } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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

const API_BASE = '/api/cms/guests?XTransformPort=3000';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ATTENDING: { label: 'Attending', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DECLINED: { label: 'Declined', color: 'bg-red-50 text-red-600 border-red-200' },
  PARTIAL: { label: 'Partial', color: 'bg-sky-50 text-sky-700 border-sky-200' },
};

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
const CSV_TEMPLATE_EXAMPLE = 'John Smith,john@email.com,+65 9123 4567,Bride\'s Family,1,yes,Jane Smith,Vegetarian';

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  // Strip BOM character (\ufeff) that some CSV editors (incl. Excel) prepend
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
  // Case-insensitive lookup for the name field
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === 'name') return row[key];
  }
  return '';
}

/**
 * Normalize a row so that column names from the system's own export format
 * (capitalized, with spaces — e.g. "Plus One", "Dietary Notes", "RSVP Status")
 * are mapped to the lowercase camelCase keys the API expects.
 * Also handles the template format (already lowercase).
 */
function normalizeRow(row: ParsedRow): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    // Lowercase + remove spaces → "Plus One" → "plusone", "Dietary Notes" → "dietarynotes"
    const normKey = key.toLowerCase().replace(/\s+/g, '');
    normalized[normKey] = row[key];
  }
  return normalized;
}

function rowToPayload(row: ParsedRow) {
  const n = normalizeRow(row);

  // Table number: CSV export uses "Table 8" — extract the number
  const tableRaw = n.tablenumber || n.table || '';
  const tableMatch = tableRaw.match(/\d+/);
  const tableNumber = tableMatch ? parseInt(tableMatch[0], 10) : undefined;

  // RSVP status: map export values to DB enum values
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

export default function CoupleGuests() {
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // CSV Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDragOver, setImportDragOver] = useState(false);

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

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

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
      const res = await fetch(`${API_BASE}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

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

  // ---- CSV Import handlers ----
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
    if (importStep === 'result') {
      fetchGuests();
    }
    resetImportState();
  };

  const [exporting, setExporting] = useState(false);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading your guest list…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl font-semibold text-charcoal-ink">Guest Management</h2>
          <p className="text-sm text-charcoal-ink/50 mt-1">
            Manage your guest list, track RSVPs, and send invitations.{' '}
            <span className="text-charcoal-ink/70 font-medium">{guests.length} guest{guests.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={openImportDialog}
            variant="outline"
            className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-3 sm:px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
          >
            <Upload className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Import CSV</span>
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={exporting}
            variant="outline"
            className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-3 sm:px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
          >
            {exporting ? <Loader2 className="size-4 sm:mr-1.5 animate-spin" /> : <Download className="size-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button
            onClick={openAddDialog}
            className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-3 sm:px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
          >
            <Plus className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Add Guest</span>
          </Button>
        </div>
      </div>

      <Separator className="bg-champagne-silk" />

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

      {/* Guest List */}
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
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {guests.map((guest) => {
            const statusConfig = getStatusConfig(guest.rsvpStatus);
            return (
              <Card
                key={guest.id}
                className="border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <h3 className="text-sm font-semibold text-charcoal-ink">{guest.name}</h3>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium ${statusConfig.color}`}
                        >
                          {statusConfig.label}
                        </Badge>
                        {guest.plusOne && (
                          <Badge variant="outline" className="text-[10px] font-medium bg-pink-50 text-pink-600 border-pink-200">
                            <UserPlus className="size-2.5 mr-0.5" />
                            +1
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-charcoal-ink/50">
                        {guest.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" />
                            {guest.email}
                          </span>
                        )}
                        {guest.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" />
                            {guest.phone}
                          </span>
                        )}
                        {guest.groupName && (
                          <span className="text-charcoal-ink/40">
                            Group: {guest.groupName}
                          </span>
                        )}
                        {guest.tableNumber != null && (
                          <span className="text-charcoal-ink/40">
                            Table {guest.tableNumber}
                          </span>
                        )}
                        <span className="text-charcoal-ink/30 font-mono text-[10px]">
                          {guest.invitationCode}
                        </span>
                      </div>

                      {guest.plusOneName && (
                        <p className="text-xs text-charcoal-ink/40 mt-1">
                          Plus one: {guest.plusOneName}
                        </p>
                      )}
                      {(() => {
                        const rsvpDietary = guest.rsvps?.[0]?.guests
                          ?.map((g) => g.dietary)
                          .filter((d): d is string => !!d && d.trim().length > 0)
                          .join('; ');
                        const effectiveDietary = guest.dietaryNotes || rsvpDietary;
                        if (!effectiveDietary) return null;
                        return (
                          <p className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1">
                            <UtensilsCrossed className="size-3" />
                            Dietary: {effectiveDietary}
                          </p>
                        );
                      })()}
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
                        {deleting === guest.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CSV Import Dialog */}
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
                }`
                }
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

      {/* Add/Edit Dialog */}
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