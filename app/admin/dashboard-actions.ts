'use server'

import { and, count, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  user,
  internships,
  internshipRegistration,
  exams,
  examSubmission,
  team,
  teamMember,
  employeeDemand,
} from '@/db/schema'

/* -------------------------------------------------------------------------- */
/*  Top stats                                                                  */
/* -------------------------------------------------------------------------- */

export type DashboardStats = {
  totalStudents: number
  totalInternships: number
  totalRegistrations: number
  totalExams: number
  totalTeams: number
  totalDemands: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    studentsResult,
    internshipsResult,
    registrationsResult,
    examsResult,
    teamsResult,
    demandsResult,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(user)
      .where(eq(user.role, 'user')),
    db.select({ value: count() }).from(internships),
    db.select({ value: count() }).from(internshipRegistration),
    db.select({ value: count() }).from(exams),
    db.select({ value: count() }).from(team),
    db.select({ value: count() }).from(employeeDemand),
  ])

  return {
    totalStudents: Number(studentsResult[0]?.value ?? 0),
    totalInternships: Number(internshipsResult[0]?.value ?? 0),
    totalRegistrations: Number(registrationsResult[0]?.value ?? 0),
    totalExams: Number(examsResult[0]?.value ?? 0),
    totalTeams: Number(teamsResult[0]?.value ?? 0),
    totalDemands: Number(demandsResult[0]?.value ?? 0),
  }
}

/* -------------------------------------------------------------------------- */
/*  Registrations over time (last 30 days)                                     */
/* -------------------------------------------------------------------------- */

export type RegistrationsOverTimePoint = {
  date: string // 'MMM d'
  isoDate: string // 'YYYY-MM-DD'
  registrations: number
}

export async function getRegistrationsOverTime(
  days = 30
): Promise<RegistrationsOverTimePoint[]> {
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  const rows = await db
    .select({
      day: sql<string>`to_char(${internshipRegistration.createdAt}, 'YYYY-MM-DD')`,
      value: count(),
    })
    .from(internshipRegistration)
    .where(gte(internshipRegistration.createdAt, since))
    .groupBy(sql`to_char(${internshipRegistration.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${internshipRegistration.createdAt}, 'YYYY-MM-DD')`)

  const map = new Map<string, number>()
  for (const r of rows) map.set(r.day, Number(r.value ?? 0))

  const points: RegistrationsOverTimePoint[] = []
  const cursor = new Date(since)
  for (let i = 0; i < days; i++) {
    const iso = cursor.toISOString().slice(0, 10)
    const label = cursor.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    points.push({
      date: label,
      isoDate: iso,
      registrations: map.get(iso) ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return points
}

/* -------------------------------------------------------------------------- */
/*  Internships by demand (bar chart)                                          */
/* -------------------------------------------------------------------------- */

export type InternshipsByDemandPoint = {
  demand: string
  internships: number
}

export async function getInternshipsByDemand(): Promise<
  InternshipsByDemandPoint[]
> {
  const rows = await db
    .select({
      demand: employeeDemand.name,
      value: count(),
    })
    .from(internships)
    .innerJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
    .groupBy(employeeDemand.name)
    .orderBy(desc(count()))

  return rows.map((r) => ({
    demand: r.demand,
    internships: Number(r.value ?? 0),
  }))
}

/* -------------------------------------------------------------------------- */
/*  Exam completion (pie chart)                                                */
/* -------------------------------------------------------------------------- */

export type ExamCompletionPoint = {
  status: 'Completed' | 'In Progress' | 'Not Started'
  count: number
  fill: string
}

export async function getExamCompletionStats(): Promise<
  ExamCompletionPoint[]
> {
  // Registrations where the student has at least one submitted exam
  const totalRegistrations = await db
    .select({ value: count() })
    .from(internshipRegistration)

  const withAnySubmission = await db
    .select({
      value: sql<number>`count(distinct ${examSubmission.userId})::int`,
    })
    .from(examSubmission)
    .where(sql`${examSubmission.submittedAt} is not null`)

  const total = Number(totalRegistrations[0]?.value ?? 0)
  const active = Number(withAnySubmission[0]?.value ?? 0)
  const inactive = Math.max(0, total - active)

  return [
    { status: 'Completed', count: active, fill: 'var(--color-completed)' },
    {
      status: 'Not Started',
      count: inactive,
      fill: 'var(--color-notstarted)',
    },
  ]
}

/* -------------------------------------------------------------------------- */
/*  Top internships by registrations                                           */
/* -------------------------------------------------------------------------- */

export type TopInternship = {
  id: string
  name: string
  registrations: number
  teams: number
}

export async function getTopInternships(
  limit = 5
): Promise<TopInternship[]> {
  const regCount = sql<number>`(
    select count(*)::int from ${internshipRegistration}
    where ${internshipRegistration.internshipId} = ${internships.id}
  )`
  const teamCount = sql<number>`(
    select count(*)::int from ${team}
    where ${team.internshipId} = ${internships.id}
  )`

  const rows = await db
    .select({
      id: internships.id,
      name: internships.name,
      registrations: regCount.as('registrations'),
      teams: teamCount.as('teams'),
    })
    .from(internships)
    .orderBy(desc(regCount))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    registrations: Number(r.registrations ?? 0),
    teams: Number(r.teams ?? 0),
  }))
}

/* -------------------------------------------------------------------------- */
/*  Recent registrations                                                       */
/* -------------------------------------------------------------------------- */

export type RecentRegistration = {
  id: string
  studentName: string
  studentEmail: string
  studentImage: string | null
  internshipName: string
  gainScore: number
  createdAt: string
}

export async function getRecentRegistrations(
  limit = 8
): Promise<RecentRegistration[]> {
  const rows = await db
    .select({
      id: internshipRegistration.id,
      studentName: user.name,
      studentEmail: user.email,
      studentImage: user.image,
      internshipName: internships.name,
      gainScore: internshipRegistration.gainScore,
      createdAt: internshipRegistration.createdAt,
    })
    .from(internshipRegistration)
    .innerJoin(user, eq(internshipRegistration.userId, user.id))
    .innerJoin(
      internships,
      eq(internshipRegistration.internshipId, internships.id)
    )
    .orderBy(desc(internshipRegistration.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    studentName: r.studentName,
    studentEmail: r.studentEmail,
    studentImage: r.studentImage,
    internshipName: r.internshipName,
    gainScore: Number(r.gainScore ?? 0),
    createdAt: r.createdAt.toISOString(),
  }))
}