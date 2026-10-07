import { Metadata } from "next";

import { getTierListPage, type TierLevel } from "../actions";
import TierListPageClient from "./TierListPageClient";

/** Narrowing guard for the `tier` query param, which arrives as a raw string. */
function isTierLevel(value: string): value is TierLevel {
  return (
    value === "Elite" ||
    value === "Platinum" ||
    value === "Gold" ||
    value === "Silver" ||
    value === "Bronze"
  );
}

export const metadata: Metadata = {
  title: "Tier List | InternBird",
  description:
    "Every student ranked by their total score across all teams and exams",
};

/**
 * Server-rendered shell.
 *
 * Page, tier and search all live in the URL so a page of the leaderboard is a
 * shareable, refreshable link and the browser Back button works. Reading
 * `searchParams` here also opts the page into dynamic rendering, which is what
 * lets the client component read them back with `useSearchParams` without
 * needing a Suspense boundary.
 */
export default async function TierListPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    tier?: string | string[];
    q?: string | string[];
  }>;
}) {
  const params = await searchParams;

  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const page = Math.max(1, Number(first(params.page)) || 1);

  const tierParam = first(params.tier);
  const tier = tierParam && isTierLevel(tierParam) ? tierParam : null;

  const query = (first(params.q) ?? "").slice(0, 100);

  const data = await getTierListPage({ page, tier, query });

  return (
    <TierListPageClient
      rows={data.rows}
      total={data.total}
      page={data.page}
      totalPages={data.totalPages}
      pageSize={data.pageSize}
      tierCounts={data.tierCounts}
      tierFilter={tier}
      query={query}
    />
  );
}