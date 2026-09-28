"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MessageSquare, Trophy, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UserTeam } from "./constants";

export default function TeamsSidebar({
  teams,
  activeTeamId,
  onSelect,
}: {
  teams: UserTeam[];
  activeTeamId: string | null;
  onSelect: (id: string) => void;
}) {
  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold mb-1">No teams yet</h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Join an internship to get added to a team and start chatting.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-2">
        {teams.map((t, i) => {
          const active = t.id === activeTeamId;
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              onClick={() => onSelect(t.id)}
              className={cn(
                "w-full text-left rounded-lg p-3 transition-colors",
                "hover:bg-accent",
                active && "bg-accent border border-primary/30"
              )}
            >
              <div className="flex items-start gap-3">
                {t.iconUrl ? (
                  <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    <Image
                      src={t.iconUrl}
                      alt={t.demandName}
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h4 className="text-sm font-semibold truncate">
                      {t.name}
                    </h4>
                    {t.unreadCount > 0 && (
                      <Badge
                        variant="default"
                        className="h-4 px-1.5 text-[9px] shrink-0"
                      >
                        {t.unreadCount}
                      </Badge>
                    )}
                  </div>

                  {t.lastMessagePreview ? (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t.lastMessagePreview}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic truncate">
                      No messages yet
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Users className="w-2.5 h-2.5" />
                      {t.memberCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Trophy className="w-2.5 h-2.5" />
                      {t.score}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </ScrollArea>
  );
}