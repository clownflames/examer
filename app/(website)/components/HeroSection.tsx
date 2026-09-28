"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowUpRight, Sparkles, Loader2, Inbox } from "lucide-react";
import { getInternships, type InternshipListItem } from "../actions";
import ApplyDrawer from "./ApplyDrawer";
import { useSession } from "@/lib/auth-client";

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
// HELPERS
// =====================================================
function formatDuration(start: Date | null, end: Date | null) {
  if (!start || !end) return "—";
  const months = Math.max(
    1,
    Math.round((+new Date(end) - +new Date(start)) / (1000 * 60 * 60 * 24 * 30))
  );
  return `${months} mo`;
}

function formatDeadline(date: Date | null) {
  if (!date) return { label: "—", variant: "outline" as const };
  const diff = Math.ceil(
    (+new Date(date) - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return { label: "Closed", variant: "outline" as const };
  if (diff === 0) return { label: "Today", variant: "destructive" as const };
  if (diff === 1) return { label: "1d left", variant: "destructive" as const };
  if (diff < 7)
    return { label: `${diff}d left`, variant: "destructive" as const };
  if (diff < 30) return { label: `${diff}d left`, variant: "secondary" as const };
  return {
    label: new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
    variant: "outline" as const,
  };
}

function formatPrice(price: string | null) {
  if (!price) return "Unpaid";
  const n = Number(price);
  if (isNaN(n) || n === 0) return "Unpaid";
  return `₹${n.toLocaleString("en-IN")}`;
}

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function HeroSection() {
  const { data: session, isPending: sessionLoading } = useSession();
  const isLoggedIn = !!session?.user;

  const [data, setData] = useState<InternshipListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InternshipListItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;

    let mounted = true;
    setLoading(true);

    getInternships().then((res) => {
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [sessionLoading, session?.user?.id]);

  const openDrawer = (intern: InternshipListItem) => {
    setSelected(intern);
    setDrawerOpen(true);
  };

  return (
    <section className="relative w-full min-h-[calc(100vh-5rem)] overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-32 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* ============ LEFT ============ */}
          <div className="order-2 lg:order-1 flex flex-col gap-8">

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <Badge variant="outline" className="mb-5 gap-1.5">
                <Sparkles className="w-3 h-3" />
                AI-MATCHED FOR YOU
              </Badge>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight">
                Discover internships that{" "}
                <span className="text-primary">match your skills</span>
              </h1>

              <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-md">
                Hand-picked opportunities from top companies, tailored to
                what you're actually good at.
              </p>
            </motion.div>

            {/* ========== TABLE CARD ========== */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Card className="overflow-hidden p-0">
                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b">
                  <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    AVAILABLE INTERNSHIPS
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {loading ? "..." : `${data.length} roles`}
                  </span>
                </div>

                {/* States */}
                {loading ? (
                  <CardContent className="p-5 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </CardContent>
                ) : data.length === 0 ? (
                  <CardContent className="flex flex-col items-center justify-center py-14 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                      <Inbox className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">
                      No internships available right now
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      New opportunities drop every week. Check back soon —
                      your next role might be just around the corner.
                    </p>
                  </CardContent>
                ) : (
                  <div className="max-h-[340px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-md">
                        <TableRow>
                          <TableHead>Role</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            Duration
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Price
                          </TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.map((intern, i) => (
                          <InternshipRow
                            key={intern.id}
                            internship={intern}
                            index={i}
                            onClick={() => openDrawer(intern)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* ============ RIGHT — Girl ============ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.9,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.2,
            }}
            className="order-1 lg:order-2 relative flex items-center justify-center"
          >
            {/* Glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[70%] h-[70%] bg-primary/25 rounded-full blur-[100px]" />
            </div>

            {/* Floating image */}
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full max-w-[420px] aspect-[4/5]"
            >
              <Image
                src="/images/hero-girl.png"
                alt="Student exploring internships"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain drop-shadow-2xl"
              />
            </motion.div>

            {/* Badge — top left */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="absolute top-8 left-2 md:left-6 px-3 py-2 rounded-xl bg-background/70 backdrop-blur-md border text-xs font-medium flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {loading ? "..." : `${data.length} live roles`}
            </motion.div>

            {/* Badge — bottom right */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="absolute bottom-10 right-2 md:right-6 px-3 py-2 rounded-xl bg-background/70 backdrop-blur-md border text-xs font-medium"
            >
              🎯 92% match rate
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ============ APPLY DRAWER ============ */}
      <ApplyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        internship={
          selected
            ? {
                id: selected.id,
                name: selected.name,
                demandName: selected.demandName,
                demandIconUrl: selected.demandIconUrl,
                description: selected.description,
                startDate: selected.startDate,
                endDate: selected.endDate,
                lastSubmissionDate: selected.lastSubmissionDate,
                sellingPrice: selected.sellingPrice,
                price: selected.price,
              }
            : null
        }
        isLoggedIn={isLoggedIn}
      />
    </section>
  );
}

// =====================================================
// ROW COMPONENT
// =====================================================
function InternshipRow({
  internship,
  index,
  onClick,
}: {
  internship: InternshipListItem;
  index: number;
  onClick: () => void;
}) {
  const dl = formatDeadline(internship.lastSubmissionDate);

  const hasDiscount =
    internship.price &&
    internship.sellingPrice &&
    Number(internship.price) > Number(internship.sellingPrice);

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.1 + index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={onClick}
      className="cursor-pointer group"
    >
      {/* Role */}
      <TableCell>
        <div className="flex items-center gap-3">
          {internship.demandIconUrl ? (
            <div className="relative w-9 h-9 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
              <Image
                src={internship.demandIconUrl}
                alt={internship.demandName ?? ""}
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {internship.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate max-w-[180px] md:max-w-[220px]">
              {internship.name}
            </span>
            {internship.demandName && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[180px] md:max-w-[220px]">
                {internship.demandName}
              </span>
            )}
          </div>
        </div>
      </TableCell>

      {/* Duration */}
      <TableCell className="hidden sm:table-cell">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDuration(internship.startDate, internship.endDate)}
        </span>
      </TableCell>

      {/* Price with discount */}
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-2 whitespace-nowrap">
          {internship.sellingPrice &&
          Number(internship.sellingPrice) > 0 ? (
            <>
              <span className="text-xs font-bold text-emerald-500">
                {formatPrice(internship.sellingPrice)}
              </span>
              {hasDiscount && (
                <span className="text-[11px] text-muted-foreground line-through">
                  {formatPrice(internship.price)}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Unpaid</span>
          )}
        </div>
      </TableCell>

      {/* Deadline */}
      <TableCell>
        <Badge
          variant={dl.variant}
          className="whitespace-nowrap text-[10px]"
        >
          {dl.label}
        </Badge>
      </TableCell>

      {/* Status / Arrow */}
      <TableCell className="text-right">
        {internship.isRegistered ? (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] whitespace-nowrap"
          >
            Applied
          </Badge>
        ) : (
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary inline-block transition-colors" />
        )}
      </TableCell>
    </motion.tr>
  );
}