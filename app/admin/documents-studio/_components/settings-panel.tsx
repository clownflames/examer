'use client'

import * as React from 'react'
import { useEditor, type SerializedNodes } from '@craftjs/core'
import {
  ArrowDown,
  ArrowUp,
  Braces,
  Copy,
  Eye,
  EyeOff,
  MousePointerClick,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  BLOCK_META,
  type CraftJson,
  type GeneratedFile,
  type PageSetup,
} from '../constants'
import { readPageSetup } from '../_lib/craft'
import { cloneNode, removeNode, reorderNode } from '../_lib/tree-ops'
import {
  BORDER_STYLE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  TEXT_DECORATION_OPTIONS,
  TEXT_TRANSFORM_OPTIONS,
  num,
  readStyle,
  str,
  type BlockStyleProps,
} from '../_lib/style'
import { BlockContentSettings } from './block-content-settings'
import { PageSettings } from './page-settings'
import { useVariables, VariablesPanel } from './variables-panel'
import {
  AlignField,
  ColorField,
  Hint,
  NumberField,
  Row,
  SelectField,
  SpacingBox,
  StyleSection,
  SwitchField,
  ToggleRow,
} from './style-controls'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type EditorQuery = ReturnType<typeof useEditor>['query']

function currentJson(query: EditorQuery): CraftJson {
  return query.getSerializedNodes() as unknown as CraftJson
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function SettingsPanel() {
  const { actions } = useEditor()

  /**
   * The selector must always return the same outer shape — Craft.js merges the
   * collector result with `{ actions, query }` through a distributive
   * conditional type, so returning `null` directly would break the merge.
   */
  const { selected } = useEditor((state) => {
    const [id] = state.events.selected
    const node = id ? state.nodes[id] : undefined

    if (!id || !node) return { selected: null }

    return {
      selected: {
        id,
        /**
         * `data.name` is the resolver key ("TextBlock"); `data.displayName` is
         * the friendly label ("Text"). BLOCK_META is keyed by the resolver key.
         */
        blockKey: node.data.name,
        displayName: node.data.displayName,
        props: node.data.props as Record<string, unknown>,
        hidden: node.data.hidden,
      },
    }
  })

  const { pageProps } = useEditor((state) => {
    const root = state.nodes.ROOT
    return {
      pageProps: root ? (root.data.props as Record<string, unknown>) : null,
    }
  })

  const batchFiles = useEditor((state) => {
    const root = state.nodes.ROOT
    const raw = root?.data.props?.generatedFiles
    return { files: Array.isArray(raw) ? (raw as GeneratedFile[]) : [] }
  }).files

  const { variables, setVariables } = useVariables()

  const [tab, setTab] = React.useState<'element' | 'page' | 'vars'>('element')
  const activeTab = selected ? tab : 'page'

  const pageSetup = React.useMemo<PageSetup | null>(
    () =>
      pageProps
        ? readPageSetup({
            ROOT: { type: 'div', isCanvas: true, props: pageProps },
          })
        : null,
    [pageProps]
  )

  function setPageProp(patch: Partial<PageSetup>) {
    actions.setProp('ROOT', (props: Record<string, unknown>) => {
      Object.assign(props, patch)
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setTab(v as 'element' | 'page' | 'vars')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="m-2 grid shrink-0 grid-cols-3">
          <TabsTrigger value="element" className="gap-1.5 px-1.5 text-xs">
            <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Element</span>
          </TabsTrigger>
          <TabsTrigger value="page" className="gap-1.5 px-1.5 text-xs">
            <span className="truncate">Page</span>
          </TabsTrigger>
          <TabsTrigger value="vars" className="gap-1.5 px-1.5 text-xs">
            <Braces className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Vars</span>
            {variables.length > 0 ? (
              <span className="bg-primary text-primary-foreground ml-0.5 rounded px-1 text-[9px] tabular-nums">
                {variables.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="element"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          {selected ? (
            <ElementSettings
              key={selected.id}
              id={selected.id}
              blockKey={selected.blockKey}
              displayName={selected.displayName}
              props={selected.props}
              hidden={selected.hidden}
            />
          ) : (
            <div className="text-muted-foreground flex flex-col items-center gap-1.5 px-6 py-12 text-center">
              <MousePointerClick className="h-5 w-5 opacity-40" />
              <p className="text-xs font-medium">No element selected</p>
              <p className="text-[10px] leading-relaxed">
                Click any block on the page to edit its content and styling
                here. Use the <strong>Page</strong> tab for size, margins and
                guides.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="page"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          {pageSetup ? (
            <PageSettings
              setup={pageSetup}
              batchFiles={batchFiles}
              onChange={setPageProp}
            />
          ) : (
            <div className="text-muted-foreground p-4 text-xs">
              Loading page settings…
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="vars"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <VariablesPanel variables={variables} onChange={setVariables} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Element settings                                                           */
/* -------------------------------------------------------------------------- */

function ElementSettings({
  id,
  blockKey,
  displayName,
  props,
  hidden,
}: {
  id: string
  blockKey: string
  displayName: string
  props: Record<string, unknown>
  hidden: boolean
}) {
  const { actions, query } = useEditor()
  const meta = BLOCK_META[blockKey]

  const position = useEditor((state) => {
    const node = state.nodes[id]
    if (!node) return { index: 0, total: 0 }
    const parentId = node.data.parent
    const siblings = parentId
      ? (state.nodes[parentId]?.data.nodes ?? [])
      : []
    return { index: siblings.indexOf(id), total: siblings.length }
  })

  const setProp = React.useCallback(
    (key: string, value: unknown) => {
      actions.setProp(id, (p: Record<string, unknown>) => {
        p[key] = value
      })
    },
    [actions, id]
  )

  const setMany = React.useCallback(
    (patch: Record<string, unknown>) => {
      actions.setProp(id, (p: Record<string, unknown>) => {
        Object.assign(p, patch)
      })
    },
    [actions, id]
  )

  const applyJson = React.useCallback(
    (next: CraftJson, selectId?: string) => {
      actions.deserialize(next as unknown as SerializedNodes)
      if (selectId) {
        requestAnimationFrame(() => actions.selectNode(selectId))
      }
    },
    [actions]
  )

  function handleDuplicate() {
    const result = cloneNode(currentJson(query), id)
    if (!result) return
    applyJson(result.json, result.newRootId)
    toast.success('Element duplicated')
  }

  function handleMove(delta: -1 | 1) {
    const next = reorderNode(currentJson(query), id, delta)
    if (!next) return
    applyJson(next, id)
  }

  function handleDelete() {
    const next = removeNode(currentJson(query), id)
    if (!next) return
    applyJson(next)
    toast.success('Element removed')
  }

  const s: BlockStyleProps = readStyle(props)
  const isFirst = position.index <= 0
  const isLast = position.index >= position.total - 1
  const showTypography = meta?.typography ?? false
  const showBox = meta?.box ?? false
  const showPosition = meta?.align ?? false
  const showSpacing = meta?.kind !== 'spacer' && meta?.kind !== 'pageBreak'

  return (
    <div className="flex flex-col pb-6">
      {/* ------------------------- header + node actions ------------------------- */}
      <div className="flex items-center gap-0.5 border-b px-2 py-2">
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-xs font-semibold">
            {meta?.displayName ?? displayName ?? blockKey}
          </p>
          <p className="text-muted-foreground truncate text-[10px]">
            {meta?.description ?? 'Element'}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={isFirst}
          onClick={() => handleMove(-1)}
          title="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={isLast}
          onClick={() => handleMove(1)}
          title="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={handleDuplicate}
          title="Duplicate"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={hidden ? 'text-muted-foreground h-7 w-7' : 'h-7 w-7'}
          onClick={() => actions.setHidden(id, !hidden)}
          title={hidden ? 'Show element' : 'Hide element'}
        >
          {hidden ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-destructive h-7 w-7"
          onClick={handleDelete}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {hidden && (
        <div className="bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-700 dark:text-amber-400">
          This element is hidden — it is skipped when the PDF is generated.
        </div>
      )}

      {/* ------------------------- block-specific content ------------------------- */}
      {meta ? (
        <BlockContentSettings
          blockKey={blockKey}
          props={props}
          setProp={setProp}
        />
      ) : (
        <StyleSection title="Custom element">
          <Hint>
            No dedicated settings for <code>{blockKey}</code>. The generic
            layout controls below still apply.
          </Hint>
        </StyleSection>
      )}

      {/* ------------------------- typography ------------------------- */}
      {showTypography && (
        <StyleSection title="Typography">
          <SelectField
            label="Font family"
            value={(s.fontFamily as string) ?? 'Inter'}
            options={FONT_FAMILY_OPTIONS}
            onChange={(v) => setProp('fontFamily', v)}
          />
          <Row>
            <NumberField
              label="Size"
              value={num(s.fontSize, 14)}
              onChange={(v) => {
                setProp('fontSize', v)
                // Headings follow their level size until the user overrides it
                // here — flag that so the level dropdown stops resetting it.
                if (blockKey === 'HeadingBlock') setProp('customSize', true)
              }}
              min={4}
              max={160}
              suffix="px"
            />
            <SelectField
              label="Weight"
              value={str(s.fontWeight, '400')}
              options={FONT_WEIGHT_OPTIONS}
              onChange={(v) => setProp('fontWeight', v)}
            />
          </Row>
          <ToggleRow
            bold={num(s.fontWeight, 400) >= 600}
            italic={s.fontStyle === 'italic'}
            underline={s.textDecoration === 'underline'}
            strike={s.textDecoration === 'line-through'}
            onToggle={(key) => {
              if (key === 'bold') {
                setProp(
                  'fontWeight',
                  num(s.fontWeight, 400) >= 600 ? '400' : '700'
                )
                return
              }
              if (key === 'italic') {
                setProp('fontStyle', s.fontStyle === 'italic' ? 'normal' : 'italic')
                return
              }
              const wanted = key === 'underline' ? 'underline' : 'line-through'
              setProp(
                'textDecoration',
                s.textDecoration === wanted ? 'none' : wanted
              )
            }}
          />
          <Row>
            <NumberField
              label="Line height"
              value={num(s.lineHeight, 1.5)}
              onChange={(v) => setProp('lineHeight', v)}
              min={0.8}
              max={4}
              step={0.05}
            />
            <NumberField
              label="Letter spacing"
              value={num(s.letterSpacing)}
              onChange={(v) => setProp('letterSpacing', v)}
              min={-5}
              max={20}
              step={0.1}
              suffix="px"
            />
          </Row>
          <AlignField
            value={s.textAlign}
            onChange={(v) => setProp('textAlign', v)}
          />
          <Row>
            <SelectField
              label="Letter case"
              value={s.textTransform}
              options={TEXT_TRANSFORM_OPTIONS}
              onChange={(v) => setProp('textTransform', v)}
            />
            <SelectField
              label="Decoration"
              value={s.textDecoration}
              options={TEXT_DECORATION_OPTIONS}
              onChange={(v) => setProp('textDecoration', v)}
            />
          </Row>
          <ColorField
            label="Text colour"
            value={str(s.color, '#18181b')}
            onChange={(v) => setProp('color', v)}
            allowTransparent={false}
          />
        </StyleSection>
      )}

      {/* ------------------------- position on page ------------------------- */}
      {showPosition && (
        <StyleSection title="Position">
          <AlignField
            value={s.align}
            onChange={(v) => setProp('align', v)}
            options={['left', 'center', 'right']}
          />
          <NumberField
            label="Width (0 = auto)"
            value={num(s.width)}
            onChange={(v) => setProp('width', v)}
            min={0}
            max={2000}
            suffix="px"
          />
        </StyleSection>
      )}

      {/* ------------------------- spacing ------------------------- */}
      {showSpacing && (
        <StyleSection title="Spacing">
          <SpacingBox
            label="Padding (inside)"
            value={{
              top: num(s.paddingTop),
              right: num(s.paddingRight),
              bottom: num(s.paddingBottom),
              left: num(s.paddingLeft),
            }}
            onChange={(v) =>
              setMany({
                paddingTop: v.top,
                paddingRight: v.right,
                paddingBottom: v.bottom,
                paddingLeft: v.left,
              })
            }
          />
          <SpacingBox
            label="Margin (outside)"
            value={{
              top: num(s.marginTop),
              right: num(s.marginRight),
              bottom: num(s.marginBottom),
              left: num(s.marginLeft),
            }}
            onChange={(v) =>
              setMany({
                marginTop: v.top,
                marginRight: v.right,
                marginBottom: v.bottom,
                marginLeft: v.left,
              })
            }
          />
        </StyleSection>
      )}

      {/* ------------------------- background / border / effects ------------------------- */}
      {showBox && (
        <>
          <StyleSection title="Background">
            <ColorField
              label="Fill"
              value={str(s.backgroundColor, 'transparent')}
              onChange={(v) => setProp('backgroundColor', v)}
            />
          </StyleSection>

          <StyleSection title="Border">
            <Row>
              <NumberField
                label="Width"
                value={num(s.borderWidth)}
                onChange={(v) => setProp('borderWidth', v)}
                min={0}
                max={40}
                suffix="px"
              />
              <NumberField
                label="Corner radius"
                value={num(s.borderRadius)}
                onChange={(v) => setProp('borderRadius', v)}
                min={0}
                max={400}
                suffix="px"
              />
            </Row>
            <Row>
              <SelectField
                label="Style"
                value={str(s.borderStyle, 'solid')}
                options={BORDER_STYLE_OPTIONS}
                onChange={(v) => setProp('borderStyle', v)}
              />
              <ColorField
                label="Colour"
                value={str(s.borderColor, '#d4d4d8')}
                onChange={(v) => setProp('borderColor', v)}
                allowTransparent={false}
              />
            </Row>
          </StyleSection>

          <StyleSection title="Effects" defaultOpen={false}>
            <NumberField
              label="Opacity"
              value={num(s.opacity, 100)}
              onChange={(v) =>
                setProp('opacity', Math.max(0, Math.min(100, v)))
              }
              min={0}
              max={100}
              suffix="%"
            />
          </StyleSection>
        </>
      )}

      {meta?.kind === 'spacer' && (
        <div className="px-3 pt-3">
          <Hint>
            A spacer is empty vertical space. It is drawn on the canvas with a
            guide so you can see exactly how much room it takes.
          </Hint>
        </div>
      )}

      {meta?.kind === 'pageBreak' && (
        <div className="px-3 pt-3">
          <Hint>
            Everything after this element moves to a new page in the exported
            PDF.
          </Hint>
        </div>
      )}

      <div className="px-3 pt-3">
        <SwitchField
          label="Show in PDF"
          hint="Turn off to keep the element in the design but skip it when exporting"
          checked={!hidden}
          onChange={(v) => actions.setHidden(id, !v)}
        />
      </div>
    </div>
  )
}
