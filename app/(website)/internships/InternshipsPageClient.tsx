"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { FaWhatsapp } from "react-icons/fa";
import {
  Briefcase,
  Search,
  Clock,
  TrendingUp,
  Trophy,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

import {
  getAllInternships,
  getDemandFilters,
  type InternshipCard,
  type DemandFilter,
  type SortOption,
} from "./actions";
import { useSession } from "@/lib/auth-client";
import ApplyDrawer from "../components/ApplyDrawer";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// =====================================================
// HELPERS
// =====================================================
function formatDuration(start: Date | null, end: Date | null) {
  if (!start || !end) return "—";
  const months = Math.max(
    1,
    Math.round(
      (+new Date(end) - +new Date(start)) / (1000 * 60 * 60 * 24 * 30)
    )
  );
  return `${months} mo`;
}

function formatPrice(price: string | null) {
  if (!price) return "Unpaid";
  const n = Number(price);
  if (isNaN(n) || n === 0) return "Unpaid";
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function deadlineInfo(days: number | null) {
  if (days === null) return { label: "—", variant: "outline" as const };
  if (days < 0) return { label: "Closed", variant: "outline" as const };
  if (days === 0) return { label: "Today", variant: "destructive" as const };
  if (days <= 7)
    return { label: `${days}d left`, variant: "destructive" as const };
  if (days <= 30)
    return { label: `${days}d left`, variant: "secondary" as const };
  return { label: `${days}d left`, variant: "outline" as const };
}

// =====================================================
// PRICE CELL — reusable
// =====================================================
function PriceCell({
  sellingPrice,
  price,
  size = "sm",
}: {
  sellingPrice: string | null;
  price: string | null;
  size?: "sm" | "xs";
}) {
  const hasSelling = sellingPrice && Number(sellingPrice) > 0;
  const hasDiscount =
    price &&
    sellingPrice &&
    Number(price) > Number(sellingPrice);

  if (!hasSelling) {
    return (
      <span
        className={cn(
          "text-muted-foreground",
          size === "sm" ? "text-xs" : "text-[11px]"
        )}
      >
        Unpaid
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        className={cn(
          "font-bold text-emerald-500",
          size === "sm" ? "text-xs" : "text-[11px]"
        )}
      >
        {formatPrice(sellingPrice)}
      </span>
      {hasDiscount && (
        <span
          className={cn(
            "text-muted-foreground line-through",
            size === "sm" ? "text-[11px]" : "text-[10px]"
          )}
        >
          {formatPrice(price)}
        </span>
      )}
    </div>
  );
}

// =====================================================
// MAIN
// =====================================================
export default function InternshipsPageClient() {
  const { data: session, isPending: sessionLoading } = useSession();
  const isLoggedIn = !!session?.user;

  const [data, setData] = useState<InternshipCard[]>([]);
  const [demands, setDemands] = useState<DemandFilter[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loadingDemands, setLoadingDemands] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeDemand, setActiveDemand] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("newest");
  // /internships?pay=<id> — the payment reminder sends people straight to the
  // right internship. Read it as the initial value so there is no effect and
  // no extra render, and strip it from the URL on mount so a refresh does not
  // yank the drawer open again.
  const [openId, setOpenId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("pay");
  });

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("pay")) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("pay");
    window.history.replaceState({}, "", url);
  }, []);

  useEffect(() => {
    getDemandFilters().then((res) => {
      setDemands(res);
      setLoadingDemands(false);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await getAllInternships({
        demandId: activeDemand,
        search: debouncedSearch,
        sort,
      });
      setData(res);
      setHasLoaded(true);
    });
  }, [activeDemand, debouncedSearch, sort]);

  useEffect(() => {
    if (sessionLoading) return;
    load();
  }, [sessionLoading, session?.user?.id, load]);

  // Skeleton only while there is genuinely nothing to show yet.
  const loading = sessionLoading || isPending || !hasLoaded;

  const selected = useMemo(
    () => data.find((d) => d.id === openId) ?? null,
    [data, openId]
  );

  // What this person is already in. Each entry only carries its WhatsApp link
  // because the server resolved them as registered for it.
  const myRegistrations = useMemo(
    () => data.filter((d) => d.isRegistered),
    [data]
  );

  return (
    <div className="min-h-screen pb-24">
      {/* ============ HEADER ============ */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute -top-40 -left-40 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-8 md:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="mb-4 gap-1.5">
              <Briefcase className="w-3 h-3" />
              OPPORTUNITIES
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              All <span className="text-primary">Internships</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-lg">
              Browse every open role across all skill demands — filter by
              category, deadline, or stipend.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 max-w-xl"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search internships by name, description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ MY REGISTRATIONS ============ */}
      {/* Stays hidden until there is something to show, so a visitor who
          registered for nothing never sees an empty panel. */}
      {!loading && myRegistrations.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold tracking-tight">
              Your internships
            </h2>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            >
              {myRegistrations.length}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myRegistrations.map((item) => (
              <button
                key={item.id}
                onClick={() => setOpenId(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card p-4 text-left",
                  "transition-colors hover:border-primary/40"
                )}
              >
                {item.demandIconUrl ? (
                  <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    <Image
                      src={item.demandIconUrl}
                      alt={item.demandName ?? ""}
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {item.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Registered
                  </p>
                </div>

                {item.whatsappGroupLink && (
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(item.whatsappGroupLink!, "_blank", "noopener");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        window.open(
                          item.whatsappGroupLink!,
                          "_blank",
                          "noopener"
                        );
                      }
                    }}
                    title="Join WhatsApp group"
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      "bg-emerald-500/15 transition-colors hover:bg-emerald-500/25",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    )}
                  >
                    <FaWhatsapp className="h-4 w-4 text-emerald-500" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ============ DEMAND CHIPS ============ */}
      <section className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2">
              <Button
                variant={activeDemand === null ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveDemand(null)}
                className="shrink-0"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                All
              </Button>

              {loadingDemands
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-28 shrink-0" />
                  ))
                : demands.map((d) => {
                    const active = d.id === activeDemand;
                    return (
                      <Button
                        key={d.id}
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveDemand(active ? null : d.id)}
                        className="shrink-0 gap-2"
                      >
                        {d.iconUrl && (
                          <Image
                            src={d.iconUrl}
                            alt={d.name}
                            width={14}
                            height={14}
                            className="rounded"
                          />
                        )}
                        {d.name}
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded",
                            active ? "bg-black/20" : "bg-muted"
                          )}
                        >
                          {d.count}
                        </span>
                      </Button>
                    );
                  })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </section>

      {/* ============ TOOLBAR ============ */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* A <p> cannot hold <Skeleton>, which renders a <div>. The
              browser would close the <p> early and hydration would mismatch,
              so this is a <div> with the same classes. */}
          <div className="text-sm text-muted-foreground">
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <>
                <span className="font-semibold text-foreground">
                  {data.length}
                </span>{" "}
                internships found
              </>
            )}
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="deadline">Closing soon</SelectItem>
              <SelectItem value="price">Highest price</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ============ TABLE ============ */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {activeDemand
                ? demands.find((d) => d.id === activeDemand)?.name
                : "All Internships"}
            </h2>
            <span className="text-xs text-muted-foreground">
              {loading ? "..." : `${data.length} roles`}
            </span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold mb-1">
                No internships found
              </h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                {search || activeDemand
                  ? "Try clearing filters or search query"
                  : "Check back soon — new roles drop weekly"}
              </p>
            </CardContent>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Demand</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item) => (
                      <TableRow
                        key={item.id}
                        onClick={() => setOpenId(item.id)}
                        className={cn(
                          "cursor-pointer",
                          (item.daysLeft ?? 1) < 0 && "opacity-60"
                        )}
                      >
                        {/* Role */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.demandIconUrl ? (
                              <div className="w-9 h-9 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                <Image
                                  src={item.demandIconUrl}
                                  alt={item.demandName ?? ""}
                                  width={24}
                                  height={24}
                                  className="object-contain"
                                />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                                <Briefcase className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate max-w-[200px]">
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Demand */}
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.demandName ?? "General"}
                          </Badge>
                        </TableCell>

                        {/* Duration */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(item.startDate, item.endDate)}
                          </span>
                        </TableCell>

                        {/* Price with discount */}
                        <TableCell>
                          <PriceCell
                            sellingPrice={item.sellingPrice}
                            price={item.price}
                          />
                        </TableCell>

                        {/* Score */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {item.totalScore}
                          </span>
                        </TableCell>

                        {/* Deadline */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs">
                              {formatDate(item.lastSubmissionDate)}
                            </span>
                            {(() => {
                              const dl = deadlineInfo(item.daysLeft);
                              return (
                                <Badge
                                  variant={dl.variant}
                                  className="text-[9px] mt-0.5 w-fit"
                                >
                                  {dl.label}
                                </Badge>
                              );
                            })()}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-right">
                          {item.isRegistered ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Applied
                            </Badge>
                          ) : (item.daysLeft ?? 1) < 0 ? (
                            <Badge variant="outline">Closed</Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              Open
                              <ArrowUpRight className="w-3 h-3" />
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile rows */}
              <div className="md:hidden divide-y">
                {data.map((item) => {
                  const dl = deadlineInfo(item.daysLeft);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setOpenId(item.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-accent transition-colors",
                        (item.daysLeft ?? 1) < 0 && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {item.demandIconUrl ? (
                          <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            <Image
                              src={item.demandIconUrl}
                              alt={item.demandName ?? ""}
                              width={24}
                              height={24}
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate mb-1.5">
                            {item.demandName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <PriceCell
                              sellingPrice={item.sellingPrice}
                              price={item.price}
                              size="xs"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              · {formatDuration(item.startDate, item.endDate)}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {item.isRegistered ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Applied
                            </Badge>
                          ) : (item.daysLeft ?? 1) < 0 ? (
                            <Badge variant="outline" className="text-[10px]">
                              Closed
                            </Badge>
                          ) : (
                            <Badge
                              variant={dl.variant}
                              className="text-[10px]"
                            >
                              {dl.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ============ DRAWER ============ */}
      <ApplyDrawer
        open={!!selected}
        onClose={() => setOpenId(null)}
        internship={
          selected
            ? {
                id: selected.id,
                name: selected.name,
                demandName: selected.demandName,
                demandIconUrl: selected.demandIconUrl,
                description: selected.description,
                jdUrl: selected.jdUrl,
                startDate: selected.startDate,
                endDate: selected.endDate,
                lastSubmissionDate: selected.lastSubmissionDate,
                sellingPrice: selected.sellingPrice,
                price: selected.price,
                totalScore: selected.totalScore,
                examinerName: selected.examinerName,
                examinerPhotoUrl: selected.examinerPhotoUrl,
                whatsappGroupLink: selected.whatsappGroupLink,
              }
            : null
        }
        isLoggedIn={isLoggedIn}
        onPaid={load}
      />
    </div>
  );
}