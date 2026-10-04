'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import { verifyOfferLetter, type VerifyOfferResult } from '../actions'

export default function VerifyOfferLetterClient({
  initialNo,
}: {
  initialNo: string
}) {
  const router = useRouter()
  const [code, setCode] = useState(initialNo)
  const [result, setResult] = useState<VerifyOfferResult | null>(null)
  const [pending, startTransition] = useTransition()

  function runVerification(value: string) {
    startTransition(async () => {
      const res = await verifyOfferLetter(value)
      setResult(res)

      if (res.found) {
        router.replace(
          `/offer-letters/verify?no=${encodeURIComponent(value.trim())}`
        )
      }
    })
  }

  // Deep link ke saath auto-verify
  const initialRun = useRef(false)
  useEffect(() => {
    if (!initialNo || initialRun.current) return
    initialRun.current = true
    runVerification(initialNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNo])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!code.trim()) {
      toast.error('Enter an offer reference number.')
      return
    }

    runVerification(code)
  }

  return (
    <div className="min-h-screen">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="bg-primary/20 pointer-events-none absolute -top-40 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full blur-[120px]" />

        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center md:px-8 md:py-20">
          <Badge variant="outline" className="mb-4 gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            PUBLIC VERIFICATION
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Verify an Offer Letter
          </h1>

          <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm md:text-base">
            Enter the offer reference number to confirm the issuer and whether
            the offer is still open.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 flex max-w-lg flex-col gap-2 sm:flex-row"
          >
            <div className="flex-1 text-left">
              <Label htmlFor="offer-no" className="sr-only">
                Offer reference number
              </Label>
              <Input
                id="offer-no"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="OFFR-2026-A1B2C3"
                className="h-11 font-mono"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <Button type="submit" size="lg" className="h-11" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Verify
            </Button>
          </form>

          <p className="text-muted-foreground mt-3 text-xs">
            No login required — anyone can verify an offer letter.
          </p>
        </div>
      </section>

      {/* ============ RESULT ============ */}
      <section className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        {pending && !result && <ResultSkeleton />}

        {!pending && result && (
          <div className="flex flex-col gap-6">
            {result.found ? (
              <>
                <ResultCard result={result} />
                <p className="text-muted-foreground text-center text-xs">
                  Sharing this page? Anyone with the reference can verify it too.
                </p>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-destructive/10 text-destructive mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                    <X className="h-6 w-6" />
                  </div>
                  <h2 className="mb-1 text-base font-semibold">Not found</h2>
                  <p className="text-muted-foreground max-w-[320px] text-sm">
                    {result.error}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!pending && !result && <EmptyHint />}
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Result card                                                                */
/* -------------------------------------------------------------------------- */

function ResultCard({
  result,
}: {
  result: Extract<VerifyOfferResult, { found: true }>
}) {
  // Offer "live" hai sirf tab jab issued hai, expired nahi, aur revoked nahi
  const isOpen = result.isOpen

  const banner = isOpen
    ? {
        cls: 'flex items-center gap-3 bg-emerald-500/10 px-6 py-4',
        iconCls:
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400',
        title: 'text-sm font-semibold text-emerald-400',
        Icon: CheckCircle2,
        heading: 'Active offer',
        sub: 'This offer was issued by the company and is currently open.',
      }
    : result.status === 'revoked'
      ? {
          cls: 'flex items-center gap-3 bg-destructive/10 px-6 py-4',
          iconCls:
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive',
          title: 'text-sm font-semibold text-destructive',
          Icon: Ban,
          heading: 'Revoked offer',
          sub: 'This offer has been revoked by the issuer.',
        }
      : result.status === 'accepted'
        ? {
            cls: 'flex items-center gap-3 bg-muted px-6 py-4',
            iconCls:
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20',
            title: 'text-sm font-semibold',
            Icon: CheckCircle2,
            heading: 'Accepted offer',
            sub: 'The candidate has already accepted this offer.',
          }
        : result.status === 'declined'
          ? {
              cls: 'flex items-center gap-3 bg-muted px-6 py-4',
              iconCls:
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20',
              title: 'text-sm font-semibold',
              Icon: X,
              heading: 'Declined offer',
              sub: 'The candidate declined this offer.',
            }
          : {
              cls: 'flex items-center gap-3 bg-destructive/10 px-6 py-4',
              iconCls:
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive',
              title: 'text-sm font-semibold text-destructive',
              Icon: Clock,
              heading: 'Expired offer',
              sub: 'The response deadline has passed.',
            }

  const BannerIcon = banner.Icon

  return (
    <Card className="overflow-hidden p-0">
      <div className={banner.cls}>
        <div className={banner.iconCls}>
          <BannerIcon className="h-5 w-5" />
        </div>
        <div>
          <p className={banner.title}>{banner.heading}</p>
          <p className="text-muted-foreground text-xs">{banner.sub}</p>
        </div>
      </div>

      <CardContent className="flex flex-col gap-4 p-6">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Reference number
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">
            {result.offerNo}
          </p>
        </div>

        <div className="divide-y rounded-lg border">
          <Row
            label="Company"
            value={result.companyName}
            icon={Building2}
          />
          <Row label="Designation" value={result.designation} />
          {result.location && (
            <Row label="Location" value={result.location} icon={MapPin} />
          )}
          {result.compensation && (
            <Row label="Compensation" value={result.compensation} />
          )}
          <Row label="Offered to" value={result.candidateName} />
          {result.internshipName && (
            <Row label="Internship" value={result.internshipName} />
          )}
          {result.issuedAt && (
            <Row
              label="Issued on"
              value={format(new Date(result.issuedAt), 'MMMM d, yyyy')}
              icon={CalendarDays}
            />
          )}
          <Row
            label="Respond by"
            value={
              result.expiresAt
                ? format(new Date(result.expiresAt), 'MMMM d, yyyy')
                : 'No deadline'
            }
            icon={Clock}
          />
        </div>

        {result.revokeReason && result.status === 'revoked' && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="mb-1 text-xs font-medium tracking-wide uppercase">
              Revocation reason
            </p>
            <p className="text-sm">{result.revokeReason}</p>
          </div>
        )}

        <div className="flex justify-center border-t pt-4">
          <Button variant="outline" render={<Link href="/" />}>
            Learn more about InternBird
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: typeof MapPin
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Loading / hint states                                                      */
/* -------------------------------------------------------------------------- */

function ResultSkeleton() {
  return (
    <Card className="p-0">
      <div className="flex items-center gap-3 px-6 py-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <CardContent className="flex flex-col gap-4 p-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-44 w-full" />
      </CardContent>
    </Card>
  )
}

function EmptyHint() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center">
      <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
        <Search className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="mb-1 text-sm font-semibold">Enter a reference number</h2>
      <p className="text-muted-foreground max-w-[300px] text-xs">
        Reference numbers look like{' '}
        <span className="font-mono">OFFR-2026-A1B2C3</span> and are printed on
        the offer letter.
      </p>
    </div>
  )
}