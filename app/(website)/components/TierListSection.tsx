"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowRight, Crown, Trophy } from "lucide-react";

import { getUserTierList, type TierLevel, type TierUser } from "../actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const PREVIEW_COUNT = 10;

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
export default function TierListSection() {
  const [users, setUsers] = useState<TierUser[]>([]);
  const [loading, setLoading] = useState(true);

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

  const preview = useMemo(
    () => users.filter((u) => u.totalScore > 0).slice(0, PREVIEW_COUNT),
    [users]
  );

  // ---------- Loading ----------
  if (loading) {
    return (
      <section className="w-full py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-72 w-full" />
        </div>
      </section>
    );
  }

  // ---------- Empty ----------
  if (preview.length === 0) {
    return (
      <section className="w-full py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground mb-4" />
              <h3 className="text-sm font-semibold mb-1">No rankings yet</h3>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                Once students start scoring in teams and exams, leaderboards
                will appear here.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8">
        {/* ---------- HEADER ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <Badge variant="outline" className="mb-4 gap-1.5">
              <Crown className="w-3 h-3" />
              LEADERBOARD
            </Badge>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
              Top students by <span className="text-primary">skill tier</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ranked by the total score earned across all their teams and exams.
            </p>
          </div>
          <Button
            variant="outline"
            render={<Link href="/tierlist" />}
            className="gap-1.5"
          >
            View full tier list
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>

        {/* ---------- TABLE ---------- */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b">
            <CardTitle className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Leaderboard
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Top {preview.length} of {users.length}
            </span>
          </CardHeader>

          <CardContent className="p-0">
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
                    <TableHead className="w-[130px]">Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell
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
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={u.image ?? undefined} />
                              <AvatarFallback>
                                {initials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                            <Image
                              src={`/tiers/${u.tier.toLowerCase()}.png`}
                              alt={u.tier}
                              width={13}
                              height={13}
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
                      <TableCell className="text-xs text-muted-foreground">
                        {u.teamCount}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.examCount}
                      </TableCell>
                      <TableCell
                        className={`text-sm font-bold ${TIER_COLOR[u.tier]}`}
                      >
                        {u.totalScore}
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
              {preview.map((u) => (
                <div key={u.id} className="px-4 py-3">
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
                      <p className="text-xs font-semibold truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {u.teamCount} teams · {u.examCount} exams
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${TIER_COLOR[u.tier]}`}>
                        {u.totalScore}
                      </p>
                      <p className={`text-[9px] ${TIER_COLOR[u.tier]}`}>
                        {u.tier}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}