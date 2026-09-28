"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Code2,
  Loader2,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Send,
  Trash2,
  Users,
  Menu,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RichTextEditor from "@/components/rich-text-editor";
import { CodeEditor } from "@/components/code-editor";
import { cn } from "@/lib/utils";
import {
  sendMessage,
  deleteMessage,
  getOlderMessages,
  refreshMessages,
} from "./actions";
import type {
  TeamMessage,
  TeamMemberSummary,
  TeamHeader,
  MessageKind,
  MessageCursor,
} from "./constants";

// =====================================================
// Helpers
// =====================================================
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

const composerSchema = z.object({
  text: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
});
type ComposerValues = z.infer<typeof composerSchema>;

// =====================================================
// Main
// =====================================================
export default function InboxChat({
  header,
  initialMessages,
  initialCursor,
  initialHasMore,
  members,
  currentUser,
  onOpenSidebar,
}: {
  header: TeamHeader;
  initialMessages: TeamMessage[];
  initialCursor: MessageCursor;
  initialHasMore: boolean;
  members: TeamMemberSummary[];
  currentUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: "user" | "admin";
  };
  onOpenSidebar?: () => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<TeamMessage[]>(initialMessages);
  const [cursor, setCursor] = React.useState<MessageCursor>(initialCursor);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [kind, setKind] = React.useState<MessageKind>("text");
  const [codeLang, setCodeLang] = React.useState("javascript");
  const [submitting, setSubmitting] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = React.useRef(0);
  const shouldRestoreScrollRef = React.useRef(false);

  const form = useForm<ComposerValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: { text: "", code: "", codeLanguage: "javascript" },
  });

  // Scroll to bottom on mount
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  // Restore scroll after prepending older messages
  React.useLayoutEffect(() => {
    if (!shouldRestoreScrollRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const prevHeight = prevScrollHeightRef.current;
    const newHeight = el.scrollHeight;
    el.scrollTop = newHeight - prevHeight;
    shouldRestoreScrollRef.current = false;
  }, [messages]);

  // Sync when team changes
  React.useEffect(() => {
    setMessages(initialMessages);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, [initialMessages, initialCursor, initialHasMore, header.id]);

  async function handleLoadMore() {
    if (!cursor || !hasMore || loadingMore) return;
    setLoadingMore(true);

    const el = scrollRef.current;
    prevScrollHeightRef.current = el?.scrollHeight ?? 0;
    shouldRestoreScrollRef.current = true;

    const result = await getOlderMessages(header.id, cursor);
    setMessages((prev) => [...result.messages, ...prev]);
    setCursor(result.nextCursor);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);

    const latest = messages[messages.length - 1];
    const after = latest?.createdAt ?? new Date(0).toISOString();
    const newMsgs = await refreshMessages(header.id, after);

    if (newMsgs.length > 0) {
      // dedupe by id
      const existing = new Set(messages.map((m) => m.id));
      const unique = newMsgs.filter((m) => !existing.has(m.id));
      if (unique.length > 0) {
        setMessages((prev) => [...prev, ...unique]);
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({
            block: "end",
            behavior: "smooth",
          });
        });
        toast.success(
          unique.length === 1
            ? "1 new message"
            : `${unique.length} new messages`
        );
      } else {
        toast.info("Already up to date");
      }
    } else {
      toast.info("Already up to date");
    }

    setRefreshing(false);
  }

  async function handleSend() {
    const values = form.getValues();

    if (kind === "text") {
      if (stripHtml(values.text ?? "").length === 0) {
        toast.error("Message cannot be empty.");
        return;
      }
    } else {
      if (!values.code || values.code.trim().length === 0) {
        toast.error("Code cannot be empty.");
        return;
      }
    }

    setSubmitting(true);
    const result = await sendMessage(header.id, {
      kind,
      text: kind === "text" ? (values.text ?? null) : null,
      code: kind === "code" ? (values.code ?? null) : null,
      codeLanguage: kind === "code" ? codeLang : null,
    });
    setSubmitting(false);

    if (result.success) {
      form.reset({ text: "", code: "", codeLanguage: codeLang });
      // optimistically re-fetch to include own message
      const after = messages[messages.length - 1]?.createdAt ?? new Date(0).toISOString();
      const newMsgs = await refreshMessages(header.id, after);
      const existing = new Set(messages.map((m) => m.id));
      const unique = newMsgs.filter((m) => !existing.has(m.id));
      setMessages((prev) => [...prev, ...unique]);
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      });
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to send.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-start gap-3 border-b px-4 md:px-6 py-3">
        {onOpenSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={onOpenSidebar}
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-1 flex-col min-w-0">
          <h2 className="text-lg md:text-xl font-semibold tracking-tight truncate">
            {header.name}
          </h2>
          <p className="text-muted-foreground text-xs md:text-sm truncate">
            {header.internshipName} · {header.demandName} · {header.memberCount}{" "}
            {header.memberCount === 1 ? "member" : "members"} · Score{" "}
            {header.score}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="shrink-0"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Main grid */}
      <div className="grid min-h-0 flex-1 gap-4 p-3 md:p-4 lg:grid-cols-[1fr_280px]">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="min-h-0 overflow-y-auto rounded-lg border bg-background p-3"
        >
          {hasMore && (
            <div className="flex justify-center pb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load older messages"
                )}
              </Button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No messages yet. Start the conversation.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <MessageCard
                  key={m.id}
                  message={m}
                  teamId={header.id}
                  isOwn={m.userId === currentUser.id}
                  canDelete={
                    m.userId === currentUser.id || currentUser.role === "admin"
                  }
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Members panel */}
        <aside className="hidden min-h-0 overflow-y-auto lg:block">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                Team Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {members.length === 0 ? (
                <p className="text-muted-foreground text-xs">No members yet.</p>
              ) : (
                members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {m.image ? (
                        <AvatarImage src={m.image} alt={m.name} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {m.name}
                        </span>
                        {m.isAdmin && (
                          <Badge className="h-4 px-1 text-[9px] font-medium">
                            ADMIN
                          </Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground truncate text-xs">
                        {m.email}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t bg-background p-3 md:p-4">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <Tabs value={kind} onValueChange={(v) => setKind(v as MessageKind)}>
              <TabsList className="h-8">
                <TabsTrigger value="text" className="gap-1 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-1 text-xs">
                  <Code2 className="h-3.5 w-3.5" />
                  Code
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {kind === "code" && (
              <Select
                value={codeLang}
                onValueChange={(v) => {
                  setCodeLang(v ?? "javascript");
                  form.setValue("codeLanguage", v);
                }}
              >
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="c">C</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                  <SelectItem value="rust">Rust</SelectItem>
                  <SelectItem value="sql">SQL</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="css">CSS</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {kind === "text" ? (
            <Controller
              name="text"
              control={form.control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  minHeight="80px"
                  placeholder="Write a message to the team…"
                />
              )}
            />
          ) : (
            <Controller
              name="code"
              control={form.control}
              render={({ field }) => (
                <CodeEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  language={codeLang}
                  height="180px"
                />
              )}
            />
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSend} disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Message card
// =====================================================
function MessageCard({
  message,
  teamId,
  isOwn,
  canDelete,
}: {
  message: TeamMessage;
  teamId: string;
  isOwn: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteMessage(message.id, teamId);
    setDeleting(false);

    if (result.success) {
      toast.success("Message deleted.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete.");
    }
  }

  const isCode = message.code != null && message.text == null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        isOwn && "border-primary/20 bg-primary/[0.02]"
      )}
    >
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          {message.authorImage ? (
            <AvatarImage src={message.authorImage} alt={message.authorName} />
          ) : null}
          <AvatarFallback className="text-xs">
            {getInitials(message.authorName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {message.authorName}
              </span>
              {message.byAdmin && (
                <Badge className="h-5 px-1.5 text-[10px] font-medium">
                  ADMIN
                </Badge>
              )}
              {isOwn && (
                <span className="text-muted-foreground text-xs">You</span>
              )}
              <span className="text-muted-foreground text-xs">
                ·{" "}
                {formatDistanceToNow(new Date(message.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {message.isEdited && (
                <span className="text-muted-foreground text-xs">(edited)</span>
              )}
            </div>

            {canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label="Message actions"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete this message?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleting}
                        >
                          {deleting ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {isCode ? (
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted text-muted-foreground flex items-center gap-2 border-b px-3 py-1.5 text-xs">
                <Code2 className="h-3.5 w-3.5" />
                <span className="font-mono uppercase">
                  {message.codeLanguage || "code"}
                </span>
              </div>
              <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
                <code>{message.code}</code>
              </pre>
            </div>
          ) : (
            <div
                  className="rich-text prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: message.text ?? "" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}