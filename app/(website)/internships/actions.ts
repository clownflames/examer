"use server";

import { db } from "@/db";
import {
  internships,
  employeeDemand,
  internshipRegistration,
  user,
} from "@/db/schema";
import { eq, desc, asc, sql, and, or, ilike } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

// =====================================================
// TYPES
// =====================================================
export type InternshipCard = {
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
  createdAt: Date;
  demandId: string;
  demandName: string | null;
  demandIconUrl: string | null;
  isRegistered: boolean;
  daysLeft: number | null;
};

export type DemandFilter = {
  id: string;
  name: string;
  iconUrl: string | null;
  count: number;
};

export type SortOption = "newest" | "deadline" | "price";

// =====================================================
// HELPERS
// =====================================================
function calcDaysLeft(date: Date | null): number | null {
  if (!date) return null;
  return Math.ceil((+new Date(date) - Date.now()) / (1000 * 60 * 60 * 24));
}

// =====================================================
// FETCH ALL INTERNSHIPS (with filters)
// =====================================================
export async function getAllInternships(params?: {
  demandId?: string | null;
  search?: string;
  sort?: SortOption;
}): Promise<InternshipCard[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userId = session?.user?.id;

    const conditions = [];
    if (params?.demandId) {
      conditions.push(eq(internships.demandId, params.demandId));
    }
    if (params?.search?.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(internships.name, q),
          ilike(internships.description, q)
        )
      );
    }

    const orderBy =
      params?.sort === "deadline"
        ? asc(internships.lastSubmissionDate)
        : params?.sort === "price"
        ? desc(internships.sellingPrice)
        : desc(internships.createdAt);

    const base = db
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
        createdAt: internships.createdAt,
        demandId: internships.demandId,
        demandName: employeeDemand.name,
        demandIconUrl: employeeDemand.iconUrl,
        registrationId: internshipRegistration.id,
      })
      .from(internships)
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id))
      .leftJoin(
        internshipRegistration,
        userId
          ? sql`${internshipRegistration.internshipId} = ${internships.id} 
                 AND ${internshipRegistration.userId} = ${userId}`
          : sql`false`
      );

    const rows =
      conditions.length > 0
        ? await base.where(and(...conditions)).orderBy(orderBy)
        : await base.orderBy(orderBy);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      jdUrl: r.jdUrl,
      startDate: r.startDate,
      endDate: r.endDate,
      lastSubmissionDate: r.lastSubmissionDate,
      sellingPrice: r.sellingPrice,
      price: r.price,
      totalScore: r.totalScore,
      examinerName: r.examinerName,
      examinerPhotoUrl: r.examinerPhotoUrl,
      createdAt: r.createdAt,
      demandId: r.demandId,
      demandName: r.demandName,
      demandIconUrl: r.demandIconUrl,
      isRegistered: !!r.registrationId,
      daysLeft: calcDaysLeft(r.lastSubmissionDate),
    }));
  } catch (error) {
    console.error("getAllInternships error:", error);
    return [];
  }
}

// =====================================================
// DEMAND FILTERS (with counts)
// =====================================================
export async function getDemandFilters(): Promise<DemandFilter[]> {
  try {
    const rows = await db
      .select({
        id: employeeDemand.id,
        name: employeeDemand.name,
        iconUrl: employeeDemand.iconUrl,
        count: sql<number>`(
          SELECT COUNT(*)::int FROM ${internships}
          WHERE ${internships.demandId} = ${employeeDemand.id}
        )`,
      })
      .from(employeeDemand)
      .orderBy(employeeDemand.name);

    return rows.filter((r) => r.count > 0);
  } catch (error) {
    console.error("getDemandFilters error:", error);
    return [];
  }
}

// =====================================================
// APPLY (same as global, but scoped here)
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

    if (!internshipId) return { success: false, error: "Invalid internship" };

    const plain = coverLetter
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    if (plain.length < 20) {
      return {
        success: false,
        error: "Cover letter must be at least 20 characters",
      };
    }

    if (!resumeUrl.trim()) {
      return { success: false, error: "Resume URL is required" };
    }

    const existing = await db
      .select({ id: internshipRegistration.id })
      .from(internshipRegistration)
      .where(
        and(
          eq(internshipRegistration.userId, session.user.id),
          eq(internshipRegistration.internshipId, internshipId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "You have already applied to this internship",
      };
    }

    await db.insert(internshipRegistration).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      internshipId,
      coverLetter: coverLetter.trim(),
      resumeUrl: resumeUrl.trim(),
    });

    revalidatePath("/internships");
    revalidatePath("/");

    return { success: true, message: "Application submitted successfully!" };
  } catch (error) {
    console.error("applyToInternship error:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}