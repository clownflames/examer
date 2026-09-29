'use client'

import * as React from 'react'
import { Info, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import {
  collectAllVariableKeys,
  slugifyVariableKey,
  type DocumentContent,
  type DocumentVariable,
  type VariableType,
} from '../constants'

export function VariablesPanel({
  content,
  onChange,
}: {
  content: DocumentContent
  onChange: (next: DocumentVariable[]) => void
}) {
  const variables = content.variables ?? []

  // Keys referenced inside blocks but not yet declared
  const usedKeys = React.useMemo(
    () => collectAllVariableKeys(content),
    [content]
  )
  const declaredKeys = new Set(variables.map((v) => v.key))
  const missingKeys = usedKeys.filter((k) => !declaredKeys.has(k))

  function addVariable() {
    const label = `Variable ${variables.length + 1}`
    const key = slugifyVariableKey(label)
    onChange([
      ...variables,
      { key, label, type: 'text' },
    ])
  }

  function addMissingVariable(key: string) {
    onChange([
      ...variables,
      {
        key,
        label: key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        type: 'text',
      },
    ])
  }

  function updateVariable<K extends keyof DocumentVariable>(
    index: number,
    field: K,
    value: DocumentVariable[K]
  ) {
    const next = [...variables]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  function removeVariable(index: number) {
    onChange(variables.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Variables ({variables.length})
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2"
          onClick={addVariable}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="bg-primary/5 border-primary/20 flex items-start gap-2 rounded-md border px-3 py-2 text-[11px]">
        <Info className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="text-muted-foreground">
          Use{' '}
          <code className="bg-muted rounded px-1">
            {'{{variable_key}}'}
          </code>{' '}
          anywhere in text fields. It&apos;ll be replaced when generating
          the PDF.
        </span>
      </div>

      {/* Missing keys — auto-detected */}
      {missingKeys.length > 0 && (
        <div className="bg-amber-500/5 border-amber-500/30 flex flex-col gap-2 rounded-md border px-3 py-2 text-[11px]">
          <p className="text-amber-700 dark:text-amber-500 font-medium">
            Used in document but not defined:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => addMissingVariable(k)}
                className="bg-background hover:bg-muted rounded-full border px-2 py-0.5 font-mono text-[10px]"
                title="Click to define"
              >
                + {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Variable list */}
      {variables.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-xs">
          No variables defined yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {variables.map((v, i) => (
            <li
              key={i}
              className="bg-card flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px]"
                >
                  {`{{${v.key}}}`}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive h-6 w-6"
                  onClick={() => removeVariable(i)}
                  aria-label="Remove variable"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <Field label="Label">
                <Input
                  value={v.label}
                  onChange={(e) => updateVariable(i, 'label', e.target.value)}
                  className="h-8 text-xs"
                />
              </Field>

              <Field label="Key">
                <Input
                  value={v.key}
                  onChange={(e) =>
                    updateVariable(
                      i,
                      'key',
                      slugifyVariableKey(e.target.value)
                    )
                  }
                  className="h-8 font-mono text-xs"
                />
              </Field>

              <Field label="Type">
                <Select
                  value={v.type}
                  onValueChange={(val) =>
                    updateVariable(i, 'type', val as VariableType)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="image">Image (URL)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Default (optional)">
                <Input
                  value={v.defaultValue ?? ''}
                  onChange={(e) =>
                    updateVariable(i, 'defaultValue', e.target.value)
                  }
                  className="h-8 text-xs"
                  placeholder="Shown as initial value"
                />
              </Field>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted-foreground text-[10px] font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}