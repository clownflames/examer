'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DemandDrawerForm,
  type DemandInitial,
} from './demand-drawer-form'
import { deleteDemand } from './actions'
import type { DemandRow } from './constants'

export function DemandsTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
}: {
  data: DemandRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [createOpen, setCreateOpen] = React.useState(false)

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-4">
      {/* Header row with Add New button */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {total} {total === 1 ? 'demand' : 'demands'} total
        </p>

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger >
            <Button>
              <Plus />
              Add New
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Add New Demand</DrawerTitle>
              <DrawerDescription>
                Create a new demand category. You can attach internships and
                teams to it later.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <DemandDrawerForm
                mode="create"
                onSuccess={() => {
                  setCreateOpen(false)
                  router.refresh()
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Icon</TableHead>
              <TableHead>Key Features</TableHead>
              <TableHead>Internships</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  No demands found. Click <strong>Add New</strong> to create one.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.iconUrl}
                        alt=""
                        className="h-8 w-8 rounded-md border object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    {row.keyFeatures && row.keyFeatures.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.keyFeatures.slice(0, 3).map((feature, i) => (
                          <Badge key={i} variant="secondary">
                            {feature}
                          </Badge>
                        ))}
                        {row.keyFeatures.length > 3 && (
                          <Badge variant="outline">
                            +{row.keyFeatures.length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.totalInternships}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.totalTeams}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <EditDemandButton
                        demand={{
                          id: row.id,
                          name: row.name,
                          iconUrl: row.iconUrl,
                          description: row.description,
                          keyFeatures: row.keyFeatures,
                        }}
                      />
                      <DeleteDemandButton id={row.id} name={row.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Showing <span className="text-foreground font-medium">{from}</span>–
          <span className="text-foreground font-medium">{to}</span> of{' '}
          <span className="text-foreground font-medium">{total}</span>
        </p>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (page > 1) goToPage(page - 1)
                }}
                className={
                  page <= 1 ? 'pointer-events-none opacity-50' : undefined
                }
              />
            </PaginationItem>

            {getPageNumbers(page, totalPages).map((p, i) =>
              p === '…' ? (
                <PaginationItem key={`e-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => {
                      e.preventDefault()
                      goToPage(p as number)
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (page < totalPages) goToPage(page + 1)
                }}
                className={
                  page >= totalPages
                    ? 'pointer-events-none opacity-50'
                    : undefined
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('…')
  pages.push(total)
  return pages
}

/* -------------------------------------------------------------------------- */
/*  Edit drawer                                                                */
/* -------------------------------------------------------------------------- */

function EditDemandButton({ demand }: { demand: DemandInitial }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger >
        <Button variant="ghost" size="icon" aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit Demand</DrawerTitle>
          <DrawerDescription>
            Update the details for <strong>{demand.name}</strong>.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <DemandDrawerForm
            mode="edit"
            initial={demand}
            onSuccess={() => {
              setOpen(false)
              router.refresh()
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/* -------------------------------------------------------------------------- */
/*  Delete dialog                                                              */
/* -------------------------------------------------------------------------- */

function DeleteDemandButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleDelete() {
    setPending(true)
    const result = await deleteDemand(id)
    setPending(false)

    if (result.success) {
      toast.success(`Demand "${name}" deleted.`)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to delete.')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          disabled={pending}
        >
          <Trash2 className="text-destructive h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this demand?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{name}</strong>. You
            can&apos;t delete a demand that still has internships or teams
            attached to it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={pending}>
            {pending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}