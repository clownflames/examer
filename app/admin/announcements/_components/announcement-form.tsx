'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { saveAnnouncement, type AnnouncementInput } from '../actions'
import {
  PRESET_PAGES,
  VARIANT_META,
  type AnnouncementDetail,
  type AnnouncementVariant,
} from '../constants'

type Props = {
  initial?: AnnouncementDetail
  mode: 'create' | 'edit'
}

export function AnnouncementForm({ initial, mode }: Props) {
  const router = useRouter()

  const [title, setTitle] = React.useState(initial?.title ?? '')
  const [content, setContent] = React.useState(initial?.content ?? '')
  const [variant, setVariant] = React.useState<AnnouncementVariant>(
    initial?.variant ?? 'info'
  )
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? false)
  const [dismissible, setDismissible] = React.useState(
    initial?.dismissible ?? true
  )
  const [displayOnce, setDisplayOnce] = React.useState(
    initial?.displayOnce ?? false
  )
  const [startsAt, setStartsAt] = React.useState(
    initial?.startsAt ? toLocalInput(initial.startsAt) : ''
  )
  const [endsAt, setEndsAt] = React.useState(
    initial?.endsAt ? toLocalInput(initial.endsAt) : ''
  )
  const [targetPages, setTargetPages] = React.useState<string[]>(
    initial?.targetPages ?? []
  )
  const [ctaText, setCtaText] = React.useState(initial?.ctaText ?? '')
  const [ctaUrl, setCtaUrl] = React.useState(initial?.ctaUrl ?? '')
  const [priority, setPriority] = React.useState(initial?.priority ?? 0)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function togglePage(path: string) {
    setTargetPages((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!content.trim()) {
      setError('Content is required')
      return
    }

    setSaving(true)

    const input: AnnouncementInput = {
      id: initial?.id ?? null,
      title: title.trim(),
      content: content.trim(),
      variant,
      isActive,
      dismissible,
      displayOnce,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      targetPages,
      ctaText: ctaText.trim() || null,
      ctaUrl: ctaUrl.trim() || null,
      priority,
    }

    const res = await saveAnnouncement(input)
    setSaving(false)

    if (!res.success) {
      setError(res.error)
      toast.error(res.error)
      return
    }

    toast.success(mode === 'create' ? 'Announcement created' : 'Saved')
    router.push('/admin/announcements')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New internships are live!"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">Content (HTML allowed)</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="<p>We've added 5 new internships this week.</p>"
              rows={4}
              className="font-mono text-xs"
            />
            <p className="text-muted-foreground text-[11px]">
              Supports HTML — links, bold, etc.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Variant</Label>
            <Select
              value={variant}
              onValueChange={(v) => setVariant(v as AnnouncementVariant)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VARIANT_META) as AnnouncementVariant[]).map(
                  (v) => (
                    <SelectItem key={v} value={v}>
                      {VARIANT_META[v].label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            <div className="mt-1">
              <span
                className={cn(
                  'inline-block rounded-md border px-2.5 py-1 text-xs font-medium',
                  VARIANT_META[variant].className
                )}
              >
                {VARIANT_META[variant].label} preview
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Call-to-action (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ctaText">Button text</Label>
            <Input
              id="ctaText"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="e.g. Browse internships"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ctaUrl">Button URL</Label>
            <Input
              id="ctaUrl"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="/internships"
            />
          </div>
        </CardContent>
      </Card>

      {/* Target pages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where should it show?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-xs">
            Leave empty to show on <strong>all pages</strong>. Otherwise pick
            pages where it should appear.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_PAGES.map((p) => {
              const selected = targetPages.includes(p.path)
              return (
                <button
                  key={p.path}
                  type="button"
                  onClick={() => togglePage(p.path)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startsAt">Starts at</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endsAt">Ends at</Label>
            <Input
              id="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Behaviour */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behaviour</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Row
            label="Active"
            description="Turn on to show this to users."
            checked={isActive}
            onChange={setIsActive}
          />
          <Row
            label="Dismissible"
            description="Users can close it."
            checked={dismissible}
            onChange={setDismissible}
          />
          <Row
            label="Show only once"
            description="Hide after the user has seen it."
            checked={displayOnce}
            onChange={setDisplayOnce}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">
              Priority (lower = shown first)
            </Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/announcements')}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === 'create' ? 'Create' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

function Row({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}