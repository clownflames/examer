export const PAGE_SIZE = 20

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type AnnouncementVariant = 'info' | 'success' | 'warning' | 'error'

export type AnnouncementRow = {
  id: string
  title: string
  content: string
  variant: AnnouncementVariant
  isActive: boolean
  dismissible: boolean
  displayOnce: boolean
  startsAt: string | null
  endsAt: string | null
  targetPages: string[]
  ctaText: string | null
  ctaUrl: string | null
  priority: number
  createdAt: string
  updatedAt: string
}

export type AnnouncementDetail = AnnouncementRow

export type AnnouncementFilter = {
  status?: 'all' | 'active' | 'inactive'
  query?: string
}

/* -------------------------------------------------------------------------- */
/*  Preset pages                                                               */
/* -------------------------------------------------------------------------- */

export const PRESET_PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'Home' },
  { path: '/tierlist', label: 'Tier list' },
  { path: '/internships', label: 'Internships' },
  { path: '/inbox', label: 'Inbox' },
  { path: '/profile', label: 'Profile' },
  { path: '/payments', label: 'Payments' },
  { path: '/certificates', label: 'Certificates' },
  { path: '/offer-letters', label: 'Offer letters' },
]

/* -------------------------------------------------------------------------- */
/*  Variant meta                                                               */
/* -------------------------------------------------------------------------- */

export const VARIANT_META: Record<
  AnnouncementVariant,
  { label: string; className: string }
> = {
  info: {
    label: 'Info',
    className:
      'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  success: {
    label: 'Success',
    className:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    label: 'Warning',
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  error: {
    label: 'Error',
    className:
      'border-destructive/30 bg-destructive/10 text-destructive',
  },
}