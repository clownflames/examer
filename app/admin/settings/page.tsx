import { redirect } from 'next/navigation'
import { getCurrentUser } from './actions'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm">
          Manage your account and preferences.
        </p>
      </div>

      <SettingsClient
        user={{
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          image: currentUser.image,
          role: currentUser.role,
          emailVerified: currentUser.emailVerified,
          createdAt: new Date(currentUser.createdAt).toISOString(),
        }}
      />
    </div>
  )
}