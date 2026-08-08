'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Loader2, Plus, Trash2, Users,
  ZoomIn, ZoomOut, Circle, Square, RectangleHorizontal,
  AlertCircle, UtensilsCrossed, Lock, Unlock,
  ImagePlus, ImageOff, Maximize, ChevronRight, Mail, Phone,
  UserPlus, ArrowRightLeft, Ban, X, Pencil,
  Wand2, Grid3x3, Download, Printer, Copy, FileDown,
  UsersRound, CheckCircle2, Clock, ChevronsUpDown,
  List,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
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
  getEffectiveDietary, truncate,
} from './guest-types';
import GuestFormDialog from './GuestFormDialog';
import GuestListSheet from './GuestListSheet';

// ---- Constants (canvas-only) ----
const FLOORPLAN_API = '/api/cms/floorplan?XTransformPort=3000';

const SHAPE_ICONS: Record<string, React.ReactNode> = {
  circle: <Circle className="size-3.5" />,
  rectangle: <Square className="size-3.5" />,
  oval: <RectangleHorizontal className="size-3.5" />,
};
const ZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '__none__', label: 'None' },
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
  const [editingZone, setEditingZone] = useState('__none__');
  const [editingNotes, setEditingNotes] = useState('');
  const [savingTable, setSavingTable] = useState(false);


  // Guest detail drawer
  const [detailGuestId, setDetailGuestId] = useState<string | null>(null);

  // Swap dialog
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapTargetTableId, setSwapTargetTableId] = useState<string | null>(null);
  const [swapGuestId, setSwapGuestId] = useState<string | null>(null);

  // Phase 3+4 state
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
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  // Drag state (table drag)
  const dragRef = useRef<{
    tableId: string;
    startX: number;
    startY: number;
    origPosX: number;
    origPosY: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

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


  const assignedCount = guests.filter((g) => g.tableNumber != null).length;
  const totalCount = guests.length;
  const totalSeats = tables.reduce((sum, t) => sum + t.capacity, 0);
  const remainingSeats = Math.max(0, totalSeats - assignedCount);
  const fillPct = totalSeats > 0 ? Math.round((assignedCount / totalSeats) * 100) : 0;

  // ======== Table CRUD ========
  const handleAddTable = async () => {
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
          zone: editingZone === '__none__' ? null : editingZone,
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

  // Immediate save with explicit field values (avoids stale closure)
  const handleSaveTableEditsWith = async (fields: { tableName?: string; tableNum?: string; zone?: string; shape?: string; capacity?: number; notes?: string }) => {
    if (!selectedTableId) return;
    try {
      const res = await fetch(TABLES_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTableId,
          name: (fields.tableName ?? '').trim() || undefined,
          tableNum: parseInt(String(fields.tableNum), 10),
          zone: fields.zone === '__none__' ? null : fields.zone,
          shape: fields.shape,
          capacity: fields.capacity,
          notes: (fields.notes ?? '').trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update table');
      }
      await fetchTables();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update table', variant: 'destructive' });
    }
  };

  // Debounced auto-save for table properties
  // Use refs to avoid stale closure — the timeout fires after state updates
  const editFieldsRef = useRef({
    tableName: '', tableNum: '', shape: 'circle', capacity: 8, zone: '__none__', notes: '',
  });
  editFieldsRef.current = {
    tableName: editingTableName, tableNum: editingTableNum, shape: editingShape,
    capacity: editingCapacity, zone: editingZone, notes: editingNotes,
  };

  const debouncedSaveTable = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      if (!selectedTableId) return;
      const f = editFieldsRef.current;
      try {
        const res = await fetch(TABLES_API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedTableId,
            name: f.tableName.trim() || undefined,
            tableNum: parseInt(f.tableNum, 10),
            zone: f.zone === '__none__' ? null : f.zone,
            shape: f.shape,
            capacity: f.capacity,
            notes: f.notes.trim() || undefined,
          }),
        });
        if (!res.ok) throw new Error('Failed to update table');
        await fetchTables();
        toast({ title: 'Success', description: 'Table updated' });
      } catch (err) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update table', variant: 'destructive' });
      }
    }, 800);
  }, [selectedTableId]);

  // Populate edit fields when a table is selected
  useEffect(() => {
    const tbl = tables.find((t) => t.id === selectedTableId);
    if (tbl) {
      setEditingTableName(tbl.name || '');
      setEditingTableNum(String(tbl.tableNum));
      setEditingShape(tbl.shape || 'circle');
      setEditingCapacity(tbl.capacity || 8);
      setEditingZone(tbl.zone || '__none__');
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
  // Ref to track latest dragged position for API persistence (avoids stale closure)
  const latestDragPos = useRef<{ posX: number; posY: number } | null>(null);

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
    latestDragPos.current = { posX: tbl.posX, posY: tbl.posY };

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!dragRef.current) return;
        const scale = canvasScale / 100;
        const dx = (ev.clientX - dragRef.current.startX) / scale;
        const dy = (ev.clientY - dragRef.current.startY) / scale;
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
      });
    };

    const handleUp = async () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTableId) {
        e.preventDefault();
        handleDeleteTable();
      }
      if (e.key === 'Escape') {
        setSelectedTableId(null);
        setReassigningGuestId(null);
        setDetailGuestId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTableId]);

  // ======== Detail Drawer Guest ========
  const detailGuest = guests.find((g) => g.id === detailGuestId);

  // ======== Content Bounds (dynamic virtual canvas) ========
  const contentBounds = useMemo(() => {
    if (tables.length === 0) return { w: 800, h: 500 };
    let maxX = 0, maxY = 0;
    tables.forEach(t => {
      const dims = TABLE_DIMS[t.shape] || TABLE_DIMS.circle;
      const r = (Math.max(dims.w, dims.h) / 2) + 100;
      maxX = Math.max(maxX, t.posX + dims.w + r);
      maxY = Math.max(maxY, t.posY + dims.h + 60);
    });
    return { w: Math.max(maxX + 40, 400), h: Math.max(maxY + 40, 300) };
  }, [tables]);

  // ======== Auto-Fit Scale ========
  const autoFitScale = useCallback(() => {
    if (!canvasRef.current) {
      setCanvasScale(100);
      return;
    }
    const container = canvasRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) return;
    const scaleX = cw / contentBounds.w;
    const scaleY = ch / contentBounds.h;
    const fit = Math.min(scaleX, scaleY) * 100;
    setCanvasScale(Math.max(30, Math.min(200, Math.round(fit / 5) * 5)));
  }, [contentBounds]);

  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    if (!tablesLoading && tables.length > 0 && !initialFitDoneRef.current) {
      initialFitDoneRef.current = true;
      requestAnimationFrame(() => autoFitScale());
    }
  }, [tablesLoading, tables.length, autoFitScale]);

  // ======== Cleanup ========
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ======== Render ========
  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={outerRef}
        data-seating-canvas
        className="-mt-[28px] sm:-mt-[40px] md:-mt-[56px] -mx-[28px] sm:-mx-[40px] md:-mx-[56px] -mb-[96px] sm:-mb-[104px] md:-mb-[56px] flex flex-col overflow-y-auto rounded-lg"
      >
        {/* ======== SECTION 1: CANVAS AREA (top) ======== */}
        <div className="flex flex-col gap-2 min-w-0"> 
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-1 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={autoFitScale}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5"
                >
                  <Maximize className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit View</TooltipContent>
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
                  onClick={() => { setEditingGuest(null); setGuestFormOpen(true); }}
                  className="h-8 px-2 text-charcoal-ink/50 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                >
                  <UserPlus className="size-3.5" />
                  <span className="hidden xl:inline text-xs ml-1.5">Add Guest</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Guest</TooltipContent>
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
            className="relative h-[58vh] min-h-[400px] border border-champagne-silk rounded-lg bg-[radial-gradient(circle,_#d4d4d4_1px,_transparent_1px)] [background-size:20px_20px] overflow-hidden"
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
              <div className="w-full h-full flex items-center justify-center">
                <div
                  style={{
                    transform: `scale(${canvasScale / 100})`,
                    transformOrigin: 'center center',
                    width: `${contentBounds.w}px`,
                    height: `${contentBounds.h}px`,
                  }}
                  className="relative shrink-0"
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
                  let circleDepthCls = tbl.shape === 'circle'
                    ? 'shadow-[inset_0_1px_2px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.08)]'
                    : '';
                  if (tbl.shape === 'rectangle') shapeCls = 'rounded-md';
                  if (tbl.shape === 'oval') shapeCls = 'rounded-lg';

                  const isDragging = dragRef.current?.tableId === tbl.id;

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
                        className={`absolute inset-0 border-2 ${borderCls} ${shapeCls} ${circleDepthCls} bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-200 will-change-transform ${isDragging ? 'z-50' : ''} ${
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

                      {/* Guest labels around table — shape-aware distribution */}
                      {tableGuests.map((guest, gi) => {
                        const dietary = getEffectiveDietary(guest);
                        const total = tableGuests.length;

                        // Shape-aware position calculation
                        let gx: number, gy: number;
                        const padding = 38;

                        if (tbl.shape === 'oval') {
                          const angle = (gi / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
                          const rx = dims.w / 2 + padding;
                          const ry = dims.h / 2 + padding;
                          gx = dims.w / 2 + Math.cos(angle) * rx;
                          gy = dims.h / 2 + Math.sin(angle) * ry;
                        } else if (tbl.shape === 'rectangle') {
                          const perimeter = 2 * (dims.w + dims.h);
                          const step = perimeter / Math.max(total, 1);
                          let dist = step * gi;
                          if (dist < dims.w) {
                            gx = dist; gy = -padding;
                          } else if (dist < dims.w + dims.h) {
                            gx = dims.w + padding; gy = dist - dims.w;
                          } else if (dist < 2 * dims.w + dims.h) {
                            gx = dims.w - (dist - dims.w - dims.h); gy = dims.h + padding;
                          } else {
                            gx = -padding; gy = dims.h - (dist - 2 * dims.w - dims.h);
                          }
                        } else {
                          const angle = (gi / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
                          const radius = dims.w / 2 + padding;
                          gx = dims.w / 2 + Math.cos(angle) * radius;
                          gy = dims.h / 2 + Math.sin(angle) * radius;
                        }

                        gx = Math.max(-20, Math.min(dims.w + 20, gx));
                        gy = Math.max(-10, Math.min(dims.h + 20, gy));

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
                                  left: gx,
                                  top: gy,
                                  transform: 'translate(-50%, -50%)',
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
            </div>
          )}
          </div>
        </div>

        {/* ======== INLINE GUEST PANEL ======== */}
        {selectedTable && (
          <div className="border border-champagne-silk border-t-0 rounded-b-lg bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-charcoal-ink">
                    {selectedTable.name || `Table ${selectedTable.tableNum}`}
                  </span>
                  {selectedTable.zone && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${ZONE_COLORS[selectedTable.zone] || ''}`}>
                      {selectedTable.zone.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-charcoal-ink/50 flex items-center gap-1">
                  {SHAPE_ICONS[selectedTable.shape]}
                  {selectedTable.capacity} seats
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditSheetOpen(true)}
                      className="h-7 w-7 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Table</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTableId(null)}
                      className="h-7 w-7 p-0 text-charcoal-ink/40 hover:text-charcoal-ink hover:bg-charcoal-ink/5"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="max-h-[35vh] overflow-y-auto">
              <div className="space-y-1.5">
                {guestsAtTable(selectedTable.tableNum).map((g) => {
                  const dietary = getEffectiveDietary(g);
                  return (
                    <div key={g.id} className="flex items-center justify-between gap-2 rounded-md border border-charcoal-ink/5 px-2.5 py-1.5 hover:border-champagne-silk transition-colors">
                      <div className="min-w-0 flex items-center gap-2">
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
                      <button
                        type="button"
                        onClick={() => handleReassignGuest(g.id, null)}
                        className="text-[10px] text-red-400 hover:text-red-600 shrink-0 underline"
                        title="Unassign"
                      >Remove</button>
                    </div>
                  );
                })}
                {getGuestCountForTable(selectedTable.tableNum) === 0 && (
                  <p className="text-xs text-charcoal-ink/30 italic py-2 text-center">No guests assigned</p>
                )}
              </div>

              {unassignedGuests.length > 0 && (
                <>
                  <Separator className="bg-champagne-silk my-3" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-ink/50">
                        Add Guest
                      </h4>
                      <span className="text-[10px] text-charcoal-ink/30">{unassignedGuests.length} available</span>
                    </div>
                    <Select
                      onValueChange={(v) => {
                        const guestId = v;
                        const count = getGuestCountForTable(selectedTable.tableNum);
                        if (count < selectedTable.capacity) {
                          handleReassignGuest(guestId, selectedTable.tableNum);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs border-charcoal-ink/10 focus:border-cinematic-gold">
                        <SelectValue placeholder="Select a guest to add..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedGuests.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======== EDIT TABLE SHEET (simplified, edit-only) ======== */}
      <Sheet open={editSheetOpen} onOpenChange={(open) => { if (!open) setEditSheetOpen(false); }}>
        <SheetContent side="right" className="w-[360px] p-0 overflow-y-auto">
          {selectedTable && (
            <>
              <SheetHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                  <SheetTitle className="text-charcoal-ink text-sm font-semibold truncate">
                    Edit Table
                  </SheetTitle>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDuplicateTable}
                        className="h-7 w-7 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
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
                    className="h-7 w-7 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </SheetHeader>

              <Separator className="bg-champagne-silk" />

              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Table Name</Label>
                  <Input
                    value={editingTableName}
                    onChange={(e) => { setEditingTableName(e.target.value); debouncedSaveTable(); }}
                    placeholder="e.g. VIP Table"
                    className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Table Number</Label>
                  <Input
                    value={editingTableNum}
                    onChange={(e) => { setEditingTableNum(e.target.value); debouncedSaveTable(); }}
                    type="number"
                    className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Shape</Label>
                  <Select
                    value={editingShape}
                    onValueChange={(v) => {
                      setEditingShape(v);
                      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                      handleSaveTableEditsWith({ ...editFieldsRef.current, shape: v });
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="circle">
                        <span className="flex items-center gap-2">{SHAPE_ICONS.circle} Round</span>
                      </SelectItem>
                      <SelectItem value="rectangle">
                        <span className="flex items-center gap-2">{SHAPE_ICONS.rectangle} Square</span>
                      </SelectItem>
                      <SelectItem value="oval">
                        <span className="flex items-center gap-2">{SHAPE_ICONS.oval} Long Rectangle</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Capacity</Label>
                  <Input
                    value={editingCapacity}
                    onChange={(e) => { setEditingCapacity(parseInt(e.target.value, 10) || 1); debouncedSaveTable(); }}
                    type="number" min={1} max={50}
                    className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Zone</Label>
                  <Select value={editingZone} onValueChange={(v) => { setEditingZone(v); debouncedSaveTable(); }}>
                    <SelectTrigger className="h-8 text-sm border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {ZONE_OPTIONS.map((z) => (
                        <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-charcoal-ink/70">Notes</Label>
                  <Textarea
                    value={editingNotes}
                    onChange={(e) => { setEditingNotes(e.target.value); debouncedSaveTable(); }}
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
            </>
          )}
        </SheetContent>
      </Sheet>

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
                  <SelectItem value="circle">Round</SelectItem>
                  <SelectItem value="rectangle">Square</SelectItem>
                  <SelectItem value="oval">Long Rectangle</SelectItem>
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
