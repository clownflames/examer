"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Building2,
  Crown,
  FileText,
  GraduationCap,
  MapPin,
  Users,
} from "lucide-react";

import {
  getUserTierDetail,
  type TierLevel,
  type UserTierDetail,
} from "../actions";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

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

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function UserDetailDrawer({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  // Tagged with the id it was fetched for, so a stale response can never be
  // shown for a different student.
  const [loaded, setLoaded] = useState<{
    userId: string;
    data: UserTierDetail | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getUserTierDetail(userId).then((res) => {
      if (active) setLoaded({ userId, data: res });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const data = loaded?.userId === userId ? loaded.data : null;
  const loading = !!userId && loaded?.userId !== userId;

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader className="p-6 pb-4 border-b">
          {data ? (
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <Avatar className="w-12 h-12 rounded-xl">
                  <AvatarImage src={data.image ?? undefined} />
                  <AvatarFallback>{initials(data.name)}</AvatarFallback>
                </Avatar>
                <Image
                  src={`/tiers/${data.tier.toLowerCase()}.png`}
                  alt={data.tier}
                  width={18}
                  height={18}
                  className="absolute -bottom-1 -right-1 object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg truncate">
                  {data.name}
                </SheetTitle>
                <SheetDescription className="text-xs truncate mt-0.5">
                  {data.headline || data.email}
                </SheetDescription>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-2xl font-bold ${TIER_COLOR[data.tier]}`}>
                  {data.totalScore}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Rank #{data.rank}
                </p>
              </div>
            </div>
          ) : (
            <Skeleton className="h-12 w-full" />
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {loading || !data ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <>
                {/* Tier + summary strip */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={`gap-1.5 ${TIER_BADGE_BG[data.tier]}`}
                  >
                    <Crown className="w-3 h-3" />
                    {data.tier} Tier
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    <Users className="w-3 h-3" />
                    {data.teamCount} teams
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    <FileText className="w-3 h-3" />
                    {data.examCount} exams
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    {data.percentage}% overall
                  </Badge>
                </div>

                <Separator />

                {/* Score breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Teams
                      </p>
                      <p
                        className={`text-lg font-bold ${TIER_COLOR[data.tier]}`}
                      >
                        {data.teamScore}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Exams
                      </p>
                      <p
                        className={`text-lg font-bold ${TIER_COLOR[data.tier]}`}
                      >
                        {data.examScore}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Profile bits */}
                {(data.bio || data.collegeName || data.branch || data.city) && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5" />
                      About
                    </h3>
                    {data.bio && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {data.bio}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {data.collegeName && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {data.collegeName}
                        </span>
                      )}
                      {data.branch && <span>{data.branch}</span>}
                      {data.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {data.city}
                        </span>
                      )}
                    </div>
                    {data.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {data.skills.slice(0, 12).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-[10px]">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {/* Teams */}
                <div>
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Teams ({data.teams.length})
                  </h3>
                  {data.teams.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Not in any team yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.teams.map((t) => (
                        <Card key={t.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">
                                  {t.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {t.demandName} · {t.internshipName}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p
                                  className={`text-sm font-bold ${TIER_COLOR[data.tier]}`}
                                >
                                  {t.score}
                                  <span className="text-[10px] font-normal text-muted-foreground">
                                    /{t.available}
                                  </span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {t.percentage}%
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exams */}
                <div>
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Exams ({data.exams.length})
                  </h3>
                  {data.exams.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No exam submitted yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.exams.map((e) => (
                        <Card key={e.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">
                                  {e.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {e.internshipName}
                                  {e.submittedAt && ` · ${fmtDate(e.submittedAt)}`}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p
                                  className={`text-sm font-bold ${TIER_COLOR[data.tier]}`}
                                >
                                  {e.score}
                                  <span className="text-[10px] font-normal text-muted-foreground">
                                    /{e.totalMarks}
                                  </span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {e.percentage}%
                                  {e.passed === true && (
                                    <span className="text-emerald-400"> · passed</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}