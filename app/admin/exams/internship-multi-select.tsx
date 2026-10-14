'use client'

import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

import type { InternshipOption } from './constants'

/**
 * Checkbox list for picking several internships at once.
 *
 * Used by the create-exam drawer ("also create copies for…") and by the copy
 * dialog on the Exams table. Deliberately a plain list rather than a multi
 * Select — there is no token for "no internship", and admins scanning a list
 * of 15 programmes are far more reliable with checkboxes.
 */
export function InternshipMultiSelect({
  options,
  value,
  onChange,
  excludeId,
  excludeLabel,
  maxHeight = 'max-h-56',
  emptyHint = 'No internships available.',
}: {
  options: InternshipOption[]
  value: string[]
  onChange: (next: string[]) => void
  /** Greyed out and never selectable — e.g. the exam's own internship. */
  excludeId?: string
  /** Small badge shown next to the excluded row. */
  excludeLabel?: string
  maxHeight?: string
  emptyHint?: string
}) {
  const selectable = React.useMemo(
    () => options.filter((option) => option.id !== excludeId),
    [options, excludeId]
  )

  const selected = React.useMemo(() => new Set(value), [value])
  const allSelected =
    selectable.length > 0 && selectable.every((option) => selected.has(option.id))

  const toggle = (id: string, checked: boolean) => {
    onChange(
      checked ? [...value, id] : value.filter((current) => current !== id)
    )
  }

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const ids = selectable.map((option) => option.id)
      onChange([...new Set([...value, ...ids])])
    } else {
      onChange(value.filter((id) => selectable.some((option) => option.id === id)))
    }
  }

  if (options.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-4 text-xs">
        {emptyHint}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {selectable.length > 1 && (
        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 px-1 text-xs">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
          {allSelected ? 'Clear all' : 'Select all'}
        </label>
      )}

      <div className={`${maxHeight} overflow-y-auto rounded-md border`}>
        <ul className="divide-border divide-y">
          {options.map((option) => {
            const isExcluded = option.id === excludeId
            const isSelected = selected.has(option.id)

            return (
              <li key={option.id}>
                <label
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm ${
                    isExcluded
                      ? 'text-muted-foreground cursor-not-allowed'
                      : 'hover:bg-muted/50 cursor-pointer'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isExcluded}
                    onCheckedChange={(checked) => toggle(option.id, checked === true)}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {isExcluded && excludeLabel ? (
                    <Badge variant="outline" className="text-[10px]">
                      {excludeLabel}
                    </Badge>
                  ) : null}
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      {selectable.length === 0 ? (
        <p className="text-muted-foreground px-1 text-[11px]">
          This is the only internship.
        </p>
      ) : (
        <p className="text-muted-foreground px-1 text-[11px]">
          {selected.size === 0
            ? 'None selected.'
            : `${selected.size} selected.`}
        </p>
      )}
    </div>
  )
}