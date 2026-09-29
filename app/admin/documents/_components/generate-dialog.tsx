'use client'

import * as React from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DocumentVariable } from '../constants'

export function GenerateDialog({
  open,
  onOpenChange,
  variables,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  variables: DocumentVariable[]
  onSubmit: (values: Record<string, string>) => void
  submitting?: boolean
}) {
  const [values, setValues] = React.useState<Record<string, string>>({})

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {}
      for (const v of variables) {
        initial[v.key] = v.defaultValue ?? ''
      }
      setValues(initial)
    }
  }, [open, variables])

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate PDF
          </DialogTitle>
          <DialogDescription>
            Fill in the values for this document&apos;s variables. Leave
            blank to keep the placeholder text.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {variables.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No variables defined for this document.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {variables.map((v) => (
                <div key={v.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">
                      {v.label}
                    </Label>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {`{{${v.key}}}`}
                    </span>
                  </div>
                  <Input
                    type={
                      v.type === 'date'
                        ? 'date'
                        : v.type === 'number'
                        ? 'number'
                        : 'text'
                    }
                    value={values[v.key] ?? ''}
                    onChange={(e) => setValue(v.key, e.target.value)}
                    placeholder={
                      v.type === 'image'
                        ? 'https://… (image URL)'
                        : v.label
                    }
                  />
                  {v.description && (
                    <p className="text-muted-foreground text-[10px]">
                      {v.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(values)}
            disabled={submitting}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}