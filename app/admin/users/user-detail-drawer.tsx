'use client'

import * as React from 'react'
import {
  Award,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleDashed,
  Clock,
  Code2,
  FileText,
  GraduationCap,
  Languages,
  Link as LinkIcon,
  MapPin,
  Phone,
  User as UserIcon,
  XCircle,
} from 'lucide-react'
// lucide v1 dropped brand glyphs, so the social icons come from react-icons.
import { FaGithub, FaLinkedinIn, FaTwitter } from 'react-icons/fa'
import { format } from 'date-fns'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import { getUserDetail } from './actions'
import type { UserDetail } from './constants'

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function inr(rupees: string | null) {
  const n = Number(rupees ?? 0)
  if (!Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN')}`
}

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                     */
/* -------------------------------------------------------------------------- */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <div className="text-sm break-words">{value}</div>
    </div>
  )
}

function Missing({ what }: { what: string }) {
  return <span className="text-muted-foreground text-sm">Not set — {what}</span>
}

function PaymentBadge({
  status,
  amount,
  reason,
}: {
  status: UserDetail['registrations'][number]['paymentStatus']
  amount: string | null
  reason?: string | null
}) {
  if (status === 'paid') {
    return (
      <Badge className="gap-1 bg-green-600 text-white hover:bg-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Paid{amount ? ` · ${inr(amount)}` : ''}
      </Badge>
    )
  }
  if (status === 'pending') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge variant="destructive" className="gap-1" title={reason ?? undefined}>
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <CircleDashed className="h-3 w-3" />
      Unpaid
    </Badge>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="text-lg leading-none font-bold">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-[11px]">{hint}</p>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function UserDetailDrawer({
  userId,
  open,
  onClose,
}: {
  userId: string | null
  open: boolean
  onClose: () => void
}) {
  /**
   * The detail is stored tagged with the user it belongs to, so moving to
   * another row reads as "loading" without ever needing a setState inside the
   * effect to clear the previous person's data.
   */
  const [loaded, setLoaded] = React.useState<{
    userId: string | null
    detail: UserDetail | null
  }>({ userId: null, detail: null })

  React.useEffect(() => {
    if (!open || !userId) return
    let active = true

    getUserDetail(userId)
      .then((detail) => {
        if (active) setLoaded({ userId, detail })
      })
      .catch((error) => console.error('UserDetailDrawer error:', error))

    return () => {
      active = false
    }
  }, [open, userId])

  const stale = loaded.userId !== userId
  const detail = stale ? null : loaded.detail
  const loading = open && !!userId && stale

  const fmt = (d: Date | null) =>
    d ? format(new Date(d), 'MMM d, yyyy') : '—'

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Student Details</DrawerTitle>
          <DrawerDescription>
            Full profile, payments and exam activity for this account.
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-8">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !detail ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Could not load this user.
            </p>
          ) : (
            <div className="space-y-8">
              {/* ---------- Identity ---------- */}
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  {detail.image ? (
                    <AvatarImage src={detail.image} alt={detail.name} />
                  ) : null}
                  <AvatarFallback>
                    {getInitials(detail.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">
                    {detail.name}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {detail.email}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge
                      variant={
                        detail.role === 'admin' ? 'default' : 'secondary'
                      }
                    >
                      {detail.role === 'admin' ? 'Admin' : 'Student'}
                    </Badge>
                    <Badge variant="outline">
                      {detail.emailVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                    <Badge variant="outline" className="text-muted-foreground">
                      Joined {fmt(detail.createdAt)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* ---------- Activity at a glance ---------- */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Registrations"
                  value={detail.totalRegistrations}
                  hint={`${detail.paidCount} paid`}
                />
                <StatCard
                  label="Unpaid"
                  value={detail.unpaidCount}
                  hint={
                    detail.unpaidCount > 0 ? 'Payment missing' : 'All settled'
                  }
                />
                <StatCard
                  label="Total paid"
                  value={detail.totalPaidAmount ? inr(detail.totalPaidAmount) : '—'}
                />
                <StatCard
                  label="Exams done"
                  value={detail.examSubmissions}
                  hint={`${detail.teams} team${detail.teams === 1 ? '' : 's'}`}
                />
              </div>

              {/* ---------- Profile completion ---------- */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Profile completion
                  </span>
                  <span className="font-semibold">
                    {detail.profileCompletion}%
                  </span>
                </div>
                <Progress value={detail.profileCompletion} className="h-1.5" />
              </div>

              <Separator />

              {/* ---------- About ---------- */}
              <Section icon={<UserIcon className="h-3.5 w-3.5" />} title="About">
                <div className="space-y-3">
                  <Field
                    label="Headline"
                    value={
                      detail.headline ?? <Missing what="no headline" />
                    }
                  />
                  <Field
                    label="Bio"
                    value={detail.bio ?? <Missing what="no bio" />}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Phone"
                      value={
                        detail.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="text-muted-foreground h-3.5 w-3.5" />
                            {detail.phone}
                          </span>
                        ) : (
                          <Missing what="no phone" />
                        )
                      }
                    />
                    <Field
                      label="Location"
                      value={
                        [detail.city, detail.state, detail.pincode]
                          .filter(Boolean)
                          .join(', ') ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                            {[detail.city, detail.state, detail.pincode]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        ) : (
                          <Missing what="no location" />
                        )
                      }
                    />
                  </div>
                </div>
              </Section>

              {/* ---------- Education ---------- */}
              <Section
                icon={<GraduationCap className="h-3.5 w-3.5" />}
                title="Education"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field
                    label="College"
                    value={detail.collegeName ?? <Missing what="—" />}
                  />
                  <Field
                    label="University"
                    value={detail.universityName ?? <Missing what="—" />}
                  />
                  <Field
                    label="Degree"
                    value={detail.degree ?? <Missing what="—" />}
                  />
                  <Field
                    label="Branch"
                    value={detail.branch ?? <Missing what="—" />}
                  />
                  <Field
                    label="Roll No."
                    value={detail.rollNumber ?? <Missing what="—" />}
                  />
                  <Field
                    label="Graduation"
                    value={detail.graduationYear ?? <Missing what="—" />}
                  />
                  <Field
                    label="CGPA"
                    value={detail.cgpa ?? <Missing what="—" />}
                  />
                </div>
              </Section>

              {/* ---------- Links ---------- */}
              <Section icon={<LinkIcon className="h-3.5 w-3.5" />} title="Links">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field
                    label="GitHub"
                    value={
                      detail.githubUrl ? (
                        <a
                          href={detail.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 hover:underline"
                        >
                          <FaGithub className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <Missing what="—" />
                      )
                    }
                  />
                  <Field
                    label="LinkedIn"
                    value={
                      detail.linkedinUrl ? (
                        <a
                          href={detail.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 hover:underline"
                        >
                          <FaLinkedinIn className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <Missing what="—" />
                      )
                    }
                  />
                  <Field
                    label="Portfolio"
                    value={
                      detail.portfolioUrl ? (
                        <a
                          href={detail.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 hover:underline"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <Missing what="—" />
                      )
                    }
                  />
                  <Field
                    label="Twitter"
                    value={
                      detail.twitterUrl ? (
                        <a
                          href={detail.twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 hover:underline"
                        >
                          <FaTwitter className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <Missing what="—" />
                      )
                    }
                  />
                </div>
              </Section>

              {/* ---------- Skills & languages ---------- */}
              {(detail.skills.length > 0 ||
                detail.languages.length > 0) && (
                <Section
                  icon={<Code2 className="h-3.5 w-3.5" />}
                  title="Skills & languages"
                >
                  <div className="space-y-3">
                    {detail.skills.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase">
                          Skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.skills.map((s) => (
                            <Badge key={s} variant="secondary">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {detail.languages.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
                          <Languages className="h-3 w-3" />
                          Languages
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.languages.map((l) => (
                            <Badge key={l} variant="outline">
                              {l}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* ---------- Experience ---------- */}
              {detail.experience.length > 0 && (
                <Section
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  title="Experience"
                >
                  <div className="space-y-2">
                    {detail.experience.map((e, i) => (
                      <div key={i} className="rounded-lg border bg-card p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{e.role}</p>
                          {e.duration && (
                            <Badge variant="secondary">{e.duration}</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {e.company}
                        </p>
                        {e.description && (
                          <p className="mt-1.5 text-xs leading-relaxed">
                            {e.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ---------- Projects ---------- */}
              {detail.projects.length > 0 && (
                <Section
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  title="Projects"
                >
                  <div className="space-y-2">
                    {detail.projects.map((p, i) => (
                      <div key={i} className="rounded-lg border bg-card p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{p.name}</p>
                          {p.link && (
                            <a
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-xs hover:underline"
                            >
                              View
                            </a>
                          )}
                        </div>
                        {p.description && (
                          <p className="mt-1 text-xs">{p.description}</p>
                        )}
                        {p.techStack && p.techStack.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.techStack.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px]">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ---------- Achievements ---------- */}
              {detail.achievements.length > 0 && (
                <Section
                  icon={<Award className="h-3.5 w-3.5" />}
                  title="Achievements"
                >
                  <ul className="space-y-1.5">
                    {detail.achievements.map((a, i) => (
                      <li
                        key={i}
                        className="text-muted-foreground flex items-start gap-2 text-xs"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* ---------- Resume ---------- */}
              <Section
                icon={<FileText className="h-3.5 w-3.5" />}
                title="Resume"
              >
                {detail.resumeFileName ? (
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-sm font-medium">
                      {detail.resumeFileName}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {detail.resumeSize
                        ? `${(detail.resumeSize / 1024).toFixed(0)} KB`
                        : 'Size unknown'}{' '}
                      · updated {fmt(detail.resumeUploadedAt)}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No resume uploaded.
                  </p>
                )}
              </Section>

              {/* ---------- Registrations & payments ---------- */}
              <Section
                icon={<Briefcase className="h-3.5 w-3.5" />}
                title="Registrations & payments"
              >
                {detail.registrations.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Not registered for any internship.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.registrations.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border bg-card p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {r.internshipName}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-[11px]">
                              Registered {fmt(r.registeredAt)} · Score{' '}
                              {r.gainScore} · Exams {r.examsCompleted}/
                              {r.examsTotal}
                            </p>
                          </div>
                          <PaymentBadge
                            status={r.paymentStatus}
                            amount={r.amountPaid}
                            reason={r.failureReason}
                          />
                        </div>
                        {r.failureReason && (
                          <p className="mt-2 text-[11px] text-destructive">
                            {r.failureReason}
                          </p>
                        )}
                        {r.paidAt && (
                          <p className="text-muted-foreground mt-1.5 text-[11px]">
                            Paid on {fmt(r.paidAt)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}