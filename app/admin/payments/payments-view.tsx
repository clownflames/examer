'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  IndianRupee,
  Search,
  Users,
  X,
} from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { cn } from '@/lib/utils'

import { PaymentDetailDrawer } from './payment-detail-drawer'
import type {
  AdminPaymentRow,
  AdminPaymentStats,
  PaymentFilterStatus,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function inr(amount: number): string {
  const hasDecimals = amount % 1 !== 0
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return format(new Date(iso), 'MMM d, yyyy · h:mm a')
}

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || 'U'
  return source.slice(0, 1).toUpperCase()
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

export function PaymentsView({
  data,
  stats,
  page,
  totalPages,
  total,
  pageSize,
  currentStatus,
  currentQuery,
}: {
  data: AdminPaymentRow[]
  stats: AdminPaymentStats
  page: number
  totalPages: number
  total: number
  pageSize: number
  currentStatus: PaymentFilterStatus
  currentQuery: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = React.useState(currentQuery)
  const [selectedPaymentId, setSelectedPaymentId] = React.useState<
    string | null
  >(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  // keep local input in sync if the URL query changes externally
  React.useEffect(() => {
    setSearchValue(currentQuery)
  }, [currentQuery])

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  // debounce search → URL
  React.useEffect(() => {
    const handle = setTimeout(() => {
      if (searchValue === currentQuery) return
      updateParams({
        q: searchValue.trim() || null,
        page: '1',
      })
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue])

  function goToPage(p: number) {
    updateParams({ page: String(p) })
  }

  function openDetail(id: string) {
    setSelectedPaymentId(id)
    setDrawerOpen(true)
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const hasFilters = currentStatus !== 'all' || currentQuery.length > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Revenue"
          value={inr(stats.totalRevenue)}
          icon={<IndianRupee className="h-4 w-4" />}
          accent="primary"
        />
        <StatCard
          label="Paid"
          value={String(stats.paidCount)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="emerald"
        />
        <StatCard
          label="Pending"
          value={String(stats.pendingCount)}
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Failed"
          value={String(stats.failedCount)}
          icon={<AlertCircle className="h-4 w-4" />}
          accent="destructive"
        />
        <StatCard
          label="Students"
          value={String(stats.uniqueStudents)}
          icon={<Users className="h-4 w-4" />}
          accent="default"
        />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatusFilter
            current={currentStatus}
            onChange={(s) =>
              updateParams({
                status: s === 'all' ? null : s,
                page: '1',
              })
            }
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() =>
                updateParams({ status: null, q: null, page: '1' })
              }
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search user, email, internship, IDs…"
            className="pl-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {data.length === 0 ? (
        <EmptyState filtered={hasFilters} />
      ) : (
        <>
          {/* Table */}
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Internship</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(p.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.userImage ?? undefined} />
                          <AvatarFallback>
                            {initials(p.userName, p.userEmail)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {p.userName ?? 'Unknown'}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {p.userEmail ?? ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {p.internshipName}
                        </span>
                        {p.demandName && (
                          <span className="text-muted-foreground truncate text-xs">
                            {p.demandName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {inr(p.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtDateTime(p.paidAt ?? p.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
            <p className="text-muted-foreground text-sm">
              Showing{' '}
              <span className="text-foreground font-medium">{from}</span>–
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
                      page <= 1
                        ? 'pointer-events-none opacity-50'
                        : undefined
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
        </>
      )}

      {/* Drawer */}
      <PaymentDetailDrawer
        paymentId={selectedPaymentId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Stat card                                                                  */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon,
  accent = 'default',
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: 'default' | 'primary' | 'emerald' | 'amber' | 'destructive'
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 md:p-4">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10',
            accent === 'primary' && 'bg-primary/10 text-primary',
            accent === 'emerald' &&
              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
            accent === 'amber' &&
              'bg-amber-500/10 text-amber-600 dark:text-amber-500',
            accent === 'destructive' && 'bg-destructive/10 text-destructive',
            accent === 'default' && 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            {label}
          </p>
          <p className="truncate text-sm font-semibold tabular-nums md:text-base">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Status badge                                                               */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: AdminPaymentRow['status'] }) {
  if (status === 'paid') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500"
      >
        <CheckCircle2 className="h-3 w-3" />
        Paid
      </Badge>
    )
  }
  if (status === 'pending') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-500"
      >
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="h-3 w-3" />
      Failed
    </Badge>
  )
}

/* -------------------------------------------------------------------------- */
/*  Status filter                                                              */
/* -------------------------------------------------------------------------- */

function StatusFilter({
  current,
  onChange,
}: {
  current: PaymentFilterStatus
  onChange: (s: PaymentFilterStatus) => void
}) {
  const options: { value: PaymentFilterStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
  ]

  return (
    <div className="bg-muted/50 inline-flex items-center rounded-lg border p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            current === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-16 text-center">
      <div className="bg-muted mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <CreditCard className="text-muted-foreground h-6 w-6" />
      </div>
      <p className="mb-1 text-sm font-semibold">
        {filtered ? 'No matching payments' : 'No payments yet'}
      </p>
      <p className="text-muted-foreground max-w-xs text-xs">
        {filtered
          ? 'Try a different search term or filter.'
          : 'Payments made by students will appear here.'}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page numbers helper                                                        */
/* -------------------------------------------------------------------------- */

function getPageNumbers(
  current: number,
  total: number
): (number | '…')[] {
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