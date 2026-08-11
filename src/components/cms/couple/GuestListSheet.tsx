'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, Users, Search, Mail, Phone, UserPlus,
  Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, UtensilsCrossed,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  API_BASE,
  type GuestItem,
  type ParsedRow,
  type ImportResult,
  type ImportStep,
  parseCSV,
  resolveFieldName,
  normalizeRow,
  rowToPayload,
  downloadCSVTemplate,
  getEffectiveDietary,
  truncate,
  getStatusConfig,
} from './guest-types';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
import GuestFormDialog from './GuestFormDialog';

interface GuestListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuestsChanged: () => void;
}

export default function GuestListSheet({ open, onOpenChange, onGuestsChanged }: GuestListSheetProps) {
  // --- Guest list state ---
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  // --- CSV Export state ---
  const [exporting, setExporting] = useState(false);

  // --- CSV Import state ---
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDragOver, setImportDragOver] = useState(false);

  // --- Edit dialog state ---
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editGuest, setEditGuest] = useState<GuestItem | null>(null);

  // ======== Data Fetching ========
  const fetchGuests = useCallback(async () => {
    try {
      setLoading(true);
      let url = API_BASE;
      const params: string[] = [];
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
    if (open) fetchGuests();
  }, [open, fetchGuests]);

  // ======== Guest CRUD ========
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
      onGuestsChanged();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete guest', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (guest: GuestItem) => {
    setEditGuest(guest);
    setEditDialogOpen(true);
  };

  // ======== CSV Import ========
  const resetImportState = () => {
    setImportStep('upload');
    setImportFile(null);
    setImportRows([]);
    setImportHeaders([]);
    setImporting(false);
    setImportResult(null);
    setImportDragOver(false);
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
      onGuestsChanged();
    }
    resetImportState();
  };

  // ======== CSV Export ========
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

  // ======== Handle sheet close ========
  const handleSheetOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSearch('');
      setStatusFilter('all');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-0 shrink-0">
            <SheetTitle className="text-charcoal-ink">Guest List</SheetTitle>
            <SheetDescription className="text-charcoal-ink/50">
              {guests.length} guest{guests.length !== 1 ? 's' : ''}
            </SheetDescription>
          </SheetHeader>

          {/* Action buttons */}
          <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => { setEditGuest(null); setEditDialogOpen(true); }}
              className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] transition-colors duration-300"
            >
              <Plus className="size-3.5 mr-1.5" />
              Add Guest
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetImportState(); setImportOpen(true); }}
              className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] transition-colors duration-300"
            >
              <Upload className="size-3.5 mr-1.5" />
              Import CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              disabled={exporting}
              className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] transition-colors duration-300"
            >
              {exporting ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Download className="size-3.5 mr-1.5" />}
              Export CSV
            </Button>
          </div>

          {/* Search + Filter */}
          <div className="px-6 pb-3 flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-charcoal-ink/30" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone…"
                className="pl-9 h-9 border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-36 border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 text-sm">
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

          {/* Guest content area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-cinematic-gold" />
              </div>
            ) : guests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Users className="size-8 text-champagne-silk" />
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
                {/* Desktop Table */}
                <div className="hidden sm:block rounded-lg border border-charcoal-ink/5">
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
                                    <UserPlus className="size-2.5 mr-0.5" />+1
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
                                <span className="text-cinematic-gold font-medium">
                                  Table {guest.tableNumber}
                                </span>
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
                                  onClick={() => handleEdit(guest)}
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
                                  {deleting === guest.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-2">
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
                                  <span className="text-cinematic-gold font-medium">Table {guest.tableNumber}</span>
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
                                onClick={() => handleEdit(guest)}
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
          </div>
        </SheetContent>
      </Sheet>

      {/* ======== CSV Import Dialog ======== */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) handleImportClose(); }}>
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
                  id="csv-file-input-sheet"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFileSelect(file);
                  }}
                />
                {importFile ? (
                  <div className="space-y-2">
                    <FileSpreadsheet className="size-10 text-emerald-500 mx-auto" />
                    <p className="text-sm font-medium text-charcoal-ink">{importFile.name}</p>
                    <p className="text-xs text-charcoal-ink/40">{(importFile.size / 1024).toFixed(1)} KB</p>
                    <button
                      type="button"
                      onClick={() => {
                        setImportFile(null);
                        const input = document.getElementById('csv-file-input-sheet') as HTMLInputElement;
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
                        onClick={() => document.getElementById('csv-file-input-sheet')?.click()}
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
                  onClick={downloadCSVTemplate}
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
                <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/50">Preview</p>
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
                          <tr key={idx} className={`border-t border-charcoal-ink/5 ${hasError ? 'bg-red-50/60' : ''}`}>
                            <td className="px-3 py-2 text-charcoal-ink/30 font-mono">{idx + 1}</td>
                            <td className={`px-3 py-2 ${hasError ? 'text-red-500 font-medium' : 'text-charcoal-ink'}`}>
                              {name || <span className="italic text-red-400">Missing name</span>}
                            </td>
                            <td className="px-3 py-2 text-charcoal-ink/50 hidden sm:table-cell truncate max-w-[160px]">{n.email || '—'}</td>
                            <td className="px-3 py-2 text-charcoal-ink/50 hidden md:table-cell">{n.group || n.groupname || '—'}</td>
                            <td className="px-3 py-2 text-charcoal-ink/50 hidden md:table-cell">{n.tablenumber || n.table || '—'}</td>
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
                    <p className="text-xs text-charcoal-ink/40">…and {importRows.length - 10} more row{importRows.length - 10 !== 1 ? 's' : ''}</p>
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
                  <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/50">Errors ({importResult.errors.length})</p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50 divide-y divide-red-100">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="px-3 py-2 flex items-start gap-2">
                        <AlertCircle className="size-3.5 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-red-700">Row {err.row}: {err.name || 'Unknown'}</p>
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
                <Button variant="outline" onClick={() => setImportOpen(false)} className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300">Cancel</Button>
                <Button onClick={handleImportNext} disabled={!importFile} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50">Next</Button>
              </>
            )}
            {importStep === 'preview' && (
              <>
                <Button variant="outline" onClick={() => { setImportStep('upload'); setImportRows([]); setImportHeaders([]); }} className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300">Back</Button>
                <Button onClick={handleImportSubmit} disabled={importing} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50">
                  {importing ? (<><Loader2 className="size-4 animate-spin mr-2" />Importing…</>) : `Import ${importRows.length} Guest${importRows.length !== 1 ? 's' : ''}`}
                </Button>
              </>
            )}
            {importStep === 'result' && (
              <Button onClick={handleImportClose} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300">Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Add/Edit Guest Dialog ======== */}
      <GuestFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editGuest={editGuest}
        onSaved={() => {
          fetchGuests();
          onGuestsChanged();
        }}
      />
    </>
  );
}
