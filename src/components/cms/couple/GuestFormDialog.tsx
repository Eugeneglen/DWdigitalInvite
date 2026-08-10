'use client';

import { useState, useEffect } from 'react';
import { Loader2, Crown, Baby, PersonStanding } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  API_BASE, emptyGuestForm, type GuestFormData, type GuestItem,
  SIDE_OPTIONS, RELATIONSHIP_OPTIONS, CATEGORY_OPTIONS,
} from './guest-types';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

interface GuestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGuest?: GuestItem | null;
  defaultTableNumber?: string;
  onSaved: () => void;
}

export default function GuestFormDialog({ open, onOpenChange, editGuest, defaultTableNumber, onSaved }: GuestFormDialogProps) {
  const [form, setForm] = useState<GuestFormData>(emptyGuestForm);
  const [saving, setSaving] = useState(false);

  // Sync form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (editGuest) {
      setForm({
        name: editGuest.name,
        chineseName: editGuest.chineseName ?? '',
        email: editGuest.email ?? '',
        phone: editGuest.phone ?? '',
        groupName: editGuest.groupName ?? '',
        side: editGuest.side ?? '',
        relationship: editGuest.relationship ?? '',
        invitedBy: editGuest.invitedBy ?? '',
        category: editGuest.category ?? '',
        tableNumber: editGuest.tableNumber != null ? String(editGuest.tableNumber) : (defaultTableNumber ?? ''),
        plusOne: editGuest.plusOne,
        plusOneName: editGuest.plusOneName ?? '',
        seatCount: String(editGuest.seatCount || 1),
        dietaryNotes: editGuest.dietaryNotes ?? '',
        isVip: editGuest.isVip,
        isElderly: editGuest.isElderly,
        needsBabyChair: editGuest.needsBabyChair,
        specialNotes: editGuest.specialNotes ?? '',
      });
    } else {
      setForm({ ...emptyGuestForm, tableNumber: defaultTableNumber ?? '' });
    }
  }, [open, editGuest, defaultTableNumber]);

  const updateField = <K extends keyof GuestFormData>(key: K, value: GuestFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePlusOneChange = (checked: boolean) => {
    setForm((prev) => {
      const next = { ...prev, plusOne: checked };
      if (checked && prev.seatCount === '1') next.seatCount = '2';
      if (!checked) next.plusOneName = '';
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Guest name is required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        groupName: form.groupName.trim() || undefined,
        side: form.side || undefined,
        relationship: form.relationship || undefined,
        invitedBy: form.invitedBy.trim() || undefined,
        category: form.category || undefined,
        tableNumber: form.tableNumber ? parseInt(form.tableNumber, 10) : undefined,
        plusOne: form.plusOne,
        plusOneName: form.plusOneName.trim() || undefined,
        seatCount: parseInt(form.seatCount, 10) || 1,
        dietaryNotes: form.dietaryNotes.trim() || undefined,
        isVip: form.isVip,
        isElderly: form.isElderly,
        needsBabyChair: form.needsBabyChair,
        specialNotes: form.specialNotes.trim() || undefined,
      };
      let res: Response;
      if (editGuest?.id) {
        res = await fetch(API_BASE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editGuest.id, ...payload }),
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
      toast({ title: 'Success', description: editGuest?.id ? 'Guest updated successfully' : 'Guest added successfully' });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save guest', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20';
  const sectionCls = 'text-[11px] font-semibold uppercase tracking-[0.1em] text-cinematic-gold mb-2 mt-4 first:mt-0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle className="text-charcoal-ink">
            {editGuest?.id ? 'Edit Guest' : 'Add New Guest'}
          </DialogTitle>
          <DialogDescription className="text-charcoal-ink/50">
            {editGuest?.id ? 'Update guest information below.' : 'Add a new guest to your wedding list.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 space-y-1 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-champagne-silk/50 [&::-webkit-scrollbar-thumb]:rounded-full">
          {/* === Section 1: Basic Info === */}
          <p className={sectionCls}>Basic Information</p>

          <div className="space-y-1.5">
            <Label htmlFor="gf-name" className="text-sm font-medium text-charcoal-ink/70">
              Full Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="gf-name" value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Sarah Tan"
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gf-chinese" className="text-sm font-medium text-charcoal-ink/70">
              Chinese Name <span className="text-charcoal-ink/30 text-xs">(华文名)</span>
            </Label>
            <Input
              id="gf-chinese" value={form.chineseName}
              onChange={(e) => updateField('chineseName', e.target.value)}
              placeholder="e.g. 陈大明"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gf-email" className="text-sm font-medium text-charcoal-ink/70">Email</Label>
              <Input
                id="gf-email" type="email" value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="sarah@email.com" className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-phone" className="text-sm font-medium text-charcoal-ink/70">Phone</Label>
              <Input
                id="gf-phone" type="tel" value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+65 9123 4567" className={inputCls}
              />
            </div>
          </div>

          {/* === Section 2: Wedding Organization === */}
          <p className={sectionCls}>Wedding Organization</p>

          {/* Side: Two radio-style cards */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-charcoal-ink/70">Side</Label>
            <div className="grid grid-cols-2 gap-2">
              {SIDE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField('side', opt.value)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-all duration-150 cursor-pointer ${
                    form.side === opt.value
                      ? 'border-cinematic-gold bg-cinematic-gold/10 text-cinematic-gold'
                      : 'border-charcoal-ink/10 text-charcoal-ink/60 hover:border-charcoal-ink/25 hover:text-charcoal-ink/80'
                  }`}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-charcoal-ink/70">Relationship</Label>
              <Select value={form.relationship} onValueChange={(v) => updateField('relationship', v)}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-invitedby" className="text-sm font-medium text-charcoal-ink/70">Invited By</Label>
              <Input
                id="gf-invitedby" value={form.invitedBy}
                onChange={(e) => updateField('invitedBy', e.target.value)}
                placeholder="e.g. Groom's Mother" className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-charcoal-ink/70">Category</Label>
              <Select value={form.category} onValueChange={(v) => updateField('category', v)}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-group" className="text-sm font-medium text-charcoal-ink/70">Group / Family</Label>
              <Input
                id="gf-group" value={form.groupName}
                onChange={(e) => updateField('groupName', e.target.value)}
                placeholder="e.g. Bride's Family" className={inputCls}
              />
            </div>
          </div>

          {/* === Section 3: Table & Seating === */}
          <p className={sectionCls}>Table & Seating</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gf-table" className="text-sm font-medium text-charcoal-ink/70">Table Number</Label>
              <Input
                id="gf-table" type="number" value={form.tableNumber}
                onChange={(e) => updateField('tableNumber', e.target.value)}
                placeholder="e.g. 5" className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-seats" className="text-sm font-medium text-charcoal-ink/70">Seats Needed</Label>
              <Input
                id="gf-seats" type="number" min={1} max={20} value={form.seatCount}
                onChange={(e) => updateField('seatCount', e.target.value)}
                placeholder="1" className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-charcoal-ink/5 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-charcoal-ink/70">Plus One</Label>
              <p className="text-xs text-charcoal-ink/40">Guest can bring a plus one</p>
            </div>
            <Switch checked={form.plusOne} onCheckedChange={handlePlusOneChange} />
          </div>

          {form.plusOne && (
            <div className="space-y-1.5">
              <Label htmlFor="gf-plusone" className="text-sm font-medium text-charcoal-ink/70">Plus One Name</Label>
              <Input
                id="gf-plusone" value={form.plusOneName}
                onChange={(e) => updateField('plusOneName', e.target.value)}
                placeholder="e.g. John Lim" className={inputCls}
              />
            </div>
          )}

          {/* === Section 4: Special Requirements === */}
          <p className={sectionCls}>Special Requirements</p>

          <div className="space-y-1.5">
            <Label htmlFor="gf-dietary" className="text-sm font-medium text-charcoal-ink/70">Dietary Notes</Label>
            <Input
              id="gf-dietary" value={form.dietaryNotes}
              onChange={(e) => updateField('dietaryNotes', e.target.value)}
              placeholder="e.g. Vegetarian, nut allergy" className={inputCls}
            />
          </div>

          {/* Toggle switches with icons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-charcoal-ink/5 p-3">
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-amber-500" />
                <Label className="text-sm font-medium text-charcoal-ink/70">VIP Guest</Label>
              </div>
              <Switch checked={form.isVip} onCheckedChange={(v) => updateField('isVip', v)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-charcoal-ink/5 p-3">
              <div className="flex items-center gap-2">
                <PersonStanding className="size-4 text-blue-500" />
                <Label className="text-sm font-medium text-charcoal-ink/70">Needs Elderly Assistance</Label>
              </div>
              <Switch checked={form.isElderly} onCheckedChange={(v) => updateField('isElderly', v)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-charcoal-ink/5 p-3">
              <div className="flex items-center gap-2">
                <Baby className="size-4 text-pink-500" />
                <Label className="text-sm font-medium text-charcoal-ink/70">Needs Baby Chair</Label>
              </div>
              <Switch checked={form.needsBabyChair} onCheckedChange={(v) => updateField('needsBabyChair', v)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gf-notes" className="text-sm font-medium text-charcoal-ink/70">Special Notes</Label>
            <Textarea
              id="gf-notes" rows={2} value={form.specialNotes}
              onChange={(e) => updateField('specialNotes', e.target.value)}
              placeholder="Any other notes..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 px-6 pb-5 shrink-0 border-t border-charcoal-ink/5 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
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
              <><Loader2 className="size-4 animate-spin mr-2" />Saving…</>
            ) : editGuest?.id ? (
              'Update Guest'
            ) : (
              'Add Guest'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
