"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { Crown, Search, Trophy, Users } from "lucide-react";

import type { TierLevel, TierUser } from "../actions";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import UserDetailDrawer from "./UserDetailDrawer";

// =====================================================
// CONSTANTS
// =====================================================
const TIER_ORDER: TierLevel[] = ["Elite", "Platinum", "Gold", "Silver", "Bronze"];

const TIER_COLOR: Record<TierLevel, string> = {
  Elite: "text-yellow-400",
  Platinum: "text-cyan-300",
  Gold: "text-amber-400",
  Silver: "text-slate-300",
  Bronze: "text-orange-400",
};

const TIER_BADGE_BG: Record<TierLevel, string> = {
  Elite: "bg-yellow-400/10 border-yellow-400/30 text-yellow-300",
  Platinum: "bg-cyan-400/10 border-cyan-400/30 text-cyan-200",
  Gold: "bg-amber-400/10 border-amber-400/30 text-amber-300",
  Silver: "bg-slate-400/10 border-slate-400/30 text-slate-200",
  Bronze: "bg-orange-400/10 border-orange-400/30 text-orange-300",
};

/** Debounce for the search box, so a request per keystroke never happens. */
const SEARCH_DEBOUNCE_MS = 300;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// =====================================================
// MAIN
// =====================================================
export default function TierListPageClient({
  rows,
  total,
  page,
  totalPages,
  pageSize,
  tierCounts,
  tierFilter,
  query,
}: {
  rows: TierUser[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  tierCounts: Record<TierLevel, number>;
  tierFilter: TierLevel | null;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [openUserId, setOpenUserId] = useState<string | null>(null);

  // The search box is local state so typing stays responsive; the URL (and so
  // the server-rendered rows) follows after the debounce.
  const [searchInput, setSearchInput] = useState(query);
  const [isPending, startTransition] = useTransition();

  /**
   * Keep the input in step when the URL changes underneath us — Back/Forward,
   * or a search term the server normalised. Adjusted during render rather than
   * in an effect: the input then never renders one frame out of date, and there
   * is no extra cascading render.
   */
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setSearchInput(query);
  }

  /**
   * Single place that owns the URL. Any filter change resets to page 1, since
   * staying on page 3 of a result set that now has one page shows an empty
   * table.
   */
  function navigate(updates: {
    page?: number;
    tier?: TierLevel | null;
    q?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.q !== undefined) {
      if (updates.q) params.set("q", updates.q);
      else params.delete("q");
    }
    if (updates.tier !== undefined) {
      if (updates.tier) params.set("tier", updates.tier);
      else params.delete("tier");
    }
    // Page 1 is the default, so it stays out of the URL.
    const nextPage = updates.page ?? 1;
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  /**
   * Real href for the pagination links, not click handlers. Keeps every page
   * a middle-clickable, shareable link, and drops `?page=1` so the first page
   * stays the clean URL.
   */
  function hrefFor(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // Debounced search -> URL.
  useEffect(() => {
    if (searchInput === query) return;
    const id = setTimeout(() => navigate({ q: searchInput }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // `navigate` is recreated every render; depending on it here would restart
    // the timer on every keystroke and the debounce would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, query]);

  // Show the previous page's rows dimmed while the next page loads, instead of
  // collapsing the table to a skeleton on every page click.
  const showSkeleton = isPending && rows.length === 0;

  const podium = rows.length > 0 ? podiumOf(page, rows) : [];

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="min-h-screen pb-24">
      {/* ============ HEADER ============ */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute -top-40 -left-40 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 right-0 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-8 md:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="mb-4 gap-1.5">
              <Crown className="w-3 h-3" />
              LEADERBOARD
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              Student <span className="text-primary">Tier List</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-lg">
              Every student ranked by the total score they have earned so far
              across all their teams and exams — sorted into tiers by their
              overall percentage.
            </p>
          </motion.div>

          {/* Tier breakdown strip — doubles as the tier filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 flex flex-wrap gap-2"
          >
            {TIER_ORDER.map((tier) => {
              const active = tierFilter === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    navigate({ tier: active ? null : tier, page: 1 })
                  }
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-md border py-1.5 px-3 transition-opacity hover:opacity-80 ${
                    active
                      ? TIER_BADGE_BG[tier]
                      : "border-border text-muted-foreground opacity-70"
                  }`}
                >
                  <Image
                    src={`/tiers/${tier.toLowerCase()}.png`}
                    alt={tier}
                    width={14}
                    height={14}
                  />
                  {tier}
                  <span className="font-bold">{tierCounts[tier]}</span>
                </button>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ============ BODY ============ */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        {/* Podium — the top of the current result set. It reads straight off
            the rows already on this page, so it can never disagree with the
            table below it. */}
        {!showSkeleton && podium.length > 0 && (
          <Podium users={podium} onOpen={setOpenUserId} />
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={tierFilter ?? "all"}
            onValueChange={(v) =>
              navigate({ tier: v === "all" ? null : (v as TierLevel), page: 1 })
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              {TIER_ORDER.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Students table */}
        <Card
          className={`overflow-hidden transition-opacity ${
            isPending ? "opacity-60" : "opacity-100"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              All Students
            </h2>
            <span className="text-xs text-muted-foreground">
              {total} {total === 1 ? "student" : "students"}
            </span>
          </div>

          {/* Loading */}
          {showSkeleton ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground mb-4" />
              <h3 className="text-sm font-semibold mb-1">No students found</h3>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                {query || tierFilter
                  ? "Try clearing filters or search"
                  : "No students have joined yet"}
              </p>
            </CardContent>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[70px]">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="w-[90px]">Teams</TableHead>
                      <TableHead className="w-[90px]">Exams</TableHead>
                      <TableHead className="w-[110px]">Score</TableHead>
                      <TableHead className="w-[90px]">%</TableHead>
                      <TableHead className="w-[130px]">Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((u) => (
                      <TableRow
                        key={u.id}
                        onClick={() => setOpenUserId(u.id)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <span className={rankColor(u.rank)}>#{u.rank}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <Avatar className="w-9 h-9">
                                <AvatarImage src={u.image ?? undefined} />
                                <AvatarFallback>
                                  {initials(u.name)}
                                </AvatarFallback>
                              </Avatar>
                              <Image
                                src={`/tiers/${u.tier.toLowerCase()}.png`}
                                alt={u.tier}
                                width={14}
                                height={14}
                                className="absolute -bottom-1 -right-1 object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {u.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {u.headline || u.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {u.teamCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {u.examCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-sm font-bold ${TIER_COLOR[u.tier]}`}
                          >
                            {u.totalScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {u.percentage}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`gap-1.5 ${TIER_BADGE_BG[u.tier]}`}
                          >
                            <Image
                              src={`/tiers/${u.tier.toLowerCase()}.png`}
                              alt={u.tier}
                              width={12}
                              height={12}
                            />
                            {u.tier}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile list */}
              <div className="md:hidden divide-y">
                {rows.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setOpenUserId(u.id)}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold w-7 shrink-0 ${rankColor(
                          u.rank
                        )}`}
                      >
                        #{u.rank}
                      </span>
                      <div className="relative shrink-0">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={u.image ?? undefined} />
                          <AvatarFallback>{initials(u.name)}</AvatarFallback>
                        </Avatar>
                        <Image
                          src={`/tiers/${u.tier.toLowerCase()}.png`}
                          alt={u.tier}
                          width={12}
                          height={12}
                          className="absolute -bottom-1 -right-1 object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {u.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {u.teamCount} teams · {u.examCount} exams
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${TIER_COLOR[u.tier]}`}>
                          {u.totalScore}
                        </p>
                        <p className={`text-[9px] ${TIER_COLOR[u.tier]}`}>
                          {u.tier} · {u.percentage}%
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex flex-col items-center gap-3 border-t px-5 py-4 md:flex-row md:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="text-foreground font-medium">{from}</span>–
                <span className="text-foreground font-medium">{to}</span> of{" "}
                <span className="text-foreground font-medium">{total}</span>
              </p>

              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href={hrefFor(page - 1)}
                      aria-disabled={page <= 1}
                      className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    />
                  </PaginationItem>

                  {getPageNumbers(page, totalPages).map((p, i) =>
                    p === "…" ? (
                      <PaginationItem key={`gap-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href={hrefFor(p)}
                          isActive={p === page}
                          aria-current={p === page ? "page" : undefined}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href={hrefFor(page + 1)}
                      aria-disabled={page >= totalPages}
                      className={
                        page >= totalPages
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>
      </section>

      {/* ============ DRAWER ============ */}
      <UserDetailDrawer
        userId={openUserId}
        onClose={() => setOpenUserId(null)}
      />
    </div>
  );
}

// =====================================================
// HELPERS
// =====================================================

/**
 * The podium is derived from the rows already on this page — no second fetch
 * for "top 3", and no possibility of the podium disagreeing with the table.
 * Only the first page can hold the top of the ranking, so later pages get none.
 */
function podiumOf(page: number, rows: TierUser[]): TierUser[] {
  if (page !== 1) return [];
  return rows.slice(0, 3);
}

function rankColor(rank: number) {
  if (rank === 1) return "font-bold text-yellow-400";
  if (rank === 2) return "font-bold text-cyan-300";
  if (rank === 3) return "font-bold text-amber-400";
  return "font-bold text-muted-foreground";
}

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

// =====================================================
// PODIUM
// =====================================================
/**
 * Visual podium: 2nd, 1st, 3rd, each on a slightly lower step.
 *
 * The step heights are `min-h`, never `h`, and the smallest one (152px) is
 * still taller than the tallest card's real content (149px). That gap is the
 * fix for the clipping bug: with a fixed `h-*` the bottom-anchored stack
 * overflowed its box, the name `<p>` was flex-shrunk to 0px, and
 * `overflow-hidden` cut the avatar in half on the shortest card.
 */
const PODIUM_SLOTS = [
  { index: 1, step: "min-h-[10.5rem]" }, // 2nd
  { index: 0, step: "min-h-[11.5rem]" }, // 1st
  { index: 2, step: "min-h-40" }, // 3rd — min-h-40 = 160px, still > content
];

function Podium({
  users,
  onOpen,
}: {
  users: TierUser[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 items-end gap-3">
      {PODIUM_SLOTS.map((slot, i) => {
        const u = users[slot.index];
        if (!u) return <div key={slot.index} className={slot.step} />;
        const color = TIER_COLOR[u.tier];

        return (
          <motion.button
            key={u.id}
            type="button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            onClick={() => onOpen(u.id)}
            aria-label={`Open details for ${u.name}`}
            className={`group relative flex min-w-0 cursor-pointer flex-col
                        items-center justify-end rounded-2xl border bg-card p-3
                        transition-colors hover:border-primary/40
                        focus-visible:border-primary/40 focus-visible:outline-none
                        ${slot.step}`}
          >
            {/* Sheen. pointer-events-none so it never eats the click. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-2xl bg-gradient-to-b from-primary/5 to-transparent"
            />

            <div className="relative mb-2 shrink-0">
              <Avatar className="w-12 h-12 rounded-xl">
                <AvatarImage src={u.image ?? undefined} />
                <AvatarFallback>{initials(u.name)}</AvatarFallback>
              </Avatar>
              <Image
                src={`/tiers/${u.tier.toLowerCase()}.png`}
                alt={u.tier}
                width={16}
                height={16}
                className="absolute -bottom-1 -right-1 object-contain"
              />
            </div>

            <p className={`shrink-0 text-xs font-bold ${color}`}>#{u.rank}</p>

            {/* min-h-8 reserves two lines so the three cards stay aligned
                whatever the name length, and line-clamp-2 stops a long name
                from pushing the score off the card. */}
            <p className="mt-0.5 min-h-8 w-full min-w-0 break-words px-0.5 text-center text-[11px] leading-4 font-semibold line-clamp-2">
              {u.name}
            </p>

            <p className={`mt-0.5 shrink-0 text-[10px] font-bold ${color}`}>
              {u.totalScore} pts
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}