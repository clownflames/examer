"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import TeamsSidebar from "./TeamsSidebar";
import InboxChat from "./InboxChat";
import {
  getTeamHeader,
  getTeamMembers,
  getInitialMessages,
} from "./actions";
import type {
  TeamHeader,
  TeamMemberSummary,
  TeamMessage,
  MessageCursor,
  UserTeam,
} from "./constants";

export default function InboxPageClient({
  teams,
  currentUser,
}: {
  teams: UserTeam[];
  currentUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: "user" | "admin";
  };
}) {
  const [activeTeamId, setActiveTeamId] = useState<string | null>(
    teams[0]?.id ?? null
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [header, setHeader] = useState<TeamHeader | null>(null);
  const [members, setMembers] = useState<TeamMemberSummary[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [cursor, setCursor] = useState<MessageCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeTeamId) {
      setHeader(null);
      setMembers([]);
      setMessages([]);
      return;
    }

    setLoading(true);
    Promise.all([
      getTeamHeader(activeTeamId),
      getTeamMembers(activeTeamId),
      getInitialMessages(activeTeamId),
    ]).then(([h, m, msg]) => {
      setHeader(h);
      setMembers(m);
      setMessages(msg.messages);
      setCursor(msg.nextCursor);
      setHasMore(msg.hasMore);
      setLoading(false);
    });
  }, [activeTeamId]);

  // Empty state — user has no teams
  if (teams.length === 0) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4">
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No conversations yet</h2>
          <p className="text-sm text-muted-foreground">
            Once you join a team, your conversations will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-5rem)] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[300px] border-r bg-muted/20">
        <div className="px-4 py-3 border-b shrink-0">
          <h2 className="text-sm font-semibold">Your Teams</h2>
          <p className="text-xs text-muted-foreground">
            {teams.length} {teams.length === 1 ? "conversation" : "conversations"}
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <TeamsSidebar
            teams={teams}
            activeTeamId={activeTeamId}
            onSelect={setActiveTeamId}
          />
        </div>
      </aside>

      {/* Mobile sidebar as sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm">Your Teams</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 h-[calc(100%-3rem)]">
            <TeamsSidebar
              teams={teams}
              activeTeamId={activeTeamId}
              onSelect={(id) => {
                setActiveTeamId(id);
                setSidebarOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Chat area */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {loading || !header ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-muted-foreground">Loading chat...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={header.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <InboxChat
                header={header}
                initialMessages={messages}
                initialCursor={cursor}
                initialHasMore={hasMore}
                members={members}
                currentUser={currentUser}
                onOpenSidebar={() => setSidebarOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}