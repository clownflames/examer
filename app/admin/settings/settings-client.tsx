'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  BadgeCheck,
  KeyRound,
  ShieldCheck,
  User2,
  Loader2,
} from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { updateProfile, changePassword } from './actions'

/* -------------------------------------------------------------------------- */
/*  Schemas (client-side mirrors)                                              */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(80),
  image: z
    .string()
    .url('Must be a valid URL.')
    .optional()
    .nullable()
    .or(z.literal('')),
})

type ProfileValues = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(72, 'Password must be at most 72 characters.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'New password must be different from the current one.',
    path: ['newPassword'],
  })

type PasswordValues = z.infer<typeof passwordSchema>

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type UserProp = {
  id: string
  name: string
  email: string
  image: string | null
  role: 'user' | 'admin'
  emailVerified: boolean
  createdAt: string
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

export function SettingsClient({ user }: { user: UserProp }) {
  return (
    <Tabs defaultValue="profile" className="max-w-3xl">
      <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-2">
        <TabsTrigger value="profile" className="gap-2">
          <User2 className="h-4 w-4" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="security" className="gap-2">
          <KeyRound className="h-4 w-4" />
          Security
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-4">
        <ProfileSection user={user} />
      </TabsContent>

      <TabsContent value="security" className="mt-4">
        <SecuritySection />
      </TabsContent>
    </Tabs>
  )
}

/* -------------------------------------------------------------------------- */
/*  Profile tab                                                                */
/* -------------------------------------------------------------------------- */

function ProfileSection({ user }: { user: UserProp }) {
  const [pending, setPending] = React.useState(false)

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      image: user.image ?? '',
    },
  })

  const watchName = form.watch('name')
  const watchImage = form.watch('image')

  async function onSubmit(values: ProfileValues) {
    setPending(true)
    const result = await updateProfile({
      name: values.name,
      image: values.image || null,
    })
    setPending(false)

    if (result.success) {
      toast.success('Profile updated.')
    } else {
      toast.error(result.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your public display name and avatar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Avatar preview + identity */}
          <div className="mb-6 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {watchImage ? (
                <AvatarImage src={watchImage} alt={watchName} />
              ) : null}
              <AvatarFallback className="text-lg">
                {getInitials(watchName || user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{watchName || user.name}</span>
                {user.role === 'admin' && (
                  <Badge className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
                {user.emailVerified && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-green-600 text-green-700"
                  >
                    <BadgeCheck className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground text-sm">
                {user.email}
              </span>
              <span className="text-muted-foreground text-xs">
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <Separator className="mb-6" />

          <form
            id="profile-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="profile-name">Full Name</FieldLabel>
                    <Input
                      {...field}
                      id="profile-name"
                      placeholder="Your name"
                      value={field.value ?? ''}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="image"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="profile-image">
                      Avatar URL{' '}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id="profile-image"
                      placeholder="https://…"
                      value={field.value ?? ''}
                    />
                    <FieldDescription>
                      Paste a link to a square image.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Field>
                <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                <Input
                  id="profile-email"
                  value={user.email}
                  disabled
                  readOnly
                />
                <FieldDescription>
                  Email cannot be changed from here. Contact support if you
                  need to update it.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={pending}
          >
            Reset
          </Button>
          <Button type="submit" form="profile-form" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Security tab                                                               */
/* -------------------------------------------------------------------------- */

function SecuritySection() {
  const [pending, setPending] = React.useState(false)

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: PasswordValues) {
    setPending(true)
    const result = await changePassword(values)
    setPending(false)

    if (result.success) {
      toast.success('Password changed.')
      form.reset()
    } else {
      toast.error(result.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password. Other sessions will be signed out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="password-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <FieldGroup>
              <Controller
                name="currentPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="currentPassword">
                      Current Password
                    </FieldLabel>
                    <Input
                      {...field}
                      id="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={field.value ?? ''}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="newPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="newPassword">
                      New Password
                    </FieldLabel>
                    <Input
                      {...field}
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={field.value ?? ''}
                    />
                    <FieldDescription>
                      Minimum 8 characters.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="confirmPassword"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="confirmPassword">
                      Confirm New Password
                    </FieldLabel>
                    <Input
                      {...field}
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={field.value ?? ''}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={pending}
          >
            Reset
          </Button>
          <Button type="submit" form="password-form" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}