"use server";

import { db } from "@/db";
import {
  internships,
  employeeDemand,
  payments,
} from "@/db/schema";
import { eq, desc, asc, sql, and, or, ilike } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
  /**
   * Invite link for this internship's WhatsApp group. Only sent to the client
   * for someone who has already registered — see getAllInternships.
   */
  whatsappGroupLink: string | null;
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
        whatsappGroupLink: internships.whatsappGroupLink,
        createdAt: internships.createdAt,
        demandId: internships.demandId,
        demandName: employeeDemand.name,
        demandIconUrl: employeeDemand.iconUrl,
      })
      .from(internships)
      .leftJoin(employeeDemand, eq(internships.demandId, employeeDemand.id));

    const rows =
      conditions.length > 0
        ? await base.where(and(...conditions)).orderBy(orderBy)
        : await base.orderBy(orderBy);

    // "Applied" means PAID everywhere — the payment decides, not a bare
    // registration row. Fetched separately so retry attempts can never
    // duplicate internship rows.
    const paidIds = new Set<string>();
    if (userId) {
      const paidRows = await db
        .selectDistinct({ internshipId: payments.internshipId })
        .from(payments)
        .where(and(eq(payments.userId, userId), eq(payments.status, "paid")));
      for (const row of paidRows) paidIds.add(row.internshipId);
    }

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
      // Cohort group invite is scoped to people who actually joined this
      // internship. Never ship the raw link to anonymous visitors — otherwise
      // the client bundle leaks it before anyone registers.
      whatsappGroupLink: paidIds.has(r.id) ? r.whatsappGroupLink : null,
      createdAt: r.createdAt,
      demandId: r.demandId,
      demandName: r.demandName,
      demandIconUrl: r.demandIconUrl,
      isRegistered: paidIds.has(r.id),
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

