'use client'

import * as React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CheckCircle2, Plus, ShieldCheck, Trash2, User2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
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
import { UserDrawerForm } from './user-drawer-form'
import { deleteUser } from './actions'
import type { UserRow } from './constants'

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UsersTable({
  data,
  page,
  totalPages,
  total,
  pageSize,
  currentUserId,
}: {
  data: UserRow[]
  page: number
  totalPages: number
  total: number
  pageSize: number
  currentUserId: string
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {total} {total === 1 ? 'user' : 'users'} total
        </p>

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger
            render={
              <Button>
                <Plus />
                Register New User
              </Button>
            }
          />
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Register New User</DrawerTitle>
              <DrawerDescription>
                Create a student or admin account. They can sign in with their
                email and password.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <UserDrawerForm
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
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Registrations</TableHead>
              <TableHead>Joined</TableHead>
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
                  No users found. Click <strong>Register New User</strong> to
                  add one.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {row.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {row.image ? (
                          <AvatarImage src={row.image} alt={row.name} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {getInitials(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {row.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.role === 'admin' ? (
                      <Badge className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <User2 className="h-3 w-3" />
                        User
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.emailVerified ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-green-600 text-green-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Unverified
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {row.totalRegistrations}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(row.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteUserButton
                      id={row.id}
                      name={row.name}
                      isSelf={row.id === currentUserId}
                    />
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

function DeleteUserButton({
  id,
  name,
  isSelf,
}: {
  id: string
  name: string
  isSelf: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleDelete(currentUserId: string) {
    setPending(true)
    const result = await deleteUser(id, currentUserId)
    setPending(false)

    if (result.success) {
      toast.success(`User "${name}" deleted.`)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Failed to delete.')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            disabled={pending || isSelf}
            title={isSelf ? 'You cannot delete your own account' : undefined}
          >
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this user?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{name}</strong> and all
            related registrations and exam submissions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              // currentUserId isn't available here; the server action guards anyway
              handleDelete('')
            }}
            disabled={pending}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}