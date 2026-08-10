'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Loader2, Plus, Trash2, Pencil, Users, Search,
  ZoomIn, ZoomOut, GripVertical, Circle, Square, CircleEllipsis,
  AlertCircle, UtensilsCrossed, X, Lock, Unlock,
  ImagePlus, ImageOff, Maximize, ChevronRight, Mail, Phone,
  UserPlus, ArrowRightLeft, Ban,
  Wand2, Grid3x3, Download, Printer, Copy, FileDown,
  UsersRound, CheckCircle2, XCircle, Clock, ChevronsUpDown,
  List, Undo2, Redo2, Hand, Tags, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
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
import {
  API_BASE, TABLES_API, TABLE_DIMS,
  type GuestItem, type SeatingTableItem,
  getEffectiveDietary, truncate, dietaryBadgeColor,
} from './guest-types';
import GuestFormDialog from './GuestFormDialog';
import GuestListSheet from './GuestListSheet';

// ---- Constants (canvas-only) ----
const FLOORPLAN_API = '/api/cms/floorplan?XTransformPort=3000';

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

// ---- Main Component ----
export default function CoupleSeatingCanvas() {
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

  // Phase 3+4 state
  const [rsvpFilter, setRsvpFilter] = useState<string>('all');
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [gridSnap, setGridSnap] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkShape, setBulkShape] = useState('circle');

  // Guest management (unified view)
  const [guestListOpen, setGuestListOpen] = useState(false);
  const [guestFormOpen, setGuestFormOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestItem | null>(null);
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);

  // Feature 1: Undo/Redo
  const [historyStack, setHistoryStack] = useState<SeatingTableItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Feature 2: Guest Labels
  const [showGuestLabels, setShowGuestLabels] = useState(false);

  // Feature 3: Table Size Slider
  const [tableSize, setTableSize] = useState(100);

  // Feature 4: Pan Mode
  const [isPanMode, setIsPanMode] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Feature 5: Venue Elements
  const [venueElements, setVenueElements] = useState<
    Array<{ id: string; type: 'STAGE' | 'COUPLE'; x: number; y: number; width: number; height: number }>
  >([
    { id: 'stage-1', type: 'STAGE', x: 50, y: 100, width: 120, height: 200 },
    { id: 'couple-1', type: 'COUPLE', x: 150, y: 600, width: 120, height: 120 },
  ]);
  const venueDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Feature 7: Canvas Search
  const [canvasSearch, setCanvasSearch] = useState('');

  // Feature 8: Multi-select
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());

  // Feature 6: Zone panel
  const [zonePanelOpen, setZonePanelOpen] = useState(true);

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
    // RSVP filter (applied first)
    if (rsvpFilter === 'attending') {
      list = list.filter((g) => g.rsvpStatus === 'ATTENDING');
    } else if (rsvpFilter === 'pending') {
      list = list.filter((g) => g.rsvpStatus === 'PENDING' || !g.rsvpStatus);
    } else if (rsvpFilter === 'declined') {
      list = list.filter((g) => g.rsvpStatus === 'DECLINED');
    }
    // Table assignment filter
    if (guestFilter === 'unassigned') {
      list = list.filter((g) => g.tableNumber == null);
    } else if (guestFilter.startsWith('table-')) {
      const num = parseInt(guestFilter.split('-')[1], 10);
      list = list.filter((g) => g.tableNumber === num);
    }
    // Search filter
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
  const totalSeats = tables.reduce((sum, t) => sum + t.capacity, 0);
  const remainingSeats = Math.max(0, totalSeats - assignedCount);
  const fillPct = totalSeats > 0 ? Math.round((assignedCount / totalSeats) * 100) : 0;

  // ======== Feature 1: History (Undo/Redo) ========
  const pushHistory = useCallback(() => {
    setHistoryStack((prev) => {
      const snapshot = JSON.parse(JSON.stringify(tables)) as SeatingTableItem[];
      const newStack = prev.slice(0, historyIndex + 1);
      newStack.push(snapshot);
      if (newStack.length > 50) newStack.shift();
      return newStack;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [tables, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setTables(JSON.parse(JSON.stringify(historyStack[newIndex])));
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setTables(JSON.parse(JSON.stringify(historyStack[newIndex])));
  }, [historyIndex, historyStack]);

  // ======== Feature 6: Zone & Dietary derived data ========
  const zoneSummary = (() => {
    const zones: Record<string, { tables: number; capacity: number; assigned: number }> = {};
    for (const t of tables) {
      const z = t.zone || '_none';
      if (!zones[z]) zones[z] = { tables: 0, capacity: 0, assigned: 0 };
      zones[z].tables++;
      zones[z].capacity += t.capacity;
      zones[z].assigned += getGuestCountForTable(t.tableNum);
    }
    return zones;
  })();

  const dietarySummary = (() => {
    const counts: Record<string, number> = {};
    const common = ['vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher', 'nut-free', 'dairy-free'];
    let otherCount = 0;
    for (const g of guests) {
      const d = getEffectiveDietary(g);
      if (!d) continue;
      const dl = d.toLowerCase();
      let matched = false;
      for (const c of common) {
        if (dl.includes(c)) {
          counts[c] = (counts[c] || 0) + 1;
          matched = true;
          break;
        }
      }
      if (!matched) otherCount++;
    }
    return { counts, otherCount };
  })();

  // ======== Table CRUD ========
  const handleAddTable = async () => {
    pushHistory();
    const maxNum = tables.length > 0 ? Math.max(...tables.map((t) => t.tableNum)) : 0;
    const newNum = maxNum + 1;
    const offset = (newNum - 1) * 180;
    const col = offset % 720;
    const row = Math.floor(offset / 720) * 180;
    try {
      const res = await fetch(TABLES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNum: newNum, shape: 'circle', capacity: 8, posX: 120 + col, posY: 120 + row }),
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
    pushHistory();
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

    // Frontend capacity guard — block if target table is full
    if (newTableNum != null) {
      const table = tables.find((t) => t.tableNum === newTableNum);
      if (table) {
        const isSameTable = guest.tableNumber === newTableNum;
        const currentCount = getGuestCountForTable(newTableNum) - (isSameTable ? 1 : 0);
        if (currentCount >= table.capacity) {
          toast({ title: 'Table Full', description: `Table ${newTableNum} has reached its capacity of ${table.capacity}.`, variant: 'destructive' });
          return;
        }
      }
    }

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

  // ======== Guest CRUD (sidebar) ========
  const handleDeleteGuest = async (id: string) => {
    if (!confirm('Delete this guest? This action cannot be undone.')) return;
    try {
      setDeletingGuestId(id);
      const res = await fetch(`${API_BASE}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete guest');
      }
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Guest deleted' });
      await fetchAllGuests();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete guest', variant: 'destructive' });
    } finally {
      setDeletingGuestId(null);
    }
  };

  // Canvas table click: if a guest is selected, reassign them
  const handleCanvasTableClick = (tableId: string, shiftKey?: boolean) => {
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
    } else if (shiftKey) {
      // Feature 8: Multi-select with Shift
      setSelectedTableIds((prev) => {
        const next = new Set(prev);
        if (next.has(tableId)) next.delete(tableId);
        else next.add(tableId);
        return next;
      });
    } else {
      setSelectedTableIds(new Set());
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
  // Ref to track latest dragged position for API persistence (avoids stale closure)
  const latestDragPos = useRef<{ posX: number; posY: number } | null>(null);

  const handleDragStart = (e: React.MouseEvent, tableId: string) => {
    if (canvasLocked) return;
    e.preventDefault();
    pushHistory();
    const tbl = tables.find((t) => t.id === tableId);
    if (!tbl) return;
    dragRef.current = {
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      origPosX: tbl.posX,
      origPosY: tbl.posY,
    };
    latestDragPos.current = { posX: tbl.posX, posY: tbl.posY };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / (canvasScale / 100);
      const dy = (ev.clientY - dragRef.current.startY) / (canvasScale / 100);
      let newPosX = Math.max(0, dragRef.current.origPosX + dx);
      let newPosY = Math.max(0, dragRef.current.origPosY + dy);
      if (gridSnap) {
        newPosX = Math.round(newPosX / 20) * 20;
        newPosY = Math.round(newPosY / 20) * 20;
      }
      latestDragPos.current = { posX: newPosX, posY: newPosY };
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, posX: newPosX, posY: newPosY } : t))
      );
    };

    const handleUp = async () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (!dragRef.current || !latestDragPos.current) return;
      try {
        await fetch(TABLES_API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: tableId, posX: latestDragPos.current.posX, posY: latestDragPos.current.posY }),
        });
      } catch {
        // silent persist
      }
      dragRef.current = null;
      latestDragPos.current = null;
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

  // ======== Auto-Assign ========
  const handleAutoAssign = async () => {
    const unassigned = guests.filter(
      (g) => g.tableNumber == null && g.rsvpStatus !== 'DECLINED'
    );
    if (unassigned.length === 0) {
      toast({ title: 'Info', description: 'No unassigned guests to place' });
      return;
    }
    if (tables.length === 0) {
      toast({ title: 'Info', description: 'No tables available' });
      return;
    }

    setAutoAssigning(true);
    let assigned = 0;

    try {
      // Sort tables by fill ratio descending (nearly full first)
      const sortedTables = [...tables].sort((a, b) => {
        const aFill = getGuestCountForTable(a.tableNum) / a.capacity;
        const bFill = getGuestCountForTable(b.tableNum) / b.capacity;
        return bFill - aFill;
      });

      for (const guest of unassigned) {
        // Find first table with room
        const target = sortedTables.find(
          (t) => getGuestCountForTable(t.tableNum) < t.capacity
        );
        if (!target) break;

        try {
          const res = await fetch(API_BASE, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: guest.id, name: guest.name, tableNumber: target.tableNum }),
          });
          if (res.ok) {
            assigned++;
            // Optimistic update
            setGuests((prev) =>
              prev.map((g) => (g.id === guest.id ? { ...g, tableNumber: target.tableNum } : g))
            );
          }
        } catch {
          // skip this guest
        }
      }

      await fetchAllGuests();
      toast({ title: 'Auto-Assign Complete', description: `${assigned} guest${assigned !== 1 ? 's' : ''} assigned to tables` });
    } catch {
      toast({ title: 'Error', description: 'Auto-assign failed', variant: 'destructive' });
    } finally {
      setAutoAssigning(false);
    }
  };

  // ======== Export PNG ========
  const handleExportPng = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(canvasRef.current, { backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = 'seating-chart.png';
      link.href = dataUrl;
      link.click();
      toast({ title: 'Success', description: 'Seating chart exported as PNG' });
    } catch {
      toast({ title: 'Error', description: 'Failed to export seating chart', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // ======== Export CSV ========
  const handleExportCsv = () => {
    const header = 'Guest Name,Email,Phone,Table Number,Table Name,Zone,RSVP Status,Dietary Notes,Plus One,Group';
    const rows = guests.map((g) => {
      const tbl = g.tableNumber != null ? tables.find((t) => t.tableNum === g.tableNumber) : null;
      const name = `"${(g.name || '').replace(/"/g, '""')}"`;
      const email = `"${(g.email || '').replace(/"/g, '""')}"`;
      const phone = `"${(g.phone || '').replace(/"/g, '""')}"`;
      const tblName = `"${(tbl?.name || '').replace(/"/g, '""')}"`;
      const zone = tbl?.zone || '';
      const rsvp = g.rsvpStatus || 'PENDING';
      const dietary = `"${(getEffectiveDietary(g) || '').replace(/"/g, '""')}"`;
      const plusOne = g.plusOne ? 'Yes' : 'No';
      const group = `"${(g.groupName || '').replace(/"/g, '""')}"`;
      return [name, email, phone, g.tableNumber ?? '', tblName, zone, rsvp, dietary, plusOne, group].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'seating-export.csv';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Success', description: `Exported ${guests.length} guests as CSV` });
  };

  // ======== Duplicate Table ========
  const handleDuplicateTable = async () => {
    if (!selectedTable) return;
    const tbl = selectedTable;
    const nextNum = tables.length > 0 ? Math.max(...tables.map((t) => t.tableNum)) + 1 : 1;
    try {
      const res = await fetch(TABLES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNum: nextNum,
          name: `${tbl.name || `Table ${tbl.tableNum}`} (copy)`,
          shape: tbl.shape,
          capacity: tbl.capacity,
          zone: tbl.zone,
          posX: tbl.posX + 40,
          posY: tbl.posY + 40,
          notes: tbl.notes,
        }),
      });
      if (!res.ok) throw new Error('Failed to duplicate table');
      await fetchTables();
      toast({ title: 'Success', description: `Duplicated as Table ${nextNum}` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to duplicate', variant: 'destructive' });
    }
  };

  // ======== Bulk Create Tables ========
  const handleBulkCreate = async () => {
    const nextNum = tables.length > 0 ? Math.max(...tables.map((t) => t.tableNum)) + 1 : 1;
    const startPosX = 60;
    const startPosY = 60;
    let created = 0;
    try {
      for (let i = 0; i < bulkCount; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const res = await fetch(TABLES_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableNum: nextNum + i,
            shape: bulkShape,
            capacity: 8,
            posX: startPosX + col * 180,
            posY: startPosY + row * 180,
          }),
        });
        if (res.ok) created++;
      }
      await fetchTables();
      setBulkDialogOpen(false);
      toast({ title: 'Success', description: `${created} table${created !== 1 ? 's' : ''} created` });
    } catch {
      toast({ title: 'Error', description: 'Bulk creation failed', variant: 'destructive' });
    }
  };

  // ======== Keyboard Shortcuts ========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      // Feature 1: Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTableId) {
        e.preventDefault();
        handleDeleteTable();
      }
      if (e.key === 'Escape') {
        setSelectedTableId(null);
        setReassigningGuestId(null);
        setDetailGuestId(null);
        setSelectedTableIds(new Set()); // Feature 8: clear multi-select
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTableId, handleUndo, handleRedo]);

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
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-charcoal-ink/50 mr-1">
                  {assignedCount}/{totalCount} assigned
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                      onClick={() => { setEditingGuest(null); setGuestFormOpen(true); }}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add Guest</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                      onClick={() => setGuestListOpen(true)}
                    >
                      <List className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Full Guest List</TooltipContent>
                </Tooltip>
              </div>
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

          {/* RSVP Filter */}
          <div className="px-3 py-1.5 border-b border-champagne-silk flex items-center gap-1">
            {([['all', 'All', UsersRound], ['attending', 'Attending', CheckCircle2], ['pending', 'Pending', Clock], ['declined', 'Declined', XCircle]] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                type="button"
                onClick={() => setRsvpFilter(val)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors duration-150 ${
                  rsvpFilter === val
                    ? 'bg-cinematic-gold/10 text-cinematic-gold border-cinematic-gold/30'
                    : 'text-charcoal-ink/40 border-transparent hover:text-charcoal-ink/60 hover:border-charcoal-ink/10'
                }`}
              >
                <Icon className="size-2.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
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
                    className={`group flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all duration-150 ${
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
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingGuest(guest); setGuestFormOpen(true); }}
                        className="h-5 w-5 flex items-center justify-center rounded text-charcoal-ink/30 hover:text-cinematic-gold hover:bg-cinematic-gold/10 transition-colors"
                      >
                        <Pencil className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteGuest(guest.id); }}
                        disabled={deletingGuestId === guest.id}
                        className="h-5 w-5 flex items-center justify-center rounded text-charcoal-ink/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {deletingGuestId === guest.id ? <Loader2 className="size-2.5 animate-spin" /> : <Trash2 className="size-2.5" />}
                      </button>
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
            {/* Feature 1: Undo/Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5 disabled:opacity-30 cursor-not-allowed"
                >
                  <Undo2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRedo}
                  disabled={historyIndex >= historyStack.length - 1}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5 disabled:opacity-30 cursor-not-allowed"
                >
                  <Redo2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>

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

            {/* Feature 2: Guest Labels Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGuestLabels(!showGuestLabels)}
                  className={`h-8 px-2 ${showGuestLabels ? 'text-cinematic-gold bg-cinematic-gold/5' : 'text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5'}`}
                >
                  <Tags className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showGuestLabels ? 'Hide guest labels' : 'Show guest labels'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGridSnap(!gridSnap)}
                  className={`h-8 px-2 ${gridSnap ? 'text-cinematic-gold bg-cinematic-gold/5' : 'text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5'}`}
                >
                  <Grid3x3 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{gridSnap ? 'Disable grid snap' : 'Enable grid snap (20px)'}</TooltipContent>
            </Tooltip>

            {/* Feature 4: Pan Mode */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPanMode(!isPanMode)}
                  className={`h-8 px-2 ${isPanMode ? 'text-cinematic-gold bg-cinematic-gold/5' : 'text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5'}`}
                >
                  <Hand className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pan Mode (drag to pan canvas)</TooltipContent>
            </Tooltip>

            {/* Feature 3: Table Size Slider */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-charcoal-ink/40 font-medium">Size</span>
              <Slider
                value={[tableSize]}
                onValueChange={(v) => setTableSize(v[0])}
                min={50}
                max={150}
                step={5}
                className="w-20"
              />
              <span className="text-[10px] text-charcoal-ink/50 font-medium w-8">{tableSize}%</span>
            </div>

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

            {/* Feature 7: Canvas Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-charcoal-ink/30" />
              <Input
                value={canvasSearch}
                onChange={(e) => setCanvasSearch(e.target.value)}
                placeholder="Search tables..."
                className="h-8 w-36 text-xs pl-7 pr-7 border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
              {canvasSearch && (
                <button
                  type="button"
                  onClick={() => setCanvasSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-charcoal-ink/30 hover:text-charcoal-ink"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

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

            <div className="w-px h-5 bg-champagne-silk mx-1" />

            {/* Add Table dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5"
                    >
                      <Plus className="size-3.5" />
                      <ChevronsUpDown className="size-2" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Add tables</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={async () => { await handleAddTable(); }}>Add 1 Table</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setBulkCount(5); setBulkShape('circle'); setBulkDialogOpen(true); }}>Add 5 Tables</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setBulkCount(10); setBulkShape('circle'); setBulkDialogOpen(true); }}>Add 10 Tables</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setBulkCount(20); setBulkShape('circle'); setBulkDialogOpen(true); }}>Add 20 Tables</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportPng}
                  disabled={exporting}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5"
                >
                  {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as PNG</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPrintDialogOpen(true)}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5"
                >
                  <Printer className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print-ready view</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportCsv}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5"
                >
                  <FileDown className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGuestListOpen(true)}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                >
                  <List className="size-4" />
                  <span className="hidden xl:inline text-xs ml-1.5">Guest List</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Full Guest List</TooltipContent>
            </Tooltip>
          </div>

          {/* Capacity Overview Bar */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-champagne-silk bg-paper-cream/50 text-xs text-charcoal-ink/70 flex-wrap">
            <span className="font-medium text-charcoal-ink/60"><UsersRound className="size-3 inline mr-1" />{totalSeats} seats</span>
            <span className="text-charcoal-ink/30">|</span>
            <span className="text-emerald-600"><CheckCircle2 className="size-3 inline mr-0.5" />{assignedCount} assigned</span>
            <span className="text-charcoal-ink/30">|</span>
            <span className="text-amber-600"><Clock className="size-3 inline mr-0.5" />{remainingSeats} remaining</span>
            <span className="text-charcoal-ink/30">|</span>
            <span className="text-charcoal-ink/50">{unassignedGuests.length} unassigned</span>
            <div className="flex-1 min-w-[80px]">
              <div className="w-full h-1.5 rounded-full bg-charcoal-ink/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    fillPct > 90 ? 'bg-red-400' : fillPct > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(fillPct, 100)}%` }}
                />
              </div>
            </div>
            <span className={`font-semibold text-[10px] ${
              fillPct > 90 ? 'text-red-500' : fillPct > 70 ? 'text-amber-500' : 'text-emerald-500'
            }`}>{fillPct}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAutoAssign}
              disabled={autoAssigning}
              className="h-7 px-2 text-[11px] font-medium text-cinematic-gold hover:bg-cinematic-gold/10 ml-auto"
            >
              {autoAssigning ? <Loader2 className="size-3 animate-spin mr-1" /> : <Wand2 className="size-3 mr-1" />}
              Auto-Assign
            </Button>
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
            className={`relative border border-champagne-silk rounded-lg bg-white overflow-hidden ${isPanMode ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
            style={{ height: '520px' }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                if (reassigningGuestId) setReassigningGuestId(null);
                setSelectedTableId(null);
                setSelectedTableIds(new Set());
              }
            }}
            onMouseDown={(e) => {
              // Feature 4: Pan mode
              if (isPanMode && e.target === e.currentTarget) {
                e.preventDefault();
                setIsPanning(true);
                panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y };

                const handleMove = (ev: MouseEvent) => {
                  const dx = ev.clientX - panStartRef.current.x;
                  const dy = ev.clientY - panStartRef.current.y;
                  setPanOffset({
                    x: panStartRef.current.panX + dx / (canvasScale / 100),
                    y: panStartRef.current.panY + dy / (canvasScale / 100),
                  });
                };
                const handleUp = () => {
                  setIsPanning(false);
                  document.removeEventListener('mousemove', handleMove);
                  document.removeEventListener('mouseup', handleUp);
                };
                document.addEventListener('mousemove', handleMove);
                document.addEventListener('mouseup', handleUp);
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
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${canvasScale / 100})`,
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

                {/* Feature 5: Venue Elements */}
                {venueElements.map((el) => (
                  <div
                    key={el.id}
                    className={`absolute ${el.type === 'STAGE' ? 'bg-gray-100 border border-gray-300' : 'border-dashed border-gray-300 bg-transparent'}`}
                    style={{
                      left: el.x,
                      top: el.y,
                      width: el.width,
                      height: el.height,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      venueDragRef.current = {
                        id: el.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: el.x,
                        origY: el.y,
                      };
                      const handleMove = (ev: MouseEvent) => {
                        if (!venueDragRef.current) return;
                        const dx = (ev.clientX - venueDragRef.current.startX) / (canvasScale / 100);
                        const dy = (ev.clientY - venueDragRef.current.startY) / (canvasScale / 100);
                        const newX = venueDragRef.current.origX + dx;
                        const newY = venueDragRef.current.origY + dy;
                        setVenueElements((prev) =>
                          prev.map((v) => (v.id === el.id ? { ...v, x: newX, y: newY } : v))
                        );
                      };
                      const handleUp = () => {
                        venueDragRef.current = null;
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp);
                    }}
                  >
                    <span
                      className={`absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 ${el.type === 'STAGE' ? 'rotate-90' : ''}`}
                    >
                      {el.type}
                    </span>
                  </div>
                ))}

                {tables.map((tbl) => {
                  const dims = TABLE_DIMS[tbl.shape] || TABLE_DIMS.circle;
                  const scaledW = dims.w * (tableSize / 100);
                  const scaledH = dims.h * (tableSize / 100);
                  const count = getGuestCountForTable(tbl.tableNum);
                  const isOverCapacity = count > tbl.capacity;
                  const isEmpty = count === 0;
                  const isSelected = tbl.id === selectedTableId;
                  const isDragOver = tbl.id === dragOverTableId;
                  const tableGuests = guestsAtTable(tbl.tableNum);
                  const displayName = tbl.name || `T${tbl.tableNum}`;

                  // Feature 7: Search highlight
                  const searchQ = canvasSearch.toLowerCase();
                  const isSearchMatch = searchQ && (
                    (tbl.name || '').toLowerCase().includes(searchQ) ||
                    `t${tbl.tableNum}`.includes(searchQ) ||
                    tableGuests.some((g) => g.name.toLowerCase().includes(searchQ))
                  );

                  // Feature 8: Multi-select
                  const isMultiSelected = selectedTableIds.has(tbl.id) && !isSelected;

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
                        width: scaledW,
                        height: scaledH,
                      }}
                    >
                      {/* Table shape */}
                      <div
                        onMouseDown={(e) => handleDragStart(e, tbl.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCanvasTableClick(tbl.id, e.shiftKey);
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
                        } ${isMultiSelected ? 'ring-2 ring-cinematic-gold/40' : ''} ${isSearchMatch ? 'ring-2 ring-cinematic-gold/50 animate-pulse' : ''}`}
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
                        {/* Balance bar */}
                        <div className="absolute bottom-0.5 left-2 right-2 h-[2px] rounded-full bg-charcoal-ink/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOverCapacity ? 'bg-red-400' : count / tbl.capacity > 0.9 ? 'bg-amber-400' : count / tbl.capacity > 0.7 ? 'bg-amber-300' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min((count / tbl.capacity) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Feature 2: Radial guest labels (when showGuestLabels is true) */}
                      {showGuestLabels && tableGuests.map((guest, gi) => {
                        const dietary = getEffectiveDietary(guest);
                        const tableRadius = scaledW / 2;
                        const angle = (gi / Math.max(tableGuests.length, 1)) * 2 * Math.PI - Math.PI / 2;
                        const labelRadius = tableRadius + 18;
                        const cx = scaledW / 2 + Math.cos(angle) * labelRadius;
                        const cy = scaledH / 2 + Math.sin(angle) * labelRadius;

                        return (
                          <div
                            key={`label-${guest.id}`}
                            className="absolute text-[10px] text-charcoal-ink/70 whitespace-nowrap truncate max-w-[70px]"
                            style={{
                              left: cx,
                              top: cy,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            {guest.name.split(' ')[0]}{dietary ? <span className="text-red-500">*</span> : ''}
                          </div>
                        );
                      })}

                      {/* Guest labels around table */}
                      {tableGuests.map((guest, gi) => {
                        const dietary = getEffectiveDietary(guest);
                        const angle = (gi / Math.max(tableGuests.length, 1)) * 2 * Math.PI - Math.PI / 2;
                        const radius = (scaledW / 2) + 40;
                        const gx = scaledW / 2 + Math.cos(angle) * radius - 50;
                        const gy = scaledH / 2 + Math.sin(angle) * radius - 10;

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
            {/* Feature 8: Multi-select floating action bar */}
            {selectedTableIds.size > 0 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-lg bg-charcoal-ink/90 text-white px-3 py-1.5 shadow-lg">
                <span className="text-xs font-medium">{selectedTableIds.size} table{selectedTableIds.size !== 1 ? 's' : ''} selected</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-white hover:bg-white/10">
                      Assign Zone
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {ZONE_OPTIONS.filter((z) => z.value).map((z) => (
                      <DropdownMenuItem
                        key={z.value}
                        onClick={async () => {
                          for (const id of selectedTableIds) {
                            const tbl = tables.find((t) => t.id === id);
                            if (!tbl) continue;
                            await fetch(TABLES_API, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id, zone: z.value }),
                            });
                          }
                          await fetchTables();
                          setSelectedTableIds(new Set());
                          toast({ title: 'Success', description: `Zone assigned to ${selectedTableIds.size} tables` });
                        }}
                      >
                        {z.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-red-300 hover:text-red-200 hover:bg-red-500/20"
                  onClick={async () => {
                    if (!confirm(`Delete ${selectedTableIds.size} selected tables?`)) return;
                    pushHistory();
                    for (const id of selectedTableIds) {
                      await fetch(`${TABLES_API}&id=${id}`, { method: 'DELETE' });
                    }
                    await fetchTables();
                    await fetchAllGuests();
                    setSelectedTableIds(new Set());
                    toast({ title: 'Success', description: `${selectedTableIds.size} tables deleted` });
                  }}
                >
                  Delete All
                </Button>
              </div>
            )}
          </div>

          {/* Feature 6: Zone/Dietary Overview Panel */}
          <div className="rounded-lg border border-champagne-silk bg-paper-cream/30 p-4">
            <button
              type="button"
              onClick={() => setZonePanelOpen(!zonePanelOpen)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold tracking-wider text-charcoal-ink/60">ZONES</span>
                <span className="text-[10px] font-semibold tracking-wider text-charcoal-ink/60">DIETARY OVERVIEW</span>
              </div>
              {zonePanelOpen ? <ChevronDown className="size-3.5 text-charcoal-ink/40" /> : <ChevronUp className="size-3.5 text-charcoal-ink/40" />}
            </button>
            {zonePanelOpen && (
              <div className="flex gap-6 mt-3">
                {/* Left: Zone Summary */}
                <div className="flex-1 space-y-2">
                  {Object.keys(zoneSummary).length === 0 || (Object.keys(zoneSummary).length === 1 && zoneSummary['_none']) ? (
                    <p className="text-xs text-charcoal-ink/30 italic">No zones defined</p>
                  ) : (
                    Object.entries(zoneSummary).filter(([k]) => k !== '_none').map(([zone, data]) => (
                      <div key={zone} className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ZONE_COLORS[zone] || 'bg-gray-100 text-gray-600'}`}>
                          {zone.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-charcoal-ink/50">{data.tables} tables</span>
                        <div className="flex-1 h-1 rounded-full bg-charcoal-ink/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-cinematic-gold/60"
                            style={{ width: `${data.capacity > 0 ? (data.assigned / data.capacity) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Right: Dietary Overview */}
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {Object.keys(dietarySummary.counts).length === 0 && dietarySummary.otherCount === 0 ? (
                    <p className="text-xs text-charcoal-ink/30 italic">No dietary requirements</p>
                  ) : (
                    <>
                      {dietarySummary.counts['vegetarian'] != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                          Vegetarian {dietarySummary.counts['vegetarian']}
                        </span>
                      )}
                      {dietarySummary.counts['vegan'] != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                          Vegan {dietarySummary.counts['vegan']}
                        </span>
                      )}
                      {dietarySummary.counts['gluten-free'] != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                          Gluten-Free {dietarySummary.counts['gluten-free']}
                        </span>
                      )}
                      {dietarySummary.counts['halal'] != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">
                          Halal {dietarySummary.counts['halal']}
                        </span>
                      )}
                      {dietarySummary.counts['kosher'] != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                          Kosher {dietarySummary.counts['kosher']}
                        </span>
                      )}
                      {dietarySummary.counts['nut-free'] != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                          Nut-Free {dietarySummary.counts['nut-free']}
                        </span>
                      )}
                      {dietarySummary.counts['dairy-free'] != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                          Dairy-Free {dietarySummary.counts['dairy-free']}
                        </span>
                      )}
                      {dietarySummary.otherCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                          Other {dietarySummary.otherCount}
                        </span>
                      )}
                    </>
                  )}
                </div>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDuplicateTable}
                        className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate table</TooltipContent>
                  </Tooltip>
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
                  {guestsAtTable(selectedTable.tableNum).map((g, idx) => {
                    const dietary = getEffectiveDietary(g);
                    return (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-charcoal-ink/5 px-2.5 py-1.5 hover:border-champagne-silk transition-colors"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="text-[10px] font-medium text-charcoal-ink/30 w-4 text-right shrink-0">{idx + 1}.</span>
                          <div
                            className="min-w-0 cursor-pointer"
                            onClick={() => setDetailGuestId(g.id)}
                          >
                            <span className="text-xs font-semibold text-charcoal-ink truncate">{g.name}</span>
                            {dietary && (
                              <span className="flex items-center gap-0.5 text-[10px] text-red-500/70 shrink-0">
                                <UtensilsCrossed className="size-2.5" />
                                <span className="hidden sm:inline">{truncate(dietary, 16)}</span>
                              </span>
                            )}
                            {g.plusOne && (
                              <span className="flex items-center gap-0.5 text-[10px] text-pink-400/70 shrink-0" title={g.plusOneName || 'Plus one'}>
                                <UserPlus className="size-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setEditingGuest(g); setGuestFormOpen(true); }}
                            className="text-charcoal-ink/30 hover:text-cinematic-gold transition-colors"
                            title="Edit guest"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReassignGuest(g.id, null)}
                            className="text-[10px] text-red-400 hover:text-red-600 underline"
                            title="Unassign"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
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

      {/* ======== PRINT DIALOG ======== */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">Print-Ready Seating Chart</DialogTitle>
            <DialogDescription className="text-charcoal-ink/50">
              Clean layout for printing. Use the Print button below.
            </DialogDescription>
          </DialogHeader>
          <div className="print-area space-y-6 p-4">
            {tables.sort((a, b) => a.tableNum - b.tableNum).map((tbl) => {
              const tblGuests = guestsAtTable(tbl.tableNum);
              return (
                <div key={tbl.id} className="border border-charcoal-ink/10 rounded-lg p-4 print:break-inside-avoid">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-bold text-charcoal-ink">
                      {tbl.name || `Table ${tbl.tableNum}`}
                    </h3>
                    <span className="text-xs text-charcoal-ink/50">({tblGuests.length}/{tbl.capacity})</span>
                    {tbl.zone && (
                      <Badge variant="outline" className={`text-[10px] ${ZONE_COLORS[tbl.zone] || ''}`}>
                        {tbl.zone.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  {tblGuests.length > 0 ? (
                    <ul className="space-y-1">
                      {tblGuests.map((g) => {
                        const dietary = getEffectiveDietary(g);
                        return (
                          <li key={g.id} className="text-xs text-charcoal-ink/80">
                            {g.name}{dietary ? ` (${dietary})` : ''}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-charcoal-ink/30 italic">No guests assigned</p>
                  )}
                </div>
              );
            })}
            {unassignedGuests.length > 0 && (
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30 print:break-inside-avoid">
                <h3 className="text-sm font-bold text-amber-700 mb-2">
                  Unassigned Guests ({unassignedGuests.length})
                </h3>
                <ul className="space-y-1">
                  {unassignedGuests.map((g) => {
                    const dietary = getEffectiveDietary(g);
                    return (
                      <li key={g.id} className="text-xs text-charcoal-ink/70">
                        {g.name}{dietary ? ` (${dietary})` : ''}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPrintDialogOpen(false)}
              className="border-charcoal-ink/15 text-charcoal-ink"
            >
              Close
            </Button>
            <Button
              onClick={() => window.print()}
              className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90"
            >
              <Printer className="size-4 mr-1.5" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== BULK ADD DIALOG ======== */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">Bulk Create Tables</DialogTitle>
            <DialogDescription className="text-charcoal-ink/50">
              Create multiple tables at once with staggered positions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-charcoal-ink/70">Number of Tables</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-charcoal-ink/70">Shape</Label>
              <Select value={bulkShape} onValueChange={setBulkShape}>
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
              className="border-charcoal-ink/15 text-charcoal-ink"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkCreate}
              className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90"
            >
              <Plus className="size-4 mr-1.5" />
              Create {bulkCount} Tables
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Guest Form Dialog (sidebar add/edit) */}
      <GuestFormDialog
        open={guestFormOpen}
        onOpenChange={setGuestFormOpen}
        editGuest={editingGuest}
        onSaved={fetchAllGuests}
      />

      {/* Guest List Sheet (full management) */}
      <GuestListSheet
        open={guestListOpen}
        onOpenChange={setGuestListOpen}
        onGuestsChanged={fetchAllGuests}
      />
    </TooltipProvider>
  );
}
