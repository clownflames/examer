"use server";

import { db } from "@/db";
import {
  messages,
  team,
  teamMember,
  user,
  internships,
  employeeDemand,
} from "@/db/schema";
import { and, desc, eq, lt, or, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type {
  TeamMessage,
  MessageCursor,
  TeamHeader,
  TeamMemberSummary,
  UserTeam,
  MessageKind,
} from "./constants";

const PAGE_SIZE = 25;

// =====================================================
// AUTH HELPER
// =====================================================
async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// =====================================================
// GET USER'S TEAMS (sidebar)
// =====================================================
export async function getUserTeams(): Promise<UserTeam[]> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return [];

    const rows = await db
      .select({
        id: team.id,
        name: team.name,
        score: team.score,
        internshipName: internships.name,
        demandName: employeeDemand.name,
        demandIconUrl: employeeDemand.iconUrl,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${teamMember}
          WHERE ${teamMember.teamId} = ${team.id}
        )`,
        lastMessageAt: sql<string | null>`(
          SELECT MAX(${messages.createdAt})::text FROM ${messages}
          WHERE ${messages.teamId} = ${team.id}
        )`,
        lastMessagePreview: sql<string | null>`(
          SELECT 
            CASE 
              WHEN ${messages.code} IS NOT NULL THEN '[code] ' || COALESCE(${messages.codeLanguage}, '')
              ELSE LEFT(REGEXP_REPLACE(COALESCE(${messages.text}, ''), '<[^>]*>', '', 'g'), 80)
            END
          FROM ${messages}
          WHERE ${messages.teamId} = ${team.id}
          ORDER BY ${messages.createdAt} DESC
          LIMIT 1
        )`,
      })
      .from(teamMember)
      .innerJoin(team, eq(teamMember.teamId, team.id))
      .leftJoin(internships, eq(team.internshipId, internships.id))
      .leftJoin(employeeDemand, eq(team.demandId, employeeDemand.id))
      .where(eq(teamMember.userId, session.user.id))
      .orderBy(desc(team.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      internshipName: r.internshipName ?? "—",
      demandName: r.demandName ?? "—",
      iconUrl: r.demandIconUrl,
      memberCount: r.memberCount ?? 0,
      score: r.score,
      lastMessageAt: r.lastMessageAt,
      lastMessagePreview: r.lastMessagePreview,
      unreadCount: 0, // placeholder
    }));
  } catch (error) {
    console.error("getUserTeams error:", error);
    return [];
  }
}

// =====================================================
// VERIFY USER BELONGS TO TEAM
// =====================================================
async function assertMembership(userId: string, teamId: string) {
  const [row] = await db
    .select({ id: teamMember.id })
    .from(teamMember)
    .where(
      and(eq(teamMember.userId, userId), eq(teamMember.teamId, teamId))
    )
    .limit(1);
  return !!row;
}

// =====================================================
// GET TEAM HEADER
// =====================================================
export async function getTeamHeader(
  teamId: string
): Promise<TeamHeader | null> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return null;

    const ok = await assertMembership(session.user.id, teamId);
    if (!ok) return null;

    const [row] = await db
      .select({
        id: team.id,
        name: team.name,
        score: team.score,
        internshipName: internships.name,
        demandName: employeeDemand.name,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${teamMember}
          WHERE ${teamMember.teamId} = ${team.id}
        )`,
      })
      .from(team)
      .leftJoin(internships, eq(team.internshipId, internships.id))
      .leftJoin(employeeDemand, eq(team.demandId, employeeDemand.id))
      .where(eq(team.id, teamId))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      internshipName: row.internshipName ?? "—",
      demandName: row.demandName ?? "—",
      memberCount: row.memberCount ?? 0,
      score: row.score,
    };
  } catch (error) {
    console.error("getTeamHeader error:", error);
    return null;
  }
}

// =====================================================
// GET TEAM MEMBERS
// =====================================================
export async function getTeamMembers(
  teamId: string
): Promise<TeamMemberSummary[]> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return [];

    const ok = await assertMembership(session.user.id, teamId);
    if (!ok) return [];

    const rows = await db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      })
      .from(teamMember)
      .innerJoin(user, eq(teamMember.userId, user.id))
      .where(eq(teamMember.teamId, teamId));

    return rows.map((r) => ({
      userId: r.userId,
      name: r.name ?? "Unknown",
      email: r.email ?? "",
      image: r.image,
      isAdmin: r.role === "admin",
    }));
  } catch (error) {
    console.error("getTeamMembers error:", error);
    return [];
  }
}

// =====================================================
// MESSAGES QUERY HELPER
// =====================================================
function formatMessage(row: {
  id: string;
  text: string | null;
  code: string | null;
  codeLanguage: string | null;
  isEdited: boolean;
  byAdmin: boolean;
  createdAt: Date;
  userId: string;
  authorName: string | null;
  authorImage: string | null;
}): TeamMessage {
  return {
    id: row.id,
    text: row.text,
    code: row.code,
    codeLanguage: row.codeLanguage,
    isEdited: row.isEdited,
    byAdmin: row.byAdmin,
    createdAt: row.createdAt.toISOString(),
    userId: row.userId,
    authorName: row.authorName ?? "Unknown",
    authorImage: row.authorImage,
  };
}

// =====================================================
// GET INITIAL MESSAGES (latest PAGE_SIZE)
// =====================================================
export async function getInitialMessages(teamId: string): Promise<{
  messages: TeamMessage[];
  nextCursor: MessageCursor;
  hasMore: boolean;
}> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { messages: [], nextCursor: null, hasMore: false };
    }

    const ok = await assertMembership(session.user.id, teamId);
    if (!ok) {
      return { messages: [], nextCursor: null, hasMore: false };
    }

    const rows = await db
      .select({
        id: messages.id,
        text: messages.text,
        code: messages.code,
        codeLanguage: messages.codeLanguage,
        isEdited: messages.isEdited,
        byAdmin: messages.byAdmin,
        createdAt: messages.createdAt,
        userId: messages.userId,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(messages)
      .leftJoin(user, eq(messages.userId, user.id))
      .where(eq(messages.teamId, teamId))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(PAGE_SIZE + 1);

    const hasMore = rows.length > PAGE_SIZE;
    const sliced = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const ascending = [...sliced].reverse();

    const oldest = ascending[0];
    const nextCursor: MessageCursor =
      hasMore && oldest
        ? { createdAt: oldest.createdAt.toISOString(), id: oldest.id }
        : null;

    return {
      messages: ascending.map(formatMessage),
      nextCursor,
      hasMore,
    };
  } catch (error) {
    console.error("getInitialMessages error:", error);
    return { messages: [], nextCursor: null, hasMore: false };
  }
}

// =====================================================
// GET OLDER MESSAGES (before cursor)
// =====================================================
export async function getOlderMessages(
  teamId: string,
  cursor: MessageCursor
): Promise<{
  messages: TeamMessage[];
  nextCursor: MessageCursor;
  hasMore: boolean;
}> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { messages: [], nextCursor: null, hasMore: false };
    }

    const ok = await assertMembership(session.user.id, teamId);
    if (!ok) {
      return { messages: [], nextCursor: null, hasMore: false };
    }

    if (!cursor) return { messages: [], nextCursor: null, hasMore: false };

    const cursorDate = new Date(cursor.createdAt);

    const rows = await db
      .select({
        id: messages.id,
        text: messages.text,
        code: messages.code,
        codeLanguage: messages.codeLanguage,
        isEdited: messages.isEdited,
        byAdmin: messages.byAdmin,
        createdAt: messages.createdAt,
        userId: messages.userId,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(messages)
      .leftJoin(user, eq(messages.userId, user.id))
      .where(
        and(
          eq(messages.teamId, teamId),
          or(
            lt(messages.createdAt, cursorDate),
            and(
              eq(messages.createdAt, cursorDate),
              lt(messages.id, cursor.id)
            )
          )
        )
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(PAGE_SIZE + 1);

    const hasMore = rows.length > PAGE_SIZE;
    const sliced = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const ascending = [...sliced].reverse();

    const oldest = ascending[0];
    const nextCursor: MessageCursor =
      hasMore && oldest
        ? { createdAt: oldest.createdAt.toISOString(), id: oldest.id }
        : null;

    return {
      messages: ascending.map(formatMessage),
      nextCursor,
      hasMore,
    };
  } catch (error) {
    console.error("getOlderMessages error:", error);
    return { messages: [], nextCursor: null, hasMore: false };
  }
}

// =====================================================
// SEND MESSAGE
// =====================================================
export async function sendMessage(
  teamId: string,
  payload: {
    kind: MessageKind;
    text: string | null;
    code: string | null;
    codeLanguage: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const ok = await assertMembership(session.user.id, teamId);
    if (!ok) {
      return { success: false, error: "You are not part of this team" };
    }

    if (payload.kind === "text") {
      const plain = (payload.text ?? "").replace(/<[^>]*>/g, "").trim();
      if (plain.length === 0) {
        return { success: false, error: "Message cannot be empty" };
      }
    } else {
      if (!payload.code || payload.code.trim().length === 0) {
        return { success: false, error: "Code cannot be empty" };
      }
    }

    await db.insert(messages).values({
      id: crypto.randomUUID(),
      teamId,
      userId: session.user.id,
      text: payload.kind === "text" ? payload.text : null,
      code: payload.kind === "code" ? payload.code : null,
      codeLanguage: payload.kind === "code" ? payload.codeLanguage : null,
      byAdmin: false,
    });

    revalidatePath("/inbox");
    return { success: true };
  } catch (error) {
    console.error("sendMessage error:", error);
    return { success: false, error: "Failed to send message" };
  }
}

// =====================================================
// DELETE MESSAGE (own only for user)
// =====================================================
export async function deleteMessage(
  messageId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const ok = await assertMembership(session.user.id, teamId);
    if (!ok) {
      return { success: false, error: "You are not part of this team" };
    }

    const [msg] = await db
      .select({ userId: messages.userId })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.teamId, teamId)))
      .limit(1);

    if (!msg) return { success: false, error: "Message not found" };

    const isAdmin = session.user.role === "admin";
    if (msg.userId !== session.user.id && !isAdmin) {
      return { success: false, error: "You can only delete your own messages" };
    }

    await db.delete(messages).where(eq(messages.id, messageId));

    revalidatePath("/inbox");
    return { success: true };
  } catch (error) {
    console.error("deleteMessage error:", error);
    return { success: false, error: "Failed to delete message" };
  }
}

// =====================================================
// REFRESH — fetch latest messages after a timestamp
// =====================================================
export async function refreshMessages(
  teamId: string,
  afterIso: string
): Promise<TeamMessage[]> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return [];

    const ok = await assertMembership(session.user.id, teamId);
    if (!ok) return [];

    const afterDate = new Date(afterIso);

    const rows = await db
      .select({
        id: messages.id,
        text: messages.text,
        code: messages.code,
        codeLanguage: messages.codeLanguage,
        isEdited: messages.isEdited,
        byAdmin: messages.byAdmin,
        createdAt: messages.createdAt,
        userId: messages.userId,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(messages)
      .leftJoin(user, eq(messages.userId, user.id))
      .where(
        and(eq(messages.teamId, teamId), sql`${messages.createdAt} > ${afterDate}`)
      )
      .orderBy(messages.createdAt)
      .limit(50);

    return rows.map(formatMessage);
  } catch (error) {
    console.error("refreshMessages error:", error);
    return [];
  }
}