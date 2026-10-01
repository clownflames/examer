import type { CraftJson, CraftNode } from '../constants'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function newNodeId(): string {
  return `node-${Math.random().toString(36).slice(2, 9)}`
}

/** Every id in the subtree rooted at `id`, including linked (column) nodes. */
export function collectSubtree(json: CraftJson, id: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  function walk(nodeId: string) {
    if (seen.has(nodeId)) return
    const node = json[nodeId]
    if (!node) return
    seen.add(nodeId)
    out.push(nodeId)
    for (const child of node.nodes ?? []) walk(child)
    for (const linked of Object.values(node.linkedNodes ?? {})) walk(linked)
  }

  walk(id)
  return out
}

/* -------------------------------------------------------------------------- */
/*  Clone                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Deep-clone a node (and everything under it), inserting the copy directly
 * after the original in its parent's child list.
 */
export function cloneNode(
  json: CraftJson,
  id: string
): { json: CraftJson; newRootId: string } | null {
  const source = json[id]
  if (!source) return null

  const subtree = collectSubtree(json, id)

  const idMap = new Map<string, string>()
  const newRootId = newNodeId()
  idMap.set(id, newRootId)
  for (const nodeId of subtree) {
    if (nodeId !== id) idMap.set(nodeId, newNodeId())
  }

  const next: CraftJson = { ...json }

  for (const nodeId of subtree) {
    const node = json[nodeId]
    const copy: CraftNode = {
      ...node,
      nodes: (node.nodes ?? []).map((c) => idMap.get(c) ?? c),
      linkedNodes: Object.fromEntries(
        Object.entries(node.linkedNodes ?? {}).map(([key, value]) => [
          key,
          idMap.get(value) ?? value,
        ])
      ),
    }
    next[idMap.get(nodeId) as string] = copy
  }

  const parentId = source.parent
  if (parentId && next[parentId]) {
    const siblings = [...(next[parentId].nodes ?? [])]
    const at = siblings.indexOf(id)
    siblings.splice(at < 0 ? siblings.length : at + 1, 0, newRootId)
    next[parentId] = { ...next[parentId], nodes: siblings }
  }

  return { json: next, newRootId }
}

/* -------------------------------------------------------------------------- */
/*  Reorder                                                                    */
/* -------------------------------------------------------------------------- */

/** Move a node up (-1) or down (+1) among its siblings. */
export function reorderNode(
  json: CraftJson,
  id: string,
  delta: -1 | 1
): CraftJson | null {
  const node = json[id]
  const parentId = node?.parent
  if (!node || !parentId || !json[parentId]) return null

  const siblings = [...(json[parentId].nodes ?? [])]
  const from = siblings.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= siblings.length) return null

  siblings.splice(from, 1)
  siblings.splice(to, 0, id)

  return { ...json, [parentId]: { ...json[parentId], nodes: siblings } }
}

/* -------------------------------------------------------------------------- */
/*  Remove                                                                     */
/* -------------------------------------------------------------------------- */

/** Remove a node and its whole subtree. */
export function removeNode(json: CraftJson, id: string): CraftJson | null {
  const node = json[id]
  if (!node) return null

  const next: CraftJson = { ...json }
  for (const nodeId of collectSubtree(json, id)) delete next[nodeId]

  if (node.parent && next[node.parent]) {
    next[node.parent] = {
      ...next[node.parent],
      nodes: (next[node.parent].nodes ?? []).filter((c) => c !== id),
    }
  }

  return next
}
