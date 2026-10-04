'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Ban,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Download,
  FileSignature,
  Loader2,
  MapPin,
  ShieldCheck,
  IndianRupee,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'

import { respondToOfferLetter, type MyOfferLetter } from './actions'

export default function OfferLettersClient({
  userName,
  letters,
}: {
  userName: string
  letters: MyOfferLetter[]
}) {
  const open = letters.filter(
    (l) => l.status === 'issued' && !l.isExpired
  )
  const accepted = letters.filter((l) => l.status === 'accepted')
  const closed = letters.filter(
    (l) =>
      l.status === 'declined' ||
      l.status === 'revoked' ||
      l.isExpired
  )

  return (
    <div className="min-h-screen">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="bg-primary/20 pointer-events-none absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
          <Badge variant="outline" className="mb-4 gap-1.5">
            <FileSignature className="h-3 w-3" />
            YOUR OFFERS
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Offer Letters
          </h1>

          <p className="text-muted-foreground mt-3 max-w-md text-sm md:text-base">
            Offers you can accept or decline, with a reference number you can
            share with employers for verification.
          </p>

          <Button
            variant="outline"
            className="mt-6"
            render={<Link href="/offer-letters/verify" />}
          >
            <ShieldCheck className="h-4 w-4" />
            Verify an Offer
          </Button>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap gap-6">
            <Stat label="Total" value={letters.length} />
            <Stat label="Awaiting response" value={open.length} className="text-amber-400" />
            <Stat label="Accepted" value={accepted.length} className="text-emerald-400" />
            <Stat label="Closed" value={closed.length} className="text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* ============ LETTERS ============ */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <h2 className="text-xl font-semibold tracking-tight">Your offers</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Signed in as {userName}
        </p>

        {letters.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {letters.map((letter) => (
              <OfferLetterCard key={letter.id} letter={letter} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Stat                                                                       */
/* -------------------------------------------------------------------------- */

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div>
      <p
        className={
          className ? `text-2xl font-bold ${className}` : 'text-2xl font-bold'
        }
      >
        {value}
      </p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
          <FileSignature className="h-7 w-7" />
        </div>
        <h3 className="mb-1 text-sm font-semibold">No offer letters yet</h3>
        <p className="text-muted-foreground max-w-[320px] text-xs">
          Complete an internship and stand out — offer letters appear here once
          an employer issues one.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-5"
          render={<Link href="/" />}
        >
          Browse internships
        </Button>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Status badge                                                               */
/* -------------------------------------------------------------------------- */

function StatusBadge({ letter }: { letter: MyOfferLetter }) {
  if (letter.status === 'accepted') {
    return (
      <Badge className="gap-1">
        <Check className="h-3 w-3" />
        Accepted
      </Badge>
    )
  }

  if (letter.status === 'declined') {
    return (
      <Badge variant="outline" className="gap-1">
        <X className="h-3 w-3" />
        Declined
      </Badge>
    )
  }

  if (letter.status === 'revoked') {
    return (
      <Badge variant="destructive" className="gap-1">
        <Ban className="h-3 w-3" />
        Revoked
      </Badge>
    )
  }

  if (letter.isExpired) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Expired
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-400">
      <Clock className="h-3 w-3" />
      Awaiting response
    </Badge>
  )
}

/* -------------------------------------------------------------------------- */
/*  Offer letter card                                                          */
/* -------------------------------------------------------------------------- */

function OfferLetterCard({ letter }: { letter: MyOfferLetter }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const isClosed =
    letter.status === 'accepted' ||
    letter.status === 'declined' ||
    letter.status === 'revoked' ||
    letter.isExpired

  function copyRef() {
    navigator.clipboard
      .writeText(letter.offerNo)
      .then(() => toast.success('Reference number copied.'))
      .catch(() => toast.error('Could not copy.'))
  }

  return (
    <Card className={isClosed ? 'p-0 opacity-85' : 'p-0'}>
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex items-center gap-1.5 text-base font-semibold">
                <Building2 className="text-muted-foreground h-4 w-4" />
                {letter.companyName}
              </h3>
              <StatusBadge letter={letter} />
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {letter.designation}
            </p>
          </div>

          {letter.pdfUrl && (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={letter.pdfUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          )}
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {letter.internshipName && (
            <Meta icon={FileSignature} label="Internship" value={letter.internshipName} />
          )}
          {letter.location && (
            <Meta icon={MapPin} label="Location" value={letter.location} />
          )}
          {letter.compensation && (
            <Meta
              icon={IndianRupee}
              label="Compensation"
              value={letter.compensation}
            />
          )}
          {letter.duration && (
            <Meta icon={Clock} label="Duration" value={letter.duration} />
          )}
          {letter.joiningDate && (
            <Meta
              icon={CalendarDays}
              label="Joining date"
              value={format(new Date(letter.joiningDate), 'MMM d, yyyy')}
            />
          )}
          {letter.issuedAt && (
            <Meta
              icon={CalendarDays}
              label="Issued"
              value={format(new Date(letter.issuedAt), 'MMM d, yyyy')}
            />
          )}
          {letter.expiresAt && (
            <Meta
              icon={Clock}
              label="Respond by"
              value={format(new Date(letter.expiresAt), 'MMM d, yyyy')}
            />
          )}
        </div>

        {/* Body preview */}
        {letter.body && (
          <div
            className="text-muted-foreground line-clamp-3 text-sm"
            dangerouslySetInnerHTML={{ __html: letter.body }}
          />
        )}

        {/* Revoke / decline reason */}
        {letter.status === 'revoked' && letter.revokeReason && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="mb-1 text-xs font-medium tracking-wide uppercase">
              Revoked by issuer
            </p>
            <p className="text-sm">{letter.revokeReason}</p>
          </div>
        )}

        {letter.status === 'declined' && letter.declineReason && (
          <div className="rounded-lg border p-3">
            <p className="mb-1 text-xs font-medium tracking-wide uppercase">
              Your reason for declining
            </p>
            <p className="text-sm">{letter.declineReason}</p>
          </div>
        )}

        {/* Reference + actions */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
            <span className="text-muted-foreground shrink-0 text-[10px] tracking-wide uppercase">
              Ref
            </span>
            <span className="flex-1 truncate font-mono text-xs font-medium">
              {letter.offerNo}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={copyRef}
              aria-label="Copy reference number"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setDetailOpen(true)}
          >
            View details
          </Button>

          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={
              <Link
                href={`/offer-letters/verify?no=${encodeURIComponent(letter.offerNo)}`}
              />
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify
          </Button>

          {letter.canRespond && (
            <RespondButtons letterId={letter.id} />
          )}
        </div>
      </CardContent>

      <OfferDetailDrawer
        letter={letter}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Meta item                                                                  */
/* -------------------------------------------------------------------------- */

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground flex items-center gap-1 text-[10px] tracking-wide uppercase">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Accept / Decline                                                           */
/* -------------------------------------------------------------------------- */

function RespondButtons({ letterId }: { letterId: string }) {
  const router = useRouter()
  const [declineOpen, setDeclineOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  function respond(response: 'accepted' | 'declined', why?: string) {
    startTransition(async () => {
      const result = await respondToOfferLetter(letterId, response, why)
      if (result.success) {
        toast.success(
          response === 'accepted'
            ? 'Offer accepted.'
            : 'Offer declined.'
        )
        setDeclineOpen(false)
        setReason('')
        // Server component naya data fetch kare — bina iske status stale rahega
        router.refresh()
      } else {
        toast.error(result.error ?? 'Something went wrong.')
      }
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => respond('accepted')}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Accept
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setDeclineOpen(true)}
          disabled={pending}
        >
          <X className="h-3.5 w-3.5" />
          Decline
        </Button>
      </div>

      <Drawer open={declineOpen} onOpenChange={setDeclineOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Decline this offer?</DrawerTitle>
            <DrawerDescription>
              Let the employer know why (optional). This cannot be undone.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="decline-reason">Reason</Label>
              <Textarea
                id="decline-reason"
                rows={4}
                placeholder="e.g. I accepted another offer…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeclineOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => respond('declined', reason)}
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Declining…
                  </>
                ) : (
                  'Confirm decline'
                )}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Full detail drawer                                                         */
/* -------------------------------------------------------------------------- */

function OfferDetailDrawer({
  letter,
  open,
  onOpenChange,
}: {
  letter: MyOfferLetter
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{letter.companyName}</DrawerTitle>
          <DrawerDescription>
            {letter.designation} · Ref{' '}
            <span className="font-mono">{letter.offerNo}</span>
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
          <StatusBadge letter={letter} />

          <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
            {letter.location && (
              <Meta icon={MapPin} label="Location" value={letter.location} />
            )}
            {letter.compensation && (
              <Meta
                icon={IndianRupee}
                label="Compensation"
                value={letter.compensation}
              />
            )}
            {letter.duration && (
              <Meta icon={Clock} label="Duration" value={letter.duration} />
            )}
            {letter.internshipName && (
              <Meta
                icon={FileSignature}
                label="Internship"
                value={letter.internshipName}
              />
            )}
            {letter.joiningDate && (
              <Meta
                icon={CalendarDays}
                label="Joining date"
                value={format(new Date(letter.joiningDate), 'MMMM d, yyyy')}
              />
            )}
            {letter.issuedAt && (
              <Meta
                icon={CalendarDays}
                label="Issued"
                value={format(new Date(letter.issuedAt), 'MMMM d, yyyy')}
              />
            )}
            {letter.expiresAt && (
              <Meta
                icon={Clock}
                label="Respond by"
                value={format(new Date(letter.expiresAt), 'MMMM d, yyyy')}
              />
            )}
          </div>

          {letter.body && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Letter
              </p>
              <div
                className="rich-text rounded-lg border p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: letter.body }}
              />
            </div>
          )}

          {letter.pdfUrl && (
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={letter.pdfUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}