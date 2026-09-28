"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Crown,
  Search,
  Trophy,
  Users,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import {
  getDemandsWithCounts,
  getTierListTeams,
  type DemandSummary,
  type TierLevel,
  type TierListTeam,
} from "../actions";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import TeamDetailDrawer from "./TeamDetailDrawer";

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

// =====================================================
// MAIN
// =====================================================
export default function TierListPageClient() {
  const [demands, setDemands] = useState<DemandSummary[]>([]);
  const [teams, setTeams] = useState<TierListTeam[]>([]);
  const [loadingDemands, setLoadingDemands] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [activeDemand, setActiveDemand] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | TierLevel>("all");
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  // fetch demands once
  useEffect(() => {
    getDemandsWithCounts().then((res) => {
      setDemands(res);
      setLoadingDemands(false);
    });
  }, []);

  // fetch teams when demand changes
  useEffect(() => {
    setLoadingTeams(true);
    getTierListTeams(activeDemand).then((res) => {
      setTeams(res);
      setLoadingTeams(false);
    });
  }, [activeDemand]);

  // filtering
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (tierFilter !== "all" && t.tier !== tierFilter) return false;
      if (search.trim() && !t.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [teams, search, tierFilter]);

  // tier breakdown
  const tierBreakdown = useMemo(() => {
    const map: Record<TierLevel, number> = {
      Elite: 0,
      Platinum: 0,
      Gold: 0,
      Silver: 0,
      Bronze: 0,
    };
    teams.forEach((t) => (map[t.tier] += 1));
    return map;
  }, [teams]);

  // top 3 for podium
  const podium = useMemo(
    () => teams.slice(0, 3),
    [teams]
  );

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
              Skill <span className="text-primary">Tier List</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-lg">
              Top performing teams across every skill demand — ranked by score,
              sorted into tiers.
            </p>
          </motion.div>

          {/* Tier breakdown strip */}
          {teams.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-6 flex flex-wrap gap-2"
            >
              {TIER_ORDER.map((tier) => (
                <Badge
                  key={tier}
                  variant="outline"
                  className={`gap-2 py-1.5 px-3 ${TIER_BADGE_BG[tier]}`}
                >
                  <Image
                    src={`/tiers/${tier.toLowerCase()}.png`}
                    alt={tier}
                    width={14}
                    height={14}
                  />
                  {tier}
                  <span className="font-bold">{tierBreakdown[tier]}</span>
                </Badge>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ============ BODY ============ */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8">

          {/* ===== SIDEBAR: Demands ===== */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
              <button
                onClick={() => setActiveDemand(null)}
                className={`shrink-0 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    activeDemand === null
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-muted-foreground"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  All Demands
                </div>
              </button>

              {loadingDemands
                ? Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full shrink-0" />
                  ))
                : demands.map((d) => {
                    const active = d.id === activeDemand;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setActiveDemand(d.id)}
                        className={`shrink-0 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                          ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent text-muted-foreground"
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {d.iconUrl ? (
                            <Image
                              src={d.iconUrl}
                              alt={d.name}
                              width={16}
                              height={16}
                              className="rounded shrink-0"
                            />
                          ) : (
                            <Trophy className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate">{d.name}</span>
                          <span
                            className={`text-[10px] ml-auto px-1.5 py-0.5 rounded ${
                              active ? "bg-black/20" : "bg-muted"
                            }`}
                          >
                            {d.teamCount}
                          </span>
                        </div>
                      </button>
                    );
                  })}
            </div>
          </aside>

          {/* ===== MAIN ===== */}
          <main className="min-w-0 space-y-6">

            {/* Podium — top 3 */}
            {!loadingTeams && podium.length > 0 && (
              <Podium teams={podium} onOpen={setOpenTeamId} />
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search teams..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={tierFilter}
                onValueChange={(v) => setTierFilter(v as "all" | TierLevel)}
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

            {/* Teams table */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  {activeDemand
                    ? demands.find((d) => d.id === activeDemand)?.name
                    : "All Teams"}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {filteredTeams.length} teams
                </span>
              </div>

              {/* Loading */}
              {loadingTeams ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredTeams.length === 0 ? (
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Trophy className="w-8 h-8 text-muted-foreground mb-4" />
                  <h3 className="text-sm font-semibold mb-1">No teams found</h3>
                  <p className="text-xs text-muted-foreground max-w-[260px]">
                    {search || tierFilter !== "all"
                      ? "Try clearing filters or search"
                      : "No teams in this category yet"}
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
                          <TableHead>Team</TableHead>
                          <TableHead className="w-[100px]">Members</TableHead>
                          <TableHead className="w-[100px]">Score</TableHead>
                          <TableHead className="w-[120px]">Tier</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTeams.map((t, i) => (
                          <TableRow
                            key={t.id}
                            onClick={() => setOpenTeamId(t.id)}
                            className="cursor-pointer"
                          >
                            <TableCell>
                              <span
                                className={`font-bold ${
                                  t.rank === 1
                                    ? "text-yellow-400"
                                    : t.rank === 2
                                    ? "text-cyan-300"
                                    : t.rank === 3
                                    ? "text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                #{t.rank}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                  <Image
                                    src={`/tiers/${t.tier.toLowerCase()}.png`}
                                    alt={t.tier}
                                    width={26}
                                    height={26}
                                    className="object-contain"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    {t.name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {t.demandName}
                                    {t.internshipName && ` · ${t.internshipName}`}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {t.memberCount}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-sm font-bold ${TIER_COLOR[t.tier]}`}
                              >
                                {t.score}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`gap-1.5 ${TIER_BADGE_BG[t.tier]}`}
                              >
                                <Image
                                  src={`/tiers/${t.tier.toLowerCase()}.png`}
                                  alt={t.tier}
                                  width={12}
                                  height={12}
                                />
                                {t.tier}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile list */}
                  <div className="md:hidden divide-y">
                    {filteredTeams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setOpenTeamId(t.id)}
                        className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-bold w-6 shrink-0 ${
                              t.rank === 1
                                ? "text-yellow-400"
                                : t.rank <= 3
                                ? "text-cyan-300"
                                : "text-muted-foreground"
                            }`}
                          >
                            #{t.rank}
                          </span>
                          <div className="w-8 h-8 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            <Image
                              src={`/tiers/${t.tier.toLowerCase()}.png`}
                              alt={t.tier}
                              width={22}
                              height={22}
                              className="object-contain"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {t.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {t.demandName} · {t.memberCount} members
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`text-sm font-bold ${TIER_COLOR[t.tier]}`}
                            >
                              {t.score}
                            </p>
                            <p
                              className={`text-[9px] ${TIER_COLOR[t.tier]}`}
                            >
                              {t.tier}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </main>
        </div>
      </section>

      {/* ============ DRAWER ============ */}
      <TeamDetailDrawer
        teamId={openTeamId}
        onClose={() => setOpenTeamId(null)}
      />
    </div>
  );
}

// =====================================================
// PODIUM
// =====================================================
function Podium({
  teams,
  onOpen,
}: {
  teams: TierListTeam[];
  onOpen: (id: string) => void;
}) {
  // reorder: 2nd, 1st, 3rd (visual podium)
  const order = [1, 0, 2];
  const heights = ["h-24", "h-32", "h-20"];

  return (
    <div className="grid grid-cols-3 gap-3">
      {order.map((idx, i) => {
        const t = teams[idx];
        if (!t) return <div key={i} />;
        const color = TIER_COLOR[t.tier];

        return (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            onClick={() => onOpen(t.id)}
            className={`relative flex flex-col items-center justify-end ${heights[i]} 
                        rounded-2xl border bg-card hover:border-primary/40 
                        transition-colors overflow-hidden p-3`}
          >
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/5 to-transparent" />

            <div className="relative w-12 h-12 rounded-xl border bg-muted flex items-center justify-center overflow-hidden mb-2">
              <Image
                src={`/tiers/${t.tier.toLowerCase()}.png`}
                alt={t.tier}
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <p className={`text-xs font-bold ${color}`}>#{t.rank}</p>
            <p className="text-[11px] font-semibold truncate w-full text-center mt-0.5">
              {t.name}
            </p>
            <p className={`text-[10px] font-bold ${color} mt-0.5`}>{t.score}</p>
          </motion.button>
        );
      })}
    </div>
  );
}