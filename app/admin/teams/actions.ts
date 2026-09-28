'use server'

import { revalidatePath } from 'next/cache'
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  sql,
} from 'drizzle-orm'

import { db } from '@/db'
import {
  team,
  teamMember,
  internships,
  employeeDemand,
  internshipRegistration,
  user,
  exams,
  examSubmission,
} from '@/db/schema'
import {
  PAGE_SIZE,
  teamFormSchema,
  type TeamRow,
  type TeamInput,
  type InternshipOption,
  type DemandOption,
  type StudentCandidate,
  type TeamMemberRow,
} from './constants'

/* -------------------------------------------------------------------------- */
/*  List teams                                                                 */
/* -------------------------------------------------------------------------- */

export async function getTeams(page = 1): Promise<{
  data: TeamRow[]
  page: number
  totalPages: number
  total: number
}> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const offset = (safePage - 1) * PAGE_SIZE

  const membersCount = sql<number>`(
    select count(*)::int from ${teamMember}
    where ${teamMember.teamId} = ${team.id}
  )`

  const rows = await db
    .select({
      id: team.id,
      name: team.name,
      internshipId: team.internshipId,
      internshipName: internships.name,
      demandId: team.demandId,
      demandName: employeeDemand.name,
      score: team.score,
      createdAt: team.createdAt,
      memberCount: membersCount.as('member_count'),
    })
    .from(team)
    .innerJoin(internships, eq(team.internshipId, internships.id))
    .innerJoin(employeeDemand, eq(team.demandId, employeeDemand.id))
    .orderBy(desc(team.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset)

  const totalResult = await db.select({ value: count() }).from(team)
  const total = Number(totalResult[0]?.value ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      internshipId: r.internshipId,
      internshipName: r.internshipName,
      demandId: r.demandId,
      demandName: r.demandName,
      score: Number(r.score ?? 0),
      memberCount: Number(r.memberCount ?? 0),
      createdAt: r.createdAt,
    })),
    page: safePage,
    totalPages,
    total,
  }
}

/* -------------------------------------------------------------------------- */
/*  Update score                                                               */
/* -------------------------------------------------------------------------- */

export async function updateTeamScore(input: {
  id: string
  score: number
}) {
  try {
    if (!Number.isFinite(input.score) || input.score < 0) {
      return { success: false as const, error: 'Score must be a number ≥ 0.' }
    }

    const updated = await db
      .update(team)
      .set({ score: Math.round(input.score) })
      .where(eq(team.id, input.id))
      .returning({ id: team.id })

    if (updated.length === 0) {
      return { success: false as const, error: 'Team not found.' }
    }

    revalidatePath('/admin/teams')
    return { success: true as const }
  } catch (err) {
    console.error('updateTeamScore failed:', err)
    return { success: false as const, error: 'Failed to update score.' }
  }
}

/* -------------------------------------------------------------------------- */
/*  Options                                                                    */
/* -------------------------------------------------------------------------- */

export async function getInternshipOptions(): Promise<InternshipOption[]> {
  return db
    .select({
      id: internships.id,
      name: internships.name,
      demandId: internships.demandId,
    })
    .from(internships)
    .orderBy(asc(internships.name))
}

export async function getDemandOptions(): Promise<DemandOption[]> {
  return db
    .select({ id: employeeDemand.id, name: employeeDemand.name })
    .from(employeeDemand)
    .orderBy(asc(employeeDemand.name))
}

/* -------------------------------------------------------------------------- */
/*  Student candidates                                                         */
/* -------------------------------------------------------------------------- */

export async function getStudentCandidates(
  internshipId: string
): Promise<StudentCandidate[]> {
  if (!internshipId) return []

  const examsTotalSubquery = sql<number>`(
    select count(*)::int from ${exams}
    where ${exams.internshipId} = ${internshipRegistration.internshipId}
  )`

  const examsCompletedSubquery = sql<number>`(
    select count(*)::int from ${examSubmission}
    where ${examSubmission.userId} = ${internshipRegistration.userId}
      and ${examSubmission.examId} in (
        select ${exams.id} from ${exams}
        where ${exams.internshipId} = ${internshipRegistration.internshipId}
      )
      and ${examSubmission.submittedAt} is not null
  )`

  const teamIdSubquery = sql<string | null>`(
    select ${teamMember.teamId}
    from ${teamMember}
    inner join ${team} on ${team.id} = ${teamMember.teamId}
    where ${teamMember.userId} = ${internshipRegistration.userId}
      and ${team.internshipId} = ${internshipRegistration.internshipId}
    limit 1
  )`

  const teamNameSubquery = sql<string | null>`(
    select ${team.name}
    from ${teamMember}
    inner join ${team} on ${team.id} = ${teamMember.teamId}
    where ${teamMember.userId} = ${internshipRegistration.userId}
      and ${team.internshipId} = ${internshipRegistration.internshipId}
    limit 1
  )`

  const rows = await db
    .select({
      registrationId: internshipRegistration.id,
      userId: internshipRegistration.userId,
      name: user.name,
      email: user.email,
      image: user.image,
      gainScore: internshipRegistration.gainScore,
      registeredAt: internshipRegistration.createdAt,
      examsCompleted: examsCompletedSubquery.as('exams_completed'),
      examsTotal: examsTotalSubquery.as('exams_total'),
      teamId: teamIdSubquery.as('team_id'),
      teamName: teamNameSubquery.as('team_name'),
    })
    .from(internshipRegistration)
    .innerJoin(user, eq(internshipRegistration.userId, user.id))
    .where(eq(internshipRegistration.internshipId, internshipId))
    .orderBy(desc(internshipRegistration.gainScore))

  return rows.map((r) => ({
    registrationId: r.registrationId,
    userId: r.userId,
    name: r.name,
    email: r.email,
    image: r.image,
    gainScore: Number(r.gainScore ?? 0),
    examsCompleted: Number(r.examsCompleted ?? 0),
    examsTotal: Number(r.examsTotal ?? 0),
    registeredAt: r.registeredAt,
    alreadyInTeam: r.teamId != null,
    teamId: r.teamId,
    teamName: r.teamName,
  }))
}

/* -------------------------------------------------------------------------- */
/*  Team members                                                               */
/* -------------------------------------------------------------------------- */

export async function getTeamMembers(
  teamId: string
): Promise<TeamMemberRow[]> {
  const rows = await db
    .select({
      id: teamMember.id,
      userId: teamMember.userId,
      name: user.name,
      email: user.email,
      image: user.image,
      joinedAt: teamMember.createdAt,
    })
    .from(teamMember)
    .innerJoin(user, eq(teamMember.userId, user.id))
    .where(eq(teamMember.teamId, teamId))
    .orderBy(asc(teamMember.createdAt))

  return rows
}

/* -------------------------------------------------------------------------- */
/*  Create team                                                                */
/* -------------------------------------------------------------------------- */

export async function createTeam(input: TeamInput) {
  try {
    const parsed = teamFormSchema.parse(input)

    // Check if any selected member is already in a team for this internship
    if (parsed.memberIds.length > 0) {
      const conflicting = await db
        .select({
          userId: teamMember.userId,
          teamName: team.name,
          userName: user.name,
        })
        .from(teamMember)
        .innerJoin(team, eq(team.id, teamMember.teamId))
        .innerJoin(user, eq(user.id, teamMember.userId))
        .where(
          and(
            eq(team.internshipId, parsed.internshipId),
            inArray(teamMember.userId, parsed.memberIds)
          )
        )

      if (conflicting.length > 0) {
        const names = conflicting.map((c) => c.userName).join(', ')
        return {
          success: false as const,
          error: `${names} ${
            conflicting.length === 1 ? 'is' : 'are'
          } already in another team for this internship.`,
        }
      }
    }

    const teamId = crypto.randomUUID()

    await db.transaction(async (tx) => {
      await tx.insert(team).values({
        id: teamId,
        name: parsed.name,
        internshipId: parsed.internshipId,
        demandId: parsed.demandId,
        score: 0,
      })

      if (parsed.memberIds.length > 0) {
        await tx.insert(teamMember).values(
          parsed.memberIds.map((userId) => ({
            id: crypto.randomUUID(),
            teamId,
            userId,
            internshipId: parsed.internshipId,
          }))
        )
      }
    })

    revalidatePath('/admin/teams')
    return { success: true as const, id: teamId }
  } catch (err) {
    console.error('createTeam failed:', err)
    // Handle DB-level unique violation as a friendly message
    const message =
      err instanceof Error && /unique|duplicate/i.test(err.message)
        ? 'One or more selected students are already in a team for this internship.'
        : 'Failed to create team.'
    return { success: false as const, error: message }
  }
}

/* -------------------------------------------------------------------------- */
/*  Delete team                                                                */
/* -------------------------------------------------------------------------- */

export async function deleteTeam(id: string) {
  try {
    const deleted = await db
      .delete(team)
      .where(eq(team.id, id))
      .returning({ id: team.id })

    if (deleted.length === 0) {
      return { success: false as const, error: 'Team not found.' }
    }

    revalidatePath('/admin/teams')
    return { success: true as const }
  } catch (err) {
    console.error('deleteTeam failed:', err)
    return { success: false as const, error: 'Failed to delete team.' }
  }
}