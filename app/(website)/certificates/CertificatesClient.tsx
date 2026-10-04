'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Award,
  BadgeCheck,
  Ban,
  Check,
  Clock,
  Copy,
  Download,
  Loader2,
  Plus,
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'

import {
  createVerificationRequest,
  type MyCertificate,
  type MyVerificationRequest,
} from './actions'

export default function CertificatesClient({
  userName,
  certificates,
  requests,
}: {
  userName: string
  certificates: MyCertificate[]
  requests: MyVerificationRequest[]
}) {
  const [requestOpen, setRequestOpen] = useState(false)

  const issued = certificates.filter((c) => c.status === 'issued')
  const revoked = certificates.filter((c) => c.status === 'revoked')

  return (
    <div className="min-h-screen">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="bg-primary/20 pointer-events-none absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Award className="h-3 w-3" />
            YOUR CREDENTIALS
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Certificates
          </h1>

          <p className="text-muted-foreground mt-3 max-w-md text-sm md:text-base">
            Every certificate you earn lives here with a unique verification
            code you can share with employers.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => setRequestOpen(true)}>
              <Plus className="h-4 w-4" />
              Request Verification
            </Button>
            <Button variant="outline" render={<Link href="/certificates/verify" />}>
              <ShieldCheck className="h-4 w-4" />
              Verify a Certificate
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap gap-6">
            <Stat label="Total" value={certificates.length} />
            <Stat label="Active" value={issued.length} className="text-emerald-400" />
            <Stat label="Revoked" value={revoked.length} className="text-destructive" />
          </div>
        </div>
      </section>

      {/* ============ CERTIFICATES ============ */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <h2 className="text-xl font-semibold tracking-tight">Your certificates</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Signed in as {userName}
        </p>

        {certificates.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => (
              <CertificateCard key={cert.id} certificate={cert} />
            ))}
          </div>
        )}
      </section>

      {/* ============ VERIFICATION REQUESTS ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
        <h2 className="text-xl font-semibold tracking-tight">
          Verification requests
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Track employers you&apos;ve asked to verify your certificates.
        </p>

        {requests.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                <Search className="text-muted-foreground h-6 w-6" />
              </div>
              <h3 className="mb-1 text-sm font-semibold">No requests yet</h3>
              <p className="text-muted-foreground max-w-[280px] text-xs">
                Need an employer to confirm your certificate? Send them a
                verification request.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => setRequestOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New request
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {requests.map((req) => (
              <RequestRow key={req.id} request={req} />
            ))}
          </div>
        )}
      </section>

      <RequestDrawer
        open={requestOpen}
        onOpenChange={setRequestOpen}
        certificates={certificates}
      />
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
      <p className={className ? `text-2xl font-bold ${className}` : 'text-2xl font-bold'}>
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
          <Award className="h-7 w-7" />
        </div>
        <h3 className="mb-1 text-sm font-semibold">No certificates yet</h3>
        <p className="text-muted-foreground max-w-[320px] text-xs">
          Complete an internship and pass the exam to earn your first
          certificate. It will show up here automatically.
        </p>
        <Button size="sm" variant="outline" className="mt-5" render={<Link href="/" />}>
          Browse internships
        </Button>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Certificate card                                                           */
/* -------------------------------------------------------------------------- */

function CertificateCard({ certificate }: { certificate: MyCertificate }) {
  const isActive = certificate.status === 'issued' && !certificate.isExpired

  function copyCode() {
    navigator.clipboard
      .writeText(certificate.certificateNo)
      .then(() => toast.success('Verification code copied.'))
      .catch(() => toast.error('Could not copy.'))
  }

  return (
    <Card
      className={
        isActive
          ? 'overflow-hidden p-0'
          : 'overflow-hidden border-destructive/40 p-0 opacity-80'
      }
    >
      {/* Image preview */}
      <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
        {certificate.imageUrl ? (
          <Image
            src={certificate.imageUrl}
            alt={certificate.title}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-contain"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Award className="text-muted-foreground h-10 w-10" />
          </div>
        )}

        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="destructive" className="gap-1">
              {certificate.status === 'revoked' ? (
                <>
                  <Ban className="h-3 w-3" />
                  Revoked
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  Expired
                </>
              )}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold">
            {certificate.title}
          </h3>
          {certificate.internshipName && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {certificate.internshipName}
            </p>
          )}
        </div>

        {certificate.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {certificate.description}
          </p>
        )}

        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>
            Issued{' '}
            {format(new Date(certificate.issuedAt), 'MMM d, yyyy')}
          </span>
          {certificate.expiresAt && (
            <span>
              Expires {format(new Date(certificate.expiresAt), 'MMM d, yyyy')}
            </span>
          )}
        </div>

        {/* Verification code */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5">
          <span className="text-muted-foreground shrink-0 text-[10px] tracking-wide uppercase">
            Code
          </span>
          <span className="flex-1 truncate font-mono text-xs font-medium">
            {certificate.certificateNo}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={copyCode}
            aria-label="Copy verification code"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            render={
              <Link
                href={`/certificates/verify?no=${encodeURIComponent(certificate.certificateNo)}`}
              />
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify
          </Button>
          {certificate.imageUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              render={
                <a
                  href={certificate.imageUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Request row                                                                */
/* -------------------------------------------------------------------------- */

function RequestRow({ request }: { request: MyVerificationRequest }) {
  const badge =
    request.status === 'approved' ? (
      <Badge className="gap-1">
        <Check className="h-3 w-3" />
        Approved
      </Badge>
    ) : request.status === 'rejected' ? (
      <Badge variant="destructive" className="gap-1">
        <X className="h-3 w-3" />
        Rejected
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    )

  return (
    <Card className="p-0">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{request.verifierName}</p>
            {badge}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {request.verifierEmail}
            {request.organisation && ` · ${request.organisation}`}
          </p>
          {request.certificateNo && (
            <p className="text-muted-foreground mt-1 truncate font-mono text-[11px]">
              {request.certificateNo}
            </p>
          )}
          {request.reviewNote && (
            <p className="text-muted-foreground mt-2 rounded-md border p-2 text-xs">
              <span className="font-medium">Admin: </span>
              {request.reviewNote}
            </p>
          )}
        </div>

        <p className="text-muted-foreground shrink-0 text-xs">
          {format(new Date(request.createdAt), 'MMM d, yyyy')}
        </p>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Request drawer                                                             */
/* -------------------------------------------------------------------------- */

function RequestDrawer({
  open,
  onOpenChange,
  certificates,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  certificates: MyCertificate[]
}) {
  const [verifierName, setVerifierName] = useState('')
  const [verifierEmail, setVerifierEmail] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [certificateId, setCertificateId] = useState('__none')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const activeCertificates = certificates.filter((c) => c.status === 'issued')

  function handleSubmit() {
    startTransition(async () => {
      const result = await createVerificationRequest({
        certificateId: certificateId === '__none' ? null : certificateId,
        verifierName,
        verifierEmail,
        organisation,
        note,
      })

      if (result.success) {
        toast.success('Verification request sent.')
        setVerifierName('')
        setVerifierEmail('')
        setOrganisation('')
        setCertificateId('__none')
        setNote('')
        onOpenChange(false)
      } else {
        toast.error(result.error ?? 'Something went wrong.')
      }
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Request Verification</DrawerTitle>
          <DrawerDescription>
            Send a request to an employer or verifier. Our team reviews it and
            confirms your certificate.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-cert">Certificate</Label>
            <Select
              value={certificateId}
              onValueChange={(v) => setCertificateId(v ?? '__none')}
            >
              <SelectTrigger id="req-cert">
                <SelectValue placeholder="Select a certificate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No specific certificate</SelectItem>
                {activeCertificates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="req-name">Verifier name</Label>
              <Input
                id="req-name"
                placeholder="e.g. Sarah from Google"
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="req-email">Verifier email</Label>
              <Input
                id="req-email"
                type="email"
                placeholder="sarah@company.com"
                value={verifierEmail}
                onChange={(e) => setVerifierEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-org">Organisation</Label>
            <Input
              id="req-org"
              placeholder="e.g. Acme Corp"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-note">Why do you need this? (optional)</Label>
            <Textarea
              id="req-note"
              rows={4}
              placeholder="Tell us a bit about the role you're applying for…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <BadgeCheck className="h-4 w-4" />
                  Send Request
                </>
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}