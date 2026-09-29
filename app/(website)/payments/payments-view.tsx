'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  IndianRupee,
  Receipt,
  X,
} from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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

import type {
  PaymentRow,
  PaymentStats,
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

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return format(new Date(iso), 'MMM d, yyyy')
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
}: {
  data: PaymentRow[]
  stats: PaymentStats
  page: number
  totalPages: number
  total: number
  pageSize: number
  currentStatus: PaymentFilterStatus
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function goToPage(p: number) {
    updateParams({ page: String(p) })
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total spent"
          value={inr(stats.totalSpent)}
          icon={<IndianRupee className="h-4 w-4" />}
          accent="primary"
        />
        <StatCard
          label="Successful"
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
      </div>

      {/* Filters */}
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
        {currentStatus !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => updateParams({ status: null, page: '1' })}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      {data.length === 0 ? (
        <EmptyState filtered={currentStatus !== 'all'} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Internship</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {p.internshipName}
                        </span>
                        {p.demandName && (
                          <span className="text-muted-foreground text-xs">
                            {p.demandName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {inr(p.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fmtDate(p.paidAt ?? p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        render={
                          <Link href="/internships">
                            View
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {data.map((p) => (
              <PaymentCard key={p.id} payment={p} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
            <p className="text-muted-foreground text-xs md:text-sm">
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

function StatusBadge({ status }: { status: PaymentRow['status'] }) {
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
/*  Mobile payment card                                                        */
/* -------------------------------------------------------------------------- */

function PaymentCard({ payment }: { payment: PaymentRow }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {payment.internshipName}
            </p>
            {payment.demandName && (
              <p className="text-muted-foreground truncate text-xs">
                {payment.demandName}
              </p>
            )}
          </div>
          <StatusBadge status={payment.status} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm">
            <Receipt className="text-muted-foreground h-3.5 w-3.5" />
            <span className="font-semibold tabular-nums">
              {inr(payment.amount)}
            </span>
          </div>
          <span className="text-muted-foreground text-xs">
            {fmtDate(payment.paidAt ?? payment.createdAt)}
          </span>
        </div>

        {payment.status === 'failed' && payment.failureReason && (
          <p className="bg-destructive/10 text-destructive rounded-md px-2.5 py-1.5 text-[11px]">
            {payment.failureReason}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          render={
            <Link href="/internships">
              View internship
              <ExternalLink className="h-3 w-3" />
            </Link>
          }
        />
      </CardContent>
    </Card>
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
          ? 'Try changing the filter above.'
          : 'When you pay for an internship, your transaction will show up here.'}
      </p>
      {!filtered && (
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          render={<Link href="/internships" />}
        >
          Browse internships
        </Button>
      )}
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