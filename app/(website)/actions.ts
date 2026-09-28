"use server";

import { db } from "@/db";
import { internships, employeeDemand, internshipRegistration, team, teamMember, user, teamGoals, teamFinalResult } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

// =====================================================
// TYPES
// =====================================================
export type InternshipListItem = {
  id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  lastSubmissionDate: Date | null;
  sellingPrice: string | null;
  totalScore: number;
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
        startDate: internships.startDate,
        endDate: internships.endDate,
        lastSubmissionDate: internships.lastSubmissionDate,
        sellingPrice: internships.sellingPrice,
        price: internships.price,
        totalScore: internships.totalScore,
        demandName: employeeDemand.name,
        demandIconUrl: employeeDemand.iconUrl,
        // payment status via registration
        registrationId: internshipRegistration.id,
        paymentStatus: payments.status,
      })
      .from(internships)
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .leftJoin(
        internshipRegistration,
        userId
          ? sql`${internshipRegistration.internshipId} = ${internships.id} 
                 AND ${internshipRegistration.userId} = ${userId}`
          : sql`false`
      )
      .leftJoin(
        payments,
        userId
          ? sql`${payments.registrationId} = ${internshipRegistration.id}
                 AND ${payments.status} = 'paid'`
          : sql`false`
      )
      .orderBy(desc(internships.createdAt))
      .limit(20);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      startDate: r.startDate,
      endDate: r.endDate,
      lastSubmissionDate: r.lastSubmissionDate,
      sellingPrice: r.sellingPrice,
      price: r.price,
      totalScore: r.totalScore,
      demandName: r.demandName,
      demandIconUrl: r.demandIconUrl,
      isRegistered: r.paymentStatus === "paid", // ✅ sirf paid users
    }));
  } catch (error) {
    console.error("getInternships error:", error);
    return [];
  }
}

// =====================================================
// APPLY TO INTERNSHIP
// =====================================================
export type ApplyResult =
  | { success: true; message: string }
  | { success: false; error: string; requiresLogin?: boolean };

export async function applyToInternship(
  internshipId: string,
  coverLetter: string,
  resumeUrl: string
): Promise<ApplyResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Please login to apply",
        requiresLogin: true,
      };
    }

    if (!internshipId) {
      return { success: false, error: "Invalid internship" };
    }

    if (!coverLetter.trim() || coverLetter.trim().length < 20) {
      return { success: false, error: "Cover letter must be at least 20 characters" };
    }

    if (!resumeUrl.trim()) {
      return { success: false, error: "Resume URL is required" };
    }

    // Check if already registered
    const existing = await db
      .select({ id: internshipRegistration.id })
      .from(internshipRegistration)
      .where(
        sql`${internshipRegistration.userId} = ${session.user.id} 
             AND ${internshipRegistration.internshipId} = ${internshipId}`
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "You have already applied to this internship" };
    }

    await db.insert(internshipRegistration).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      internshipId,
      coverLetter: coverLetter.trim(),
      resumeUrl: resumeUrl.trim(),
    });

    revalidatePath("/");

    return { success: true, message: "Application submitted successfully!" };
  } catch (error) {
    console.error("applyToInternship error:", error);
    return { success: false, error: "Something went wrong. Please try again." };
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
      .from(internships);

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
      .where(sql`${internships.lastSubmissionDate} > NOW()`)
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
// RAZORPAY IMPORTS
// =====================================================
import { razorpay } from "@/lib/razorpay";
import crypto from "crypto";
import { payments, exams, examSubmission } from "@/db/schema";

// =====================================================
// CREATE REGISTRATION + RAZORPAY ORDER
// =====================================================
export type CreateOrderResult =
  | {
      success: true;
      orderId: string;
      amount: number;
      currency: string;
      registrationId: string;
      keyId: string;
    }
  | { success: false; error: string; requiresLogin?: boolean };

export async function createRegistrationAndOrder(
  internshipId: string,
  coverLetter: string,
  resumeUrl: string
): Promise<CreateOrderResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Please login to apply",
        requiresLogin: true,
      };
    }

    // ... validation same ...

    // create Razorpay order FIRST (before DB inserts)
    const amount = Number(internships.sellingPrice ?? 0);
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: session.user.id,
        internshipId,
      },
    });

    const registrationId = crypto.randomUUID();

    // ✅ TRANSACTION: registration + payment dono ek saath
    await db.transaction(async (tx) => {
      await tx.insert(internshipRegistration).values({
        id: registrationId,
        userId: session.user.id,
        internshipId,
        coverLetter: coverLetter.trim(),
        resumeUrl: resumeUrl.trim(),
      });

      await tx.insert(payments).values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        registrationId,
        internshipId,
        amount: amount.toString(),
        currency: "INR",
        status: "pending",
        razorpayOrderId: order.id,
      });
    });

    return {
      success: true,
      orderId: order.id,
      amount: amount * 100,
      currency: "INR",
      registrationId,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    };
  } catch (error) {
    console.error("createRegistrationAndOrder error:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// =====================================================
// VERIFY PAYMENT
// =====================================================
export type VerifyResult =
  | { success: true }
  | { success: false; error: string };

export async function verifyPayment(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

    // verify signature
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      // signature mismatch → mark failed and delete
      await markPaymentFailed(razorpayOrderId, "Signature mismatch", true);
      return { success: false, error: "Payment verification failed" };
    }

    // find payment row
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, razorpayOrderId))
      .limit(1);

    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    if (payment.userId !== session.user.id) {
      return { success: false, error: "Unauthorized" };
    }

    // update payment
    await db
      .update(payments)
      .set({
        status: "paid",
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    revalidatePath("/");
    revalidatePath("/internships");

    return { success: true };
  } catch (error) {
    console.error("verifyPayment error:", error);
    return { success: false, error: "Verification failed" };
  }
}

// =====================================================
// MARK PAYMENT FAILED + OPTIONALLY DELETE
// =====================================================
async function markPaymentFailed(
  razorpayOrderId: string,
  reason: string,
  deleteRegistration = true
) {
  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, razorpayOrderId))
      .limit(1);

    if (!payment) return;

    if (deleteRegistration) {
      // registration delete → payments cascade delete bhi ho jayega
      await db
        .delete(internshipRegistration)
        .where(eq(internshipRegistration.id, payment.registrationId));
    } else {
      await db
        .update(payments)
        .set({ status: "failed", failureReason: reason })
        .where(eq(payments.id, payment.id));
    }
  } catch (error) {
    console.error("markPaymentFailed error:", error);
  }
}

// =====================================================
// CANCEL PAYMENT (user ne cancel kiya ya failed)
// =====================================================
export async function cancelPayment(
  razorpayOrderId: string
): Promise<{ success: boolean }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) return { success: false };

    await markPaymentFailed(razorpayOrderId, "Cancelled by user", true);
    return { success: true };
  } catch (error) {
    console.error("cancelPayment error:", error);
    return { success: false };
  }
}

// =====================================================
// GET USER REGISTRATION STATUS FOR AN INTERNSHIP
// =====================================================
export type RegistrationStatus =
  | { state: "none" }
  | { state: "pending"; razorpayOrderId: string | null; amount: number }
  | { state: "paid" };

export async function getMyRegistrationStatus(
  internshipId: string
): Promise<RegistrationStatus> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) return { state: "none" };

    // 1. registration dhundo
    const [reg] = await db
      .select({ id: internshipRegistration.id })
      .from(internshipRegistration)
      .where(
        and(
          eq(internshipRegistration.userId, session.user.id),
          eq(internshipRegistration.internshipId, internshipId)
        )
      )
      .limit(1);

    if (!reg) return { state: "none" };

    // 2. payment dhundo (latest ek)
    const [pay] = await db
      .select({
        id: payments.id,
        status: payments.status,
        razorpayOrderId: payments.razorpayOrderId,
        amount: payments.amount,
      })
      .from(payments)
      .where(eq(payments.registrationId, reg.id))
      .orderBy(desc(payments.createdAt))
      .limit(1);

    // registration hai but payment row nahi mili — rare case
    if (!pay) {
      console.warn(
        "[getMyRegistrationStatus] Registration exists but no payment row:",
        reg.id
      );
      return { state: "none" };
    }

    if (pay.status === "paid") return { state: "paid" };

    if (pay.status === "pending" && pay.razorpayOrderId) {
      return {
        state: "pending",
        razorpayOrderId: pay.razorpayOrderId,
        amount: Math.round(Number(pay.amount) * 100),
      };
    }

    // failed status wali payment hai → form dikhao (fresh start)
    return { state: "none" };
  } catch (error) {
    console.error("getMyRegistrationStatus error:", error);
    return { state: "none" };
  }
}

// =====================================================
// GET INTERNSHIP EXAMS (with submission status)
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
  submittedAt: string | null;
};

export async function getInternshipExams(
  internshipId: string
): Promise<InternshipExam[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) return [];

    // verify paid registration
    const [reg] = await db
      .select({ id: internshipRegistration.id })
      .from(internshipRegistration)
      .innerJoin(
        payments,
        and(
          eq(payments.registrationId, internshipRegistration.id),
          eq(payments.status, "paid")
        )
      )
      .where(
        and(
          eq(internshipRegistration.userId, session.user.id),
          eq(internshipRegistration.internshipId, internshipId)
        )
      )
      .limit(1);

    if (!reg) return []; // not paid

    // fetch exams
    const rows = await db
      .select({
        id: exams.id,
        orderNo: exams.orderNo,
        name: exams.name,
        description: exams.description,
        duration: exams.duration,
        totalMarks: exams.totalMarks,
        passingMarks: exams.passingMarks,
        submissionSubmittedAt: examSubmission.submittedAt,
      })
      .from(exams)
      .leftJoin(
        examSubmission,
        and(
          eq(examSubmission.examId, exams.id),
          eq(examSubmission.userId, session.user.id)
        )
      )
      .where(eq(exams.internshipId, internshipId))
      .orderBy(exams.orderNo);

    return rows.map((r) => ({
      id: r.id,
      orderNo: r.orderNo,
      name: r.name,
      description: r.description,
      duration: r.duration,
      totalMarks: r.totalMarks,
      passingMarks: r.passingMarks,
      attempted: !!r.submissionSubmittedAt,
      submittedAt: r.submissionSubmittedAt
        ? r.submissionSubmittedAt.toISOString()
        : null,
    }));
  } catch (error) {
    console.error("getInternshipExams error:", error);
    return [];
  }
}