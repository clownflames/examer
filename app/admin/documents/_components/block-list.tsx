'use client'

import * as React from 'react'
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import {
  BLOCK_CATALOG,
  createBlock,
  type BlockType,
  type DocumentBlock,
} from '../constants'

/* -------------------------------------------------------------------------- */
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

export function BlockList({
  blocks,
  selectedId,
  onSelect,
  onChange,
}: {
  blocks: DocumentBlock[]
  selectedId: string | null
  onSelect: (id: string) => void
  onChange: (next: DocumentBlock[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6, // avoid accidental drags on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function addBlock(type: BlockType) {
    const next = [...blocks, createBlock(type)]
    onChange(next)
    onSelect(next[next.length - 1].id)
  }

  function removeBlock(id: string) {
    const next = blocks.filter((b) => b.id !== id)
    onChange(next)
    if (selectedId === id) onSelect(next[0]?.id ?? '')
  }

  function duplicateBlock(id: string) {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx < 0) return
    const copy = { ...blocks[idx] }
    copy.id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    const next = [...blocks]
    next.splice(idx + 1, 0, copy)
    onChange(next)
    onSelect(copy.id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    onChange(arrayMove(blocks, oldIndex, newIndex))
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Blocks ({blocks.length})
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>

              <DropdownMenuLabel>Add block</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {BLOCK_CATALOG.map((b) => (
                <DropdownMenuItem
                  key={b.type}
                  onClick={() => addBlock(b.type)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">{b.label}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {b.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {blocks.length === 0 ? (
          <div className="text-muted-foreground p-6 text-center text-xs">
            No blocks yet. Click <strong>Add</strong> to start.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-1 p-2">
                {blocks.map((block) => (
                  <SortableBlockItem
                    key={block.id}
                    block={block}
                    selected={selectedId === block.id}
                    onSelect={() => onSelect(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onDelete={() => removeBlock(block.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sortable item                                                              */
/* -------------------------------------------------------------------------- */

function SortableBlockItem({
  block,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  block: DocumentBlock
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'group flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:border-border hover:bg-muted/40',
        isDragging && 'shadow-md'
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Preview */}
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium capitalize">{block.type}</span>
        <span className="text-muted-foreground ml-1">
          {blockPreview(block)}
        </span>
      </span>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
          aria-label="Duplicate"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive h-6 w-6"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/*  Preview text                                                               */
/* -------------------------------------------------------------------------- */

function blockPreview(block: DocumentBlock): string {
  switch (block.type) {
    case 'heading':
      return (block.text ?? '').slice(0, 30)
    case 'paragraph': {
      // @ts-expect-error - legacy documents store `text` instead of `html`
      const html = (block.html ?? block.text ?? '') as string
      return html.replace(/<[^>]*>/g, '').slice(0, 30)
    }
    case 'image':
      return block.url ? 'image' : 'empty'
    case 'list':
      return `${block.items.length} item${block.items.length === 1 ? '' : 's'}`
    case 'spacer':
      return `${block.height}pt`
    case 'signature':
      return block.name
    case 'qrcode':
      return (block.value ?? '').slice(0, 30) || 'empty'
    case 'table':
      return `${block.rows.length} × ${block.headers.length}`
    case 'columns':
      return `${block.ratio}`
    case 'divider':
    case 'pageBreak':
      return ''
  }
}