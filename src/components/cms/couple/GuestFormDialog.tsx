'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { API_BASE, emptyGuestForm, type GuestFormData, type GuestItem } from './guest-types';
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

  // Populate form when dialog opens — useEffect because Radix Dialog
  // does NOT fire onOpenChange(true) when opened via controlled `open` prop
  useEffect(() => {
    if (open) {
      if (editGuest) {
        setForm({
          name: editGuest.name,
          email: editGuest.email ?? '',
          phone: editGuest.phone ?? '',
          groupName: editGuest.groupName ?? '',
          tableNumber: editGuest.tableNumber != null ? String(editGuest.tableNumber) : (defaultTableNumber ?? ''),
          plusOne: editGuest.plusOne,
          plusOneName: editGuest.plusOneName ?? '',
          dietaryNotes: editGuest.dietaryNotes ?? '',
        });
      } else {
        setForm({ ...emptyGuestForm, tableNumber: defaultTableNumber ?? '' });
      }
    }
  }, [open, editGuest, defaultTableNumber]);

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
        plusOneName: form.plusOneName.trim() || undefined,
        dietaryNotes: form.dietaryNotes.trim() || undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-charcoal-ink">
            {editGuest?.id ? 'Edit Guest' : 'Add New Guest'}
          </DialogTitle>
          <DialogDescription className="text-charcoal-ink/50">
            {editGuest?.id ? 'Update guest information below.' : 'Add a new guest to your wedding list.'}
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
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Saving…
              </>
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
