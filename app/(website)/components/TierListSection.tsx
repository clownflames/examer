"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Crown, ChevronDown, Loader2, Trophy, Users } from "lucide-react";

import {
  getTierList,
  type TierGroup,
  type TierLevel,
  type TierTeam,
} from "../actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// =====================================================
// TIER STYLES (bas color tokens — koi custom styling nahi)
// =====================================================
const TIER_COLOR: Record<TierLevel, string> = {
  Elite: "text-yellow-400",
  Platinum: "text-cyan-300",
  Gold: "text-amber-400",
  Silver: "text-slate-300",
  Bronze: "text-orange-400",
};

// =====================================================
// MAIN
// =====================================================
export default function TierListSection() {
  const [groups, setGroups] = useState<TierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showAllTabs, setShowAllTabs] = useState(false);

  useEffect(() => {
    let mounted = true;
    getTierList().then((res) => {
      if (mounted) {
        setGroups(res);
        if (res.length > 0) setActiveTab(res[0].demandId);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeGroup = useMemo(
    () => groups.find((g) => g.demandId === activeTab) ?? null,
    [groups, activeTab]
  );

  useEffect(() => {
    if (activeGroup && activeGroup.teams.length > 0) {
      setSelectedTeamId(activeGroup.teams[0].id);
    } else {
      setSelectedTeamId(null);
    }
  }, [activeGroup]);

  const visibleTabs = showAllTabs ? groups : groups.slice(0, 5);
  const hasMoreTabs = groups.length > 5;

  // ---------- Loading ----------
  if (loading) {
    return (
      <section className="w-full py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </section>
    );
  }

  // ---------- Empty ----------
  if (groups.length === 0) {
    return (
      <section className="w-full py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground mb-4" />
              <h3 className="text-sm font-semibold mb-1">No rankings yet</h3>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                Once teams start scoring, leaderboards will appear here.
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
        >
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Crown className="w-3 h-3" />
            LEADERBOARD
          </Badge>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
            Top teams by <span className="text-primary">skill tier</span>
          </h2>
        </motion.div>

        {/* ---------- TABS ---------- */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList className="flex-wrap h-auto">
              {visibleTabs.map((g) => (
                <TabsTrigger key={g.demandId} value={g.demandId}>
                  {g.demandName}
                </TabsTrigger>
              ))}
            </TabsList>

            {hasMoreTabs && !showAllTabs && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllTabs(true)}
              >
                View More
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </Tabs>

        {/* ---------- SPLIT LAYOUT ---------- */}
        {activeGroup && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

            {/* LEFT — Team cards */}
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
              {activeGroup.teams.length === 0 ? (
                <Card className="w-full">
                  <CardContent className="py-10 text-center">
                    <p className="text-xs text-muted-foreground">
                      No teams in this category yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                activeGroup.teams.map((team, i) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    index={i}
                    active={team.id === selectedTeamId}
                    onClick={() => setSelectedTeamId(team.id)}
                  />
                ))
              )}
            </div>

            {/* RIGHT — Detail table */}
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between space-y-0 border-b">
                <CardTitle className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  {activeGroup.demandName}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {activeGroup.teams.length} teams
                </span>
              </CardHeader>

              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Tier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeGroup.teams.map((t, i) => (
                        <TeamRow
                          key={t.id}
                          team={t}
                          index={i}
                          active={t.id === selectedTeamId}
                          onClick={() => setSelectedTeamId(t.id)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile list */}
                <div className="md:hidden divide-y">
                  {activeGroup.teams.map((t, i) => (
                    <MobileRow
                      key={t.id}
                      team={t}
                      index={i}
                      active={t.id === selectedTeamId}
                      onClick={() => setSelectedTeamId(t.id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

// =====================================================
// TEAM CARD
// =====================================================
function TeamCard({
  team,
  index,
  active,
  onClick,
}: {
  team: TierTeam;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const color = TIER_COLOR[team.tier];
  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      onClick={onClick}
      className={`shrink-0 w-[240px] lg:w-full text-left rounded-xl border transition-colors
        ${active ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
    >
      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              <Image
                src={`/tiers/${team.tier.toLowerCase()}.png`}
                alt={team.tier}
                width={36}
                height={36}
                className="object-contain"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`text-[10px] font-bold ${color}`}>
                  #{team.rank}
                </span>
                <Badge variant="outline" className={`text-[10px] ${color}`}>
                  {team.tier}
                </Badge>
              </div>
              <h4 className="text-sm font-semibold truncate">{team.name}</h4>
              <p className="text-[10px] text-muted-foreground truncate">
                {team.internshipName}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Score</span>
            <span className={`font-bold ${color}`}>{team.score}</span>
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}

// =====================================================
// TEAM ROW (desktop)
// =====================================================
function TeamRow({
  team,
  index,
  active,
  onClick,
}: {
  team: TierTeam;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const color = TIER_COLOR[team.tier];
  return (
    <TableRow
      onClick={onClick}
      data-state={active ? "selected" : undefined}
      className="cursor-pointer"
    >
      <TableCell className="font-bold">#{team.rank}</TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            <Image
              src={`/tiers/${team.tier.toLowerCase()}.png`}
              alt={team.tier}
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <span className="text-sm font-semibold truncate max-w-[180px]">
            {team.name}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="w-3 h-3" />
          {team.memberCount}
        </span>
      </TableCell>
      <TableCell className={`font-bold ${color}`}>{team.score}</TableCell>
      <TableCell>
        <Badge variant="outline" className={color}>
          {team.tier}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

// =====================================================
// MOBILE ROW
// =====================================================
function MobileRow({
  team,
  index,
  active,
  onClick,
}: {
  team: TierTeam;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const color = TIER_COLOR[team.tier];
  return (
    <button
      onClick={onClick}
      data-state={active ? "selected" : undefined}
      className="w-full text-left px-4 py-3 transition-colors hover:bg-accent data-[state=selected]:bg-accent"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold w-6 shrink-0">#{team.rank}</span>
        <div className="w-8 h-8 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          <Image
            src={`/tiers/${team.tier.toLowerCase()}.png`}
            alt={team.tier}
            width={22}
            height={22}
            className="object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{team.name}</p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            {team.memberCount} · {team.internshipName}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${color}`}>{team.score}</p>
          <p className={`text-[9px] ${color}`}>{team.tier}</p>
        </div>
      </div>
    </button>
  );
}