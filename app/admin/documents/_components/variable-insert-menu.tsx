'use client'

import * as React from 'react'
import { Braces } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DocumentVariable } from '../constants'

export function VariableInsertMenu({
  variables,
  onInsert,
}: {
  variables: DocumentVariable[]
  onInsert: (placeholder: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Insert variable"
          >
            <Braces className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Insert variable</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {variables.length === 0 ? (
          <div className="text-muted-foreground px-2 py-3 text-center text-xs">
            No variables defined. Add some in the Variables tab.
          </div>
        ) : (
          variables.map((v) => (
            <DropdownMenuItem
              key={v.key}
              onClick={() => onInsert(`{{${v.key}}}`)}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="text-sm font-medium">{v.label}</span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {`{{${v.key}}}`}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}