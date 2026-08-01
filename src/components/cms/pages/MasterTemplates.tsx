'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Star, Trash2, Copy, Check, Loader2, FileText,
  Palette, Calendar, HelpCircle, BookOpen, Image as ImageIcon,
  Lock, Pencil,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCMSStore } from '@/store/useCMSStore';
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
  const { setPage, setEditingTemplateId } = useCMSStore();
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentTemplate | null>(null);
  const [editTarget, setEditTarget] = useState<ContentTemplate | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<{
    name: string;
    description: string;
    content: { section: string; fieldKey: string; fieldValue: string; fieldType: string }[];
    schedule: { eventType: string; title: string; description: string | null; startTime: string; endTime: string | null; location: string | null; sortOrder: number }[];
    faqs: { question: string; answer: string; sortOrder: number; isActive: boolean }[];
    stories: { title: string; content: string; date: string | null; imageUrl: string | null; sortOrder: number }[];
    theme: { colors: { bg: string; text: string; accent: string; secondary: string; muted: string }; fonts: { heading: string; body: string } };
  } | null>(null);
  const [editTab, setEditTab] = useState<'details' | 'content' | 'schedule' | 'faqs' | 'stories' | 'theme'>('details');
  const [saving, setSaving] = useState(false);

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
      toast({ title: 'Default Set', description: `${template.name} is now the default template. New couple accounts will use this template. Existing accounts are unchanged.` });
      fetchTemplates();
    } catch {
      toast({ title: 'Error', description: 'Failed to set default template', variant: 'destructive' });
    }
  }

  async function openEdit(template: ContentTemplate) {
    // Navigate to the full-page template editor
    setEditingTemplateId(template.id);
    setPage('template-editor');
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !editData) return;
    try {
      setSaving(true);
      const res = await fetch('/api/master/content-templates?XTransformPort=3000', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTarget.id,
          name: editData.name,
          description: editData.description,
          content: JSON.stringify(editData.content),
          schedule: JSON.stringify(editData.schedule),
          faqs: JSON.stringify(editData.faqs),
          stories: JSON.stringify(editData.stories),
          theme: JSON.stringify(editData.theme),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save template');
      }
      toast({ title: 'Template Saved', description: `${editData.name} has been updated.` });
      setEditOpen(false);
      setEditTarget(null);
      setEditData(null);
      fetchTemplates();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save template', variant: 'destructive' });
    } finally {
      setSaving(false);
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(t)}
                          title="Edit template"
                        >
                          <Pencil className="size-4 text-slate-500" />
                        </Button>
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

      {/* Edit Template Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update template details, content, schedule, FAQs, stories, and theme.</DialogDescription>
          </DialogHeader>
          {editData && (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Tab selector */}
              <div className="flex gap-1 border-b border-slate-200 pb-2">
                {(['details', 'content', 'schedule', 'faqs', 'stories', 'theme'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setEditTab(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                      editTab === tab ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Details tab */}
              {editTab === 'details' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-slate-500">Template Name</Label>
                    <Input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      required
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-slate-500">Description</Label>
                    <Input
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                </div>
              )}

              {/* Content tab */}
              {editTab === 'content' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {editData.content.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-start">
                      <div className="col-span-1">
                        <Badge variant="outline" className="text-xs">{item.section}</Badge>
                        <p className="text-xs text-slate-400 mt-1">{item.fieldKey}</p>
                      </div>
                      <Input
                        className="col-span-2 text-sm"
                        value={item.fieldValue}
                        onChange={(e) => {
                          const updated = [...editData.content];
                          updated[idx] = { ...item, fieldValue: e.target.value };
                          setEditData({ ...editData, content: updated });
                        }}
                        disabled={saving}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Schedule tab */}
              {editTab === 'schedule' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {editData.schedule.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2 items-start border-b border-slate-50 pb-2">
                      <Input
                        className="text-sm"
                        value={item.title}
                        placeholder="Title"
                        onChange={(e) => {
                          const updated = [...editData.schedule];
                          updated[idx] = { ...item, title: e.target.value };
                          setEditData({ ...editData, schedule: updated });
                        }}
                        disabled={saving}
                      />
                      <Input
                        className="text-sm"
                        value={item.startTime}
                        placeholder="Time (e.g. 16:00)"
                        onChange={(e) => {
                          const updated = [...editData.schedule];
                          updated[idx] = { ...item, startTime: e.target.value };
                          setEditData({ ...editData, schedule: updated });
                        }}
                        disabled={saving}
                      />
                      <Input
                        className="col-span-2 text-sm"
                        value={item.location || ''}
                        placeholder="Location"
                        onChange={(e) => {
                          const updated = [...editData.schedule];
                          updated[idx] = { ...item, location: e.target.value };
                          setEditData({ ...editData, schedule: updated });
                        }}
                        disabled={saving}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* FAQs tab */}
              {editTab === 'faqs' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {editData.faqs.map((item, idx) => (
                    <div key={idx} className="space-y-1 border-b border-slate-50 pb-2">
                      <Input
                        className="text-sm font-medium"
                        value={item.question}
                        placeholder="Question"
                        onChange={(e) => {
                          const updated = [...editData.faqs];
                          updated[idx] = { ...item, question: e.target.value };
                          setEditData({ ...editData, faqs: updated });
                        }}
                        disabled={saving}
                      />
                      <textarea
                        className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
                        value={item.answer}
                        placeholder="Answer"
                        rows={2}
                        onChange={(e) => {
                          const updated = [...editData.faqs];
                          updated[idx] = { ...item, answer: e.target.value };
                          setEditData({ ...editData, faqs: updated });
                        }}
                        disabled={saving}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Stories tab */}
              {editTab === 'stories' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {editData.stories.map((item, idx) => (
                    <div key={idx} className="space-y-1 border-b border-slate-50 pb-2">
                      <Input
                        className="text-sm font-medium"
                        value={item.title}
                        placeholder="Title"
                        onChange={(e) => {
                          const updated = [...editData.stories];
                          updated[idx] = { ...item, title: e.target.value };
                          setEditData({ ...editData, stories: updated });
                        }}
                        disabled={saving}
                      />
                      <Input
                        className="text-sm"
                        value={item.date || ''}
                        placeholder="Date (e.g. March 2023)"
                        onChange={(e) => {
                          const updated = [...editData.stories];
                          updated[idx] = { ...item, date: e.target.value };
                          setEditData({ ...editData, stories: updated });
                        }}
                        disabled={saving}
                      />
                      <textarea
                        className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
                        value={item.content}
                        placeholder="Story content"
                        rows={3}
                        onChange={(e) => {
                          const updated = [...editData.stories];
                          updated[idx] = { ...item, content: e.target.value };
                          setEditData({ ...editData, stories: updated });
                        }}
                        disabled={saving}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Theme tab */}
              {editTab === 'theme' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">Colors</Label>
                    <div className="grid grid-cols-5 gap-3">
                      {(['bg', 'text', 'accent', 'secondary', 'muted'] as const).map((key) => (
                        <div key={key} className="text-center">
                          <Label className="text-xs text-slate-400 capitalize">{key}</Label>
                          <input
                            type="color"
                            value={editData.theme.colors[key]}
                            onChange={(e) => {
                              setEditData({
                                ...editData,
                                theme: {
                                  ...editData.theme,
                                  colors: { ...editData.theme.colors, [key]: e.target.value },
                                },
                              });
                            }}
                            className="w-full h-10 rounded border border-slate-200 cursor-pointer"
                            disabled={saving}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">Fonts</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400">Heading</Label>
                        <Input
                          value={editData.theme.fonts.heading}
                          onChange={(e) => setEditData({ ...editData, theme: { ...editData.theme, fonts: { ...editData.theme.fonts, heading: e.target.value } } })}
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">Body</Label>
                        <Input
                          value={editData.theme.fonts.body}
                          onChange={(e) => setEditData({ ...editData, theme: { ...editData.theme, fonts: { ...editData.theme.fonts, body: e.target.value } } })}
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
