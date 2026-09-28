"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Layers, Trophy, Users } from "lucide-react";
import {
  getDemandDetail,
  type DemandDetail,
} from "../actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// =====================================================
// Tier colors
// =====================================================
const TIER_COLOR: Record<string, string> = {
  Elite: "text-yellow-500",
  Platinum: "text-cyan-500",
  Gold: "text-amber-500",
  Silver: "text-slate-400",
  Bronze: "text-orange-500",
};

const TIER_BADGE: Record<string, string> = {
  Elite: "bg-yellow-500/10 border-yellow-500/30 text-yellow-500",
  Platinum: "bg-cyan-500/10 border-cyan-500/30 text-cyan-500",
  Gold: "bg-amber-500/10 border-amber-500/30 text-amber-500",
  Silver: "bg-slate-500/10 border-slate-500/30 text-slate-400",
  Bronze: "bg-orange-500/10 border-orange-500/30 text-orange-500",
};

export default function DemandDetailDrawer({
  demandId,
  onClose,
}: {
  demandId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<DemandDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!demandId) {
      setData(null);
      return;
    }
    setLoading(true);
    getDemandDetail(demandId).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [demandId]);

  const open = !!demandId;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] p-0 flex flex-col rounded-t-3xl overflow-hidden"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <SheetHeader className="px-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-3">
            {data?.iconUrl ? (
              <div className="w-12 h-12 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                <Image
                  src={data.iconUrl}
                  alt={data.name}
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl border bg-muted flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg md:text-xl leading-snug">
                {data?.name ?? "Loading..."}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {data
                  ? `${data.internshipCount} internships · ${data.totalTeams} teams`
                  : ""}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
            {loading || !data ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                {/* Description */}
                {data.description && (
                  <div>
                    <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                      About this track
                    </h3>
                    <div
                      className="rich-text text-sm text-foreground/80 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: data.description }}
                    />
                  </div>
                )}

                {/* Key skills */}
                {data.keyFeatures.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                      Key Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {data.keyFeatures.map((f) => (
                        <Badge key={f} variant="secondary">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teams table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5" />
                      Teams Ranking
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {data.teams.length} teams
                    </span>
                  </div>

                  {data.teams.length === 0 ? (
                    <Card>
                      <CardContent className="py-10 text-center">
                        <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          No teams in this category yet
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="overflow-hidden">
                      {/* Desktop table */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[70px]">Rank</TableHead>
                              <TableHead>Team</TableHead>
                              <TableHead>Internship</TableHead>
                              <TableHead className="w-[100px]">
                                Members
                              </TableHead>
                              <TableHead className="w-[80px]">Score</TableHead>
                              <TableHead className="w-[110px]">Tier</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.teams.map((t) => (
                              <TableRow key={t.id}>
                                <TableCell>
                                  <span
                                    className={`font-bold ${
                                      t.rank === 1
                                        ? "text-yellow-500"
                                        : t.rank === 2
                                        ? "text-cyan-500"
                                        : t.rank === 3
                                        ? "text-amber-500"
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
                                        width={24}
                                        height={24}
                                        className="object-contain"
                                      />
                                    </div>
                                    <span className="text-sm font-semibold truncate max-w-[180px]">
                                      {t.name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground truncate max-w-[180px] inline-block">
                                    {t.internshipName ?? "—"}
                                  </span>
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
                                    className={`${TIER_BADGE[t.tier]} text-[10px]`}
                                  >
                                    {t.tier}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile rows */}
                      <div className="md:hidden divide-y">
                        {data.teams.map((t) => (
                          <div
                            key={t.id}
                            className="px-4 py-3 flex items-center gap-3"
                          >
                            <span
                              className={`text-xs font-bold w-6 shrink-0 ${
                                t.rank === 1
                                  ? "text-yellow-500"
                                  : t.rank <= 3
                                  ? "text-cyan-500"
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
                                {t.internshipName ?? "—"} · {t.memberCount}{" "}
                                members
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
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}