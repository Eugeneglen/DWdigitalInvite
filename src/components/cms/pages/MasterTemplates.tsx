'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Star, Trash2, Copy, Check, Loader2, FileText,
  Palette, Calendar, HelpCircle, BookOpen, Image as ImageIcon,
  RefreshCw, Lock,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ContentTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  contentCount: number;
  scheduleCount: number;
  faqCount: number;
  storyCount: number;
  mediaCount: number;
  theme: { colors: { bg: string; text: string; accent: string; secondary: string; muted: string }; fonts: { heading: string; body: string } };
  createdAt: string;
  updatedAt: string;
}

interface Wedding {
  id: string;
  coupleName: string;
  slug: string;
}

export default function MasterTemplates() {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentTemplate | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [cloneWeddingId, setCloneWeddingId] = useState('');
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/master/content-templates?XTransformPort=3000');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load templates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeddings = useCallback(async () => {
    try {
      const res = await fetch('/api/master/weddings?page=1&limit=100&XTransformPort=3000');
      if (res.ok) {
        const data = await res.json();
        setWeddings((data.weddings || []).map((w: { id: string; coupleName: string; slug: string }) => ({
          id: w.id, coupleName: w.coupleName, slug: w.slug,
        })));
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (createOpen) fetchWeddings();
  }, [createOpen, fetchWeddings]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const res = await fetch('/api/master/content-templates?XTransformPort=3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          cloneFromWeddingId: cloneWeddingId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create template');
      }
      toast({ title: 'Template Created', description: `${newName} has been created.` });
      setNewName('');
      setNewDescription('');
      setCloneWeddingId('');
      setCreateOpen(false);
      fetchTemplates();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create template', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  async function handleSetDefault(template: ContentTemplate) {
    try {
      const res = await fetch(`/api/master/content-templates/${template.id}/set-default?XTransformPort=3000`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to set default');
      toast({ title: 'Default Set', description: `${template.name} is now the default template for new couples.` });
      fetchTemplates();
    } catch {
      toast({ title: 'Error', description: 'Failed to set default template', variant: 'destructive' });
    }
  }

  async function handleApplyAll(template: ContentTemplate) {
    if (!confirm(`Apply "${template.name}" to all non-customized weddings? This will overwrite their content, schedule, FAQs, stories, and media.`)) return;
    try {
      setApplying(template.id);
      const res = await fetch(`/api/master/content-templates/${template.id}/apply-all?XTransformPort=3000`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to apply template');
      const data = await res.json();
      toast({ title: 'Template Applied', description: data.message });
    } catch {
      toast({ title: 'Error', description: 'Failed to apply template', variant: 'destructive' });
    } finally {
      setApplying(null);
    }
  }

  async function handleDelete(template: ContentTemplate) {
    try {
      const res = await fetch(`/api/master/content-templates?id=${template.id}&XTransformPort=3000`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete template');
      }
      toast({ title: 'Template Deleted', description: `${template.name} has been removed.` });
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete template', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-cinematic-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Content Templates</h2>
          <p className="text-sm text-slate-500 mt-1">Manage default content templates for new couple accounts</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800">
          <Plus className="size-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Templates table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                    No templates yet. Click "New Template" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      {t.isDefault ? (
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 border border-amber-200">
                          <Star className="size-3.5 text-amber-500 fill-amber-400" />
                        </div>
                      ) : (
                        <FileText className="size-4 text-slate-300" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{t.name}</p>
                          {t.isDefault && <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">DEFAULT</Badge>}
                          {!t.isActive && <Badge variant="outline" className="text-xs text-slate-400">Inactive</Badge>}
                        </div>
                        {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1" title="Content sections"><FileText className="size-3" />{t.contentCount}</span>
                        <span className="flex items-center gap-1" title="Schedule items"><Calendar className="size-3" />{t.scheduleCount}</span>
                        <span className="flex items-center gap-1" title="FAQs"><HelpCircle className="size-3" />{t.faqCount}</span>
                        <span className="flex items-center gap-1" title="Stories"><BookOpen className="size-3" />{t.storyCount}</span>
                        <span className="flex items-center gap-1" title="Media"><ImageIcon className="size-3" />{t.mediaCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: t.theme.colors.bg }} title="Background" />
                        <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: t.theme.colors.accent }} title="Accent" />
                        <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: t.theme.colors.text }} title="Text" />
                        <span className="text-xs text-slate-400 ml-1">{t.theme.fonts.heading}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!t.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(t)}
                            title="Set as default"
                          >
                            <Star className="size-4 text-slate-400" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyAll(t)}
                          disabled={applying === t.id}
                          title="Apply to all non-customized weddings"
                        >
                          {applying === t.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4 text-blue-500" />}
                        </Button>
                        {!t.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(t)}
                            title="Delete template"
                          >
                            <Trash2 className="size-4 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 shrink-0">
            <FileText className="size-4 text-blue-600" />
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How Content Templates work</p>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>• The <strong>default</strong> template (⭐) is automatically cloned into every newly created couple account</li>
              <li>• <strong>Apply to All</strong> overwrites content on weddings that haven't been customized by the couple</li>
              <li>• Couples who manually edited their theme are protected from bulk overwrite</li>
              <li>• Create seasonal variants (Summer, Winter, etc.) and switch the default anytime</li>
              <li>• Images use local placeholder paths — couples upload their own</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Content Template</DialogTitle>
            <DialogDescription>
              Create a new template from scratch, or clone an existing wedding's content.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-name" className="text-xs uppercase tracking-wider text-slate-500">Template Name</Label>
              <Input
                id="template-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Summer Garden"
                required
                disabled={creating}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-desc" className="text-xs uppercase tracking-wider text-slate-500">Description (optional)</Label>
              <Input
                id="template-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g. Bright, airy summer wedding style"
                disabled={creating}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-slate-500">Clone from Wedding (optional)</Label>
              <Select value={cloneWeddingId} onValueChange={setCloneWeddingId} disabled={creating}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Start from scratch (empty template)" />
                </SelectTrigger>
                <SelectContent>
                  {weddings.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.coupleName} ({w.slug})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">
                Cloning extracts all content, schedule, FAQs, stories, and media from the selected wedding.
                Base64 images are replaced with local placeholder paths.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
              <Button type="submit" disabled={creating || !newName.trim()}>
                {creating ? <><Loader2 className="size-4 mr-2 animate-spin" />Creating...</> : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              <Trash2 className="size-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
