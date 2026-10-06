'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Mail,
  MailCheck,
  MailWarning,
  RefreshCw,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

import {
  getExamEmailStatus,
  notifyExamStudents,
  syncExamEmailStatuses,
} from './actions'
import type { NotificationRow, NotificationSummary } from './notify'

/* -------------------------------------------------------------------------- */
/*  Status styling                                                             */
/* -------------------------------------------------------------------------- */

const STATUS_META: Record<
  NotificationRow['status'],
  { label: string; icon: typeof Mail; badge: string }
> = {
  queued: {
    label: 'Queued',
    icon: Clock,
    badge: 'bg-slate-400/10 text-slate-600 border-slate-400/30',
  },
  sent: {
    label: 'Sent',
    icon: Send,
    badge: 'bg-blue-400/10 text-blue-600 border-blue-400/30',
  },
  delivered: {
    label: 'Delivered',
    icon: MailCheck,
    badge: 'bg-emerald-400/10 text-emerald-600 border-emerald-400/30',
  },
  failed: {
    label: 'Failed',
    icon: AlertTriangle,
    badge: 'bg-red-400/10 text-red-600 border-red-400/30',
  },
  bounced: {
    label: 'Bounced',
    icon: MailWarning,
    badge: 'bg-orange-400/10 text-orange-600 border-orange-400/30',
  },
  complained: {
    label: 'Spam reported',
    icon: MailWarning,
    badge: 'bg-rose-400/10 text-rose-600 border-rose-400/30',
  },
}

const EMPTY_SUMMARY: NotificationSummary = {
  total: 0,
  delivered: 0,
  sent: 0,
  queued: 0,
  failed: 0,
  bounced: 0,
  complained: 0,
  deliveredTo: 0,
}

/* -------------------------------------------------------------------------- */
/*  Per-exam email drawer                                                      */
/* -------------------------------------------------------------------------- */

export function ExamEmailsDrawer({
  examId,
  examName,
  initialCounts,
}: {
  examId: string
  examName: string
  initialCounts?: { total: number; delivered: number; failed: number }
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [summary, setSummary] = React.useState<NotificationSummary>(
    EMPTY_SUMMARY
  )
  const [rows, setRows] = React.useState<NotificationRow[]>([])
  const [syncing, setSyncing] = React.useState(false)
  const [sending, setSending] = React.useState(false)

  const total = summary.total || initialCounts?.total || 0
  const delivered = summary.total ? summary.delivered : (initialCounts?.delivered ?? 0)
  const failed = summary.total ? summary.failed : (initialCounts?.failed ?? 0)

  async function load() {
    setLoading(true)
    const res = await getExamEmailStatus(examId)
    setSummary(res.summary)
    setRows(res.rows)
    setLoading(false)
  }

  /** Load on open rather than in an effect, so the fetch starts with the drawer. */
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) void load()
  }

  async function handleSync() {
    setSyncing(true)
    const res = await syncExamEmailStatuses(examId)
    setSyncing(false)

    if (res.success) {
      toast.success(
        res.checked === 0
          ? 'Nothing left to check — every email has a final status.'
          : `Checked ${res.checked} email${res.checked === 1 ? '' : 's'}.`,
        {
          description: res.updated
            ? `${res.updated} status${res.updated === 1 ? '' : 'es'} updated from the mail provider.`
            : 'No status changed since the last check.',
        }
      )
      await load()
    } else {
      toast.error(res.error ?? 'Could not check delivery status.')
    }
  }

  async function handleResend() {
    setSending(true)
    const res = await notifyExamStudents(examId)
    setSending(false)

    if (!res.success) {
      toast.error(res.error ?? 'Could not send the emails.')
      return
    }

    if (res.skipped || (res.sent ?? 0) === 0) {
      toast.warning('No emails were sent.', {
        description: res.error ?? 'There may be no paid students yet.',
      })
    } else {
      toast.success(`Emailed ${res.sent} of ${res.recipients} students.`, {
        description: res.failed
          ? `${res.failed} could not be sent — see the list for details.`
          : undefined,
      })
    }
    await load()
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1 px-2">
            <Mail className="h-3.5 w-3.5" />
            {total === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <>
                <span className="tabular-nums">
                  {delivered}/{total}
                </span>
                {failed > 0 && (
                  <MailWarning
                    className="h-3 w-3 text-red-500"
                    aria-label={`${failed} failed`}
                  />
                )}
              </>
            )}
          </Button>
        }
      />
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Student emails</DrawerTitle>
          <DrawerDescription>
            Who was notified about <strong>{examName}</strong> and what happened
            to each message.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-wrap items-center gap-2 px-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing || total === 0}
            className="gap-1.5"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Check delivery status
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={sending}
            className="gap-1.5"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Email students now
          </Button>
        </div>

        {total > 0 && (
          <div className="grid grid-cols-2 gap-2 px-4 pt-3 sm:grid-cols-4">
            <Stat label="Recipients" value={summary.total} />
            <Stat label="Delivered" value={summary.delivered} tone="good" />
            <Stat label="In flight" value={summary.sent + summary.queued} />
            <Stat
              label="Failed"
              value={summary.failed + summary.bounced + summary.complained}
              tone="bad"
            />
          </div>
        )}

        <div className="overflow-y-auto px-4 pb-6 pt-4">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
              <Inbox className="text-muted-foreground mb-3 h-7 w-7" />
              <p className="text-sm font-medium">Nobody emailed yet</p>
              <p className="text-muted-foreground mt-1 max-w-[280px] text-xs">
                Students are emailed when you tick the box while creating the
                exam, or you can send it now with the button above.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <StatusRow key={row.id} row={row} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-lg font-semibold tabular-nums ${
          tone === 'good'
            ? 'text-emerald-600'
            : tone === 'bad' && value > 0
              ? 'text-red-600'
              : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function StatusRow({ row }: { row: NotificationRow }) {
  const meta = STATUS_META[row.status]
  const Icon = meta.icon

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.studentName}</p>
          <p className="text-muted-foreground truncate text-xs">{row.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`gap-1 ${meta.badge}`}>
          <Icon className="h-3 w-3" />
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
        {row.sentAt ? format(new Date(row.sentAt), 'MMM d, h:mm a') : '—'}
      </TableCell>
      <TableCell>
        <p className="text-muted-foreground max-w-[220px] truncate text-xs">
          {row.error ?? (row.deliveredAt ? 'Confirmed delivered' : '—')}
        </p>
      </TableCell>
    </TableRow>
  )
}

/* -------------------------------------------------------------------------- */
/*  Site-wide sync button                                                      */
/* -------------------------------------------------------------------------- */

export function CheckAllEmailsButton({ pending }: { pending: number }) {
  const [pendingState, setPendingState] = React.useState(false)

  async function handleClick() {
    setPendingState(true)
    const res = await syncExamEmailStatuses()
    setPendingState(false)

    if (res.success) {
      toast.success(
        res.checked === 0
          ? 'Every email already has a final status.'
          : `Checked ${res.checked} email${res.checked === 1 ? '' : 's'}.`,
        {
          description: res.updated
            ? `${res.updated} updated · ${res.unknown} still not reported by the provider.`
            : 'No status changed since the last check.',
        }
      )
    } else {
      toast.error(res.error ?? 'Could not check delivery status.')
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pendingState}
      className="gap-1.5"
    >
      {pendingState ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : pending > 0 ? (
        <MailWarning className="h-3.5 w-3.5 text-amber-500" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      )}
      Check email status
      {pending > 0 && (
        <Badge variant="secondary" className="ml-0.5 px-1.5 tabular-nums">
          {pending}
        </Badge>
      )}
    </Button>
  )
}