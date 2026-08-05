'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Loader2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCMSStore } from '@/store/useCMSStore';

// --- Types ---

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  enabled: boolean;
  order: number;
}

interface TenantBasic {
  id: string;
  name: string;
}

// --- Schema ---

const faqSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
  enabled: z.boolean().optional().default(true),
});

type FAQFormValues = z.infer<typeof faqSchema>;

// --- Main Component ---

export default function CMSFAQ() {
  const authUser = useCMSStore((s) => s.authUser);
  const selectedTenantId = useCMSStore((s) => s.selectedTenantId);
  const setSelectedTenantId = useCMSStore((s) => s.setSelectedTenantId);

  const [items, setItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FAQItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FAQItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [tenants, setTenants] = useState<TenantBasic[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const authHeaders = {
    Authorization: `Bearer ${authUser?.token}`,
    'Content-Type': 'application/json',
  };

  // Fetch tenants if no selected tenant
  useEffect(() => {
    if (selectedTenantId) return;
    const fetchTenants = async () => {
      setTenantsLoading(true);
      try {
        const res = await fetch('/api/cms/tenants?limit=100', {
          headers: { Authorization: `Bearer ${authUser?.token}` },
        });
        const data = await res.json();
        if (data.success) {
          setTenants(data.data.tenants || []);
        }
      } catch {
        // silently handle
      } finally {
        setTenantsLoading(false);
      }
    };
    fetchTenants();
  }, [selectedTenantId, authUser?.token]);

  const fetchItems = useCallback(async () => {
    if (!selectedTenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/faq`, {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setItems((Array.isArray(data.data) ? data.data : []).sort((a: FAQItem, b: FAQItem) => a.order - b.order));
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, authUser?.token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FAQFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: { question: '', answer: '', enabled: true },
  });

  const enabledWatch = watch('enabled');

  const openCreate = () => {
    setEditingItem(null);
    reset({ question: '', answer: '', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (item: FAQItem) => {
    setEditingItem(item);
    reset({
      question: item.question,
      answer: item.answer,
      enabled: item.enabled,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: FAQFormValues) => {
    if (!selectedTenantId) return;
    setSaving(true);
    try {
      const isEdit = !!editingItem;
      const url = isEdit
        ? `/api/cms/tenants/${selectedTenantId}/faq/${editingItem.id}`
        : `/api/cms/tenants/${selectedTenantId}/faq`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isEdit ? 'FAQ updated' : 'FAQ added');
        setDialogOpen(false);
        fetchItems();
      } else {
        toast.error(data.error || 'Something went wrong');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !selectedTenantId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/faq/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('FAQ deleted');
        setDeleteTarget(null);
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (item: FAQItem) => {
    if (!selectedTenantId) return;
    try {
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/faq/${item.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // No tenant selected
  if (!selectedTenantId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-charcoal-ink">FAQ</h1>
          <p className="text-sm text-gray-500 mt-1">Select a tenant to manage its FAQ.</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <Label className="text-sm font-medium text-charcoal-ink">Select Tenant</Label>
          {tenantsLoading ? (
            <Skeleton className="h-9 w-full mt-2" />
          ) : (
            <Select onValueChange={(val) => setSelectedTenantId(val)}>
              <SelectTrigger className="mt-2 h-9 border-gray-300">
                <SelectValue placeholder="Choose a tenant..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-charcoal-ink">FAQ</h1>
        <Button
          onClick={openCreate}
          className="bg-charcoal-ink text-white hover:bg-charcoal-ink/90 h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Question
        </Button>
      </div>

      {/* FAQ Accordion List */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-8" />
              </div>
              <Skeleton className="h-3 w-64 mt-2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <HelpCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No FAQ items yet</p>
          <p className="text-xs text-gray-400 mt-1">Click &quot;Add Question&quot; to create the first one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <Accordion type="multiple">
            {items.map((item) => (
              <AccordionItem key={item.id} value={item.id} className="px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <AccordionTrigger className="flex-1 hover:no-underline py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-sm font-medium text-charcoal-ink truncate ${!item.enabled ? 'text-gray-400' : ''}`}>
                        {item.question}
                      </span>
                      {!item.enabled && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 border-gray-200 flex-shrink-0">
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={() => handleToggle(item)}
                      className="scale-75 origin-left"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-charcoal-ink"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <AccordionContent>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {item.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">
              {editingItem ? 'Edit Question' : 'Add Question'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the FAQ item below.' : 'Add a new question to the FAQ.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="faq-question" className="text-sm font-medium text-charcoal-ink">Question *</Label>
              <Textarea
                id="faq-question"
                placeholder="What time does the ceremony start?"
                {...register('question')}
                className="border-gray-300 min-h-[60px]"
              />
              {errors.question && <p className="text-xs text-red-600">{errors.question.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="faq-answer" className="text-sm font-medium text-charcoal-ink">Answer *</Label>
              <Textarea
                id="faq-answer"
                placeholder="The ceremony will begin at 10:00 AM sharp..."
                {...register('answer')}
                className="border-gray-300 min-h-[100px]"
              />
              {errors.answer && <p className="text-xs text-red-600">{errors.answer.message}</p>}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={enabledWatch}
                onCheckedChange={(checked) => setValue('enabled', checked)}
              />
              <Label className="text-sm font-medium text-charcoal-ink">Enabled</Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-9 bg-charcoal-ink text-white hover:bg-charcoal-ink/90"
              >
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {editingItem ? 'Save Changes' : 'Add Question'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}