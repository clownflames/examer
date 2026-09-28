'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, asc, desc, eq, lt, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  messages,
  team,
  teamMember,
  internships,
  employeeDemand,
  user,
} from '@/db/schema'
import { auth } from '@/lib/auth'
import {
  MESSAGE_PAGE_SIZE,
  sendMessageSchema,
  type SendMessageInput,
  type TeamMessage,
  type TeamMemberSummary,
  type TeamHeader,
  type MessageCursor,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  Team header                                                                */
/* -------------------------------------------------------------------------- */

export async function getTeamHeader(
  teamId: string
): Promise<TeamHeader | null> {
  const rows = await db
    .select({
      id: team.id,
      name: team.name,
      internshipName: internships.name,
      demandName: employeeDemand.name,
      score: team.score,
    })
    .from(team)
    .innerJoin(internships, eq(team.internshipId, internships.id))
    .innerJoin(employeeDemand, eq(team.demandId, employeeDemand.id))
    .where(eq(team.id, teamId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const members = await db
    .select({ id: teamMember.id })
    .from(teamMember)
    .where(eq(teamMember.teamId, teamId))

  return {
    id: row.id,
    name: row.name,
    internshipName: row.internshipName,
    demandName: row.demandName,
    memberCount: members.length,
    score: Number(row.score ?? 0),
  }
}

/* -------------------------------------------------------------------------- */
/*  Messages                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Loads the LATEST `limit` messages for a team (newest at the bottom).
 * Returns them in ascending chronological order for easy rendering.
 * Also returns the cursor pointing at the oldest loaded message.
 */
export async function getInitialMessages(
  teamId: string,
  limit = MESSAGE_PAGE_SIZE
): Promise<{
  messages: TeamMessage[]
  nextCursor: MessageCursor
  hasMore: boolean
}> {
  // Fetch limit + 1 to know if there are older messages
  const rows = await db
    .select({
      id: messages.id,
      teamId: messages.teamId,
      userId: messages.userId,
      text: messages.text,
      code: messages.code,
      codeLanguage: messages.codeLanguage,
      isEdited: messages.isEdited,
      byAdmin: messages.byAdmin,
      createdAt: messages.createdAt,
      authorName: user.name,
      authorEmail: user.email,
      authorImage: user.image,
      authorRole: user.role,
    })
    .from(messages)
    .innerJoin(user, eq(messages.userId, user.id))
    .where(eq(messages.teamId, teamId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const selected = hasMore ? rows.slice(0, limit) : rows

  // Reverse to ascending order for rendering
  const chronological = selected.slice().reverse()

  const oldest = chronological[0]
  const nextCursor: MessageCursor = oldest
    ? { createdAt: oldest.createdAt.toISOString(), id: oldest.id }
    : null

  return {
    messages: chronological.map(serialize),
    nextCursor,
    hasMore,
  }
}

/**
 * Loads older messages strictly before the given cursor.
 */
export async function getOlderMessages(
  teamId: string,
  cursor: { createdAt: string; id: string },
  limit = MESSAGE_PAGE_SIZE
): Promise<{
  messages: TeamMessage[]
  nextCursor: MessageCursor
  hasMore: boolean
}> {
  const cursorDate = new Date(cursor.createdAt)

  // (createdAt < cursorDate) OR (createdAt = cursorDate AND id < cursor.id)
  const where = and(
    eq(messages.teamId, teamId),
    or(
      lt(messages.createdAt, cursorDate),
      and(eq(messages.createdAt, cursorDate), lt(messages.id, cursor.id))
    )
  )

  const rows = await db
    .select({
      id: messages.id,
      teamId: messages.teamId,
      userId: messages.userId,
      text: messages.text,
      code: messages.code,
      codeLanguage: messages.codeLanguage,
      isEdited: messages.isEdited,
      byAdmin: messages.byAdmin,
      createdAt: messages.createdAt,
      authorName: user.name,
      authorEmail: user.email,
      authorImage: user.image,
      authorRole: user.role,
    })
    .from(messages)
    .innerJoin(user, eq(messages.userId, user.id))
    .where(where)
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const selected = hasMore ? rows.slice(0, limit) : rows
  const chronological = selected.slice().reverse()

  const oldest = chronological[0]
  const nextCursor: MessageCursor = oldest
    ? { createdAt: oldest.createdAt.toISOString(), id: oldest.id }
    : null

  return {
    messages: chronological.map(serialize),
    nextCursor,
    hasMore,
  }
}

function serialize(r: {
  id: string
  teamId: string
  userId: string
  text: string | null
  code: string | null
  codeLanguage: string | null
  isEdited: boolean
  byAdmin: boolean
  createdAt: Date
  authorName: string
  authorEmail: string
  authorImage: string | null
  authorRole: string
}): TeamMessage {
  return {
    id: r.id,
    teamId: r.teamId,
    userId: r.userId,
    text: r.text,
    code: r.code,
    codeLanguage: r.codeLanguage,
    isEdited: r.isEdited,
    byAdmin: r.byAdmin,
    createdAt: r.createdAt.toISOString(),
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    authorImage: r.authorImage,
    authorRole: r.authorRole as 'user' | 'admin',
  }
}

/* -------------------------------------------------------------------------- */
/*  Team members                                                               */
/* -------------------------------------------------------------------------- */

export async function getTeamMemberSummaries(
  teamId: string
): Promise<TeamMemberSummary[]> {
  const rows = await db
    .select({
      userId: teamMember.userId,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
    })
    .from(teamMember)
    .innerJoin(user, eq(teamMember.userId, user.id))
    .where(eq(teamMember.teamId, teamId))
    .orderBy(asc(user.name))

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    image: r.image,
    role: r.role as 'user' | 'admin',
    isAdmin: r.role === 'admin',
  }))
}

/* -------------------------------------------------------------------------- */
/*  Send                                                                       */
/* -------------------------------------------------------------------------- */

export async function sendMessage(teamId: string, input: SendMessageInput) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return { success: false as const, error: 'Not authenticated.' }
    }

    const parsed = sendMessageSchema.parse(input)
    const isAdmin = session.user.role === 'admin'

    const created = await db
      .insert(messages)
      .values({
        id: crypto.randomUUID(),
        teamId,
        userId: session.user.id,
        text: parsed.kind === 'text' ? parsed.text || null : null,
        code: parsed.kind === 'code' ? parsed.code || null : null,
        codeLanguage:
          parsed.kind === 'code' ? parsed.codeLanguage || null : null,
        byAdmin: isAdmin,
        isEdited: false,
      })
      .returning({ id: messages.id })

    revalidatePath(`/admin/team/${teamId}/inbox`)
    return { success: true as const, id: created[0].id }
  } catch (err) {
    console.error('sendMessage failed:', err)
    return { success: false as const, error: 'Failed to send message.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteMessage(messageId: string, teamId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return { success: false as const, error: 'Not authenticated.' }
    }

    const existing = await db
      .select({ id: messages.id, userId: messages.userId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)

    if (existing.length === 0) {
      return { success: false as const, error: 'Message not found.' }
    }

    const isOwn = existing[0].userId === session.user.id
    const isAdmin = session.user.role === 'admin'

    if (!isOwn && !isAdmin) {
      return {
        success: false as const,
        error: 'You can only delete your own messages.',
      }
    }

    await db.delete(messages).where(eq(messages.id, messageId))

    revalidatePath(`/admin/team/${teamId}/inbox`)
    return { success: true as const }
  } catch (err) {
    console.error('deleteMessage failed:', err)
    return { success: false as const, error: 'Failed to delete message.' }
  }
}