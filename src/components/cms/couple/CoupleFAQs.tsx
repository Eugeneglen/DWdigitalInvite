'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import SectionContentFields, { type ContentField } from './SectionContentFields';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

const API_BASE = '/api/cms/faqs?XTransformPort=3000';

const QA_CONTENT_FIELDS: ContentField[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'e.g. Questions & Answers' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'e.g. Everything you need to know' },
  { key: 'contactPrompt', label: 'Contact Prompt', type: 'text', placeholder: 'e.g. Still have questions? Message the couple' },
  { key: 'contactEmail', label: 'Contact Email', type: 'text', placeholder: 'e.g. concierge@example.com' },
  { key: 'ctaEyebrow', label: 'CTA Eyebrow Text', type: 'text', placeholder: 'e.g. NEED MORE HELP?' },
  { key: 'ctaDescription', label: 'CTA Description', type: 'textarea', placeholder: 'Description text below the CTA heading...' },
  { key: 'ctaButtonLabel', label: 'CTA Button Label', type: 'text', placeholder: 'e.g. Message the Couple' },
];

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
}

interface FormData {
  question: string;
  answer: string;
  isActive: boolean;
}

const emptyForm: FormData = {
  question: '',
  answer: '',
  isActive: true,
};

export default function CoupleFAQs() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchFAQs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load FAQs');
      const data = await res.json();
      setFaqs(data.faqs ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load FAQs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFAQs();
  }, [fetchFAQs]);

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: FAQItem) => {
    setEditingId(item.id);
    setForm({
      question: item.question,
      answer: item.answer,
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim()) {
      toast({ title: 'Error', description: 'Question is required', variant: 'destructive' });
      return;
    }
    if (!form.answer.trim()) {
      toast({ title: 'Error', description: 'Answer is required', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        isActive: form.isActive,
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
        throw new Error(err.error || 'Failed to save FAQ');
      }

      invalidateWeddingCache();
      toast({ title: 'Success', description: editingId ? 'FAQ updated successfully' : 'FAQ added successfully' });
      setDialogOpen(false);
      fetchFAQs();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save FAQ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('Delete this FAQ?', 'This action cannot be undone.');
    if (!ok) return;

    try {
      setDeleting(id);
      const res = await fetch(`${API_BASE}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete FAQ');
      }

      invalidateWeddingCache();
      toast({ title: 'Success', description: 'FAQ deleted' });
      fetchFAQs();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete FAQ', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (item: FAQItem) => {
    const newActive = !item.isActive;
    // Optimistic update
    setFaqs((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, isActive: newActive } : f))
    );

    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          question: item.question,
          answer: item.answer,
          isActive: newActive,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update FAQ status');
      }

      invalidateWeddingCache();
      toast({ title: 'Success', description: newActive ? 'FAQ activated' : 'FAQ deactivated' });
    } catch {
      // Revert optimistic update
      setFaqs((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, isActive: item.isActive } : f))
      );
      toast({ title: 'Error', description: 'Failed to update FAQ status', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading your FAQs…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-charcoal-ink">Questions & Answers</h2>
          <p className="text-sm text-charcoal-ink/50 mt-1">
            Manage the FAQs guests will see on your invitation.
          </p>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 shrink-0"
        >
          <Plus className="size-4 mr-1.5" />
          Add Question
        </Button>
      </div>

      {/* FAQ List */}
      {faqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <HelpCircle className="size-10 text-champagne-silk" />
          <p className="text-sm text-charcoal-ink/40 font-medium">No FAQs yet</p>
          <p className="text-xs text-charcoal-ink/30">
            Click &quot;Add Question&quot; to create your first FAQ.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((item) => (
            <Card
              key={item.id}
              className={`border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200 ${
                !item.isActive ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-charcoal-ink">
                        {item.question}
                      </h3>
                      {!item.isActive && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium border-charcoal-ink/10 text-charcoal-ink/40"
                        >
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-charcoal-ink/50 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(item)}
                      className={`h-9 w-9 p-0 ${
                        item.isActive
                          ? 'text-cinematic-gold hover:bg-cinematic-gold/5'
                          : 'text-charcoal-ink/30 hover:text-cinematic-gold hover:bg-cinematic-gold/5'
                      }`}
                      title={item.isActive ? 'Deactivate FAQ' : 'Activate FAQ'}
                    >
                      {item.isActive ? (
                        <Eye className="size-3.5" />
                      ) : (
                        <EyeOff className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(item)}
                      className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                    >
                      {deleting === item.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">
              {editingId ? 'Edit FAQ' : 'Add New Question'}
            </DialogTitle>
            <DialogDescription className="text-charcoal-ink/50">
              {editingId
                ? 'Update the question and answer below.'
                : 'Add a new frequently asked question for your guests.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="faq-question" className="text-sm font-medium text-charcoal-ink/70">
                Question <span className="text-red-400">*</span>
              </Label>
              <Input
                id="faq-question"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="e.g. Is there parking available?"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="faq-answer" className="text-sm font-medium text-charcoal-ink/70">
                Answer <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="faq-answer"
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="Provide the answer to this question…"
                rows={3}
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-charcoal-ink/5 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-charcoal-ink/70">Active</Label>
                <p className="text-xs text-charcoal-ink/40">
                  Show this FAQ to your guests
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
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
                'Update FAQ'
              ) : (
                'Add Question'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Q&A Section Text — moved from Content Editor */}
      <SectionContentFields
        section="qa"
        title="Q&A Section Text"
        description="Customise the section header and contact information"
        fields={QA_CONTENT_FIELDS}
      />
      {ConfirmDialog}
    </div>
  );
}