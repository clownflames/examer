"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Crown, Search, Trophy, Users } from "lucide-react";

import { getUserTierList, type TierLevel, type TierUser } from "../actions";

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// =====================================================
// MAIN
// =====================================================
export default function TierListPageClient() {
  const [users, setUsers] = useState<TierUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | TierLevel>("all");
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getUserTierList().then((res) => {
      if (mounted) {
        setUsers(res);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // filtering
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (tierFilter !== "all" && u.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.headline ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, tierFilter]);

  // tier breakdown
  const tierBreakdown = useMemo(() => {
    const map: Record<TierLevel, number> = {
      Elite: 0,
      Platinum: 0,
      Gold: 0,
      Silver: 0,
      Bronze: 0,
    };
    users.forEach((u) => (map[u.tier] += 1));
    return map;
  }, [users]);

  // top 3 for podium
  const podium = useMemo(() => users.slice(0, 3), [users]);

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

          {/* Tier breakdown strip */}
          {users.length > 0 && (
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
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        {/* Podium — top 3 */}
        {!loading && podium.length > 0 && (
          <Podium users={podium} onOpen={setOpenUserId} />
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
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

        {/* Students table */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              All Students
            </h2>
            <span className="text-xs text-muted-foreground">
              {filteredUsers.length} students
            </span>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground mb-4" />
              <h3 className="text-sm font-semibold mb-1">No students found</h3>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                {search || tierFilter !== "all"
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
                    {filteredUsers.map((u) => (
                      <TableRow
                        key={u.id}
                        onClick={() => setOpenUserId(u.id)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <span
                            className={`font-bold ${
                              u.rank === 1
                                ? "text-yellow-400"
                                : u.rank === 2
                                ? "text-cyan-300"
                                : u.rank === 3
                                ? "text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            #{u.rank}
                          </span>
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
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setOpenUserId(u.id)}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold w-7 shrink-0 ${
                          u.rank === 1
                            ? "text-yellow-400"
                            : u.rank <= 3
                            ? "text-cyan-300"
                            : "text-muted-foreground"
                        }`}
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
// PODIUM
// =====================================================
function Podium({
  users,
  onOpen,
}: {
  users: TierUser[];
  onOpen: (id: string) => void;
}) {
  // reorder: 2nd, 1st, 3rd (visual podium)
  const order = [1, 0, 2];
  const heights = ["h-28", "h-36", "h-24"];

  return (
    <div className="grid grid-cols-3 gap-3">
      {order.map((idx, i) => {
        const u = users[idx];
        if (!u) return <div key={i} />;
        const color = TIER_COLOR[u.tier];

        return (
          <motion.button
            key={u.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            onClick={() => onOpen(u.id)}
            className={`relative flex flex-col items-center justify-end ${heights[i]}
                        rounded-2xl border bg-card hover:border-primary/40
                        transition-colors overflow-hidden p-3`}
          >
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/5 to-transparent" />

            <div className="relative mb-2">
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
            <p className={`text-xs font-bold ${color}`}>#{u.rank}</p>
            <p className="text-[11px] font-semibold truncate w-full text-center mt-0.5">
              {u.name}
            </p>
            <p className={`text-[10px] font-bold ${color} mt-0.5`}>
              {u.totalScore} pts
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}