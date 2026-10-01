'use client'

import * as React from 'react'
import { useEditor } from '@craftjs/core'
import {
  Box,
  Columns,
  Heading as HeadingIcon,
  Image as ImageIcon,
  List as ListIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  QrCode,
  Search,
  SquarePen,
  Table as TableIcon,
  Type,
  PenLine,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { BLOCK_META, type BlockCategory } from '../constants'
import {
  TextBlock,
  HeadingBlock,
  ListBlock,
  ButtonBlock,
  ImageBlock,
  QrBlock,
  TableBlock,
  DividerBlock,
  SpacerBlock,
  BoxBlock,
  SignatureBlock,
  PageBreakBlock,
  TwoColumnBlock,
} from './blocks'

/* -------------------------------------------------------------------------- */
/*  Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

type Entry = {
  key: keyof typeof BLOCK_META
  label: string
  icon: React.ReactNode
  element: React.ReactElement
}

const CATEGORY_ORDER: BlockCategory[] = [
  'Content',
  'Media',
  'Data',
  'Layout',
  'Decoration',
]

const CATALOGUE: Entry[] = [
  {
    key: 'TextBlock',
    label: 'Text',
    icon: <Type className="h-4 w-4" />,
    element: <TextBlock />,
  },
  {
    key: 'HeadingBlock',
    label: 'Heading',
    icon: <HeadingIcon className="h-4 w-4" />,
    element: <HeadingBlock />,
  },
  {
    key: 'ListBlock',
    label: 'List',
    icon: <ListIcon className="h-4 w-4" />,
    element: <ListBlock />,
  },
  {
    key: 'ButtonBlock',
    label: 'Button',
    icon: <MousePointerClick className="h-4 w-4" />,
    element: <ButtonBlock />,
  },
  {
    key: 'SignatureBlock',
    label: 'Signature',
    icon: <SquarePen className="h-4 w-4" />,
    element: <SignatureBlock />,
  },
  {
    key: 'ImageBlock',
    label: 'Image',
    icon: <ImageIcon className="h-4 w-4" />,
    element: <ImageBlock />,
  },
  {
    key: 'QrBlock',
    label: 'QR code',
    icon: <QrCode className="h-4 w-4" />,
    element: <QrBlock />,
  },
  {
    key: 'TableBlock',
    label: 'Table',
    icon: <TableIcon className="h-4 w-4" />,
    element: <TableBlock />,
  },
  {
    key: 'TwoColumnBlock',
    label: 'Columns',
    icon: <Columns className="h-4 w-4" />,
    element: <TwoColumnBlock />,
  },
  {
    key: 'PageBreakBlock',
    label: 'Page break',
    icon: <PenLine className="h-4 w-4" />,
    element: <PageBreakBlock />,
  },
  {
    key: 'DividerBlock',
    label: 'Divider',
    icon: <Minus className="h-4 w-4" />,
    element: <DividerBlock />,
  },
  {
    key: 'SpacerBlock',
    label: 'Spacer',
    icon: <MoveVertical className="h-4 w-4" />,
    element: <SpacerBlock />,
  },
  {
    key: 'BoxBlock',
    label: 'Box',
    icon: <Box className="h-4 w-4" />,
    element: <BoxBlock />,
  },
]

/* -------------------------------------------------------------------------- */
/*  Toolbox                                                                    */
/* -------------------------------------------------------------------------- */

export function Toolbox() {
  const { connectors, query, actions } = useEditor()
  const [search, setSearch] = React.useState('')

  const { selectedId } = useEditor((state) => {
    const [first] = state.events.selected
    return { selectedId: first ?? null }
  })

  const term = search.trim().toLowerCase()

  const filtered = React.useMemo(
    () =>
      CATALOGUE.filter((entry) => {
        if (!term) return true
        const meta = BLOCK_META[entry.key]
        return (
          entry.label.toLowerCase().includes(term) ||
          meta.description.toLowerCase().includes(term) ||
          meta.category.toLowerCase().includes(term)
        )
      }),
    [term]
  )

  const grouped = React.useMemo(() => {
    const map = new Map<BlockCategory, Entry[]>()
    for (const entry of filtered) {
      const category = BLOCK_META[entry.key].category
      const list = map.get(category) ?? []
      list.push(entry)
      map.set(category, list)
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c) as Entry[]] as const
    )
  }, [filtered])

  /**
   * Insert a block right after whatever is currently selected — inside its
   * parent canvas — or at the end of the page when nothing is selected.
   */
  function insertAtSelection(element: React.ReactElement) {
    const tree = query.parseReactElement(element).toNodeTree()

    let parentId = 'ROOT'
    let index = Number.MAX_SAFE_INTEGER

    if (selectedId) {
      const node = query.node(selectedId).get()
      if (node.data.isCanvas) {
        parentId = selectedId
      } else if (node.data.parent) {
        parentId = node.data.parent
        index = query.node(parentId).childNodes().indexOf(selectedId) + 1
      }
    }

    actions.addNodeTree(tree, parentId, index)
    actions.selectNode(tree.rootNodeId)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-2.5 pb-1.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks…"
            className="h-7 pr-2 pl-7 text-xs"
          />
        </div>
        <p className="text-muted-foreground mt-1.5 text-[10px] leading-snug">
          Drag onto the page, or click to add after the selected block.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        {grouped.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            No blocks match “{search}”.
          </p>
        ) : (
          grouped.map(([category, entries]) => (
            <div key={category} className="mt-3 flex flex-col gap-1.5">
              <p className="text-muted-foreground px-1 text-[10px] font-semibold tracking-wider uppercase">
                {category}
              </p>
              {entries.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  title={`${BLOCK_META[entry.key].description} — click to add`}
                  ref={(ref) => {
                    if (ref) connectors.create(ref, entry.element)
                  }}
                  onClick={() => insertAtSelection(entry.element)}
                  className="hover:bg-muted hover:border-primary/50 flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors"
                >
                  <span className="text-muted-foreground shrink-0">
                    {entry.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.label}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}

        <div className="bg-muted/40 mt-4 rounded-md border border-dashed p-2.5">
          <p className="text-muted-foreground text-[10px] leading-relaxed">
            <strong className="text-foreground">Tip:</strong> click any text,
            heading or list block on the page to type directly on the canvas.
            Press <kbd>Esc</kbd> to cancel.
          </p>
        </div>
      </div>
    </div>
  )
}
