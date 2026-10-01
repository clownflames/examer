'use client'

import * as React from 'react'
import { useEditor } from '@craftjs/core'
import { Braces, Plus, Trash2, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

import {
  extractVariableKeys,
  isValidVariableKey,
  readVariables,
  slugifyVariableKey,
  type DocumentVariable,
  type VariableType,
} from '../_lib/variables'
import { Hint, SelectField, TextField } from './style-controls'

/* -------------------------------------------------------------------------- */
/*  Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function VariablesPanel({
  variables,
  onChange,
}: {
  variables: DocumentVariable[]
  onChange: (next: DocumentVariable[]) => void
}) {
  /**
   * Which placeholder keys appear anywhere in the document.
   *
   * The selector returns a **sorted, joined string** rather than an array on
   * purpose: Craft.js rebuilds the object `useEditor()` returns on every store
   * notification, so an array would be a new reference each time and would
   * invalidate every memo downstream. A string compares by value, so this only
   * changes when the set of used keys genuinely changes.
   */
  const { usedKeyString } = useEditor((state) => {
    const keys = new Set<string>()

    for (const node of Object.values(state.nodes)) {
      for (const value of Object.values(node.data.props ?? {})) {
        if (typeof value === 'string') {
          extractVariableKeys(value).forEach((k) => keys.add(k))
        } else if (Array.isArray(value)) {
          value.forEach((item) => {
            if (typeof item === 'string') {
              extractVariableKeys(item).forEach((k) => keys.add(k))
            }
          })
        }
      }
    }

    return { usedKeyString: [...keys].sort().join(',') }
  })

  const used = React.useMemo(
    () => (usedKeyString ? usedKeyString.split(',') : []),
    [usedKeyString]
  )

  const usedSet = React.useMemo(() => new Set(used), [used])
  const definedSet = React.useMemo(
    () => new Set(variables.map((v) => v.key)),
    [variables]
  )

  /** Placeholders typed in the document that have no matching variable. */
  const orphans = used.filter((key: string) => !definedSet.has(key))
  /** Variables nobody has placed in the document yet. */
  const unused = variables.filter((v) => !usedSet.has(v.key))

  function update(index: number, patch: Partial<DocumentVariable>) {
    onChange(variables.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  function add() {
    let key = 'variable'
    let n = variables.length + 1
    while (definedSet.has(key)) {
      key = `variable_${n}`
      n += 1
    }
    onChange([
      ...variables,
      { key, label: `Variable ${n}`, type: 'text', defaultValue: '' },
    ])
  }

  function removeAt(index: number) {
    onChange(variables.filter((_, i) => i !== index))
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta
    if (to < 0 || to >= variables.length) return
    const next = [...variables]
    ;[next[index], next[to]] = [next[to], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col pb-8">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Braces className="text-muted-foreground h-4 w-4" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Variables</p>
          <p className="text-muted-foreground text-[10px]">
            {variables.length} defined · {usedSet.size} used
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-[11px]"
          onClick={add}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {orphans.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            These placeholders are in the document but not defined:{' '}
            {orphans.map((k) => (
              <code key={k} className="font-mono">
                {`{{${k}}}`}{' '}
              </code>
            ))}
            — they will print as-is.
          </span>
        </div>
      )}

      {variables.length === 0 ? (
        <div className="px-3 py-4">
          <Hint>
            Add a variable, then type{' '}
            <code className="font-mono">{`{{key}}`}</code> in any text,
            heading, list item or table cell. Use <strong>Bulk generate</strong>{' '}
            to produce one PDF per spreadsheet row.
          </Hint>
        </div>
      ) : (
        variables.map((variable, index) => (
          <VariableRow
            key={`${variable.key}-${index}`}
            variable={variable}
            index={index}
            total={variables.length}
            isUsed={usedSet.has(variable.key)}
            isDuplicate={variables.filter((v) => v.key === variable.key).length > 1}
            onChange={(patch) => update(index, patch)}
            onRemove={() => removeAt(index)}
            onMove={(delta) => move(index, delta)}
          />
        ))
      )}

      {unused.length > 0 && variables.length > 0 ? (
        <div className="px-3 pt-1">
          <Hint>
            Not placed in the document yet:{' '}
            {unused.map((v) => (
              <code key={v.key} className="font-mono">
                {`{{${v.key}}}`}{' '}
              </code>
            ))}
          </Hint>
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Row                                                                        */
/* -------------------------------------------------------------------------- */

function VariableRow({
  variable,
  index,
  total,
  isUsed,
  isDuplicate,
  onChange,
  onRemove,
  onMove,
}: {
  variable: DocumentVariable
  index: number
  total: number
  isUsed: boolean
  isDuplicate: boolean
  onChange: (patch: Partial<DocumentVariable>) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
}) {
  const keyValid = isValidVariableKey(variable.key)
  const keyDirty = variable.key !== slugifyVariableKey(variable.key)

  return (
    <div className="border-b px-3 py-2.5 last:border-b-0">
      <div className="mb-2 flex items-center gap-1.5">
        <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
          {`{{${variable.key || '…'}}}`}
        </code>
        {isUsed ? (
          <Badge
            variant="outline"
            className="border-emerald-500/40 text-[9px] text-emerald-600"
          >
            in use
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[9px]">
            unused
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="h-6 w-6"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Move up"
          >
            ↑
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="h-6 w-6"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            title="Move down"
          >
            ↓
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-destructive h-6 w-6"
            onClick={onRemove}
            title="Remove variable"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <TextField
          label="Label"
          value={variable.label}
          onChange={(v) => onChange({ label: v })}
        />

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[10px] font-medium">
              Key
            </span>
            <Input
              value={variable.key}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^a-zA-Z0-9_]/g, '_')
                onChange({
                  key: /^[0-9]/.test(raw) ? `_${raw}` : raw,
                })
              }}
              placeholder="student_name"
              className="h-7 font-mono text-[10px]"
            />
          </div>
          <SelectField
            label="Type"
            value={variable.type}
            options={[
              { value: 'text', label: 'Text' },
              { value: 'number', label: 'Number' },
              { value: 'date', label: 'Date' },
              { value: 'image', label: 'Image URL' },
            ]}
            onChange={(v) => onChange({ type: v as VariableType })}
          />
        </div>

        {(!keyValid || isDuplicate || keyDirty) && (
          <Hint>
            {!keyValid
              ? 'Key must start with a letter and use only letters, numbers and underscores.'
              : isDuplicate
                ? 'Duplicate key — placeholders will be ambiguous.'
                : 'Key will be normalised on save.'}
          </Hint>
        )}

        <TextField
          label="Default value"
          value={variable.defaultValue ?? ''}
          onChange={(v) => onChange({ defaultValue: v })}
          placeholder="Used when a row leaves it blank"
        />

        <TextField
          label="Hint (optional)"
          value={variable.description ?? ''}
          onChange={(v) => onChange({ description: v })}
          placeholder="Shown while filling the form"
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Read / write on the root node                                              */
/* -------------------------------------------------------------------------- */

export function useVariables(): {
  variables: DocumentVariable[]
  setVariables: (next: DocumentVariable[]) => void
} {
  const { actions } = useEditor()

  const { variables: current } = useEditor((state) => {
    const root = state.nodes.ROOT
    if (!root) return { variables: [] as DocumentVariable[] }
    return {
      variables: readVariables({
        ROOT: { type: 'div', isCanvas: true, props: root.data.props },
      }),
    }
  })

  const setVariables = React.useCallback(
    (next: DocumentVariable[]) => {
      actions.setProp('ROOT', (props: Record<string, unknown>) => {
        props.variables = next
      })
    },
    [actions]
  )

  return { variables: current, setVariables }
}
