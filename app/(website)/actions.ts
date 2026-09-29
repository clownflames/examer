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
  teamGoals,
  teamFinalResult,
  payments,
  exams,
  examSubmission,
} from "@/db/schema";
import { eq, desc, asc, sql, and, inArray, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
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

export type TierTeam = {
  id: string;
  name: string;
  score: number;
  rank: number;
  tier: TierLevel;
  memberCount: number;
  demandName: string;
  internshipName: string;
};

export type TierGroup = {
  demandId: string;
  demandName: string;
  demandIconUrl: string | null;
  teams: TierTeam[];
};

function getTierFromScore(score: number): TierLevel {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Platinum";
  if (score >= 60) return "Gold";
  if (score >= 40) return "Silver";
  return "Bronze";
}

export async function getTierList(): Promise<TierGroup[]> {
  try {
    // All demands
    const demands = await db
      .select({
        id: employeeDemand.id,
        name: employeeDemand.name,
        iconUrl: employeeDemand.iconUrl,
      })
      .from(employeeDemand)
      .orderBy(employeeDemand.name);

    if (demands.length === 0) return [];

    // All teams with scores, joined with demand + internship + member count
    const rows = await db
      .select({
        teamId: team.id,
        teamName: team.name,
        teamScore: team.score,
        demandId: team.demandId,
        internshipName: internships.name,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${teamMember} 
          WHERE ${teamMember.teamId} = ${team.id}
        )`,
      })
      .from(team)
      .leftJoin(internships, eq(team.internshipId, internships.id))
      .orderBy(desc(team.score));

    // Group by demand
    const grouped: TierGroup[] = demands.map((d) => {
      const demandTeams = rows
        .filter((r) => r.demandId === d.id)
        .map((r, idx) => ({
          id: r.teamId,
          name: r.teamName,
          score: r.teamScore,
          rank: idx + 1,
          tier: getTierFromScore(r.teamScore),
          memberCount: r.memberCount ?? 0,
          demandName: d.name,
          internshipName: r.internshipName ?? "—",
        }));

      return {
        demandId: d.id,
        demandName: d.name,
        demandIconUrl: d.iconUrl,
        teams: demandTeams,
      };
    });

    // Only return demands that have at least 1 team
    return grouped.filter((g) => g.teams.length > 0);
  } catch (error) {
    console.error("getTierList error:", error);
    return [];
  }
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

export async function getHomeStats(): Promise<HomeStats> {
  try {
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

    const now = Date.now();
    return rows.map((r) => ({
      ...r,
      daysLeft: r.lastSubmissionDate
        ? Math.max(
            0,
            Math.ceil((+new Date(r.lastSubmissionDate) - now) / (1000 * 60 * 60 * 24))
          )
        : 0,
    }));
  } catch (error) {
    console.error("getUpcomingDeadlines error:", error);
    return [];
  }
}




// =====================================================
// TIERLIST PAGE
// =====================================================

export type TierListTeam = {
  id: string;
  name: string;
  score: number;
  rank: number;
  tier: TierLevel;
  memberCount: number;
  demandId: string;
  demandName: string;
  demandIconUrl: string | null;
  internshipName: string | null;
  createdAt: Date;
};

export type DemandSummary = {
  id: string;
  name: string;
  iconUrl: string | null;
  teamCount: number;
};

export type TeamDetail = TierListTeam & {
  members: {
    id: string;
    userId: string;
    name: string;
    email: string;
    image: string | null;
  }[];
  goals: {
    id: string;
    text: string;
    createdAt: Date;
  }[];
  finalResults: {
    id: string;
    score: number;
    result: string;
    createdAt: Date;
  }[];
  internship: {
    id: string;
    name: string;
    description: string | null;
    examinerName: string | null;
    examinerPhotoUrl: string | null;
    totalScore: number;
  } | null;
};

// All demands with team counts (for sidebar)
export async function getDemandsWithCounts(): Promise<DemandSummary[]> {
  try {
    const demands = await db
      .select({
        id: employeeDemand.id,
        name: employeeDemand.name,
        iconUrl: employeeDemand.iconUrl,
        teamCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${team}
          WHERE ${team.demandId} = ${employeeDemand.id}
        )`,
      })
      .from(employeeDemand)
      .orderBy(employeeDemand.name);

    return demands;
  } catch (error) {
    console.error("getDemandsWithCounts error:", error);
    return [];
  }
}

// All teams (optionally filtered by demand)
export async function getTierListTeams(
  demandId?: string | null
): Promise<TierListTeam[]> {
  try {
    const baseQuery = db
      .select({
        id: team.id,
        name: team.name,
        score: team.score,
        demandId: team.demandId,
        demandName: employeeDemand.name,
        demandIconUrl: employeeDemand.iconUrl,
        internshipName: internships.name,
        createdAt: team.createdAt,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${teamMember}
          WHERE ${teamMember.teamId} = ${team.id}
        )`,
      })
      .from(team)
      .leftJoin(employeeDemand, eq(team.demandId, employeeDemand.id))
      .leftJoin(internships, eq(team.internshipId, internships.id));

    const rows = await (demandId
      ? baseQuery.where(eq(team.demandId, demandId))
      : baseQuery
    ).orderBy(desc(team.score));

    // rank per demand
    const rankMap = new Map<string, number>();
    return rows.map((r) => {
      const nextRank = (rankMap.get(r.demandId) ?? 0) + 1;
      rankMap.set(r.demandId, nextRank);
      return {
        id: r.id,
        name: r.name,
        score: r.score,
        rank: nextRank,
        tier: getTierFromScore(r.score),
        memberCount: r.memberCount ?? 0,
        demandId: r.demandId,
        demandName: r.demandName ?? "Unknown",
        demandIconUrl: r.demandIconUrl,
        internshipName: r.internshipName,
        createdAt: r.createdAt,
      };
    });
  } catch (error) {
    console.error("getTierListTeams error:", error);
    return [];
  }
}

// Full team detail for drawer
export async function getTeamDetail(
  teamId: string
): Promise<TeamDetail | null> {
  try {
    const [row] = await db
      .select({
        id: team.id,
        name: team.name,
        score: team.score,
        demandId: team.demandId,
        demandName: employeeDemand.name,
        demandIconUrl: employeeDemand.iconUrl,
        internshipId: team.internshipId,
        internshipName: internships.name,
        internshipDesc: internships.description,
        examinerName: internships.examinerName,
        examinerPhotoUrl: internships.examinerPhotoUrl,
        totalScore: internships.totalScore,
        createdAt: team.createdAt,
      })
      .from(team)
      .leftJoin(employeeDemand, eq(team.demandId, employeeDemand.id))
      .leftJoin(internships, eq(team.internshipId, internships.id))
      .where(eq(team.id, teamId))
      .limit(1);

    if (!row) return null;

    const members = await db
      .select({
        id: teamMember.id,
        userId: teamMember.userId,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(teamMember)
      .leftJoin(user, eq(teamMember.userId, user.id))
      .where(eq(teamMember.teamId, teamId));

    const goals = await db
      .select({
        id: teamGoals.id,
        text: teamGoals.text,
        createdAt: teamGoals.createdAt,
      })
      .from(teamGoals)
      .where(eq(teamGoals.teamId, teamId))
      .orderBy(desc(teamGoals.createdAt));

    const finalResults = await db
      .select({
        id: teamFinalResult.id,
        score: teamFinalResult.score,
        result: teamFinalResult.result,
        createdAt: teamFinalResult.createdAt,
      })
      .from(teamFinalResult)
      .where(eq(teamFinalResult.teamId, teamId))
      .orderBy(desc(teamFinalResult.createdAt));

    // rank within demand
    const allInDemand = await db
      .select({ score: team.score, id: team.id })
      .from(team)
      .where(eq(team.demandId, row.demandId))
      .orderBy(desc(team.score));

    const rank =
      allInDemand.findIndex((t) => t.id === teamId) + 1 || allInDemand.length;

    return {
      id: row.id,
      name: row.name,
      score: row.score,
      rank,
      tier: getTierFromScore(row.score),
      memberCount: members.length,
      demandId: row.demandId,
      demandName: row.demandName ?? "Unknown",
      demandIconUrl: row.demandIconUrl,
      internshipName: row.internshipName,
      createdAt: row.createdAt,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.name ?? "Unknown",
        email: m.email ?? "",
        image: m.image,
      })),
      goals,
      finalResults,
      internship: row.internshipId
        ? {
            id: row.internshipId,
            name: row.internshipName ?? "",
            description: row.internshipDesc,
            examinerName: row.examinerName,
            examinerPhotoUrl: row.examinerPhotoUrl,
            totalScore: row.totalScore ?? 100,
          }
        : null,
    };
  } catch (error) {
    console.error("getTeamDetail error:", error);
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
        | "validation";
    };

export async function createRegistrationAndOrder(
  internshipId: string,
  coverLetter: string,
  resumeUrl: string
): Promise<CreateOrderResult> {
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

    // ---- closed? ----
    if (
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
  passed: boolean | null;
  pendingReview: number;
} {
  if (!raw || typeof raw !== "object") {
    return { score: null, passed: null, pendingReview: 0 };
  }
  const meta = raw as SubmissionMeta & {
    score?: number;
    passed?: boolean | null;
    pendingReview?: number;
  };
  return {
    score: typeof meta.score === "number" ? meta.score : null,
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