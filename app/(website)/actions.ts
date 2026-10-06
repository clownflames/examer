"use server";

import crypto from "crypto";
import { db } from "@/db";
import {
  internships,
  employeeDemand,
  internshipRegistration,
  team,
  teamMember,
  user,
  payments,
  exams,
  examSubmission,
  profile,
} from "@/db/schema";
import { eq, desc, asc, sql, and, inArray, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { CACHE_TAGS, cachedValue, invalidateTag } from "@/lib/cache";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getRazorpay, getRazorpayPublicKeyId } from "@/lib/razorpay";

// =====================================================
// TYPES
// =====================================================
export type InternshipListItem = {
  id: string;
  name: string;
  description: string | null;
  jdUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  lastSubmissionDate: Date | null;
  sellingPrice: string | null;
  price: string | null;
  totalScore: number;
  examinerName: string | null;
  examinerPhotoUrl: string | null;
  demandName: string | null;
  demandIconUrl: string | null;
  isRegistered: boolean;
};

// =====================================================
// FETCH INTERNSHIPS (for hero — with paid status)
// =====================================================
export async function getInternships(): Promise<InternshipListItem[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id;

    const rows = await db
      .select({
        id: internships.id,
        name: internships.name,
        description: internships.description,
        jdUrl: internships.jdUrl,
        startDate: internships.startDate,
        endDate: internships.endDate,
        lastSubmissionDate: internships.lastSubmissionDate,
        sellingPrice: internships.sellingPrice,
        price: internships.price,
        totalScore: internships.totalScore,
        examinerName: internships.examinerName,
        examinerPhotoUrl: internships.examinerPhotoUrl,
        demandName: employeeDemand.name,
        demandIconUrl: employeeDemand.iconUrl,
      })
      .from(internships)
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .where(eq(internships.isPublic, true))
      .orderBy(desc(internships.createdAt))
      .limit(20);

    const paidIds = await getPaidInternshipIds(userId);

    return rows.map((r) => ({
      ...r,
      isRegistered: paidIds.has(r.id), // ✅ sirf paid users ko "Applied"
    }));
  } catch (error) {
    console.error("getInternships error:", error);
    return [];
  }
}

/**
 * Set of internship ids the given user has an ACTIVE (paid) registration for.
 * Queried separately from the internship list so a user with several
 * payment attempts can never duplicate the internship rows.
 */
export async function getPaidInternshipIds(
  userId: string | null | undefined
): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const rows = await db
      .selectDistinct({ internshipId: payments.internshipId })
      .from(payments)
      .where(and(eq(payments.userId, userId), eq(payments.status, "paid")));
    return new Set(rows.map((r) => r.internshipId));
  } catch (error) {
    console.error("getPaidInternshipIds error:", error);
    return new Set();
  }
}

// =====================================================
// TIER LIST
// =====================================================

export type TierLevel = "Elite" | "Platinum" | "Gold" | "Silver" | "Bronze";

/**
 * 0-100 percentage -> tier. Kept in one place so the leaderboard, the podium
 * and the profile drawer can never disagree on a student's tier.
 */
function getTierFromScore(score: number): TierLevel {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Platinum";
  if (score >= 60) return "Gold";
  if (score >= 40) return "Silver";
  return "Bronze";
}



// =====================================================
// STATS
// =====================================================
export type HomeStats = {
  students: number;
  teams: number;
  demands: number;
  internships: number;
};

/**
 * Four COUNT queries on every homepage load, for numbers that barely move.
 * Cached for 5 minutes — long enough to absorb traffic spikes, short enough
 * that the figures never look meaningfully stale.
 */
export async function getHomeStats(): Promise<HomeStats> {
  try {
    return await cachedValue(
      "home:stats",
      { ttlSeconds: 300, tag: CACHE_TAGS.stats },
      async () => {
        const [students] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(user);

        const [teams] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(team);

        const [demands] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(employeeDemand);

        const [internshipsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(internships)
          .where(eq(internships.isPublic, true));

        return {
          students: students?.count ?? 0,
          teams: teams?.count ?? 0,
          demands: demands?.count ?? 0,
          internships: internshipsCount?.count ?? 0,
        };
      }
    );
  } catch (error) {
    console.error("getHomeStats error:", error);
    return { students: 0, teams: 0, demands: 0, internships: 0 };
  }
}



// =====================================================
// FEATURED DEMANDS
// =====================================================
export type DemandCard = {
  id: string;
  name: string;
  iconUrl: string | null;
  description: string | null;
  keyFeatures: string[];
  internshipCount: number;
};

export async function getFeaturedDemands(): Promise<DemandCard[]> {
  try {
    // Public and identical for everyone, so it is safe to cache. Keyed by the
    // demand filter so a narrowed view does not get another view's data.
    const raw = await cachedValue(
      "home:featured-demands",
      { ttlSeconds: 300, tag: CACHE_TAGS.demands },
      async () => {
        const demands = await db
          .select({
            id: employeeDemand.id,
            name: employeeDemand.name,
            iconUrl: employeeDemand.iconUrl,
            description: employeeDemand.description,
            keyFeatures: employeeDemand.keyFeatures,
            internshipCount: sql<number>`(
              SELECT COUNT(*)::int FROM ${internships}
              WHERE ${internships.demandId} = ${employeeDemand.id}
                AND ${internships.isPublic} = true
            )`,
          })
          .from(employeeDemand)
          .limit(8);

        return demands.map((d) => ({
          id: d.id,
          name: d.name,
          iconUrl: d.iconUrl,
          description: d.description,
          keyFeatures: Array.isArray(d.keyFeatures)
            ? (d.keyFeatures as string[])
            : [],
          internshipCount: d.internshipCount ?? 0,
        }));
      }
    );

    return raw;
  } catch (error) {
    console.error("getFeaturedDemands error:", error);
    return [];
  }
}

// =====================================================
// UPCOMING DEADLINES
// =====================================================
export type UpcomingInternship = {
  id: string;
  name: string;
  description: string | null;
  lastSubmissionDate: Date | null;
  sellingPrice: string | null;
  demandName: string | null;
  demandIconUrl: string | null;
  daysLeft: number;
};

export async function getUpcomingDeadlines(): Promise<UpcomingInternship[]> {
  try {
    /**
     * Cached as ISO strings because JSON has no Date type, then revived.
     *
     * `daysLeft` is deliberately NOT cached — it counts down, so it has to be
     * recomputed on every render or a deadline would sit frozen at its cached
     * value until the TTL expired.
     */
    const raw = await cachedValue(
      "home:upcoming-deadlines",
      { ttlSeconds: 120, tag: CACHE_TAGS.deadlines },
      async () => {
        const rows = await db
          .select({
            id: internships.id,
            name: internships.name,
            description: internships.description,
            lastSubmissionDate: internships.lastSubmissionDate,
            sellingPrice: internships.sellingPrice,
            demandName: employeeDemand.name,
            demandIconUrl: employeeDemand.iconUrl,
          })
          .from(internships)
          .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
          .where(
            and(
              eq(internships.isPublic, true),
              sql`${internships.lastSubmissionDate} > NOW()`
            )
          )
          .orderBy(internships.lastSubmissionDate)
          .limit(6);

        return rows.map((r) => ({
          ...r,
          lastSubmissionDate: r.lastSubmissionDate
            ? r.lastSubmissionDate.toISOString()
            : null,
        }));
      }
    );

    const now = Date.now();
    return raw.map((r) => ({
      ...r,
      lastSubmissionDate: r.lastSubmissionDate
        ? new Date(r.lastSubmissionDate)
        : null,
      daysLeft: r.lastSubmissionDate
        ? Math.max(
            0,
            Math.ceil(
              (+new Date(r.lastSubmissionDate) - now) / (1000 * 60 * 60 * 24)
            )
          )
        : 0,
    }));
  } catch (error) {
    console.error("getUpcomingDeadlines error:", error);
    return [];
  }
}




// =====================================================
// TIERLIST PAGE — users ranked by their running total score
// =====================================================

/**
 * One profile on the tier list.
 *
 * `totalScore` is the raw running sum of everything the student has scored so
 * far — every team they are in plus every exam they submitted — and that is
 * what decides the rank.
 *
 * `percentage` normalises those same points against what each team/exam was
 * actually worth, so someone in 8 teams is not handed a bigger tier than
 * someone in 1 for the same result. That is what decides the tier.
 */
export type TierUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  headline: string | null;
  rank: number;
  tier: TierLevel;
  totalScore: number;
  teamScore: number;
  examScore: number;
  percentage: number;
  teamCount: number;
  examCount: number;
};

type ScoreBucket = {
  teamScore: number;
  examScore: number;
  /** Points earned, each activity capped at what it was worth. */
  earned: number;
  /** Points that were on offer across those activities. */
  available: number;
  teamCount: number;
  examCount: number;
};

function emptyBucket(): ScoreBucket {
  return {
    teamScore: 0,
    examScore: 0,
    earned: 0,
    available: 0,
    teamCount: 0,
    examCount: 0,
  };
}

/** 0-100, weighted by what each team/exam was worth. */
function bucketPercentage(bucket: ScoreBucket): number {
  if (bucket.available <= 0) return 0;
  return Math.min(100, Math.max(0, (bucket.earned / bucket.available) * 100));
}

/**
 * Running totals for every student. Built from their team memberships and
 * their latest submission per exam — a retake replaces the earlier attempt
 * instead of stacking on top of it.
 */
async function getScoreBuckets(): Promise<Map<string, ScoreBucket>> {
  const buckets = new Map<string, ScoreBucket>();
  const bucketFor = (userId: string) => {
    let bucket = buckets.get(userId);
    if (!bucket) {
      bucket = emptyBucket();
      buckets.set(userId, bucket);
    }
    return bucket;
  };

  // ---- teams ----
  const teamRows = await db
    .select({
      userId: teamMember.userId,
      score: team.score,
      // A team's score is free-form for the admin, so cap it at the
      // internship's out-of score before it feeds the percentage.
      earned: sql<number>`LEAST(${team.score}::numeric, GREATEST(${internships.totalScore}, 1))::float8`,
      available: sql<number>`GREATEST(${internships.totalScore}, 1)::float8`,
    })
    .from(teamMember)
    .innerJoin(team, eq(teamMember.teamId, team.id))
    .innerJoin(internships, eq(team.internshipId, internships.id));

  for (const row of teamRows) {
    const bucket = bucketFor(row.userId);
    bucket.teamScore += row.score ?? 0;
    bucket.teamCount += 1;
    bucket.earned += Number(row.earned ?? 0);
    bucket.available += Number(row.available ?? 0);
  }

  // ---- exams (latest attempt per exam) ----
  // DISTINCT ON forces the grouped keys to lead the ORDER BY.
  const submissions = await db
    .selectDistinctOn([examSubmission.userId, examSubmission.examId], {
      userId: examSubmission.userId,
      examId: examSubmission.examId,
      answers: examSubmission.answers,
    })
    .from(examSubmission)
    .where(isNotNull(examSubmission.submittedAt))
    .orderBy(
      asc(examSubmission.userId),
      asc(examSubmission.examId),
      desc(examSubmission.submittedAt),
      desc(examSubmission.id)
    );

  const examMarks = new Map<string, number>();
  if (submissions.length > 0) {
    const examRows = await db
      .select({ id: exams.id, totalMarks: exams.totalMarks })
      .from(exams)
      .where(
        inArray(
          exams.id,
          submissions.map((s) => s.examId)
        )
      );
    for (const exam of examRows) examMarks.set(exam.id, exam.totalMarks ?? 0);
  }

  for (const submission of submissions) {
    const meta = readSubmissionMeta(submission.answers);
    const score = meta.score ?? 0;
    const available = meta.totalMarks ?? examMarks.get(submission.examId) ?? 0;

    const bucket = bucketFor(submission.userId);
    bucket.examScore += score;
    bucket.examCount += 1;
    bucket.earned += Math.min(score, available);
    bucket.available += available;
  }

  return buckets;
}

/** Everyone on the tier list, highest running total first. */
export async function getUserTierList(): Promise<TierUser[]> {
  try {
    /**
     * The whole leaderboard is identical for every visitor, so it is safe to
     * cache — and this is the heaviest read in the app (4 queries, run on
     * every page load by the profile reminder).
     *
     * Kept to 30 seconds. A leaderboard that lags half a minute after an exam
     * is fine; one that lags an hour would look broken.
     */
    return await cachedValue(
      "tierlist:users",
      { ttlSeconds: 30, tag: CACHE_TAGS.tierlist },
      async () => {
        const [users, buckets] = await Promise.all([
          db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              headline: profile.headline,
            })
            .from(user)
            .leftJoin(profile, eq(profile.userId, user.id))
            .where(eq(user.role, "user")),
          getScoreBuckets(),
        ]);

        const rows: TierUser[] = users.map((account) => {
          const bucket = buckets.get(account.id) ?? emptyBucket();
          const percentage = bucketPercentage(bucket);
          return {
            id: account.id,
            name: account.name,
            email: account.email,
            image: account.image,
            headline: account.headline,
            rank: 0,
            tier: getTierFromScore(percentage),
            totalScore: bucket.teamScore + bucket.examScore,
            teamScore: bucket.teamScore,
            examScore: bucket.examScore,
            percentage: Math.round(percentage * 10) / 10,
            teamCount: bucket.teamCount,
            examCount: bucket.examCount,
          };
        });

        rows.sort(
          (a, b) =>
            b.totalScore - a.totalScore ||
            b.percentage - a.percentage ||
            a.name.localeCompare(b.name)
        );

        // Equal totals share a rank.
        let lastScore = Number.NaN;
        let lastRank = 0;
        return rows.map((row, i) => {
          if (row.totalScore !== lastScore) {
            lastRank = i + 1;
            lastScore = row.totalScore;
          }
          return { ...row, rank: lastRank };
        });
      }
    );
  } catch (error) {
    console.error("getUserTierList error:", error);
    return [];
  }
}

export type UserTierTeam = {
  id: string;
  name: string;
  score: number;
  available: number;
  percentage: number;
  demandName: string;
  internshipName: string;
  memberCount: number;
};

export type UserTierExam = {
  id: string;
  name: string;
  internshipName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean | null;
  submittedAt: string | null;
};

export type UserTierDetail = TierUser & {
  bio: string | null;
  city: string | null;
  branch: string | null;
  collegeName: string | null;
  skills: string[];
  teams: UserTierTeam[];
  exams: UserTierExam[];
};

/** Full profile + every team and exam behind their score, for the drawer. */
export async function getUserTierDetail(
  userId: string
): Promise<UserTierDetail | null> {
  try {
    const [account] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        headline: profile.headline,
        bio: profile.bio,
        city: profile.city,
        branch: profile.branch,
        collegeName: profile.collegeName,
        skills: profile.skills,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);

    if (!account) return null;

    const teamRows = await db
      .select({
        id: team.id,
        name: team.name,
        score: team.score,
        available: sql<number>`GREATEST(${internships.totalScore}, 1)::float8`,
        demandName: employeeDemand.name,
        internshipName: internships.name,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${teamMember} m
          WHERE m.team_id = ${team.id}
        )`,
      })
      .from(teamMember)
      .innerJoin(team, eq(teamMember.teamId, team.id))
      .leftJoin(employeeDemand, eq(team.demandId, employeeDemand.id))
      .leftJoin(internships, eq(team.internshipId, internships.id))
      .where(eq(teamMember.userId, userId))
      .orderBy(desc(team.score));

    const teams: UserTierTeam[] = teamRows.map((row) => {
      const available = Number(row.available ?? 0) || 1;
      const score = row.score ?? 0;
      return {
        id: row.id,
        name: row.name,
        score,
        available,
        percentage: Math.min(100, Math.round((score / available) * 100)),
        demandName: row.demandName ?? "Unknown",
        internshipName: row.internshipName ?? "—",
        memberCount: row.memberCount ?? 0,
      };
    });

    const submissions = await db
      .selectDistinctOn([examSubmission.userId, examSubmission.examId], {
        examId: examSubmission.examId,
        answers: examSubmission.answers,
        submittedAt: examSubmission.submittedAt,
      })
      .from(examSubmission)
      .where(
        and(
          eq(examSubmission.userId, userId),
          isNotNull(examSubmission.submittedAt)
        )
      )
      .orderBy(
        asc(examSubmission.userId),
        asc(examSubmission.examId),
        desc(examSubmission.submittedAt),
        desc(examSubmission.id)
      );

    const examInfo = new Map<
      string,
      { name: string; internshipName: string; totalMarks: number }
    >();
    if (submissions.length > 0) {
      const examRows = await db
        .select({
          id: exams.id,
          name: exams.name,
          totalMarks: exams.totalMarks,
          internshipName: internships.name,
        })
        .from(exams)
        .leftJoin(internships, eq(exams.internshipId, internships.id))
        .where(inArray(exams.id, submissions.map((s) => s.examId)));

      for (const exam of examRows) {
        examInfo.set(exam.id, {
          name: exam.name,
          internshipName: exam.internshipName ?? "—",
          totalMarks: exam.totalMarks ?? 0,
        });
      }
    }

    const examRows: UserTierExam[] = submissions
      .map((submission) => {
        const meta = readSubmissionMeta(submission.answers);
        const info = examInfo.get(submission.examId);
        const score = meta.score ?? 0;
        const totalMarks = meta.totalMarks ?? info?.totalMarks ?? 0;
        return {
          id: submission.examId,
          name: info?.name ?? "Exam",
          internshipName: info?.internshipName ?? "—",
          score,
          totalMarks,
          percentage:
            totalMarks > 0
              ? Math.min(100, Math.round((score / totalMarks) * 100))
              : 0,
          passed: meta.passed,
          submittedAt: submission.submittedAt
            ? new Date(submission.submittedAt).toISOString()
            : null,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    // Reuse the list so the drawer can never disagree with the table.
    // Admins are not on the tier list, so they get a neutral zeroed row.
    const ranked = await getUserTierList();
    const base: TierUser = ranked.find((u) => u.id === userId) ?? {
      id: account.id,
      name: account.name,
      email: account.email,
      image: account.image,
      headline: account.headline,
      rank: 0,
      tier: "Bronze",
      totalScore: 0,
      teamScore: 0,
      examScore: 0,
      percentage: 0,
      teamCount: 0,
      examCount: 0,
    };

    return {
      ...base,
      bio: account.bio,
      city: account.city,
      branch: account.branch,
      collegeName: account.collegeName,
      skills: Array.isArray(account.skills) ? (account.skills as string[]) : [],
      teams,
      exams: examRows,
    };
  } catch (error) {
    console.error("getUserTierDetail error:", error);
    return null;
  }
}




// =====================================================
// DEMAND TEAMS (for drawer)
// =====================================================
export type DemandTeamRow = {
  id: string;
  name: string;
  score: number;
  rank: number;
  tier: "Elite" | "Platinum" | "Gold" | "Silver" | "Bronze";
  memberCount: number;
  internshipName: string | null;
};

export type DemandDetail = {
  id: string;
  name: string;
  iconUrl: string | null;
  description: string | null;
  keyFeatures: string[];
  internshipCount: number;
  totalTeams: number;
  teams: DemandTeamRow[];
};

function tierFromScore(score: number) {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Platinum";
  if (score >= 60) return "Gold";
  if (score >= 40) return "Silver";
  return "Bronze";
}

export async function getDemandDetail(
  demandId: string
): Promise<DemandDetail | null> {
  try {
    const [demand] = await db
      .select({
        id: employeeDemand.id,
        name: employeeDemand.name,
        iconUrl: employeeDemand.iconUrl,
        description: employeeDemand.description,
        keyFeatures: employeeDemand.keyFeatures,
        internshipCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${internships}
          WHERE ${internships.demandId} = ${employeeDemand.id}
            AND ${internships.isPublic} = true
        )`,
      })
      .from(employeeDemand)
      .where(eq(employeeDemand.id, demandId))
      .limit(1);

    if (!demand) return null;

    const teams = await db
      .select({
        id: team.id,
        name: team.name,
        score: team.score,
        internshipName: internships.name,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${teamMember}
          WHERE ${teamMember.teamId} = ${team.id}
        )`,
      })
      .from(team)
      .leftJoin(internships, eq(team.internshipId, internships.id))
      .where(eq(team.demandId, demandId))
      .orderBy(desc(team.score));

    const teamRows: DemandTeamRow[] = teams.map((t, i) => ({
      id: t.id,
      name: t.name,
      score: t.score,
      rank: i + 1,
      tier: tierFromScore(t.score),
      memberCount: t.memberCount ?? 0,
      internshipName: t.internshipName,
    }));

    return {
      id: demand.id,
      name: demand.name,
      iconUrl: demand.iconUrl,
      description: demand.description,
      keyFeatures: Array.isArray(demand.keyFeatures)
        ? (demand.keyFeatures as string[])
        : [],
      internshipCount: demand.internshipCount ?? 0,
      totalTeams: teamRows.length,
      teams: teamRows,
    };
  } catch (error) {
    console.error("getDemandDetail error:", error);
    return null;
  }
}

// =====================================================
// PAYMENT — shared helpers
// =====================================================

/** Current user id, or null when not signed in. */
async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.id ?? null;
  } catch (error) {
    console.error("currentUserId error:", error);
    return null;
  }
}

/** HTML -> readable plain text, used to validate rich-text fields. */
function stripHtml(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Amount the user actually has to pay, in RUPEES.
 * sellingPrice wins, then price, then 0 (= free access, no Razorpay needed).
 */
function effectiveAmountRupees(row: {
  sellingPrice: string | null;
  price: string | null;
}): number {
  const selling = Number(row.sellingPrice ?? NaN);
  if (Number.isFinite(selling) && selling > 0) return selling;
  const mrrp = Number(row.price ?? NaN);
  if (Number.isFinite(mrrp) && mrrp > 0) return mrrp;
  return 0;
}

/** Razorpay works in the smallest currency unit (paise). */
function toPaise(rupees: number): number {
  return Math.max(1, Math.round(rupees * 100));
}

/** Constant-time hex comparison so signature checks can't be timed. */
function safeHexEqual(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Recompute the Razorpay signature (we hold the secret). */
function buildRazorpaySignature(orderId: string, paymentId: string): string {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Razorpay's `order.payments` comes back as an array of payment ids, but some
 * typings describe it as entities. Handle both shapes.
 */
function firstPaymentIdFromOrder(order: { payments?: unknown }): string | null {
  const list = order.payments;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first: unknown = list[0];
  if (typeof first === "string" && first) return first;
  if (first && typeof first === "object" && "id" in first) {
    const id = (first as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return null;
}

/** Drizzle transaction handle, inferred from db.transaction's callback. */
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function hasPaidPayment(
  userId: string,
  internshipId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.internshipId, internshipId),
        eq(payments.status, "paid")
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Marks a payment row failed WITHOUT deleting the user's application. */
async function failPaymentById(paymentId: string, reason: string) {
  try {
    await db
      .update(payments)
      .set({ status: "failed", failureReason: reason })
      .where(eq(payments.id, paymentId));
  } catch (error) {
    console.error("failPaymentById error:", error);
  }
}

/**
 * Self-healing: the browser callback can be lost (tab closed, network drop)
 * even though Razorpay captured the money. Ask Razorpay what really happened
 * and repair our local state. Never throws.
 */
async function reconcilePendingPayment(
  userId: string,
  internshipId: string
): Promise<boolean> {
  try {
    const [pending] = await db
      .select({
        id: payments.id,
        razorpayOrderId: payments.razorpayOrderId,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          eq(payments.internshipId, internshipId),
          eq(payments.status, "pending")
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    if (!pending?.razorpayOrderId) return false;

    // Razorpay orders stay payable for 24h. Anything older is dead — clean it up.
    const ageMs = Date.now() - new Date(pending.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      await failPaymentById(pending.id, "Payment window expired");
      return false;
    }

    const rzp = getRazorpay();
    const order = await rzp.orders.fetch(pending.razorpayOrderId);

    if (order.status === "paid") {
      const paymentId = firstPaymentIdFromOrder(order);
      if (paymentId) {
        await db
          .update(payments)
          .set({
            status: "paid",
            razorpayPaymentId: paymentId,
            razorpaySignature: buildRazorpaySignature(
              pending.razorpayOrderId,
              paymentId
            ),
            paidAt: new Date(),
            failureReason: null,
          })
          .where(eq(payments.id, pending.id));
        return true;
      }
    }

    if (order.status === "created" && ageMs > 60 * 60 * 1000) {
      await failPaymentById(pending.id, "Payment not completed in time");
    }

    return false;
  } catch (error) {
    console.error("reconcilePendingPayment error:", error);
    return false;
  }
}

// =====================================================
// STEP 1 — SAVE APPLICATION + CREATE PAYMENT ORDER
// =====================================================
export type CreateOrderResult =
  | { success: true; free: true }
  | {
      success: true;
      free: false;
      orderId: string;
      amount: number;
      currency: string;
      registrationId: string;
      keyId: string;
    }
  | {
      success: false;
      error: string;
      code?:
        | "unauthorized"
        | "invalid"
        | "closed"
        | "already_paid"
        | "validation"
        | "rate_limited";
    };

export async function createRegistrationAndOrder(
  internshipId: string,
  coverLetter: string,
  resumeUrl: string
): Promise<CreateOrderResult> {
  // Stops someone from spamming Razorpay with order requests. Keyed on the
  // signed-in user, not the IP, so a shared network cannot lock anyone out.
  const registrationLimit = await rateLimit(LIMITS.registration);
  if (!registrationLimit.ok) {
    return {
      success: false,
      error:
        "Too many attempts from your account. Please try again in a few minutes.",
      code: "rate_limited",
    };
  }

  const userId = await currentUserId();
  if (!userId) {
    return {
      success: false,
      error: "Please login to continue",
      code: "unauthorized",
    };
  }

  if (!internshipId || !internshipId.trim()) {
    return { success: false, error: "Invalid internship", code: "invalid" };
  }

  try {
    const [internship] = await db
      .select({
        id: internships.id,
        name: internships.name,
        sellingPrice: internships.sellingPrice,
        price: internships.price,
        lastSubmissionDate: internships.lastSubmissionDate,
      })
      .from(internships)
      .where(eq(internships.id, internshipId))
      .limit(1);

    if (!internship) {
      return {
        success: false,
        error: "This internship is no longer available",
        code: "invalid",
      };
    }

    // ---- already registered before the deadline? ----
    // Looked up before the deadline check: the cutoff is meant to stop NEW
    // registrations, not to strand somebody who already filled the form.
    const [existingReg] = await db
      .select({ id: internshipRegistration.id })
      .from(internshipRegistration)
      .where(
        and(
          eq(internshipRegistration.userId, userId),
          eq(internshipRegistration.internshipId, internshipId)
        )
      )
      .orderBy(asc(internshipRegistration.createdAt))
      .limit(1);

    // ---- closed? ----
    // Only for people who have no application yet.
    if (
      !existingReg &&
      internship.lastSubmissionDate &&
      new Date(internship.lastSubmissionDate).getTime() < Date.now()
    ) {
      return {
        success: false,
        error: `Applications closed on ${fmtDate(internship.lastSubmissionDate)}`,
        code: "closed",
      };
    }

    // ---- form validation ----
    if (stripHtml(coverLetter).length < 20) {
      return {
        success: false,
        error: "Cover letter must be at least 20 characters",
        code: "validation",
      };
    }

    const resume = resumeUrl.trim();
    if (!resume) {
      return {
        success: false,
        error: "Resume URL is required",
        code: "validation",
      };
    }
    if (!isValidHttpUrl(resume)) {
      return {
        success: false,
        error: "Resume URL must be a valid link starting with http:// or https://",
        code: "validation",
      };
    }

    // Heal any earlier attempt that may have actually succeeded on Razorpay's
    // side before deciding what the user still owes.
    await reconcilePendingPayment(userId, internshipId);

    // ---- already paid? ----
    if (await hasPaidPayment(userId, internshipId)) {
      return {
        success: false,
        error: "You have already paid for this internship",
        code: "already_paid",
      };
    }

    // ---- reuse the application instead of creating a duplicate ----
    const registrationId = existingReg?.id ?? crypto.randomUUID();
    const amountRupees = effectiveAmountRupees(internship);

    const saveApplication = async (tx: DbTransaction) => {
      if (existingReg) {
        await tx
          .update(internshipRegistration)
          .set({ coverLetter: coverLetter.trim(), resumeUrl: resume })
          .where(eq(internshipRegistration.id, registrationId));
      } else {
        await tx.insert(internshipRegistration).values({
          id: registrationId,
          userId,
          internshipId,
          coverLetter: coverLetter.trim(),
          resumeUrl: resume,
        });
      }
    };

    // ---- FREE internship: no gateway needed ----
    if (amountRupees <= 0) {
      await db.transaction(async (tx) => {
        await saveApplication(tx);
        await tx.insert(payments).values({
          id: crypto.randomUUID(),
          userId,
          registrationId,
          internshipId,
          amount: "0.00",
          currency: "INR",
          status: "paid",
          paidAt: new Date(),
        });
      });

      revalidatePath("/");
      revalidatePath("/internships");
      revalidatePath("/profile");
      return { success: true, free: true };
    }

    // ---- PAID internship ----
    const keyId = getRazorpayPublicKeyId();
    if (!keyId) {
      return {
        success: false,
        error: "Payments are being set up. Please try again in a moment.",
      };
    }

    const amount = toPaise(amountRupees);

    let orderId: string;
    try {
      const order = await getRazorpay().orders.create({
        amount,
        currency: "INR",
        receipt: `reg_${registrationId.slice(0, 8)}_${Date.now()}`,
        notes: { userId, internshipId, registrationId },
      });
      orderId = order.id;
    } catch (error) {
      console.error("razorpay.orders.create error:", error);
      return {
        success: false,
        error: "Could not start the payment. Please try again.",
      };
    }

    await db.transaction(async (tx) => {
      await saveApplication(tx);

      // retire older attempts so the status is never ambiguous
      await tx
        .update(payments)
        .set({
          status: "failed",
          failureReason: "Replaced by a newer payment attempt",
        })
        .where(
          and(
            eq(payments.registrationId, registrationId),
            eq(payments.status, "pending")
          )
        );

      await tx.insert(payments).values({
        id: crypto.randomUUID(),
        userId,
        registrationId,
        internshipId,
        amount: amountRupees.toFixed(2),
        currency: "INR",
        status: "pending",
        razorpayOrderId: orderId,
      });
    });

    return {
      success: true,
      free: false,
      orderId,
      amount,
      currency: "INR",
      registrationId,
      keyId,
    };
  } catch (error) {
    console.error("createRegistrationAndOrder error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

// =====================================================
// STEP 2 — VERIFY PAYMENT
// =====================================================
export type VerifyResult =
  | { success: true }
  | { success: false; error: string };

export async function verifyPayment(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyResult> {
  // Cheap to call, easy to hammer, and it touches Razorpay — so it gets a cap.
  const paymentLimit = await rateLimit(LIMITS.payment);
  if (!paymentLimit.ok) {
    return {
      success: false,
      error: "Too many verification attempts. Please wait a moment.",
    };
  }

  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Not authenticated" };

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params ?? {
    razorpayOrderId: "",
    razorpayPaymentId: "",
    razorpaySignature: "",
  };

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return { success: false, error: "Incomplete payment response" };
  }

  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, razorpayOrderId))
      .limit(1);

    if (!payment) {
      return { success: false, error: "Payment record not found" };
    }
    if (payment.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }
    // idempotent — Razorpay can fire the handler more than once
    if (payment.status === "paid") {
      return { success: true };
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return { success: false, error: "Payment verification is not configured" };
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (!safeHexEqual(expectedSignature, razorpaySignature)) {
      await failPaymentById(payment.id, "Signature mismatch");
      return { success: false, error: "Payment verification failed" };
    }

    await db
      .update(payments)
      .set({
        status: "paid",
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date(),
        failureReason: null,
      })
      .where(eq(payments.id, payment.id));

    revalidatePath("/");
    revalidatePath("/internships");
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    console.error("verifyPayment error:", error);
    return { success: false, error: "Verification failed" };
  }
}

// =====================================================
// STEP 2b — CANCEL / FAILED
// =====================================================
export async function cancelPayment(
  razorpayOrderId: string
): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { success: false };

  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, razorpayOrderId))
      .limit(1);

    // never downgrade a payment that already went through
    if (!payment || payment.userId !== userId || payment.status === "paid") {
      return { success: true };
    }

    await failPaymentById(payment.id, "Cancelled by user");
    return { success: true };
  } catch (error) {
    console.error("cancelPayment error:", error);
    return { success: false };
  }
}

// =====================================================
// STEP 2c — MANUAL "CHECK PAYMENT STATUS" (recovery)
// =====================================================
export type SyncResult = { success: true; paid: boolean } | { success: false; error: string };

export async function syncPaymentStatus(
  razorpayOrderId: string
): Promise<SyncResult> {
  const userId = await currentUserId();
  if (!userId) return { success: false, error: "Not authenticated" };

  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, razorpayOrderId))
      .limit(1);

    if (!payment || payment.userId !== userId) {
      return { success: false, error: "Payment not found" };
    }
    if (payment.status === "paid") return { success: true, paid: true };

    const order = await getRazorpay().orders.fetch(razorpayOrderId);
    const paymentId = firstPaymentIdFromOrder(order);

    if (order.status === "paid" && paymentId) {
      await db
        .update(payments)
        .set({
          status: "paid",
          razorpayPaymentId: paymentId,
          razorpaySignature: buildRazorpaySignature(razorpayOrderId, paymentId),
          paidAt: new Date(),
          failureReason: null,
        })
        .where(eq(payments.id, payment.id));

      revalidatePath("/");
      revalidatePath("/internships");
      revalidatePath("/profile");
      return { success: true, paid: true };
    }

    return { success: true, paid: false };
  } catch (error) {
    console.error("syncPaymentStatus error:", error);
    return { success: false, error: "Could not reach the payment gateway" };
  }
}

// =====================================================
// STEP 3 — WHERE IS THIS USER IN THE FLOW?
// =====================================================
export type RegistrationStatus = {
  state: "none" | "paid";
  /**
   * True when an application row already exists for this internship.
   *
   * `state` alone cannot tell "never applied" apart from "applied but never
   * paid", and the deadline needs that difference: someone who applied before
   * the cutoff must still be able to finish paying after it.
   */
  hasRegistration: boolean;
  /** Prefill the form when they come back after a failed/abandoned attempt. */
  coverLetter: string | null;
  resumeUrl: string | null;
  registrationId: string | null;
  paidAt: string | null;
  amountPaid: number | null;
  amountDue: number;
  currency: string;
};

export async function getMyRegistrationStatus(
  internshipId: string
): Promise<RegistrationStatus> {
  const empty: RegistrationStatus = {
    state: "none",
    hasRegistration: false,
    coverLetter: null,
    resumeUrl: null,
    registrationId: null,
    paidAt: null,
    amountPaid: null,
    amountDue: 0,
    currency: "INR",
  };

  const userId = await currentUserId();
  if (!userId) return empty;

  try {
    const [internship] = await db
      .select({ sellingPrice: internships.sellingPrice, price: internships.price })
      .from(internships)
      .where(eq(internships.id, internshipId))
      .limit(1);

    const amountDue = internship
      ? effectiveAmountRupees(internship)
      : 0;

    const [reg] = await db
      .select({
        id: internshipRegistration.id,
        coverLetter: internshipRegistration.coverLetter,
        resumeUrl: internshipRegistration.resumeUrl,
      })
      .from(internshipRegistration)
      .where(
        and(
          eq(internshipRegistration.userId, userId),
          eq(internshipRegistration.internshipId, internshipId)
        )
      )
      .orderBy(asc(internshipRegistration.createdAt))
      .limit(1);

    if (!reg) return { ...empty, amountDue };

    // repair a lost callback before deciding what to show
    await reconcilePendingPayment(userId, internshipId);

    const [paid] = await db
      .select({
        amount: payments.amount,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.registrationId, reg.id),
          eq(payments.status, "paid")
        )
      )
      .orderBy(desc(payments.paidAt))
      .limit(1);

    if (paid) {
      return {
        state: "paid",
        hasRegistration: true,
        coverLetter: reg.coverLetter,
        resumeUrl: reg.resumeUrl,
        registrationId: reg.id,
        paidAt: paid.paidAt ? new Date(paid.paidAt).toISOString() : null,
        amountPaid: Number(paid.amount ?? 0),
        amountDue,
        currency: "INR",
      };
    }

    return {
      state: "none",
      hasRegistration: true,
      coverLetter: reg.coverLetter,
      resumeUrl: reg.resumeUrl,
      registrationId: reg.id,
      paidAt: null,
      amountPaid: null,
      amountDue,
      currency: "INR",
    };
  } catch (error) {
    console.error("getMyRegistrationStatus error:", error);
    return empty;
  }
}

// =====================================================
// STEP 4 — EXAMS UNLOCKED BY A PAID REGISTRATION
// =====================================================
export type InternshipExam = {
  id: string;
  orderNo: number;
  name: string;
  description: string | null;
  duration: number;
  totalMarks: number;
  passingMarks: number | null;
  attempted: boolean;
  attemptCount: number;
  submittedAt: string | null;
  score: number | null;
  passed: boolean | null;
  pendingReview: number;
};

type SubmissionMeta = {
  answers: unknown;
};

function readSubmissionMeta(raw: unknown): {
  score: number | null;
  totalMarks: number | null;
  passed: boolean | null;
  pendingReview: number;
} {
  if (!raw || typeof raw !== "object") {
    return { score: null, totalMarks: null, passed: null, pendingReview: 0 };
  }
  const meta = raw as SubmissionMeta & {
    score?: number;
    totalMarks?: number;
    passed?: boolean | null;
    pendingReview?: number;
  };
  return {
    score: typeof meta.score === "number" ? meta.score : null,
    totalMarks: typeof meta.totalMarks === "number" ? meta.totalMarks : null,
    passed: typeof meta.passed === "boolean" ? meta.passed : null,
    pendingReview:
      typeof meta.pendingReview === "number" ? meta.pendingReview : 0,
  };
}

/** True when the user has a PAID registration for this internship. */
export async function hasPaidAccess(
  userId: string,
  internshipId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.internshipId, internshipId),
        eq(payments.status, "paid")
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function getInternshipExams(
  internshipId: string
): Promise<InternshipExam[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  try {
    if (!(await hasPaidAccess(userId, internshipId))) return [];

    const examRows = await db
      .select({
        id: exams.id,
        orderNo: exams.orderNo,
        name: exams.name,
        description: exams.description,
        duration: exams.duration,
        totalMarks: exams.totalMarks,
        passingMarks: exams.passingMarks,
      })
      .from(exams)
      .where(
        and(
          eq(exams.internshipId, internshipId),
          eq(exams.isPublic, true)
        )
      )
      .orderBy(asc(exams.orderNo), asc(exams.createdAt));

    if (examRows.length === 0) return [];

    const submissionRows = await db
      .select({
        id: examSubmission.id,
        examId: examSubmission.examId,
        answers: examSubmission.answers,
        submittedAt: examSubmission.submittedAt,
      })
      .from(examSubmission)
      .where(
        and(
          eq(examSubmission.userId, userId),
          inArray(
            examSubmission.examId,
            examRows.map((e) => e.id)
          ),
          isNotNull(examSubmission.submittedAt)
        )
      )
      .orderBy(desc(examSubmission.submittedAt));

    // latest submission per exam + attempt count
    const byExam = new Map<
      string,
      { count: number; latest: (typeof submissionRows)[number] | null }
    >();
    for (const row of submissionRows) {
      const entry = byExam.get(row.examId);
      if (!entry) {
        byExam.set(row.examId, { count: 1, latest: row });
      } else {
        entry.count += 1;
      }
    }

    return examRows.map((exam) => {
      const entry = byExam.get(exam.id);
      const latest = entry?.latest ?? null;
      const meta = latest ? readSubmissionMeta(latest.answers) : null;

      return {
        id: exam.id,
        orderNo: exam.orderNo,
        name: exam.name,
        description: exam.description,
        duration: exam.duration,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        attempted: !!latest,
        attemptCount: entry?.count ?? 0,
        submittedAt: latest?.submittedAt
          ? new Date(latest.submittedAt).toISOString()
          : null,
        score: meta?.score ?? null,
        passed: meta?.passed ?? null,
        pendingReview: meta?.pendingReview ?? 0,
      };
    });
  } catch (error) {
    console.error("getInternshipExams error:", error);
    return [];
  }
}

// =====================================================
// MY PAYMENTS (order history for the profile page)
// =====================================================
export type MyPayment = {
  id: string;
  internshipId: string;
  internshipName: string;
  demandName: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  createdAt: string;
  paidAt: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  failureReason: string | null;
};

export async function getMyPayments(): Promise<MyPayment[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  try {
    const rows = await db
      .select({
        id: payments.id,
        internshipId: payments.internshipId,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
        razorpayOrderId: payments.razorpayOrderId,
        razorpayPaymentId: payments.razorpayPaymentId,
        failureReason: payments.failureReason,
        internshipName: internships.name,
        demandName: employeeDemand.name,
      })
      .from(payments)
      .innerJoin(internships, eq(payments.internshipId, internships.id))
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      internshipId: r.internshipId,
      internshipName: r.internshipName,
      demandName: r.demandName,
      amount: Number(r.amount ?? 0),
      currency: r.currency,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      paidAt: r.paidAt ? new Date(r.paidAt).toISOString() : null,
      razorpayOrderId: r.razorpayOrderId,
      razorpayPaymentId: r.razorpayPaymentId,
      failureReason: r.failureReason,
    }));
  } catch (error) {
    console.error("getMyPayments error:", error);
    return [];
  }
}