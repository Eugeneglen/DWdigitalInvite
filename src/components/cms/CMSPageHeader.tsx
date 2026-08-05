'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { Save, Eye, EyeOff, Loader2 } from 'lucide-react';

export function CMSPageHeader() {
  const { pages, selectedPageSlug, isDirty, savePageBlocks } = useWorkspaceStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const selectedPage = pages.find((p) => p.slug === selectedPageSlug) ?? null;

  const handleSave = useCallback(async () => {
    if (!selectedPageSlug || isSaving) return;
    setIsSaving(true);
    try {
      await savePageBlocks(selectedPageSlug);
    } finally {
      setIsSaving(false);
    }
  }, [selectedPageSlug, isSaving, savePageBlocks]);

  const handlePublishToggle = useCallback(async () => {
    if (!selectedPageSlug || isPublishing || !selectedPage) return;
    setIsPublishing(true);
    const newPublishState = !selectedPage.isPublished;
    try {
      const res = await fetch('/api/workspace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageSlug: selectedPageSlug, publish: newPublishState }),
      });
      if (res.ok) {
        const data = await res.json();
        useWorkspaceStore.setState((state) => ({
          pages: state.pages.map((p) =>
            p.slug === selectedPageSlug
              ? { ...p, isPublished: data.page.isPublished, publishedAt: data.page.publishedAt }
              : p,
          ),
        }));
      }
    } finally {
      setIsPublishing(false);
    }
  }, [selectedPageSlug, isPublishing, selectedPage]);

  if (!selectedPage) return null;

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-white/90 px-1 py-3 backdrop-blur-sm">
      {/* Left: Title + dirty indicator */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="truncate text-lg font-semibold text-charcoal-ink font-[family-name:var(--font-inter)]">
          {selectedPage.title}
        </h1>
        {isDirty && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-cinematic-gold font-[family-name:var(--font-inter)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cinematic-gold" />
            <span className="hidden sm:inline">Unsaved changes</span>
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="gap-1.5 font-[family-name:var(--font-inter)] text-xs"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save
        </Button>

        <Button
          variant={selectedPage.isPublished ? 'outline' : 'default'}
          size="sm"
          onClick={handlePublishToggle}
          disabled={isPublishing}
          className="gap-1.5 font-[family-name:var(--font-inter)] text-xs"
        >
          {isPublishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : selectedPage.isPublished ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {selectedPage.isPublished ? 'Unpublish' : 'Publish'}
        </Button>
      </div>
    </div>
  );
}