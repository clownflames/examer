import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import {
  getTeamHeader,
  getInitialMessages,
  getTeamMemberSummaries,
} from './actions'
import { InboxClient } from './inbox-client'

export default async function TeamInboxPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [header, initial, members, session] = await Promise.all([
    getTeamHeader(id),
    getInitialMessages(id),
    getTeamMemberSummaries(id),
    auth.api.getSession({ headers: await headers() }),
  ])

  if (!header) notFound()

  const currentUser = session?.user
    ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
        role: session.user.role as 'user' | 'admin',
      }
    : null

  return (
    <InboxClient
      header={header}
      initialMessages={initial.messages}
      initialCursor={initial.nextCursor}
      initialHasMore={initial.hasMore}
      members={members}
      currentUser={currentUser}
    />
  )
}