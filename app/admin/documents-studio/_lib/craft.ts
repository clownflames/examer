import {
  ALLOWED_COMPONENTS,
  DEFAULT_PAGE_SETUP,
  ROOT_ID,
  type CraftJson,
  type CraftNode,
  type PageSetup,
} from '../constants'

/* -------------------------------------------------------------------------- */
/*  Tree traversal                                                             */
/* -------------------------------------------------------------------------- */

export function getRootNodeId(json: CraftJson): string {
  // The serialized root is normally keyed "ROOT", but fall back to whichever
  // node has no parent so hand-edited JSON still loads.
  if (json[ROOT_ID]) return ROOT_ID
  const found = Object.keys(json).find((id) => !json[id].parent)
  return found ?? ROOT_ID
}

export function rootProps(json: CraftJson): Record<string, unknown> {
  const root = json[getRootNodeId(json)]
  return root?.props ?? {}
}

export function childIds(json: CraftJson, id: string): string[] {
  return json[id]?.nodes ?? []
}

export function linkedId(json: CraftJson, id: string, key: string): string {
  return json[id]?.linkedNodes?.[key] ?? ''
}

/** Ordered list of component names directly under a node. */
export function childBlockNames(json: CraftJson, id: string): string[] {
  return childIds(json, id).map((cid) => resolvedName(json[cid]) ?? 'Unknown')
}

export function resolvedName(node: CraftNode | undefined): string | null {
  if (!node) return null
  return typeof node.type === 'string' ? node.type : node.type?.resolvedName
}

/* -------------------------------------------------------------------------- */
/*  Page setup                                                                 */
/* -------------------------------------------------------------------------- */

export function readPageSetup(json: CraftJson | null | undefined): PageSetup {
  const props = json ? rootProps(json) : {}
  return { ...DEFAULT_PAGE_SETUP, ...(props as Partial<PageSetup>) }
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

function isValidNode(node: unknown): node is CraftNode {
  if (!node || typeof node !== 'object') return false
  const n = node as CraftNode

  const isStrType = typeof n.type === 'string'
  const isResolvedType =
    !!n.type &&
    typeof n.type === 'object' &&
    typeof (n.type as { resolvedName?: unknown }).resolvedName === 'string'

  if (!isStrType && !isResolvedType) return false
  if (!n.props || typeof n.props !== 'object') return false
  if (n.nodes !== undefined && !Array.isArray(n.nodes)) return false
  if (n.linkedNodes !== undefined && typeof n.linkedNodes !== 'object') {
    return false
  }

  const name = resolvedName(n)
  return !!name && ALLOWED_COMPONENTS.has(name)
}

/**
 * Guard against hand-edited / corrupt / outdated documents.
 *
 * Craft.js serializes to a **flat** `nodeId -> node` map, so we validate the
 * shape of that map directly rather than looking for a `nodes` wrapper.
 */
export function isSafeCraftJson(value: unknown): value is CraftJson {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const json = value as Record<string, unknown>
  const ids = Object.keys(json)
  if (ids.length === 0) return false

  for (const id of ids) {
    if (!isValidNode(json[id])) return false
  }

  // Every child / linked reference must point at a node that exists.
  for (const id of ids) {
    const node = json[id] as CraftNode
    for (const childId of node.nodes ?? []) {
      if (typeof childId !== 'string' || !json[childId]) return false
    }
    for (const linked of Object.values(node.linkedNodes ?? {})) {
      if (typeof linked !== 'string' || !json[linked]) return false
    }
  }

  return true
}

/* -------------------------------------------------------------------------- */
/*  Empty document                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A fresh document: a single empty page whose root node carries the page setup.
 * `TextBlock` is injected as a child so the user has something to type into.
 */
export function emptyCraftJson(): CraftJson {
  return {
    [ROOT_ID]: {
      type: 'div',
      isCanvas: true,
      displayName: 'Page',
      custom: {},
      hidden: false,
      nodes: ['welcome-text'],
      linkedNodes: {},
      props: {
        ...DEFAULT_PAGE_SETUP,
        style: {},
      },
    },
    'welcome-text': {
      type: { resolvedName: 'TextBlock' },
      isCanvas: false,
      displayName: 'Text',
      custom: {},
      hidden: false,
      parent: ROOT_ID,
      nodes: [],
      linkedNodes: {},
      props: {
        text: 'Double-click this text to edit it, or drag new blocks in from the left.',
        fontSize: 14,
        fontWeight: '400',
        color: '#52525b',
        textAlign: 'left',
        lineHeight: 1.6,
      },
    },
  }
}

/** Serialized form, ready for `<Frame data={...} />`. */
export function emptyCraftJsonString(): string {
  return JSON.stringify(emptyCraftJson())
}
