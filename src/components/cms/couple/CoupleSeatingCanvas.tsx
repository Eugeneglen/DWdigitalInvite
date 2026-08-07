'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Loader2, Plus, Trash2, Users, Search,
  ZoomIn, ZoomOut, GripVertical, Circle, Square, CircleEllipsis,
  AlertCircle, UtensilsCrossed, X, Lock, Unlock,
  ImagePlus, ImageOff, Maximize, ChevronRight, Mail, Phone,
  UserPlus, ArrowRightLeft, Ban,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
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
} from '@/components/ui/sheet';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

// ---- Constants ----
const API_BASE = '/api/cms/guests?XTransformPort=3000';
const TABLES_API = '/api/cms/tables?XTransformPort=3000';
const FLOORPLAN_API = '/api/cms/floorplan?XTransformPort=3000';

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

const ZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'None' },
  { value: 'VIP', label: 'VIP' },
  { value: 'BRIDE_FAMILY', label: "Bride's Family" },
  { value: 'GROOM_FAMILY', label: "Groom's Family" },
  { value: 'FRIENDS', label: 'Friends' },
  { value: 'COLLEAGUES', label: 'Colleagues' },
];

const ZONE_COLORS: Record<string, string> = {
  VIP: 'bg-amber-100 text-amber-700 border-amber-300',
  BRIDE_FAMILY: 'bg-pink-100 text-pink-700 border-pink-300',
  GROOM_FAMILY: 'bg-sky-100 text-sky-700 border-sky-300',
  FRIENDS: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  COLLEAGUES: 'bg-violet-100 text-violet-700 border-violet-300',
  CUSTOM: 'bg-gray-100 text-gray-700 border-gray-300',
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
  return str.length > len ? str.slice(0, len) + '\u2026' : str;
}

function dietaryBadgeColor(dietary: string): string {
  const d = dietary.toLowerCase();
  if (d.includes('vegan')) return 'bg-green-100 text-green-700';
  if (d.includes('vegetarian')) return 'bg-emerald-100 text-emerald-700';
  if (d.includes('halal')) return 'bg-blue-100 text-blue-700';
  if (d.includes('kosher')) return 'bg-indigo-100 text-indigo-700';
  if (d.includes('gluten') || d.includes('celiac')) return 'bg-amber-100 text-amber-700';
  if (d.includes('nut') || d.includes('allerg')) return 'bg-red-100 text-red-700';
  return 'bg-orange-100 text-orange-700';
}

// ---- Props ----
interface CoupleSeatingCanvasProps {
  onAddTable: () => void;
}

// ---- Main Component ----
export default function CoupleSeatingCanvas({ onAddTable }: CoupleSeatingCanvasProps) {
  // --- Guest state ---
  const [guests, setGuests] = useState<GuestItem[]>([]);

  // --- Seating state ---
  const [tables, setTables] = useState<SeatingTableItem[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [canvasScale, setCanvasScale] = useState(100);
  const [canvasLocked, setCanvasLocked] = useState(false);
  const [reassigningGuestId, setReassigningGuestId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);

  // Floor plan
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [floorPlanLoading, setFloorPlanLoading] = useState(false);

  // Seating panel edit state
  const [editingTableName, setEditingTableName] = useState('');
  const [editingTableNum, setEditingTableNum] = useState('');
  const [editingShape, setEditingShape] = useState('circle');
  const [editingCapacity, setEditingCapacity] = useState(8);
  const [editingZone, setEditingZone] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [savingTable, setSavingTable] = useState(false);

  // Guest sidebar search/filter
  const [guestSearch, setGuestSearch] = useState('');
  const [guestFilter, setGuestFilter] = useState<string>('all'); // all | unassigned | table-N

  // Guest detail drawer
  const [detailGuestId, setDetailGuestId] = useState<string | null>(null);

  // Swap dialog
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapTargetTableId, setSwapTargetTableId] = useState<string | null>(null);
  const [swapGuestId, setSwapGuestId] = useState<string | null>(null);

  // Drag state (table drag)
  const dragRef = useRef<{
    tableId: string;
    startX: number;
    startY: number;
    origPosX: number;
    origPosY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Debounce save ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ======== Data Fetching ========
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

  const fetchFloorPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/wedding?XTransformPort=3000');
      if (!res.ok) return;
      const data = await res.json();
      setFloorPlanUrl(data.wedding?.floorPlanUrl ?? null);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchTables();
    fetchAllGuests();
    fetchFloorPlan();
  }, [fetchTables, fetchAllGuests, fetchFloorPlan]);

  // ======== Derived Data ========
  const selectedTable = tables.find((t) => t.id === selectedTableId);

  const guestsAtTable = (tableNum: number) =>
    guests.filter((g) => g.tableNumber === tableNum);

  const unassignedGuests = guests.filter((g) => g.tableNumber == null);

  const getGuestCountForTable = (tableNum: number) =>
    guests.filter((g) => g.tableNumber === tableNum).length;

  // Guest sidebar filtered list
  const filteredGuests = (() => {
    let list = guests;
    if (guestFilter === 'unassigned') {
      list = list.filter((g) => g.tableNumber == null);
    } else if (guestFilter.startsWith('table-')) {
      const num = parseInt(guestFilter.split('-')[1], 10);
      list = list.filter((g) => g.tableNumber === num);
    }
    if (guestSearch.trim()) {
      const q = guestSearch.toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.email && g.email.toLowerCase().includes(q)) ||
          (g.groupName && g.groupName.toLowerCase().includes(q))
      );
    }
    return list;
  })();

  const assignedCount = guests.filter((g) => g.tableNumber != null).length;
  const totalCount = guests.length;

  // ======== Table CRUD ========
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
          name: editingTableName.trim() || undefined,
          tableNum: parseInt(editingTableNum, 10),
          zone: editingZone || null,
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

  // Debounced auto-save for table properties
  const debouncedSaveTable = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      handleSaveTableEdits();
    }, 800);
  }, [selectedTableId, editingTableName, editingTableNum, editingZone, editingShape, editingCapacity, editingNotes]);

  // Populate edit fields when a table is selected
  useEffect(() => {
    const tbl = tables.find((t) => t.id === selectedTableId);
    if (tbl) {
      setEditingTableName(tbl.name || '');
      setEditingTableNum(String(tbl.tableNum));
      setEditingShape(tbl.shape || 'circle');
      setEditingCapacity(tbl.capacity || 8);
      setEditingZone(tbl.zone || '');
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
      // Optimistic update
      setGuests((prev) =>
        prev.map((g) => (g.id === guestId ? { ...g, tableNumber: newTableNum } : g))
      );
      // Also do a full refresh in background
      fetchAllGuests();
      toast({ title: 'Success', description: `${guest.name} moved to ${newTableNum != null ? `Table ${newTableNum}` : 'unassigned'}` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to reassign guest', variant: 'destructive' });
      fetchAllGuests();
    }
  };

  // Canvas table click: if a guest is selected, reassign them
  const handleCanvasTableClick = (tableId: string) => {
    if (reassigningGuestId) {
      const tbl = tables.find((t) => t.id === tableId);
      if (tbl) {
        // Check capacity
        const count = getGuestCountForTable(tbl.tableNum);
        if (count >= tbl.capacity) {
          // Open swap dialog
          setSwapGuestId(reassigningGuestId);
          setSwapTargetTableId(tableId);
          setSwapDialogOpen(true);
          setReassigningGuestId(null);
          return;
        }
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

  // ======== Floor Plan Upload ========
  const handleFloorPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFloorPlanLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(FLOORPLAN_API, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload floor plan');
      }
      const data = await res.json();
      setFloorPlanUrl(data.url);
      toast({ title: 'Success', description: 'Floor plan uploaded' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to upload floor plan', variant: 'destructive' });
    } finally {
      setFloorPlanLoading(false);
      e.target.value = '';
    }
  };

  const handleFloorPlanRemove = async () => {
    try {
      await fetch(FLOORPLAN_API, { method: 'DELETE' });
      setFloorPlanUrl(null);
      toast({ title: 'Success', description: 'Floor plan removed' });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove floor plan', variant: 'destructive' });
    }
  };

  // ======== Drag handlers (table reposition) ========
  const handleDragStart = (e: React.MouseEvent, tableId: string) => {
    if (canvasLocked) return;
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

  // ======== Guest drag-to-table ========
  const handleGuestDragStart = (e: React.DragEvent, guestId: string) => {
    e.dataTransfer.setData('text/plain', guestId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTableDragOver = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTableId(tableId);
  };

  const handleTableDragLeave = () => {
    setDragOverTableId(null);
  };

  const handleTableDrop = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    setDragOverTableId(null);
    const guestId = e.dataTransfer.getData('text/plain');
    if (!guestId) return;

    const tbl = tables.find((t) => t.id === tableId);
    if (!tbl) return;

    // Check capacity
    const count = getGuestCountForTable(tbl.tableNum);
    if (count >= tbl.capacity) {
      setSwapGuestId(guestId);
      setSwapTargetTableId(tableId);
      setSwapDialogOpen(true);
      return;
    }

    handleReassignGuest(guestId, tbl.tableNum);
  };

  // ======== Swap Dialog ========
  const handleSwapConfirm = async (existingGuestId: string) => {
    if (!swapGuestId || !swapTargetTableId) return;
    const tbl = tables.find((t) => t.id === swapTargetTableId);
    if (!tbl) return;

    try {
      // Move existing guest out
      await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existingGuestId,
          name: guests.find((g) => g.id === existingGuestId)?.name,
          tableNumber: null,
        }),
      });
      // Move incoming guest in
      await handleReassignGuest(swapGuestId, tbl.tableNum);
      // Refresh remaining
      fetchAllGuests();
      setSwapDialogOpen(false);
      setSwapGuestId(null);
      setSwapTargetTableId(null);
    } catch (err) {
      toast({ title: 'Error', description: 'Swap failed', variant: 'destructive' });
    }
  };

  // ======== Detail Drawer Guest ========
  const detailGuest = guests.find((g) => g.id === detailGuestId);

  // ======== Cleanup ========
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ======== Render ========
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col lg:flex-row gap-0 h-full">
        {/* ======== LEFT GUEST SIDEBAR ======== */}
        <div className="w-full lg:w-64 shrink-0 border-r border-champagne-silk bg-paper-cream/50 flex flex-col lg:max-h-[580px] lg:h-auto max-h-[200px] lg:max-h-none order-2 lg:order-1">
          {/* Summary */}
          <div className="px-3 py-2.5 border-b border-champagne-silk">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal-ink/60">Guests</span>
              <span className="text-xs font-medium text-charcoal-ink/50">
                {assignedCount}/{totalCount} assigned
              </span>
            </div>
            {unassignedGuests.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium bg-amber-50 text-amber-700 border-amber-200">
                <AlertCircle className="size-2.5 mr-1" />
                {unassignedGuests.length} unassigned
              </Badge>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-champagne-silk">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-charcoal-ink/30" />
              <Input
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder="Search guests..."
                className="h-7 pl-8 text-xs border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
          </div>

          {/* Filter */}
          <div className="px-3 py-2 border-b border-champagne-silk">
            <Select value={guestFilter} onValueChange={setGuestFilter}>
              <SelectTrigger className="h-7 text-xs border-charcoal-ink/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Guests</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {tables
                  .sort((a, b) => a.tableNum - b.tableNum)
                  .map((t) => (
                    <SelectItem key={t.id} value={`table-${t.tableNum}`}>
                      {t.name || `Table ${t.tableNum}`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Guest list */}
          <ScrollArea className="flex-1">
            <div className="px-2 py-1 space-y-1">
              {filteredGuests.length === 0 && (
                <p className="text-xs text-charcoal-ink/30 text-center py-4 italic">
                  No guests found
                </p>
              )}
              {filteredGuests.map((guest) => {
                const dietary = getEffectiveDietary(guest);
                const isSelected = reassigningGuestId === guest.id;
                return (
                  <div
                    key={guest.id}
                    draggable
                    onDragStart={(e) => handleGuestDragStart(e, guest.id)}
                    onClick={(e) => {
                      if (e.detail === 1) {
                        // Single click: tap-to-assign mode (for mobile)
                        handleCanvasGuestClick(guest.id);
                      }
                    }}
                    onDoubleClick={() => setDetailGuestId(guest.id)}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all duration-150 ${
                      isSelected
                        ? 'border-cinematic-gold bg-cinematic-gold/10 ring-1 ring-cinematic-gold/30'
                        : 'border-charcoal-ink/5 bg-white hover:border-champagne-silk hover:shadow-sm'
                    }`}
                  >
                    <div className="flex-1 min-w-0" onClick={() => setDetailGuestId(guest.id)}>
                      <p className="text-xs font-medium text-charcoal-ink truncate">{guest.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {guest.tableNumber != null && (
                          <span className="text-[10px] font-medium text-cinematic-gold">
                            T{guest.tableNumber}
                          </span>
                        )}
                        {dietary && (
                          <span
                            className={`inline-flex items-center justify-center size-3.5 rounded text-[8px] font-bold ${dietaryBadgeColor(dietary)}`}
                            title={dietary}
                          >
                            {dietary.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    {guest.plusOne && (
                      <UserPlus className="size-3 text-pink-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* ======== CENTER CANVAS AREA ======== */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 order-1 lg:order-2">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-1 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCanvasScale(100)}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5"
                >
                  <Maximize className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit View (100%)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCanvasLocked(!canvasLocked)}
                  className={`h-8 px-2 ${canvasLocked ? 'text-cinematic-gold bg-cinematic-gold/5' : 'text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5'}`}
                >
                  {canvasLocked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{canvasLocked ? 'Unlock tables' : 'Lock tables'}</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-champagne-silk mx-1" />

            <label
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors duration-150 ${
                floorPlanUrl
                  ? 'text-cinematic-gold bg-cinematic-gold/5'
                  : 'text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5'
              }`}
            >
              <ImagePlus className="size-3.5" />
              <span className="hidden sm:inline">{floorPlanUrl ? 'Change' : 'Upload'} Floor Plan</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFloorPlanUpload}
                className="hidden"
                disabled={floorPlanLoading}
              />
            </label>

            {floorPlanUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFloorPlanRemove}
                    className="h-8 px-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <ImageOff className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove floor plan</TooltipContent>
              </Tooltip>
            )}

            <div className="w-px h-5 bg-champagne-silk mx-1" />

            <ZoomOut className="size-3.5 text-charcoal-ink/40 shrink-0" />
            <Slider
              value={[canvasScale]}
              onValueChange={(v) => setCanvasScale(v[0])}
              min={30}
              max={200}
              step={10}
              className="w-24 sm:w-32"
            />
            <ZoomIn className="size-3.5 text-charcoal-ink/40 shrink-0" />
            <span className="text-[10px] text-charcoal-ink/50 font-medium w-8 text-right">{canvasScale}%</span>
          </div>

          {/* Reassigning indicator */}
          {reassigningGuestId && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertCircle className="size-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>Tap a table</strong> to assign{' '}
                <strong>{guests.find((g) => g.id === reassigningGuestId)?.name}</strong>
                {'. Drag & drop also works.'}
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
              if (e.target === e.currentTarget) {
                if (reassigningGuestId) setReassigningGuestId(null);
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
                <p className="text-xs text-charcoal-ink/30">Click &quot;Add Table&quot; to start arranging seating.</p>
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
                {/* Floor plan background */}
                {floorPlanUrl && (
                  <img
                    src={floorPlanUrl}
                    alt="Floor plan"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{ opacity: 0.15 }}
                  />
                )}

                {tables.map((tbl) => {
                  const dims = TABLE_DIMS[tbl.shape] || TABLE_DIMS.circle;
                  const count = getGuestCountForTable(tbl.tableNum);
                  const isOverCapacity = count > tbl.capacity;
                  const isEmpty = count === 0;
                  const isSelected = tbl.id === selectedTableId;
                  const isDragOver = tbl.id === dragOverTableId;
                  const tableGuests = guestsAtTable(tbl.tableNum);
                  const displayName = tbl.name || `T${tbl.tableNum}`;

                  // Border color logic
                  let borderCls = 'border-gray-300';
                  if (isDragOver) {
                    borderCls = 'border-cinematic-gold animate-pulse';
                  } else if (isSelected) {
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
                        onDragOver={(e) => handleTableDragOver(e, tbl.id)}
                        onDragLeave={handleTableDragLeave}
                        onDrop={(e) => handleTableDrop(e, tbl.id)}
                        className={`absolute inset-0 border-2 ${borderCls} ${shapeCls} bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-200 ${
                          isSelected
                            ? 'shadow-[0_0_0_3px_rgba(212,175,55,0.3)] ring-2 ring-cinematic-gold/30'
                            : 'hover:shadow-md'
                        } ${reassigningGuestId && !isSelected ? 'hover:border-cinematic-gold hover:bg-cinematic-gold/5' : ''} ${
                          canvasLocked ? 'cursor-default' : ''
                        }`}
                      >
                        <span className="text-xs font-bold text-charcoal-ink leading-none">
                          {displayName.length > 8 ? truncate(displayName, 8) : displayName}
                        </span>
                        <span className={`text-[10px] font-medium ${isOverCapacity ? 'text-red-500' : 'text-charcoal-ink/50'}`}>
                          {count}/{tbl.capacity}
                        </span>
                        {tbl.zone && (
                          <span
                            className={`text-[8px] px-1 rounded mt-0.5 ${ZONE_COLORS[tbl.zone] || 'bg-gray-100 text-gray-600'}`}
                          >
                            {tbl.zone.replace('_', ' ')}
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
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setDetailGuestId(guest.id);
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
                              {dietary && <p className="text-red-300">{'\uD83C\uDF7D'} {dietary}</p>}
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

        {/* ======== RIGHT TABLE DETAIL PANEL ======== */}
        {selectedTable && (
          <div className="w-full lg:w-72 shrink-0 border-l border-champagne-silk bg-paper-cream order-3 lg:max-h-[580px] overflow-y-auto custom-scrollbar max-h-[300px] lg:max-h-none">
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-[0.08em]">
                  {selectedTable.name || `Table ${selectedTable.tableNum}`}
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
                    className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-charcoal-ink lg:hidden"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>

              <Separator className="bg-champagne-silk" />

              {/* Edit fields */}
              <div className="space-y-3">
                {/* Table Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Table Name</Label>
                  <Input
                    value={editingTableName}
                    onChange={(e) => {
                      setEditingTableName(e.target.value);
                      debouncedSaveTable();
                    }}
                    placeholder="e.g. VIP Table"
                    className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>

                {/* Table Number */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Table Number</Label>
                  <Input
                    value={editingTableNum}
                    onChange={(e) => {
                      setEditingTableNum(e.target.value);
                      debouncedSaveTable();
                    }}
                    type="number"
                    className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>

                {/* Shape selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Shape</Label>
                  <Select
                    value={editingShape}
                    onValueChange={(v) => {
                      setEditingShape(v);
                      debouncedSaveTable();
                    }}
                  >
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

                {/* Capacity */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Capacity</Label>
                  <Input
                    value={editingCapacity}
                    onChange={(e) => {
                      setEditingCapacity(parseInt(e.target.value, 10) || 1);
                      debouncedSaveTable();
                    }}
                    type="number"
                    min={1}
                    max={50}
                    className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>

                {/* Zone selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Zone</Label>
                  <Select
                    value={editingZone}
                    onValueChange={(v) => {
                      setEditingZone(v);
                      debouncedSaveTable();
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {ZONE_OPTIONS.map((z) => (
                        <SelectItem key={z.value} value={z.value}>
                          {z.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Notes</Label>
                  <Textarea
                    value={editingNotes}
                    onChange={(e) => {
                      setEditingNotes(e.target.value);
                      debouncedSaveTable();
                    }}
                    placeholder="e.g. Near bar, VIP"
                    className="text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 min-h-[60px]"
                  />
                </div>

                {/* Save button (explicit) */}
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
                  Guests at Table ({getGuestCountForTable(selectedTable.tableNum)}/{selectedTable.capacity})
                </h4>
                <div className="space-y-1.5">
                  {guestsAtTable(selectedTable.tableNum).map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-charcoal-ink/5 px-2.5 py-1.5"
                    >
                      <div
                        className="min-w-0 cursor-pointer"
                        onClick={() => setDetailGuestId(g.id)}
                      >
                        <p className="text-xs font-medium text-charcoal-ink truncate hover:text-cinematic-gold transition-colors">
                          {g.name}
                        </p>
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
          </div>
        )}
      </div>

      {/* ======== SWAP DIALOG ======== */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">Table is Full</DialogTitle>
            <DialogDescription className="text-charcoal-ink/50">
              Choose a guest to swap with{' '}
              <strong>{guests.find((g) => g.id === swapGuestId)?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {swapTargetTableId &&
              (() => {
                const tbl = tables.find((t) => t.id === swapTargetTableId);
                if (!tbl) return null;
                return guestsAtTable(tbl.tableNum).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSwapConfirm(g.id)}
                    className="w-full flex items-center justify-between gap-2 rounded-md border border-charcoal-ink/5 px-3 py-2 hover:border-cinematic-gold hover:bg-cinematic-gold/5 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-charcoal-ink">{g.name}</span>
                    <ArrowRightLeft className="size-3.5 text-charcoal-ink/40" />
                  </button>
                ));
              })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSwapDialogOpen(false)}
              className="border-charcoal-ink/15 text-charcoal-ink"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== GUEST DETAIL DRAWER ======== */}
      <Sheet open={!!detailGuestId} onOpenChange={(open) => { if (!open) setDetailGuestId(null); }}>
        <SheetContent side="right" className="w-80 p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle className="text-charcoal-ink text-sm font-semibold">
              Guest Details
            </SheetTitle>
          </SheetHeader>
          {detailGuest && (
            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <p className="text-lg font-semibold text-charcoal-ink">{detailGuest.name}</p>
                {detailGuest.groupName && (
                  <Badge variant="outline" className="mt-1 text-[10px] font-medium bg-champagne-silk/30 border-champagne-silk text-charcoal-ink/70">
                    {detailGuest.groupName}
                  </Badge>
                )}
              </div>

              <Separator className="bg-champagne-silk" />

              {/* Contact info */}
              <div className="space-y-2">
                {detailGuest.email && (
                  <div className="flex items-center gap-2 text-sm text-charcoal-ink/70">
                    <Mail className="size-3.5 text-charcoal-ink/40" />
                    <span>{detailGuest.email}</span>
                  </div>
                )}
                {detailGuest.phone && (
                  <div className="flex items-center gap-2 text-sm text-charcoal-ink/70">
                    <Phone className="size-3.5 text-charcoal-ink/40" />
                    <span>{detailGuest.phone}</span>
                  </div>
                )}
              </div>

              {/* Dietary */}
              {(() => {
                const dietary = getEffectiveDietary(detailGuest);
                if (!dietary) return null;
                return (
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="size-3.5 text-red-400" />
                    <span className="text-sm text-red-600/80">{dietary}</span>
                  </div>
                );
              })()}

              {/* Plus One */}
              {detailGuest.plusOne && (
                <div className="flex items-center gap-2">
                  <UserPlus className="size-3.5 text-pink-400" />
                  <span className="text-sm text-charcoal-ink/70">
                    Plus one{detailGuest.plusOneName ? `: ${detailGuest.plusOneName}` : ' allowed'}
                  </span>
                </div>
              )}

              {/* RSVP */}
              <div className="flex items-center gap-2">
                <ChevronRight className="size-3.5 text-charcoal-ink/40" />
                <span className="text-sm text-charcoal-ink/70">
                  RSVP: {detailGuest.rsvpStatus || 'Pending'}
                </span>
              </div>

              <Separator className="bg-champagne-silk" />

              {/* Table assignment */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-charcoal-ink/70 uppercase tracking-[0.08em]">Table Assignment</Label>
                {detailGuest.tableNumber != null ? (
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs font-medium bg-cinematic-gold/10 text-cinematic-gold border-cinematic-gold/30">
                      Table {detailGuest.tableNumber}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReassignGuest(detailGuest.id, null)}
                      className="h-7 px-2 text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Ban className="size-3 mr-1" />
                      Unassign
                    </Button>
                  </div>
                ) : (
                  <Select
                    onValueChange={(v) => {
                      const num = parseInt(v, 10);
                      handleReassignGuest(detailGuest.id, num);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm border-charcoal-ink/10">
                      <SelectValue placeholder="Assign to table..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tables
                        .sort((a, b) => a.tableNum - b.tableNum)
                        .map((t) => {
                          const cnt = getGuestCountForTable(t.tableNum);
                          const full = cnt >= t.capacity;
                          return (
                            <SelectItem key={t.id} value={String(t.tableNum)} disabled={full}>
                              {t.name || `Table ${t.tableNum}`} ({cnt}/{t.capacity})
                              {full && ' - Full'}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
