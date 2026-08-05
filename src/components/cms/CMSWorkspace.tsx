'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  X,
  FileText,
  Layout,
  ImageIcon,
  Pencil,
  Loader2,
  Menu,
} from 'lucide-react';

import { useWorkspaceMode } from '@/store/useWorkspaceMode';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { CMSPageHeader } from './CMSPageHeader';
import { CMSBlockEditor, TYPE_BADGE_COLORS, TYPE_LABELS } from './CMSBlockEditor';
import type { WorkspaceSection, WorkspaceBlock, BlockType } from '@/types/content';

// ─── Block type icon mapping ────────────────────────────────────
function BlockTypeIcon({ type }: { type: BlockType }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (type) {
    case 'image':
    case 'gallery':
      return <ImageIcon className={cls} />;
    case 'text':
    case 'richtext':
      return <FileText className={cls} />;
    default:
      return <Layout className={cls} />;
  }
}

// ─── Sortable Block Item ────────────────────────────────────────
function SortableBlockItem({
  block,
  pageSlug,
  sectionId,
}: {
  block: WorkspaceBlock;
  pageSlug: string;
  sectionId: string;
}) {
  const { updateBlockValue, deleteBlock } = useWorkspaceStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-2 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 shrink-0 cursor-grab text-charcoal-ink/25 hover:text-charcoal-ink/50 focus:outline-none active:cursor-grabbing p-2"
        aria-label="Drag to reorder block"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Block content */}
      <div className="min-w-0 flex-1">
        {/* Block row: key + type badge */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="truncate text-sm font-medium text-charcoal-ink/70 font-[family-name:var(--font-inter)]">
            {block.key}
          </span>
          <Badge
            variant="secondary"
            className={`shrink-0 gap-1 px-1.5 py-0 text-[10px] font-normal font-[family-name:var(--font-inter)] ${TYPE_BADGE_COLORS[block.type]}`}
          >
            <BlockTypeIcon type={block.type} />
            {TYPE_LABELS[block.type]}
          </Badge>
        </div>
        <CMSBlockEditor
          block={block}
          onChange={(value) => updateBlockValue(block.id, value)}
        />
      </div>

      {/* Delete block */}
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => deleteBlock(block.id)}
              className="mt-0.5 shrink-0 rounded p-1 text-charcoal-ink/20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive focus:outline-none"
              aria-label={`Delete block ${block.key}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="font-[family-name:var(--font-inter)] text-xs">Delete block</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ─── Block Drag Overlay ─────────────────────────────────────────
function BlockDragOverlay({ block }: { block: WorkspaceBlock | null }) {
  if (!block) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-cinematic-gold/30 bg-white px-3 py-2 shadow-lg">
      <GripVertical className="h-4 w-4 text-cinematic-gold" />
      <span className="text-sm font-medium text-charcoal-ink font-[family-name:var(--font-inter)]">
        {block.key}
      </span>
      <Badge
        variant="secondary"
        className={`gap-1 px-1.5 py-0 text-[10px] font-normal font-[family-name:var(--font-inter)] ${TYPE_BADGE_COLORS[block.type]}`}
      >
        {TYPE_LABELS[block.type]}
      </Badge>
    </div>
  );
}

// ─── Sortable Section ───────────────────────────────────────────
function SortableSection({
  section,
  pageSlug,
  autoExpanded,
}: {
  section: WorkspaceSection;
  pageSlug: string;
  autoExpanded: boolean;
}) {
  const { selectedSectionId, selectSection, deleteSection, reorderBlocks } =
    useWorkspaceStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isExpanded =
    autoExpanded || selectedSectionId === section.id;
  const blockIds = useMemo(
    () => section.blocks.map((b) => b.id),
    [section.blocks],
  );

  const handleBlockDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blockIds.indexOf(active.id as string);
      const newIndex = blockIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(blockIds, oldIndex, newIndex);
      const order = reordered.map((id, i) => ({ id, sortOrder: i }));
      reorderBlocks(section.id, order);
    },
    [blockIds, section.id, reorderBlocks],
  );

  const [sectionTitle, setSectionTitle] = useState(section.title);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setSectionTitle(section.title);
  }, [section.title]);

  const handleTitleBlur = useCallback(() => {
    setIsEditing(false);
    // If title changed, we could persist it — but for now just keep local
  }, []);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        setIsEditing(false);
      }
    },
    [],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border transition-colors ${
        isExpanded
          ? 'border-l-2 border-l-cinematic-gold border-t-border border-r-border border-b-border bg-white'
          : 'border-border bg-white/60'
      }`}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab text-charcoal-ink/20 hover:text-charcoal-ink/50 focus:outline-none active:cursor-grabbing p-2"
          aria-label="Drag to reorder section"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Collapse toggle */}
        <Collapsible open={isExpanded} onOpenChange={(open) => selectSection(open ? section.id : null)}>
          <CollapsibleTrigger asChild>
            <button className="flex shrink-0 items-center justify-center focus:outline-none" aria-label="Toggle section">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-charcoal-ink/50" />
              ) : (
                <ChevronRight className="h-4 w-4 text-charcoal-ink/50" />
              )}
            </button>
          </CollapsibleTrigger>

          {/* Section title (editable) */}
          <span
            className="ml-1 text-sm font-semibold text-charcoal-ink font-[family-name:var(--font-inter)] cursor-default select-none"
            onDoubleClick={handleTitleDoubleClick}
          >
            {isEditing ? (
              <Input
                ref={inputRef}
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="h-6 w-full max-w-[192px] px-1 py-0 text-sm font-semibold font-[family-name:var(--font-inter)]"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>{section.title}</>
            )}
          </span>
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Pencil className="ml-1 inline-block h-3 w-3 text-charcoal-ink/20" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-[family-name:var(--font-inter)] text-xs">Double-click title to edit</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Collapsible>

        {/* Block count */}
        <Badge
          variant="secondary"
          className="ml-auto shrink-0 px-1.5 py-0 text-[10px] font-normal text-charcoal-ink/40 font-[family-name:var(--font-inter)]"
        >
          {section.blocks.length} {section.blocks.length === 1 ? 'block' : 'blocks'}
        </Badge>

        {/* Delete section */}
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => deleteSection(section.id)}
                className="shrink-0 rounded p-2.5 text-charcoal-ink/20 transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none"
                aria-label={`Delete section ${section.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="font-[family-name:var(--font-inter)] text-xs">Delete section</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Section body (blocks) */}
      <Collapsible open={isExpanded} onOpenChange={(open) => selectSection(open ? section.id : null)}>
        <CollapsibleContent>
          <Separator />
          <div className="p-3">
            {section.blocks.length === 0 ? (
              <p className="py-4 text-center text-xs text-charcoal-ink/30 font-[family-name:var(--font-inter)]">
                No blocks in this section
              </p>
            ) : (
              <BlockDndContext
                section={section}
                handleBlockDragEnd={handleBlockDragEnd}
                blockIds={blockIds}
              >
                <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {section.blocks.map((block) => (
                      <SortableBlockItem
                        key={block.id}
                        block={block}
                        pageSlug={pageSlug}
                        sectionId={section.id}
                      />
                    ))}
                  </div>
                </SortableContext>
              </BlockDndContext>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Section Drag Overlay ───────────────────────────────────────
function SectionDragOverlay({ section }: { section: WorkspaceSection | null }) {
  if (!section) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-cinematic-gold/30 bg-white px-4 py-3 shadow-lg">
      <GripVertical className="h-4 w-4 text-cinematic-gold" />
      <span className="text-sm font-semibold text-charcoal-ink font-[family-name:var(--font-inter)]">
        {section.title}
      </span>
      <Badge
        variant="secondary"
        className="ml-auto px-1.5 py-0 text-[10px] font-normal text-charcoal-ink/40 font-[family-name:var(--font-inter)]"
      >
        {section.blocks.length} {section.blocks.length === 1 ? 'block' : 'blocks'}
      </Badge>
    </div>
  );
}

// ─── DnD context wrappers (hooks called at component top-level) ─
function BlockDndContext({
  section,
  handleBlockDragEnd,
  blockIds,
  children,
}: {
  section: WorkspaceSection;
  handleBlockDragEnd: (event: DragEndEvent) => void;
  blockIds: string[];
  children: React.ReactNode;
}) {
  const [activeBlock, setActiveBlock] = useState<WorkspaceBlock | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => {
        const b = section.blocks.find((bl) => bl.id === e.active.id);
        setActiveBlock(b ?? null);
      }}
      onDragEnd={handleBlockDragEnd}
      onDragCancel={() => setActiveBlock(null)}
    >
      {children}
      <DragOverlay>
        <BlockDragOverlay block={activeBlock} />
      </DragOverlay>
    </DndContext>
  );
}

function SectionDndContext({
  selectedPage,
  handleSectionDragEnd,
  sectionIds,
  children,
}: {
  selectedPage: { sections: WorkspaceSection[] };
  handleSectionDragEnd: (event: DragEndEvent) => void;
  sectionIds: string[];
  children: React.ReactNode;
}) {
  const [activeSection, setActiveSection] = useState<WorkspaceSection | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => {
        const s = selectedPage.sections.find((sec) => sec.id === e.active.id);
        setActiveSection(s ?? null);
      }}
      onDragEnd={handleSectionDragEnd}
      onDragCancel={() => setActiveSection(null)}
    >
      {children}
      <DragOverlay>
        <SectionDragOverlay section={activeSection} />
      </DragOverlay>
    </DndContext>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────
function Sidebar({
  mobileOpen,
  onCloseMobile,
  onOpenMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenMobile: () => void;
}) {
  const {
    pages,
    selectedPageSlug,
    selectPage,
    addSection,
    isLoading,
  } = useWorkspaceStore();
  const toggleWorkspace = useWorkspaceMode((s) => s.toggleWorkspace);

  const selectedPage = pages.find((p) => p.slug === selectedPageSlug) ?? null;

  const handleAddSection = useCallback(async () => {
    if (!selectedPageSlug) return;
    const slug = `section-${Date.now()}`;
    const title = `New Section ${selectedPage?.sections.length ? selectedPage.sections.length + 1 : 1}`;
    await addSection(selectedPageSlug, slug, title);
  }, [selectedPageSlug, selectedPage, addSection]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Top bar: account name + close */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="truncate text-sm font-semibold text-charcoal-ink font-[family-name:var(--font-inter)]">
          Eleanor &amp; James
        </span>
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  toggleWorkspace();
                  onCloseMobile();
                }}
                className="shrink-0 rounded p-1 text-charcoal-ink/30 transition-colors hover:bg-muted hover:text-charcoal-ink focus:outline-none"
                aria-label="Close workspace"
              >
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-[family-name:var(--font-inter)] text-xs">Back to site</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Pages list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-charcoal-ink/40 font-[family-name:var(--font-inter)]">
            Pages
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-cinematic-gold" />
          </div>
        ) : (
          <nav className="space-y-0.5 px-2" aria-label="Pages">
            {pages.map((page) => {
              const isSelected = page.slug === selectedPageSlug;
              return (
                <button
                  key={page.id}
                  onClick={() => {
                    selectPage(page.slug);
                    onCloseMobile();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors focus:outline-none ${
                    isSelected
                      ? 'border-l-2 border-l-cinematic-gold bg-cinematic-gold/5'
                      : 'border-l-2 border-l-transparent hover:bg-muted/50'
                  }`}
                >
                  {/* Published indicator */}
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      page.isPublished ? 'bg-emerald-500' : 'bg-charcoal-ink/15'
                    }`}
                    title={page.isPublished ? 'Published' : 'Draft'}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-sm font-medium font-[family-name:var(--font-inter)] ${
                        isSelected ? 'text-charcoal-ink' : 'text-charcoal-ink/70'
                      }`}
                    >
                      {page.title}
                    </div>
                    <div className="truncate text-[11px] text-charcoal-ink/35 font-[family-name:var(--font-inter)]">
                      /{page.slug}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Add section button */}
      {selectedPageSlug && (
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 font-[family-name:var(--font-inter)] text-sm text-charcoal-ink/60 hover:text-charcoal-ink"
            onClick={handleAddSection}
          >
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[280px] shrink-0 border-r border-border bg-white md:block">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          {/* Drawer */}
          <aside className="relative z-10 h-full w-[300px] max-w-[calc(100vw-2rem)] bg-white shadow-xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile menu toggle (shown when drawer is closed) */}
      {!mobileOpen && (
        <button
          onClick={onOpenMobile}
          className="fixed left-3 top-3 z-40 rounded-md bg-white p-2 shadow-md md:hidden focus:outline-none"
          aria-label="Open pages menu"
        >
          <Menu className="h-5 w-5 text-charcoal-ink" />
        </button>
      )}
    </>
  );
}

// ─── Main Workspace ─────────────────────────────────────────────
export function CMSWorkspace() {
  const {
    pages,
    selectedPageSlug,
    selectedSectionId,
    loadPages,
    reorderSections,
  } = useWorkspaceStore();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Load pages on mount
  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const selectedPage = pages.find((p) => p.slug === selectedPageSlug) ?? null;

  const sectionIds = useMemo(
    () => (selectedPage ? selectedPage.sections.map((s) => s.id) : []),
    [selectedPage],
  );

  // Auto-expand section when selected
  const autoExpandedSectionId = selectedSectionId;

  const handleSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !selectedPageSlug) return;

      const oldIndex = sectionIds.indexOf(active.id as string);
      const newIndex = sectionIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sectionIds, oldIndex, newIndex);
      const order = reordered.map((id, i) => ({ id, sortOrder: i }));
      reorderSections(selectedPageSlug, order);
    },
    [sectionIds, selectedPageSlug, reorderSections],
  );

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white font-[family-name:var(--font-inter)]">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={closeMobile} onOpenMobile={() => setMobileOpen(true)} />

      {/* Main editor area */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {selectedPage ? (
          <>
            {/* Sticky header with page title + actions */}
            <div className="px-6 pt-4">
              <CMSPageHeader />
            </div>

            {/* Sections list */}
            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-4">
              <SectionDndContext
                selectedPage={selectedPage}
                handleSectionDragEnd={handleSectionDragEnd}
                sectionIds={sectionIds}
              >
                <SortableContext
                  items={sectionIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {selectedPage.sections.map((section) => (
                      <SortableSection
                        key={section.id}
                        section={section}
                        pageSlug={selectedPage.slug}
                        autoExpanded={autoExpandedSectionId === section.id}
                      />
                    ))}
                  </div>
                </SortableContext>
              </SectionDndContext>

              {selectedPage.sections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Layout className="mb-3 h-10 w-10 text-charcoal-ink/10" />
                  <p className="text-sm text-charcoal-ink/30 font-[family-name:var(--font-inter)]">
                    No sections yet. Add one from the sidebar.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state — no pages */
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <FileText className="h-12 w-12 text-charcoal-ink/10" />
            <p className="text-sm text-charcoal-ink/30 font-[family-name:var(--font-inter)]">
              {pages.length === 0
                ? 'No pages found. Create a page to get started.'
                : 'Select a page from the sidebar to start editing.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}