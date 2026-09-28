"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Crown,
  Loader2,
  Users,
  Target,
  Trophy,
  Award,
  User as UserIcon,
} from "lucide-react";

import {
  getTeamDetail,
  type TeamDetail,
  type TierLevel,
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

export default function TeamDetailDrawer({
  teamId,
  onClose,
}: {
  teamId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setData(null);
      return;
    }
    setLoading(true);
    getTeamDetail(teamId).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [teamId]);

  return (
    <Sheet open={!!teamId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            {data ? (
              <>
                <div className="w-12 h-12 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src={`/tiers/${data.tier.toLowerCase()}.png`}
                    alt={data.tier}
                    width={36}
                    height={36}
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg truncate">
                    {data.name}
                  </SheetTitle>
                  <SheetDescription className="text-xs flex items-center gap-2 mt-1">
                    <span>{data.demandName}</span>
                    {data.internshipName && (
                      <>
                        <span>·</span>
                        <span className="truncate">
                          {data.internshipName}
                        </span>
                      </>
                    )}
                  </SheetDescription>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-2xl font-bold ${TIER_COLOR[data.tier]}`}
                  >
                    {data.score}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Rank #{data.rank}
                  </p>
                </div>
              </>
            ) : (
              <Skeleton className="h-12 w-full" />
            )}
          </div>
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
                {/* Tier + rank strip */}
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
                    {data.memberCount} members
                  </Badge>
                  {data.internship && (
                    <Badge variant="outline" className="gap-1.5">
                      <Trophy className="w-3 h-3" />
                      Total: {data.internship.totalScore}
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Members */}
                <div>
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Members
                  </h3>
                  {data.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No members yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 p-2 rounded-lg border bg-card"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={m.image ?? undefined} />
                            <AvatarFallback>
                              {m.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {m.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {m.email}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Goals */}
                <div>
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" />
                    Goals
                  </h3>
                  {data.goals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No goals set yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.goals.map((g) => (
                        <Card key={g.id}>
                          <CardContent className="p-3 text-sm">
                            {g.text}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Final Results */}
                {data.finalResults.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-2">
                      <Award className="w-3.5 h-3.5" />
                      Final Results
                    </h3>
                    <div className="space-y-2">
                      {data.finalResults.map((r) => (
                        <Card key={r.id}>
                          <CardContent className="p-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold">
                                {r.result}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(r.createdAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )}
                              </p>
                            </div>
                            <span
                              className={`text-lg font-bold ${TIER_COLOR[data.tier]}`}
                            >
                              {r.score}
                            </span>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Examiner */}
                {data.internship?.examinerName && (
                  <div>
                    <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5" />
                      Examiner
                    </h3>
                    <Card>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={data.internship.examinerPhotoUrl ?? undefined}
                          />
                          <AvatarFallback>
                            {data.internship.examinerName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">
                            {data.internship.examinerName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Examiner for {data.internship.name}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}