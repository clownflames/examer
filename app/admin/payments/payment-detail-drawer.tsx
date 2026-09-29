'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Receipt,
  User as UserIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

import { getAdminPaymentDetail } from './actions'
import type { AdminPaymentDetail } from './constants'

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

async function copy(value: string | null) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Copied')
  } catch {
    toast.error('Copy failed')
  }
}

/* -------------------------------------------------------------------------- */
/*  Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function PaymentDetailDrawer({
  paymentId,
  open,
  onOpenChange,
}: {
  paymentId: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [detail, setDetail] = React.useState<AdminPaymentDetail | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !paymentId) return
    let cancelled = false
    setLoading(true)
    setDetail(null)

    getAdminPaymentDetail(paymentId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((err) => {
        console.error(err)
        toast.error('Failed to load payment.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, paymentId])

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <DrawerContent className="flex h-[92vh] w-full flex-col">
        {/* Drag handle */}
        <div className="bg-muted mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full" />

        <DrawerHeader className="mx-auto w-full max-w-3xl border-b text-left">
          <DrawerTitle>Payment Details</DrawerTitle>
          <DrawerDescription>
            Full transaction snapshot and student info.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : !detail ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No payment data.
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 md:p-6">
                {/* Amount + Status hero */}
                <div className="bg-card rounded-2xl border p-5 text-center">
                  <p className="text-3xl font-bold tabular-nums">
                    {inr(detail.amount)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {detail.currency} · Payment ID{' '}
                    <span className="font-mono">{detail.id.slice(0, 8)}</span>
                  </p>
                  <div className="mt-3 flex justify-center">
                    <StatusBadge status={detail.status} />
                  </div>
                  {detail.status === 'failed' && detail.failureReason && (
                    <p className="bg-destructive/10 text-destructive mt-3 rounded-md px-3 py-2 text-xs">
                      {detail.failureReason}
                    </p>
                  )}
                </div>

                {/* Student */}
                <Section title="Student" icon={<UserIcon className="h-4 w-4" />}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={detail.userImage ?? undefined} />
                      <AvatarFallback>
                        {initials(detail.userName, detail.userEmail)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {detail.userName ?? 'Unknown'}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {detail.userEmail ?? '—'}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {detail.userRole ?? 'user'}
                        </Badge>
                        {detail.userCreatedAt && (
                          <span className="text-muted-foreground text-[10px]">
                            Joined {format(new Date(detail.userCreatedAt), 'MMM yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      render={
                        <Link
                          href={`/admin/users?q=${encodeURIComponent(detail.userEmail ?? '')}`}
                        >
                          View user
                        </Link>
                      }
                    />
                    {detail.userEmail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(detail.userEmail)}
                        className="gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Copy email
                      </Button>
                    )}
                  </div>
                </Section>

                {/* Internship */}
                <Section
                  title="Internship"
                  icon={<Receipt className="h-4 w-4" />}
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold">
                      {detail.internshipName}
                    </p>
                    {detail.demandName && (
                      <p className="text-muted-foreground text-xs">
                        {detail.demandName}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    render={
                      <Link
                        href={`/admin/internships/${detail.internshipId}/edit`}
                      >
                        View internship
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    }
                  />
                </Section>

                {/* Razorpay */}
                <Section
                  title="Razorpay"
                  icon={<Link2 className="h-4 w-4" />}
                >
                  <div className="flex flex-col gap-3">
                    <CopyRow
                      label="Order ID"
                      value={detail.razorpayOrderId}
                    />
                    <CopyRow
                      label="Payment ID"
                      value={detail.razorpayPaymentId}
                    />
                    <CopyRow
                      label="Signature"
                      value={detail.razorpaySignature}
                      mono
                    />
                  </div>
                </Section>

                {/* Application */}
                <Section
                  title="Application"
                  icon={<FileText className="h-4 w-4" />}
                >
                  <div className="flex flex-col gap-3">
                    {detail.resumeUrl && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                            Resume
                          </p>
                          <p className="truncate text-xs">
                            {detail.resumeUrl}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          render={
                            <a
                              href={detail.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          }
                        />
                      </div>
                    )}

                    {detail.coverLetter && (
                      <div>
                        <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
                          Cover letter
                        </p>
                        <div
                          className="rich-text bg-muted/40 max-h-48 overflow-y-auto rounded-md p-3 text-xs"
                          dangerouslySetInnerHTML={{
                            __html: detail.coverLetter,
                          }}
                        />
                      </div>
                    )}

                    {!detail.resumeUrl && !detail.coverLetter && (
                      <p className="text-muted-foreground text-xs italic">
                        No application data found.
                      </p>
                    )}
                  </div>
                </Section>

                {/* Timeline */}
                <Section
                  title="Timeline"
                  icon={<Clock className="h-4 w-4" />}
                >
                  <div className="flex flex-col gap-2 text-xs">
                    <TimelineRow
                      label="Created"
                      value={fmtDateTime(detail.createdAt)}
                    />
                    {detail.paidAt && (
                      <TimelineRow
                        label="Paid"
                        value={fmtDateTime(detail.paidAt)}
                      />
                    )}
                    <TimelineRow
                      label="Updated"
                      value={fmtDateTime(detail.updatedAt)}
                    />
                  </div>
                </Section>
              </div>
            </ScrollArea>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="text-muted-foreground mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function CopyRow({
  label,
  value,
  mono = true,
}: {
  label: string
  value: string | null
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
          {label}
        </p>
        <p
          className={cn(
            'truncate text-xs',
            mono && 'font-mono',
            !value && 'text-muted-foreground italic'
          )}
        >
          {value ?? 'Not set'}
        </p>
      </div>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => copy(value)}
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: AdminPaymentDetail['status']
}) {
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