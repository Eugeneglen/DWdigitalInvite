'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, Pencil, Trash2, Search, Crown, UtensilsCrossed,
  Download, Upload, Baby, PersonStanding, Users, UserCheck,
  AlertTriangle, FileSpreadsheet,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  API_BASE, GUEST_STATS_API, type GuestItem, type GuestStats,
  type ParsedRow, type ImportResult, type ImportStep,
  parseCSV, rowToPayload, downloadCSVTemplate,
  getEffectiveDietary, getStatusConfig, CATEGORY_OPTIONS,
} from './guest-types';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
import GuestFormDialog from './GuestFormDialog';
import GuestListCheckIn from './GuestListCheckIn';

interface FO { value: string; label: string; }
const SIDE_F: FO[] = [{ value: '', label: 'All' }, { value: 'GROOM', label: '🤵 Groom' }, { value: 'BRIDE', label: '👰 Bride' }];
const RSVP_F: FO[] = [{ value: '', label: 'All' }, { value: 'PENDING', label: 'Pending' }, { value: 'ATTENDING', label: 'Attending' }, { value: 'DECLINED', label: 'Declined' }, { value: 'PARTIAL', label: 'Partial' }];
const CAT_F: FO[] = [{ value: '', label: 'All' }, ...CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.label }))];
const TBL_F: FO[] = [{ value: '', label: 'All' }, { value: '__unassigned__', label: 'Unassigned' }];
const SPC_F: FO[] = [{ value: '', label: 'All' }, { value: 'vip', label: 'VIP Only' }, { value: 'elderly', label: 'Elderly' }, { value: 'baby', label: 'Baby Chair' }];

const inputCls = 'border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 h-9 text-sm bg-white';
const btnOutlineCls = 'border-charcoal-ink/15 text-charcoal-ink/70 hover:border-cinematic-gold hover:text-cinematic-gold h-8 text-xs';

function StatCard({ label, value, emoji }: { label: string; value: number; emoji?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-champagne-silk/60 bg-white px-3 py-2 min-w-[90px]">
      <span className="text-lg font-bold text-charcoal-ink">{emoji ? `${emoji} ` : ''}{value}</span>
      <span className="text-[11px] text-charcoal-ink/50 mt-0.5">{label}</span>
    </div>
  );
}

function FilterPills({ options, value, onChange }: { options: FO[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer ${
            value === o.value ? 'bg-cinematic-gold/15 border-cinematic-gold/40 text-cinematic-gold' : 'bg-white border-charcoal-ink/10 text-charcoal-ink/60 hover:border-charcoal-ink/25 hover:text-charcoal-ink/80'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterRow({ label, w, options, value, onChange }: { label: string; w: string; options: FO[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-charcoal-ink/40 font-medium shrink-0 text-xs" style={{ width: w }}>{label}</span>
      <FilterPills options={options} value={value} onChange={onChange} />
    </div>
  );
}

export default function GuestListMain() {
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [stats, setStats] = useState<GuestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sideF, setSideF] = useState('');
  const [rsvpF, setRsvpF] = useState('');
  const [catF, setCatF] = useState('');
  const [tblF, setTblF] = useState('');
  const [spcF, setSpcF] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editGuest, setEditGuest] = useState<GuestItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [impOpen, setImpOpen] = useState(false);
  const [impStep, setImpStep] = useState<ImportStep>('upload');
  const [impRows, setImpRows] = useState<ParsedRow[]>([]);
  const [impHeaders, setImpHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [impResult, setImpResult] = useState<ImportResult | null>(null);
  const [impDrag, setImpDrag] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const dbRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { dbRef.current = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(dbRef.current); }, [search]);

  const fetchStats = useCallback(async () => {
    try { const r = await fetch(GUEST_STATS_API); if (r.ok) setStats(await r.json()); } catch { /* */ }
    finally { setStatsLoading(false); }
  }, []);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchGuests = useCallback(async () => {
    try {
      setLoading(true);
      const p: string[] = [];
      if (debounced) p.push(`search=${encodeURIComponent(debounced)}`);
      if (sideF) p.push(`side=${sideF}`);
      if (rsvpF) p.push(`status=${rsvpF}`);
      if (catF) p.push(`category=${catF}`);
      if (tblF === '__unassigned__') p.push('unassigned=true');
      else if (tblF) p.push(`tableNumber=${tblF}`);
      const url = API_BASE + (p.length ? '&' + p.join('&') : '');
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      let list: GuestItem[] = (await r.json()).guests ?? [];
      if (spcF === 'vip') list = list.filter((g) => g.isVip);
      else if (spcF === 'elderly') list = list.filter((g) => g.isElderly);
      else if (spcF === 'baby') list = list.filter((g) => g.needsBabyChair);
      setGuests(list);
    } catch { toast({ title: 'Error', description: 'Failed to load guests', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [debounced, sideF, rsvpF, catF, tblF, spcF]);
  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this guest?')) return;
    try {
      setDelId(id);
      const r = await fetch(`${API_BASE}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Guest deleted' });
      fetchGuests(); fetchStats();
    } catch { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }); }
    finally { setDelId(null); }
  };

  const onSaved = () => { fetchGuests(); fetchStats(); setSelId(null); };

  const handleExport = async () => {
    try {
      setExporting(true);
      const r = await fetch('/api/cms/export?XTransformPort=3000&type=guests');
      if (!r.ok) return;
      const u = URL.createObjectURL(await r.blob());
      const a = document.createElement('a'); a.href = u; a.download = 'guests-export.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
      toast({ title: 'Success', description: 'Export downloaded' });
    } catch { toast({ title: 'Error', description: 'Export failed', variant: 'destructive' }); }
    finally { setExporting(false); }
  };

  const resetImp = () => { setImpStep('upload'); setImpRows([]); setImpHeaders([]); setImporting(false); setImpResult(null); setImpDrag(false); };
  const procFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { toast({ title: 'Error', description: 'Please select a .csv file', variant: 'destructive' }); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target?.result as string);
      if (!rows.length) { toast({ title: 'Error', description: 'No data rows', variant: 'destructive' }); return; }
      setImpHeaders(headers); setImpRows(rows); setImpStep('preview');
    };
    reader.readAsText(f);
  };

  const handleImpDrop = (e: React.DragEvent) => { e.preventDefault(); setImpDrag(false); const f = e.dataTransfer.files[0]; if (f) procFile(f); };
  const handleImp = async () => {
    try {
      setImporting(true);
      const r = await fetch('/api/cms/guests/bulk?XTransformPort=3000', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: impRows.map(rowToPayload) }),
      });
      if (!r.ok) throw new Error();
      setImpResult(await r.json()); setImpStep('result');
      invalidateWeddingCache(); fetchGuests(); fetchStats();
    } catch { toast({ title: 'Error', description: 'Import failed', variant: 'destructive' }); }
    finally { setImporting(false); }
  };

  const gC = stats?.groomSide ?? 0; const bC = stats?.brideSide ?? 0;
  const totB = gC + bC;
  const gP = totB > 0 ? (gC / totB) * 100 : 50;
  const bP = totB > 0 ? (bC / totB) * 100 : 50;
  const imbal = totB > 0 && Math.abs(gC - bC) / totB > 0.25;

  return (
    <div className="flex flex-col h-full bg-paper-cream/30">
      {/* Stats */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        {statsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-[90px] rounded-lg shrink-0" />)}</div>
        ) : stats ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Groom Side" value={stats.groomSide} emoji="🤵" />
            <StatCard label="Bride Side" value={stats.brideSide} emoji="👰" />
            <StatCard label="Attending" value={stats.attending} emoji="✅" />
            <StatCard label="Unassigned" value={stats.unassignedTable} emoji="📍" />
            <StatCard label="Checked In" value={stats.checkedIn} emoji="📋" />
            <div className="flex flex-col items-center justify-center rounded-lg border border-champagne-silk/60 bg-white px-3 py-2 min-w-[120px]">
              <div className="flex w-full h-3 rounded-full overflow-hidden bg-charcoal-ink/5 mb-1.5">
                <div className={`h-full transition-all duration-500 ${imbal ? 'bg-amber-400' : 'bg-cinematic-gold/70'}`} style={{ width: `${gP}%` }} />
                <div className={`h-full transition-all duration-500 ${imbal ? 'bg-rose-400' : 'bg-champagne-silk'}`} style={{ width: `${bP}%` }} />
              </div>
              {imbal && <AlertTriangle className="size-3 text-amber-500" />}
              <span className="text-[11px] text-charcoal-ink/50">Groom vs Bride</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Filters */}
      <div className="px-4 pb-3 space-y-2 shrink-0 border-b border-champagne-silk/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-charcoal-ink/30" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, Chinese name, phone, or group..." className={`pl-9 ${inputCls}`} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <FilterRow label="Side" w="2rem" options={SIDE_F} value={sideF} onChange={setSideF} />
          <FilterRow label="RSVP" w="2rem" options={RSVP_F} value={rsvpF} onChange={setRsvpF} />
          <FilterRow label="Category" w="3.2rem" options={CAT_F} value={catF} onChange={setCatF} />
          <FilterRow label="Table" w="2rem" options={TBL_F} value={tblF} onChange={setTblF} />
          <FilterRow label="Special" w="3.2rem" options={SPC_F} value={spcF} onChange={setSpcF} />
        </div>
      </div>

      {sideF && (
        <div className="px-4 pt-3 pb-1 shrink-0">
          <h3 className="text-sm font-semibold text-charcoal-ink">
            {sideF === 'GROOM' ? "Groom's Side" : "Bride's Side"} — {guests.filter((g) => g.side === sideF).length} guests
          </h3>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 px-4">
        <div className="max-h-[calc(100vh-380px)] overflow-y-auto rounded-lg border border-champagne-silk/40 bg-white [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-champagne-silk/50 [&::-webkit-scrollbar-thumb]:rounded-full">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>
          ) : !guests.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-charcoal-ink/30">
              <Users className="size-10 mb-2" /><p className="text-sm">No guests found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-paper-cream/60 hover:bg-paper-cream/60 border-b border-champagne-silk/40">
                  <TableHead className="w-10 text-[11px] font-semibold text-charcoal-ink/50">No.</TableHead>
                  <TableHead className="text-[11px] font-semibold text-charcoal-ink/50">Name</TableHead>
                  <TableHead className="w-16 text-[11px] font-semibold text-charcoal-ink/50">Side</TableHead>
                  <TableHead className="w-20 text-[11px] font-semibold text-charcoal-ink/50 hidden md:table-cell">Category</TableHead>
                  <TableHead className="w-20 text-[11px] font-semibold text-charcoal-ink/50">RSVP</TableHead>
                  <TableHead className="w-14 text-[11px] font-semibold text-charcoal-ink/50 text-center">Table</TableHead>
                  <TableHead className="w-12 text-[11px] font-semibold text-charcoal-ink/50 text-center">Seats</TableHead>
                  <TableHead className="w-28 text-[11px] font-semibold text-charcoal-ink/50 hidden sm:table-cell">Special</TableHead>
                  <TableHead className="w-20 text-[11px] font-semibold text-charcoal-ink/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((g, idx) => {
                  const sc = getStatusConfig(g.rsvpStatus);
                  const di = getEffectiveDietary(g);
                  const sel = selId === g.id;
                  return (
                    <TableRow key={g.id} onClick={() => setSelId(sel ? null : g.id)}
                      className={`cursor-pointer transition-colors duration-100 border-b border-champagne-silk/20 ${
                        sel ? 'bg-cinematic-gold/[0.08]' : idx % 2 === 0 ? 'bg-white hover:bg-paper-cream/40' : 'bg-paper-cream/30 hover:bg-paper-cream/60'}`}>
                      <TableCell className="text-xs text-charcoal-ink/40 font-mono">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-charcoal-ink">{g.name}</div>
                        {g.chineseName && <div className="text-xs text-charcoal-ink/40 mt-0.5">{g.chineseName}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${
                          g.side === 'GROOM' ? 'bg-cinematic-gold/10 text-cinematic-gold border-cinematic-gold/20'
                            : g.side === 'BRIDE' ? 'bg-champagne-silk/40 text-charcoal-ink/70 border-champagne-silk/60'
                            : 'bg-charcoal-ink/5 text-charcoal-ink/40 border-charcoal-ink/10'}`}>
                          {g.side === 'GROOM' ? '🤵' : g.side === 'BRIDE' ? '👰' : '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-charcoal-ink/50">{g.category || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sc.color}`}>{sc.label}</Badge></TableCell>
                      <TableCell className="text-center text-sm font-medium text-charcoal-ink">{g.tableNumber ?? '—'}</TableCell>
                      <TableCell className="text-center text-sm text-charcoal-ink/60">{g.seatCount || 1}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1 flex-wrap">
                          {g.isVip && <span title="VIP" className="inline-flex items-center justify-center size-5 rounded-full bg-amber-100 text-amber-600"><Crown className="size-3" /></span>}
                          {g.isElderly && <span title="Elderly" className="inline-flex items-center justify-center size-5 rounded-full bg-blue-50 text-blue-500"><PersonStanding className="size-3" /></span>}
                          {g.needsBabyChair && <span title="Baby Chair" className="inline-flex items-center justify-center size-5 rounded-full bg-pink-50 text-pink-500"><Baby className="size-3" /></span>}
                          {di && <span title={di} className="inline-flex items-center justify-center size-5 rounded-full bg-orange-50 text-orange-500"><UtensilsCrossed className="size-3" /></span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditGuest(g); setEditOpen(true); }}
                            className="p-1.5 rounded-md text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/10 transition-colors cursor-pointer" title="Edit">
                            <Pencil className="size-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }} disabled={delId === g.id}
                            className="p-1.5 rounded-md text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50" title="Delete">
                            {delId === g.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="px-4 py-3 border-t border-champagne-silk/40 bg-white shrink-0 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-charcoal-ink/40">Showing <strong className="text-charcoal-ink/60">{guests.length}</strong> of {stats?.total ?? '—'} guests</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { resetImp(); setImpOpen(true); }} className={btnOutlineCls}><Upload className="size-3.5 mr-1" />Import</Button>
          <Button variant="outline" size="sm" onClick={() => downloadCSVTemplate()} className={btnOutlineCls}><FileSpreadsheet className="size-3.5 mr-1" />Template</Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className={btnOutlineCls}>
            {exporting ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />}Export
          </Button>
          <Button size="sm" onClick={() => setCheckinOpen(true)} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 h-8 text-xs"><UserCheck className="size-3.5 mr-1" />Check-In</Button>
        </div>
      </div>

      <GuestFormDialog open={editOpen} onOpenChange={setEditOpen} editGuest={editGuest} onSaved={onSaved} />

      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="sm:max-w-lg p-0 max-h-[90vh] overflow-hidden">
          <GuestListCheckIn onClose={() => { setCheckinOpen(false); fetchStats(); }} />
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={impOpen} onOpenChange={(v) => { if (!v) resetImp(); setImpOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">Import Guests from CSV</DialogTitle>
            <DialogDescription className="text-charcoal-ink/50">
              {impStep === 'upload' && 'Upload a CSV file with guest data.'}
              {impStep === 'preview' && `Preview: ${impRows.length} rows found.`}
              {impStep === 'result' && 'Import complete!'}
            </DialogDescription>
          </DialogHeader>
          {impStep === 'upload' && (
            <div onDragOver={(e) => { e.preventDefault(); setImpDrag(true); }} onDragLeave={() => setImpDrag(false)} onDrop={handleImpDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${impDrag ? 'border-cinematic-gold bg-cinematic-gold/5' : 'border-charcoal-ink/15 hover:border-charcoal-ink/30'}`}>
              <Upload className="size-8 mx-auto mb-2 text-charcoal-ink/30" />
              <p className="text-sm text-charcoal-ink/50 mb-3">Drag & drop a CSV file here, or</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-cinematic-gold/10 text-cinematic-gold text-sm font-medium cursor-pointer hover:bg-cinematic-gold/20 transition-colors">
                <FileSpreadsheet className="size-4" /> Browse Files
                <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) procFile(f); }} />
              </label>
            </div>
          )}
          {impStep === 'preview' && (
            <div className="space-y-3">
              <div className="max-h-48 overflow-y-auto rounded border border-charcoal-ink/10 text-xs">
                <table className="w-full"><thead><tr className="bg-paper-cream/60 border-b border-champagne-silk/40">
                  {impHeaders.map((h) => <th key={h} className="px-2 py-1.5 text-left text-charcoal-ink/50 font-medium">{h}</th>)}
                </tr></thead><tbody>
                  {impRows.slice(0, 10).map((row, i) => <tr key={i} className="border-b border-charcoal-ink/5">
                    {impHeaders.map((h) => <td key={h} className="px-2 py-1 text-charcoal-ink/60">{row[h] || ''}</td>)}
                  </tr>)}
                </tbody></table>
                {impRows.length > 10 && <p className="px-2 py-1.5 text-charcoal-ink/40 text-center">...and {impRows.length - 10} more rows</p>}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={resetImp} className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold">Cancel</Button>
                <Button onClick={handleImp} disabled={importing} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90">
                  {importing ? <><Loader2 className="size-4 animate-spin mr-2" />Importing…</> : `Import ${impRows.length} Guests`}
                </Button>
              </DialogFooter>
            </div>
          )}
          {impStep === 'result' && impResult && (
            <div className="space-y-3">
              <div className="rounded-lg border border-champagne-silk/40 p-4 space-y-2">
                <p className="text-sm text-emerald-600 font-medium">✅ {impResult.created} guests created</p>
                <p className="text-sm text-cinematic-gold font-medium">🔄 {impResult.updated} guests updated</p>
                {impResult.skipped > 0 && <p className="text-sm text-charcoal-ink/50">⏭️ {impResult.skipped} skipped</p>}
              </div>
              {impResult.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-xs text-red-500">
                  {impResult.errors.map((e, i) => <p key={i}>Row {e.row}: {e.name} — {e.error}</p>)}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { resetImp(); setImpOpen(false); }} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90">Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
